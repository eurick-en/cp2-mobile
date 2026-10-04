import {
  Platform,
} from 'react-native';

import * as Notifications
  from 'expo-notifications';

import Constants
  from 'expo-constants';

import * as Crypto
  from 'expo-crypto';

import {
  doc,
  setDoc,
} from 'firebase/firestore';

import {
  firestore,
} from '@/services/firebase';

import {
  DevicePlatform,
  PushRegistrationResult,
} from '@/types/notification';

Notifications.setNotificationHandler({
  handleNotification:
    async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

async function configureAndroidChannel():
  Promise<void> {
  if (
    Platform.OS !== 'android'
  ) {
    return;
  }

  await Notifications
    .setNotificationChannelAsync(
      'default',
      {
        name: 'Mensagens',

        importance:
          Notifications
            .AndroidImportance
            .MAX,

        vibrationPattern: [
          0,
          250,
          250,
          250,
        ],
      }
    );
}

function getProjectId():
  string | null {
  const expoProjectId =
    Constants
      .expoConfig
      ?.extra
      ?.eas
      ?.projectId;

  const easProjectId =
    Constants
      .easConfig
      ?.projectId;

  return (
    expoProjectId ??
    easProjectId ??
    null
  );
}

async function createDeviceId(
  token: string
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto
      .CryptoDigestAlgorithm
      .SHA256,
    token
  );
}

export async function registerDeviceForPush(
  userId: string
): Promise<PushRegistrationResult> {
  try {
    if (
      Platform.OS !== 'android' &&
      Platform.OS !== 'ios'
    ) {
      return {
        status:
          'unsupported-platform',
        token: null,
      };
    }

    await configureAndroidChannel();

    const currentPermission =
      await Notifications
        .getPermissionsAsync();

    let permissionStatus =
      currentPermission.status;

    if (
      permissionStatus !==
      'granted'
    ) {
      const permission =
        await Notifications
          .requestPermissionsAsync();

      permissionStatus =
        permission.status;
    }

    if (
      permissionStatus !==
      'granted'
    ) {
      return {
        status:
          'permission-denied',
        token: null,
      };
    }

    const projectId =
      getProjectId();

    if (!projectId) {
      console.warn(
        'EAS projectId não encontrado.'
      );

      return {
        status:
          'project-id-missing',
        token: null,
      };
    }

    const expoPushToken =
      await Notifications
        .getExpoPushTokenAsync({
          projectId,
        });

    const token =
      expoPushToken.data;

    const deviceId =
      await createDeviceId(
        token
      );

    const platform:
      DevicePlatform =
      Platform.OS ===
      'android'
        ? 'android'
        : 'ios';

    await setDoc(
      doc(
        firestore,
        'users',
        userId,
        'devices',
        deviceId
      ),
      {
        id: deviceId,
        token,
        platform,
        enabled: true,
        updatedAt:
          Date.now(),
      }
    );

    return {
      status:
        'registered',
      token,
    };
  } catch (error) {
    console.error(
      'Erro ao registrar dispositivo:',
      error
    );

    return {
      status:
        'error',
      token: null,
    };
  }
}

export function addNotificationReceivedListener(
  callback: (
    notification:
      Notifications.Notification
  ) => void
): Notifications.EventSubscription {
  return Notifications
    .addNotificationReceivedListener(
      callback
    );
}

export function addNotificationResponseListener(
  callback: (
    response:
      Notifications.NotificationResponse
  ) => void
): Notifications.EventSubscription {
  return Notifications
    .addNotificationResponseReceivedListener(
      callback
    );
}