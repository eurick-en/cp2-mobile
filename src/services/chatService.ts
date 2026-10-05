import {
  collection,
  doc,
  getDoc,
  getDocs,
  query as firestoreQuery,
  setDoc,
  where,
} from 'firebase/firestore';

import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  set,
} from 'firebase/database';

import {
  firestore,
  realtimeDatabase,
} from '@/services/firebase';

import {
  ChatMessage,
  DirectConversation,
  MessageTarget,
} from '@/types/chat';

import {
  createDirectConversationId,
} from '@/utils/conversationId';

import {
  getGroupById,
} from '@/services/groupService';

import {
  requestMessagePush,
} from '@/services/notificationApiService';

function isMessageTarget(
  value: unknown
): value is MessageTarget {
  if (
    typeof value !== 'object' ||
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
    target.type === 'member' &&
    typeof target.memberId ===
      'string'
  );
}

function isChatMessage(
  value: unknown
): value is ChatMessage {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  const validMentionedUsers =
    data.mentionedUserIds ===
      undefined ||
    data.mentionedUserIds ===
      null ||
    (
      Array.isArray(
        data.mentionedUserIds
      ) &&
      data.mentionedUserIds.every(
        (userId) =>
          typeof userId ===
          'string'
      )
    );

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
    typeof data.createdAt ===
      'number' &&
    isMessageTarget(
      data.target
    ) &&
    validMentionedUsers
  );
}

function isDirectConversation(
  value: unknown
): value is DirectConversation {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const data =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof data.id !==
      'string' ||
    data.type !== 'direct' ||
    typeof data.createdAt !==
      'number' ||
    !Array.isArray(
      data.participantIds
    )
  ) {
    return false;
  }

  if (
    data.participantIds
      .length !== 2
  ) {
    return false;
  }

  return (
    data.participantIds.every(
      (participantId) =>
        typeof participantId ===
        'string'
    )
  );
}

export async function getOrCreateDirectConversation(
  currentUserId: string,
  otherUserId: string
): Promise<DirectConversation> {
  if (
    currentUserId ===
    otherUserId
  ) {
    throw new Error(
      'Você não pode iniciar uma conversa consigo mesmo.'
    );
  }

  const conversationId =
    createDirectConversationId(
      currentUserId,
      otherUserId
    );

  const conversationReference =
    doc(
      firestore,
      'directConversations',
      conversationId
    );

  const existingConversation =
    await getDoc(
      conversationReference
    );

  if (
    existingConversation.exists()
  ) {
    const data: unknown =
      existingConversation.data();

    if (
      !isDirectConversation(
        data
      )
    ) {
      throw new Error(
        'Dados da conversa são inválidos.'
      );
    }

    return data;
  }

  const sortedParticipants = [
    currentUserId,
    otherUserId,
  ].sort();

  const participantIds:
    [string, string] = [
      sortedParticipants[0],
      sortedParticipants[1],
    ];

  const conversation:
    DirectConversation = {
      id: conversationId,
      type: 'direct',
      participantIds,
      createdAt:
        Date.now(),
    };

  await setDoc(
    conversationReference,
    conversation
  );

  return conversation;
}

export async function getDirectConversation(
  conversationId: string
): Promise<
  DirectConversation | null
