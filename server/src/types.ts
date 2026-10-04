export type ConversationType =
  | 'direct'
  | 'group';

export type MessageTarget =
  | {
      type: 'conversation';
    }
  | {
      type: 'member';
      memberId: string;
    };

export type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType:
    ConversationType;
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds:
    string[];
  createdAt: number;
};

export type NotificationPolicy =
  | 'all_group_messages'
  | 'mentioned_members'
  | 'direct_messages_only'
  | 'disabled';

export type DeviceRecord = {
  path: string;
  userId: string;
  token: string;
  enabled: boolean;
};

export type ResolvedNotification = {
  message: ChatMessage;
  recipientIds: string[];
  title: string;
  body: string;
};