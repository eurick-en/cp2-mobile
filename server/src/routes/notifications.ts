import {
  Response,
  Router,
} from 'express';

import {
  adminFirestore,
} from '../services/firebaseAdmin';

import {
  resolveNotificationRecipients,
} from '../services/recipientResolver';

import {
  sendNotification,
} from '../services/notificationSender';

import {
  AuthenticatedRequest,
  authenticate,
} from '../middleware/authenticate';

const router =
  Router();

type NotificationRequestBody = {
  conversationId?: string;
  messageId?: string;
};

function getDispatchId(
  conversationId: string,
  messageId: string
): string {
  return `${conversationId}_${messageId}`;
}

async function claimDispatch(
  dispatchId: string
): Promise<boolean> {
  const reference =
    adminFirestore.doc(
      `notificationDispatches/${dispatchId}`
    );

  return adminFirestore
    .runTransaction(
      async (
        transaction
      ) => {
        const snapshot =
          await transaction.get(
            reference
          );

        if (
          snapshot.exists
        ) {
          const data =
            snapshot.data();

          if (
            data?.status ===
              'processing' ||
            data?.status ===
              'completed'
          ) {
            return false;
          }
        }

        transaction.set(
          reference,
          {
            status:
              'processing',
            startedAt:
              Date.now(),
          },
          {
            merge: true,
          }
        );

        return true;
      }
    );
}

async function completeDispatch(
  dispatchId: string,
  result: {
    recipients: number;
    devices: number;
    sent: number;
    disabled: number;
  }
): Promise<void> {
  await adminFirestore
    .doc(
      `notificationDispatches/${dispatchId}`
    )
    .set(
      {
        status:
          'completed',

        completedAt:
          Date.now(),

        result,
      },
      {
        merge: true,
      }
    );
}

async function failDispatch(
  dispatchId: string,
  error: unknown
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : 'Erro desconhecido';

  await adminFirestore
    .doc(
      `notificationDispatches/${dispatchId}`
    )
    .set(
      {
        status:
          'failed',

        failedAt:
          Date.now(),

        error: message,
      },
      {
        merge: true,
      }
    );
}

router.post(
  '/messages',
  authenticate,
  async (
    request:
      AuthenticatedRequest,
    response: Response
  ): Promise<void> => {
    const body =
      request.body as NotificationRequestBody;

    const conversationId =
      body.conversationId;

    const messageId =
      body.messageId;

    if (
      typeof conversationId !==
        'string' ||
      !conversationId.trim() ||
      typeof messageId !==
        'string' ||
      !messageId.trim()
    ) {
      response.status(
        400
      ).json({
        error:
          'conversationId e messageId são obrigatórios.',
      });

      return;
    }

    if (
      !request.firebaseUser
    ) {
      response.status(
        401
      ).json({
        error:
          'Usuário não autenticado.',
      });

      return;
    }

    const dispatchId =
      getDispatchId(
        conversationId,
        messageId
      );

    try {
      const claimed =
        await claimDispatch(
          dispatchId
        );

      if (!claimed) {
        response.status(
          200
        ).json({
          success: true,
          duplicate: true,
          message:
            'Notificação já processada ou em processamento.',
        });

        return;
      }

      const resolved =
        await resolveNotificationRecipients(
          conversationId,
          messageId,
          request
            .firebaseUser
            .uid
        );

      const result =
        await sendNotification(
          resolved
        );

      await completeDispatch(
        dispatchId,
        result
      );

      response.status(
        200
      ).json({
        success: true,
        duplicate: false,
        result,
      });
    } catch (error) {
      console.error(
        'Erro ao processar notificação:',
        error
      );

      await failDispatch(
        dispatchId,
        error
      );

      response.status(
        500
      ).json({
        error:
          error instanceof Error
            ? error.message
            : 'Erro interno ao processar notificação.',
      });
    }
  }
);

export default router;