> {
  const conversationReference =
    doc(
      firestore,
      'directConversations',
      conversationId
    );

  const snapshot =
    await getDoc(
      conversationReference
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data: unknown =
    snapshot.data();

  if (
    !isDirectConversation(
      data
    )
  ) {
    throw new Error(
      'Dados da conversa são inválidos.'
    );
  }

  return data;
}

export async function getDirectConversationsForUser(
  userId: string
): Promise<
  DirectConversation[]
> {
  const conversationsReference =
    collection(
      firestore,
      'directConversations'
    );

  const conversationsQuery =
    firestoreQuery(
      conversationsReference,
      where(
        'participantIds',
        'array-contains',
        userId
      )
    );

  const snapshot =
    await getDocs(
      conversationsQuery
    );

  const conversations:
    DirectConversation[] = [];

  snapshot.forEach(
    (
      documentSnapshot
    ) => {
      const data: unknown =
        documentSnapshot.data();

      if (
        isDirectConversation(
          data
        )
      ) {
        conversations.push(
          data
        );
      }
    }
  );

  conversations.sort(
    (
      first,
      second
    ) =>
      second.createdAt -
      first.createdAt
  );

  return conversations;
}

async function persistMessage(
  message: ChatMessage
): Promise<ChatMessage> {
  const conversationMessagesReference =
    ref(
      realtimeDatabase,
      `messages/${message.conversationId}`
    );

  const newMessageReference =
    push(
      conversationMessagesReference
    );

  if (
    !newMessageReference.key
  ) {
    throw new Error(
      'Não foi possível gerar o identificador da mensagem.'
    );
  }

  const completeMessage:
    ChatMessage = {
      ...message,
      id:
        newMessageReference.key,
    };

  await set(
    newMessageReference,
    completeMessage
  );

  return completeMessage;
}

async function persistMessageAndRequestPush(
  message: ChatMessage
): Promise<ChatMessage> {
  const persistedMessage =
    await persistMessage(
      message
    );

  try {
    await requestMessagePush(
      persistedMessage
        .conversationId,
      persistedMessage.id
    );

    console.log(
      '✅ Solicitação de push enviada para a API.'
    );
  } catch (error) {
    console.error(
      '⚠️ A mensagem foi salva, mas houve falha ao solicitar o push:',
      error
    );
  }

  return persistedMessage;
}

export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  text: string
): Promise<ChatMessage> {
  const normalizedText =
    text.trim();

  if (!normalizedText) {
    throw new Error(
      'A mensagem não pode estar vazia.'
    );
  }

  if (
    normalizedText.length >
    2000
  ) {
    throw new Error(
      'A mensagem não pode ultrapassar 2000 caracteres.'
    );
  }

  const conversation =
    await getDirectConversation(
      conversationId
    );

  if (!conversation) {
    throw new Error(
      'Conversa não encontrada.'
    );
  }

  if (
    !conversation
      .participantIds
      .includes(
        senderId
      )
  ) {
    throw new Error(
      'Você não participa desta conversa.'
    );
  }

  return (
    persistMessageAndRequestPush(
      {
        id: '',
        conversationId,
        conversationType:
          'direct',
        senderId,
        text:
          normalizedText,
        target: {
          type:
            'conversation',
        },
        mentionedUserIds:
          [],
        createdAt:
          Date.now(),
      }
    )
  );
}

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  text: string,
  targetMemberId?:
    string | null
): Promise<ChatMessage> {
  const normalizedText =
    text.trim();

  if (!normalizedText) {
    throw new Error(
      'A mensagem não pode estar vazia.'
    );
  }

  if (
    normalizedText.length >
    2000
  ) {
    throw new Error(
      'A mensagem não pode ultrapassar 2000 caracteres.'
    );
  }

  const group =
    await getGroupById(
      groupId
    );

  if (!group) {
    throw new Error(
      'Grupo não encontrado.'
    );
  }

  if (
    !group.memberIds.includes(
      senderId
    )
  ) {
    throw new Error(
      'Você não participa deste grupo.'
    );
  }

  let target:
    MessageTarget = {
      type:
        'conversation',
    };

  let mentionedUserIds:
    string[] = [];

  if (targetMemberId) {
    if (
      targetMemberId ===
      senderId
    ) {
      throw new Error(
        'Você não pode direcionar uma mensagem para si mesmo.'
      );
    }

    if (
      !group.memberIds
        .includes(
          targetMemberId
        )
    ) {
      throw new Error(
        'O destinatário não pertence ao grupo.'
      );
    }

    target = {
      type: 'member',
      memberId:
        targetMemberId,
    };

    mentionedUserIds = [
      targetMemberId,
    ];
  }

  return (
    persistMessageAndRequestPush(
      {
        id: '',
        conversationId:
          groupId,
        conversationType:
          'group',
        senderId,
        text:
          normalizedText,
        target,
        mentionedUserIds,
        createdAt:
          Date.now(),
      }
    )
  );
}

export async function getLastMessage(
  conversationId: string
): Promise<
  ChatMessage | null
> {
  const messagesReference =
    query(
      ref(
        realtimeDatabase,
        `messages/${conversationId}`
      ),
      orderByChild(
        'createdAt'
      ),
      limitToLast(1)
    );

  const snapshot =
    await get(
      messagesReference
    );

  if (!snapshot.exists()) {
    return null;
  }

  let lastMessage:
    ChatMessage | null =
      null;

  snapshot.forEach(
    (
      childSnapshot
    ) => {
      const value: unknown =
        childSnapshot.val();

      if (
        isChatMessage(
          value
        )
      ) {
        lastMessage = {
          ...value,
          mentionedUserIds:
            Array.isArray(
              value
                .mentionedUserIds
            )
              ? value
                  .mentionedUserIds
              : [],
        };
      }
    }
  );

  return lastMessage;
}

export function subscribeToMessages(
  conversationId: string,
  onMessages: (
    messages:
      ChatMessage[]
  ) => void,
  onError: (
    error: Error
  ) => void
): () => void {
  const messagesReference =
    query(
      ref(
        realtimeDatabase,
        `messages/${conversationId}`
      ),
      orderByChild(
        'createdAt'
      )
    );

  const unsubscribe =
    onValue(
      messagesReference,
      (snapshot) => {
        const messages:
          ChatMessage[] = [];

        snapshot.forEach(
          (
            childSnapshot
          ) => {
            const value:
              unknown =
                childSnapshot
                  .val();

            if (
              isChatMessage(
                value
              )
            ) {
              messages.push({
                ...value,
                mentionedUserIds:
                  Array.isArray(
                    value
                      .mentionedUserIds
                  )
                    ? value
                        .mentionedUserIds
                    : [],
              });
            }
          }
        );

        messages.sort(
          (
            first,
            second
          ) =>
            first.createdAt -
            second.createdAt
        );

        onMessages(
          messages
        );
      },
      (error) => {
        onError(error);
      }
    );

  return unsubscribe;
}