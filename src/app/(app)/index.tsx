import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  getDirectConversationsForUser,
  getLastMessage,
} from '@/services/chatService';

import {
  getGroupsForUser,
} from '@/services/groupService';

import {
  getUserById,
} from '@/services/userService';

import {
  ChatMessage,
  DirectConversation,
} from '@/types/chat';

import {
  ChatGroup,
} from '@/types/group';

import {
  ChatUser,
} from '@/types/user';

type DirectListItem = {
  kind: 'direct';
  id: string;
  conversation: DirectConversation;
  otherUser: ChatUser;
  lastMessage: ChatMessage | null;
  createdAt: number;
};

type GroupListItem = {
  kind: 'group';
  id: string;
  group: ChatGroup;
  lastMessage: ChatMessage | null;
  createdAt: number;
};

type ConversationListItem =
  | DirectListItem
  | GroupListItem;

export default function HomeScreen() {
  const {
    firebaseUser,
    userProfile,
    logout,
  } = useAuth();

  const [
    conversations,
    setConversations,
  ] = useState<
    ConversationListItem[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const loadConversations =
    useCallback(async () => {
      if (!firebaseUser) {
        setConversations([]);
        setLoading(false);
        setRefreshing(false);

        return;
      }

      try {
        const [
          directConversations,
          groups,
        ] = await Promise.all([
          getDirectConversationsForUser(
            firebaseUser.uid
          ),

          getGroupsForUser(
            firebaseUser.uid
          ),
        ]);

        const directItems =
          await Promise.all(
            directConversations.map(
              async (
                conversation
              ): Promise<
                DirectListItem | null
              > => {
                const otherUserId =
                  conversation
                    .participantIds
                    .find(
                      (
                        participantId
                      ) =>
                        participantId !==
                        firebaseUser.uid
                    );

                if (!otherUserId) {
                  return null;
                }

                const [
                  otherUser,
                  lastMessage,
                ] =
                  await Promise.all([
                    getUserById(
                      otherUserId
                    ),

                    getLastMessage(
                      conversation.id
                    ),
                  ]);

                if (!otherUser) {
                  return null;
                }

                return {
                  kind: 'direct',
                  id:
                    conversation.id,
                  conversation,
                  otherUser,
                  lastMessage,
                  createdAt:
                    conversation
                      .createdAt,
                };
              }
            )
          );

        const groupItems =
          await Promise.all(
            groups.map(
              async (
                group
              ): Promise<GroupListItem> => {
                const lastMessage =
                  await getLastMessage(
                    group.id
                  );

                return {
                  kind: 'group',
                  id: group.id,
                  group,
                  lastMessage,
                  createdAt:
                    group.createdAt,
                };
              }
            )
          );

        const validDirectItems =
          directItems.filter(
            (
              item
            ): item is DirectListItem =>
              item !== null
          );

        const allItems:
          ConversationListItem[] = [
          ...validDirectItems,
          ...groupItems,
        ];

        allItems.sort(
          (first, second) => {
            const firstTime =
              first.lastMessage
                ?.createdAt ??
              first.createdAt;

            const secondTime =
              second.lastMessage
                ?.createdAt ??
              second.createdAt;

            return (
              secondTime -
              firstTime
            );
          }
        );

        setConversations(
          allItems
        );
      } catch (error) {
        console.error(
          'Erro ao carregar conversas:',
          error
        );

        Alert.alert(
          'Erro',
          'Não foi possível carregar suas conversas.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, [firebaseUser]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations])
  );

  const handleRefresh =
    useCallback(() => {
      setRefreshing(true);

      void loadConversations();
    }, [loadConversations]);

  const handleLogout =
    useCallback(async () => {
      try {
        await logout();

        router.replace(
          '/(auth)/login'
        );
      } catch (error) {
        console.error(
          'Erro ao sair:',
          error
        );

        Alert.alert(
          'Erro',
          'Não foi possível sair da conta.'
        );
      }
    }, [logout]);

  const handleNewConversation =
    useCallback(() => {
      router.push(
        '/(app)/users'
      );
    }, []);

  const handleNewGroup =
    useCallback(() => {
      router.push(
        '/(app)/group/new'
      );
    }, []);

  const handleOpenItem =
    useCallback(
      (
        item:
          ConversationListItem
      ) => {
        if (
          item.kind ===
          'direct'
        ) {
          router.push({
            pathname:
              '/(app)/chat/[conversationId]',
            params: {
              conversationId:
                item.id,
            },
          });

          return;
        }

        router.push({
          pathname:
            '/(app)/group/[groupId]',
          params: {
            groupId: item.id,
          },
        });
      },
      []
    );

  const formatMessageTime =
    useCallback(
      (
        timestamp:
          number | undefined
      ): string => {
        if (!timestamp) {
          return '';
        }

        const messageDate =
          new Date(timestamp);

        const now =
          new Date();

        const sameDay =
          messageDate.getDate() ===
            now.getDate() &&
          messageDate.getMonth() ===
            now.getMonth() &&
          messageDate.getFullYear() ===
            now.getFullYear();

        if (sameDay) {
          return messageDate
            .toLocaleTimeString(
              'pt-BR',
              {
                hour: '2-digit',
                minute:
                  '2-digit',
              }
            );
        }

        return messageDate
          .toLocaleDateString(
            'pt-BR',
            {
              day: '2-digit',
              month: '2-digit',
            }
          );
      },
      []
    );

  const displayName =
    userProfile?.name ??
    firebaseUser?.displayName ??
    firebaseUser?.email ??
    'Usuário';

  function renderConversation({
    item,
  }: {
    item:
      ConversationListItem;
  }) {
    if (
      item.kind ===
      'group'
    ) {
      const {
        group,
        lastMessage,
      } = item;

      return (
        <Pressable
          style={
            styles.conversationCard
          }
          onPress={() =>
            handleOpenItem(item)
          }
        >
          {group.photoUrl ? (
            <Image
              source={{
                uri:
                  group.photoUrl,
              }}
              style={
                styles.conversationAvatar
              }
            />
          ) : (
            <View
              style={
                styles.groupAvatarPlaceholder
              }
            >
              <Text
                style={
                  styles.groupAvatarText
                }
              >
                👥
              </Text>
            </View>
          )}

          <View
            style={
              styles.conversationInformation
            }
          >
            <View
              style={
                styles.conversationTopRow
              }
            >
              <View
                style={
                  styles.nameRow
                }
              >
                <Text
                  style={
                    styles.conversationName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {group.name}
                </Text>

                <View
                  style={
                    styles.groupBadge
                  }
                >
                  <Text
                    style={
                      styles.groupBadgeText
                    }
                  >
                    GRUPO
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.conversationTime
                }
              >
                {formatMessageTime(
                  lastMessage
                    ?.createdAt
                )}
              </Text>
            </View>

            <Text
              style={
                styles.lastMessage
              }
              numberOfLines={1}
            >
              {lastMessage
                ? lastMessage.text
                : `${
                    group
                      .memberIds
                      .length
                  }/${
                    group
                      .memberLimit
                  } integrantes`}
            </Text>
          </View>

          <Text
            style={
              styles.arrow
            }
          >
            ›
          </Text>
        </Pressable>
      );
    }

    const {
      otherUser,
      lastMessage,
    } = item;

    const isMyLastMessage =
      lastMessage?.senderId ===
      firebaseUser?.uid;

    return (
      <Pressable
        style={
          styles.conversationCard
        }
        onPress={() =>
          handleOpenItem(item)
        }
      >
        {otherUser.photoUrl ? (
          <Image
            source={{
              uri:
                otherUser.photoUrl,
            }}
            style={
              styles.conversationAvatar
            }
          />
        ) : (
          <View
            style={
              styles.conversationAvatarPlaceholder
            }
          >
            <Text
              style={
                styles.conversationAvatarText
              }
            >
              {otherUser.name
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
        )}

        <View
          style={
            styles.conversationInformation
          }
        >
          <View
            style={
              styles.conversationTopRow
            }
          >
            <View
              style={
                styles.nameRow
              }
            >
              <Text
                style={
                  styles.conversationName
                }
                numberOfLines={1}
              >
                {otherUser.name}
              </Text>

              <View
                style={
                  styles.directBadge
                }
              >
                <Text
                  style={
                    styles.directBadgeText
                  }
                >
                  INDIVIDUAL
                </Text>
              </View>
            </View>

            <Text
              style={
                styles.conversationTime
              }
            >
              {formatMessageTime(
                lastMessage
                  ?.createdAt
              )}
            </Text>
          </View>

          <Text
            style={
              styles.lastMessage
            }
            numberOfLines={1}
          >
            {lastMessage
              ? `${
                  isMyLastMessage
                    ? 'Você: '
                    : ''
                }${lastMessage.text}`
              : 'Conversa iniciada'}
          </Text>
        </View>

        <Text
          style={
            styles.arrow
          }
        >
          ›
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.header}
      >
        <View
          style={styles.userArea}
        >
          {userProfile?.photoUrl ? (
            <Image
              source={{
                uri:
                  userProfile.photoUrl,
              }}
              style={
                styles.profileImage
              }
            />
          ) : (
            <View
              style={
                styles.photoPlaceholder
              }
            >
              <Text
                style={
                  styles.photoPlaceholderText
                }
              >
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          )}

          <View
            style={
              styles.userTexts
            }
          >
            <Text
              style={
                styles.userName
              }
              numberOfLines={1}
            >
              {displayName}
            </Text>

            <Text
              style={
                styles.userEmail
              }
              numberOfLines={1}
            >
              {firebaseUser?.email}
            </Text>
          </View>
        </View>

        <Pressable
          style={
            styles.logoutButton
          }
          onPress={
            handleLogout
          }
        >
          <Text
            style={
              styles.logoutText
            }
          >
            Sair
          </Text>
        </Pressable>
      </View>

      <View
        style={styles.content}
      >
        <View
          style={
            styles.titleRow
          }
        >
          <Text
            style={
              styles.pageTitle
            }
          >
            Conversas
          </Text>

          <View
            style={
              styles.actions
            }
          >
            <Pressable
              style={
                styles.actionButton
              }
              onPress={
                handleNewConversation
              }
            >
              <Text
                style={
                  styles.actionIcon
                }
              >
                👤+
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.actionButton
              }
              onPress={
                handleNewGroup
              }
            >
              <Text
                style={
                  styles.actionIcon
                }
              >
                👥+
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={
            styles.actionLabels
          }
        >
          <Text
            style={
              styles.actionLabel
            }
          >
            👤+ Nova conversa
          </Text>

          <Text
            style={
              styles.actionLabel
            }
          >
            👥+ Novo grupo
          </Text>
        </View>

        {loading ? (
          <View
            style={
              styles.centerContainer
            }
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Carregando conversas...
            </Text>
          </View>
        ) : (
          <FlatList
            data={
              conversations
            }
            keyExtractor={(
              item
            ) =>
              `${item.kind}-${item.id}`
            }
            renderItem={
              renderConversation
            }
            showsVerticalScrollIndicator={
              false
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  refreshing
                }
                onRefresh={
                  handleRefresh
                }
              />
            }
            contentContainerStyle={
              conversations.length ===
              0
                ? styles.emptyList
                : styles.list
            }
            ListEmptyComponent={
              <View
                style={
                  styles.emptyContainer
                }
              >
                <Text
                  style={
                    styles.emptyIcon
                  }
                >
                  💬
                </Text>

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Nenhuma conversa
                  ainda
                </Text>

                <Text
                  style={
                    styles.emptyDescription
                  }
                >
                  Inicie uma conversa
                  individual ou crie
                  um novo grupo.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F5F7FB',
    },

    header: {
      paddingTop: 54,
      paddingHorizontal: 20,
      paddingBottom: 18,
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    userArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },

    profileImage: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },

    photoPlaceholder: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    photoPlaceholderText: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '700',
    },

    userTexts: {
      flex: 1,
      marginLeft: 12,
    },

    userName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
    },

    userEmail: {
      marginTop: 3,
      fontSize: 13,
      color: '#6B7280',
    },

    logoutButton: {
      marginLeft: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor:
        '#111827',
    },

    logoutText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 24,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    pageTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: '#111827',
    },

    actions: {
      flexDirection: 'row',
      gap: 10,
    },

    actionButton: {
      minWidth: 50,
      height: 48,
      paddingHorizontal: 10,
      borderRadius: 15,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    actionIcon: {
      fontSize: 19,
      color: '#FFFFFF',
    },

    actionLabels: {
      marginTop: 12,
      marginBottom: 20,
      flexDirection: 'row',
      gap: 18,
    },

    actionLabel: {
      fontSize: 12,
      color: '#6B7280',
    },

    list: {
      paddingBottom: 30,
    },

    conversationCard: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 13,
      marginBottom: 12,
      borderRadius: 16,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    conversationAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },

    conversationAvatarPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    conversationAvatarText: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '700',
    },

    groupAvatarPlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    groupAvatarText: {
      fontSize: 22,
    },

    conversationInformation: {
      flex: 1,
      marginLeft: 14,
    },

    conversationTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    nameRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },

    conversationName: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
    },

    directBadge: {
      marginLeft: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor:
        '#E5E7EB',
    },

    directBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#4B5563',
    },

    groupBadge: {
      marginLeft: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor:
        '#111827',
    },

    groupBadgeText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    conversationTime: {
      marginLeft: 10,
      fontSize: 12,
      color: '#9CA3AF',
    },

    lastMessage: {
      marginTop: 5,
      fontSize: 14,
      color: '#6B7280',
    },

    arrow: {
      marginLeft: 10,
      fontSize: 30,
      color: '#9CA3AF',
    },

    centerContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: '#6B7280',
    },

    emptyList: {
      flexGrow: 1,
    },

    emptyContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      paddingBottom: 80,
    },

    emptyIcon: {
      fontSize: 56,
    },

    emptyTitle: {
      marginTop: 18,
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
    },

    emptyDescription: {
      maxWidth: 290,
      marginTop: 8,
      fontSize: 15,
      lineHeight: 22,
      color: '#6B7280',
      textAlign: 'center',
    },
  });