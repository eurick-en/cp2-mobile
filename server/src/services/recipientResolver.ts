import {
  adminFirestore,
  adminRealtime,
} from './firebaseAdmin';

import {
  ChatMessage,
  NotificationPolicy,
  ResolvedNotification,
} from '../types';

function isStringArray(
  value: unknown
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item ===
        'string'
    )
  );
}

function isMessageTarget(
  value: unknown
): value is ChatMessage['target'] {
  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    return false;
  }

  const target =
    value as Record<
      string,
      unknown
    >;

  if (
    target.type ===
    'conversation'
  ) {
    return true;
  }

  return (
    target.type ===
      'member' &&
    typeof target.memberId ===
      'string'
  );
}

function isChatMessage(
  value: unknown
): value is ChatMessage {
  if (
    typeof value !==
      'object' ||
    value === null
  ) {
    return false;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  return (
    typeof data.id ===
      'string' &&
    typeof data.conversationId ===
      'string' &&
    (
      data.conversationType ===
        'direct' ||
      data.conversationType ===
        'group'
    ) &&
    typeof data.senderId ===
      'string' &&
    typeof data.text ===
      'string' &&
    isMessageTarget(
      data.target
    ) &&
    (
      data.mentionedUserIds ===
        undefined ||
      data.mentionedUserIds ===
        null ||
      isStringArray(
        data.mentionedUserIds
      )
    ) &&
    typeof data.createdAt ===
      'number'
  );
}

function isNotificationPolicy(
  value: unknown
): value is NotificationPolicy {
  return (
    value ===
      'all_group_messages' ||
    value ===
      'mentioned_members' ||
    value ===
      'direct_messages_only' ||
    value ===
      'disabled'
  );
}

function uniqueUserIds(
  userIds: string[]
): string[] {
  return Array.from(
    new Set(userIds)
  );
}

async function getSenderName(
  senderId: string
): Promise<string> {
  const snapshot =
    await adminFirestore
      .doc(
        `users/${senderId}`
      )
      .get();

  if (!snapshot.exists) {
    return 'Usuário';
  }

  const data =
    snapshot.data();

  return typeof data?.name ===
    'string'
    ? data.name
    : 'Usuário';
}

async function resolveDirectRecipients(
  message: ChatMessage,
  authenticatedUserId: string
): Promise<ResolvedNotification> {
  const snapshot =
    await adminFirestore
      .doc(
        `directConversations/${message.conversationId}`
      )
      .get();

  if (!snapshot.exists) {
    throw new Error(
      'Conversa individual não encontrada.'
    );
  }

  const data =
    snapshot.data();

  const participantIds:
    unknown =
    data?.participantIds;

  if (
    !isStringArray(
      participantIds
    ) ||
    participantIds.length !==
      2
  ) {
    throw new Error(
      'Participantes da conversa são inválidos.'
    );
  }

  if (
    !participantIds.includes(
      authenticatedUserId
    )
  ) {
    throw new Error(
      'Usuário não participa da conversa.'
    );
  }

  const recipients =
    participantIds.filter(
      (participantId) =>
        participantId !==
        message.senderId
    );

  const senderName =
    await getSenderName(
      message.senderId
    );

  return {
    message,
    recipientIds:
      uniqueUserIds(
        recipients
      ),
    title:
      `Nova mensagem de ${senderName}`,
    body:
      'Você recebeu uma nova mensagem.',
  };
}

async function resolveGroupRecipients(
  message: ChatMessage,
  authenticatedUserId: string
): Promise<ResolvedNotification> {
  const snapshot =
    await adminFirestore
      .doc(
        `groups/${message.conversationId}`
      )
      .get();

  if (!snapshot.exists) {
    throw new Error(
      'Grupo não encontrado.'
    );
  }

  const data =
    snapshot.data();

  const memberIds:
    unknown =
    data?.memberIds;

  const policy:
    unknown =
    data?.notificationPolicy;

  if (
    !isStringArray(
      memberIds
    )
  ) {
    throw new Error(
      'Lista de integrantes inválida.'
    );
  }

  if (
    !memberIds.includes(
      authenticatedUserId
    )
  ) {
    throw new Error(
      'Usuário não participa do grupo.'
    );
  }

  if (
    !isNotificationPolicy(
      policy
    )
  ) {
    throw new Error(
      'Política de notificações inválida.'
    );
  }

  let recipients:
    string[] = [];

  switch (policy) {
    case 'all_group_messages':
      recipients =
        memberIds.filter(
          (memberId) =>
            memberId !==
            message.senderId
        );
      break;

    case 'mentioned_members': {
      const mentioned =
        message
          .mentionedUserIds ??
        [];

      const targetMemberId =
        message.target.type ===
        'member'
          ? message.target
              .memberId
          : null;

      const candidates =
        targetMemberId
          ? [
              ...mentioned,
              targetMemberId,
            ]
          : mentioned;

      recipients =
        uniqueUserIds(
          candidates
        ).filter(
          (userId) =>
            userId !==
              message.senderId &&
            memberIds.includes(
              userId
            )
        );

      break;
    }

    case 'direct_messages_only':
      recipients = [];
      break;

    case 'disabled':
      recipients = [];
      break;
  }

  const senderName =
    await getSenderName(
      message.senderId
    );

  const groupName =
    typeof data?.name ===
      'string'
      ? data.name
      : 'Grupo';

  return {
    message,
    recipientIds:
      uniqueUserIds(
        recipients
      ),
    title:
      `${groupName} • ${senderName}`,
    body:
      'Você recebeu uma nova mensagem no grupo.',
  };
}

export async function resolveNotificationRecipients(
  conversationId: string,
  messageId: string,
  authenticatedUserId: string
): Promise<ResolvedNotification> {
  const snapshot =
    await adminRealtime
      .ref(
        `messages/${conversationId}/${messageId}`
      )
      .get();

  if (!snapshot.exists()) {
    throw new Error(
      'Mensagem não encontrada no Realtime Database.'
    );
  }

  const rawMessage:
    unknown =
    snapshot.val();

  if (
    !isChatMessage(
      rawMessage
    )
  ) {
    throw new Error(
      'Formato da mensagem inválido.'
    );
  }

  const message:
    ChatMessage = {
      ...rawMessage,
      mentionedUserIds:
        Array.isArray(
          rawMessage
            .mentionedUserIds
        )
          ? rawMessage
              .mentionedUserIds
          : [],
    };

  if (
    message.conversationId !==
    conversationId
  ) {
    throw new Error(
      'conversationId da mensagem é inválido.'
    );
  }

  if (
    message.id !==
    messageId
  ) {
    throw new Error(
      'messageId da mensagem é inválido.'
    );
  }

  if (
    message.senderId !==
    authenticatedUserId
  ) {
    throw new Error(
      'O usuário autenticado não é o remetente da mensagem.'
    );
  }

  if (
    message.conversationType ===
    'direct'
  ) {
    return resolveDirectRecipients(
      message,
      authenticatedUserId
    );
  }

  return resolveGroupRecipients(
    message,
    authenticatedUserId
  );
}