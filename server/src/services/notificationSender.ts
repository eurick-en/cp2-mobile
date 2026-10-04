import {
  Expo,
  ExpoPushMessage,
  ExpoPushTicket,
} from 'expo-server-sdk';

import {
  adminFirestore,
} from './firebaseAdmin';

import {
  DeviceRecord,
  ResolvedNotification,
} from '../types';

const expo =
  new Expo();

async function getDevices(
  userIds: string[]
): Promise<DeviceRecord[]> {
  const deviceGroups =
    await Promise.all(
      userIds.map(
        async (
          userId
        ): Promise<
          DeviceRecord[]
        > => {
          const snapshot =
            await adminFirestore
              .collection(
                `users/${userId}/devices`
              )
              .where(
                'enabled',
                '==',
                true
              )
              .get();

          return snapshot.docs
            .map(
              (
                document
              ): DeviceRecord | null => {
                const data =
                  document.data();

                if (
                  typeof data.token !==
                  'string'
                ) {
                  return null;
                }

                return {
                  path:
                    document.ref.path,
                  userId,
                  token:
                    data.token,
                  enabled:
                    data.enabled ===
                    true,
                };
              }
            )
            .filter(
              (
                device
              ): device is DeviceRecord =>
                device !== null
            );
        }
      )
    );

  return deviceGroups.flat();
}

async function disableDevice(
  device:
    DeviceRecord
): Promise<void> {
  await adminFirestore
    .doc(device.path)
    .update({
      enabled: false,
      updatedAt:
        Date.now(),
    });
}

function isDeviceNotRegistered(
  ticket: ExpoPushTicket
): boolean {
  if (
    ticket.status !==
    'error'
  ) {
    return false;
  }

  return (
    ticket.details?.error ===
    'DeviceNotRegistered'
  );
}

export async function sendNotification(
  resolved:
    ResolvedNotification
): Promise<{
  recipients: number;
  devices: number;
  sent: number;
  disabled: number;
}> {
  if (
    resolved.recipientIds.length ===
    0
  ) {
    return {
      recipients: 0,
      devices: 0,
      sent: 0,
      disabled: 0,
    };
  }

  const devices =
    await getDevices(
      resolved.recipientIds
    );

  const validDevices:
    DeviceRecord[] = [];

  let disabled = 0;

  for (
    const device of
    devices
  ) {
    if (
      Expo.isExpoPushToken(
        device.token
      )
    ) {
      validDevices.push(
        device
      );
    } else {
      await disableDevice(
        device
      );

      disabled += 1;
    }
  }

  let sent = 0;

  const batchSize = 100;

  for (
    let index = 0;
    index <
    validDevices.length;
    index += batchSize
  ) {
    const deviceBatch =
      validDevices.slice(
        index,
        index +
          batchSize
      );

    const messages:
      ExpoPushMessage[] =
      deviceBatch.map(
        (device) => ({
          to:
            device.token,

          title:
            resolved.title,

          body:
            resolved.body,

          priority:
            'high',

          channelId:
            'default',

          data: {
            conversationId:
              resolved.message
                .conversationId,

            conversationType:
              resolved.message
                .conversationType,
          },
        })
      );

    const tickets =
      await expo
        .sendPushNotificationsAsync(
          messages
        );

    for (
      let ticketIndex = 0;
      ticketIndex <
      tickets.length;
      ticketIndex += 1
    ) {
      const ticket =
        tickets[
          ticketIndex
        ];

      const device =
        deviceBatch[
          ticketIndex
        ];

      if (
        ticket.status ===
        'ok'
      ) {
        sent += 1;
      }

      if (
        isDeviceNotRegistered(
          ticket
        )
      ) {
        await disableDevice(
          device
        );

        disabled += 1;
      }
    }
  }

  return {
    recipients:
      resolved.recipientIds
        .length,

    devices:
      devices.length,

    sent,

    disabled,
  };
}