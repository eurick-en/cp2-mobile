import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  getGroupById,
} from '@/services/groupService';

import {
  sendGroupMessage,
  subscribeToMessages,
} from '@/services/chatService';

import {
  getUserById,
} from '@/services/userService';

import {
  ChatGroup,
} from '@/types/group';

import {
  ChatMessage,
} from '@/types/chat';

import {
  ChatUser,
} from '@/types/user';

export default function GroupScreen() {
  const {
    firebaseUser,
    loading: authLoading,
  } = useAuth();

  const {
    groupId,
  } = useLocalSearchParams<{
    groupId: string;
  }>();

  const [
    group,
    setGroup,
  ] =
    useState<ChatGroup | null>(
      null
    );

  const [
    members,
    setMembers,
  ] = useState<
    Record<string, ChatUser>
  >({});

  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>(
      []
    );

  const [
    messageText,
    setMessageText,
  ] = useState('');

  const [
    targetMemberId,
    setTargetMemberId,
  ] = useState<
    string | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    groupReady,
    setGroupReady,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<
    string | null
  >(null);

  const listReference =
    useRef<
      FlatList<ChatMessage>
    >(null);

  const memberList =
    useMemo(() => {
      if (!group) {
        return [];
      }

      return group.memberIds
        .map(
          (memberId) =>
            members[
              memberId
            ]
        )
        .filter(
          (
            member
          ): member is ChatUser =>
            member !==
            undefined
        );
    }, [
      group,
      members,
    ]);

  const selectableMembers =
    useMemo(
      () =>
        memberList.filter(
          (member) =>
            member.uid !==
            firebaseUser?.uid
        ),
      [
        memberList,
        firebaseUser,
      ]
    );

  const selectedTarget =
    targetMemberId
      ? members[
          targetMemberId
        ]
      : null;

  const loadGroup =
    useCallback(async () => {
      if (authLoading) {
        return;
      }

      if (
        !firebaseUser ||
        !groupId
      ) {
        setLoading(false);
        setGroupReady(false);

        setErrorMessage(
          'Grupo inválido.'
        );

        return;
      }

      try {
        setLoading(true);
        setGroupReady(false);
        setErrorMessage(null);

        const loadedGroup =
          await getGroupById(
            groupId
          );

        if (!loadedGroup) {
          throw new Error(
            'Grupo não encontrado.'
          );
        }

        const isMember =
          loadedGroup.memberIds.includes(
            firebaseUser.uid
          );

        if (!isMember) {
          throw new Error(
            'Você não participa deste grupo.'
          );
        }

        const loadedMembers =
          await Promise.all(
            loadedGroup.memberIds.map(
              (memberId) =>
                getUserById(
                  memberId
                )
            )
          );

        const memberMap:
          Record<
            string,
            ChatUser
          > = {};

        loadedMembers.forEach(
          (member) => {
            if (member) {
              memberMap[
                member.uid
              ] =
                member;
            }
          }
        );

        setGroup(
          loadedGroup
        );

        setMembers(
          memberMap
        );

        setGroupReady(
          true
        );

        setTargetMemberId(
          (currentTarget) => {
            if (
              currentTarget &&
              !loadedGroup.memberIds.includes(
                currentTarget
              )
            ) {
              return null;
            }

            return currentTarget;
          }
        );
      } catch (error) {
        console.error(
          'Erro ao carregar grupo:',
          error
        );

        setGroupReady(
          false
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o grupo.'
        );
      } finally {
        setLoading(false);
      }
    }, [
      authLoading,
      firebaseUser,
      groupId,
    ]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    if (
      authLoading ||
      !firebaseUser ||
      !groupId ||
      !groupReady
    ) {
      return;
    }

    const unsubscribe =
      subscribeToMessages(
        groupId,
        (
          newMessages
        ) => {
          const groupMessages =
            newMessages.filter(
              (message) =>
                message
                  .conversationType ===
                'group'
            );

          setMessages(
            groupMessages
          );

          setTimeout(() => {
            listReference.current
              ?.scrollToEnd({
                animated: true,
              });
          }, 50);
        },
        (error) => {
          console.error(
            'Erro no listener do grupo:',
            error
          );

          Alert.alert(
            'Erro',
            'Não foi possível atualizar as mensagens do grupo.'
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    authLoading,
    firebaseUser,
    groupId,
    groupReady,
  ]);

  const handleOpenGroupInfo =
    useCallback(() => {
      if (!groupId) {
        return;
      }

      router.push({
        pathname:
          '/(app)/group-info/[groupId]',
        params: {
          groupId,
        },
      });
    }, [groupId]);

  const handleSendMessage =
    useCallback(async () => {
      if (
        !firebaseUser ||
        !groupId ||
        !groupReady ||
        sending
      ) {
        return;
      }

      const normalizedText =
        messageText.trim();

      if (!normalizedText) {
        return;
      }

      try {
        setSending(true);

        await sendGroupMessage(
          groupId,
          firebaseUser.uid,
          normalizedText,
          targetMemberId
        );

        setMessageText('');

        setTargetMemberId(
          null
        );
      } catch (error) {
        console.error(
          'Erro ao enviar mensagem para o grupo:',
          error
        );

        Alert.alert(
          'Erro no envio',
          error instanceof Error
            ? error.message
            : 'Não foi possível enviar a mensagem.'
        );
      } finally {
        setSending(false);
      }
    }, [
      firebaseUser,
      groupId,
      groupReady,
      sending,
      messageText,
      targetMemberId,
    ]);

  const renderMessage =
    useCallback(
      ({
        item,
      }: {
        item: ChatMessage;
      }) => {
        const isMine =
          item.senderId ===
          firebaseUser?.uid;

        const author =
          members[
            item.senderId
          ];

        const authorName =
          isMine
            ? 'Você'
            : author?.name ??
              'Usuário';

        const targetName =
          item.target.type ===
          'member'
            ? members[
                item.target
                  .memberId
              ]?.name ??
              'Integrante'
            : null;

        return (
          <View
            style={[
              styles.messageRow,
              isMine
                ? styles.myMessageRow
                : styles.otherMessageRow,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                isMine
                  ? styles.myMessageBubble
                  : styles.otherMessageBubble,
              ]}
            >
              <Text
                style={[
                  styles.authorName,
                  isMine &&
                    styles.myAuthorName,
                ]}
              >
                {authorName}
              </Text>

              {targetName && (
                <Text
                  style={[
                    styles.targetLabel,
                    isMine &&
                      styles.myTargetLabel,
                  ]}
                >
                  → Para{' '}
                  {targetName}
                </Text>
              )}

              <Text
                style={[
                  styles.messageText,
                  isMine
                    ? styles.myMessageText
                    : styles.otherMessageText,
                ]}
              >
                {item.text}
              </Text>

              <Text
                style={[
                  styles.messageTime,
                  isMine
                    ? styles.myTime
                    : styles.otherTime,
                ]}
              >
                {new Date(
                  item.createdAt
                ).toLocaleTimeString(
                  'pt-BR',
                  {
                    hour:
                      '2-digit',
                    minute:
                      '2-digit',
                  }
                )}
              </Text>
            </View>
          </View>
        );
      },
      [
        firebaseUser,
        members,
      ]
    );

  if (
    authLoading ||
    loading
  ) {
    return (
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
          Carregando grupo...
        </Text>
      </View>
    );
  }

  if (
    errorMessage ||
    !group ||
    !firebaseUser
  ) {
    return (
      <View
        style={
          styles.centerContainer
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Ops!
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {errorMessage ??
            'Grupo indisponível.'}
        </Text>

        <Pressable
          style={
            styles.errorButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.errorButtonText
            }
          >
            Voltar
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
      }
    >
      <View
        style={styles.header}
      >
        <Pressable
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ‹
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.groupHeaderButton
          }
          onPress={
            handleOpenGroupInfo
          }
        >
          {group.photoUrl ? (
            <Image
              source={{
                uri:
                  group.photoUrl,
              }}
              style={
                styles.groupImage
              }
            />
          ) : (
            <View
              style={
                styles.groupPlaceholder
              }
            >
              <Text
                style={
                  styles.groupPlaceholderText
                }
              >
                👥
              </Text>
            </View>
          )}

          <View
            style={
              styles.headerTexts
            }
          >
            <Text
              style={
                styles.groupName
              }
              numberOfLines={1}
            >
              {group.name}
            </Text>

            <Text
              style={
                styles.groupSubtitle
              }
            >
              {group.memberIds.length}
              {' / '}
              {group.memberLimit}
              {' integrantes • toque para ver'}
            </Text>
          </View>

          <Text
            style={
              styles.infoArrow
            }
          >
            ›
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listReference}
        data={messages}
        keyExtractor={(
          item
        ) => item.id}
        renderItem={
          renderMessage
        }
        style={
          styles.messagesList
        }
        contentContainerStyle={
          messages.length ===
          0
            ? styles.emptyMessages
            : styles.messagesContent
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
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
              👥
            </Text>

            <Text
              style={
                styles.emptyTitle
              }
            >
              Nenhuma mensagem
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Envie a primeira
              mensagem para o grupo.
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          if (
            messages.length >
            0
          ) {
            listReference.current
              ?.scrollToEnd({
                animated: true,
              });
          }
        }}
      />

      <View
        style={
          styles.composerArea
        }
      >
        <Text
          style={
            styles.sendToLabel
          }
        >
          Enviar para:
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.targetList
          }
        >
          <Pressable
            style={[
              styles.targetChip,
              targetMemberId ===
                null &&
                styles.targetChipSelected,
            ]}
            onPress={() =>
              setTargetMemberId(
                null
              )
            }
          >
            <Text
              style={[
                styles.targetChipText,
                targetMemberId ===
                  null &&
                  styles.targetChipTextSelected,
              ]}
            >
              Todos
            </Text>
          </Pressable>

          {selectableMembers.map(
            (member) => {
              const selected =
                targetMemberId ===
                member.uid;

              return (
                <Pressable
                  key={
                    member.uid
                  }
                  style={[
                    styles.targetChip,
                    selected &&
                      styles.targetChipSelected,
                  ]}
                  onPress={() =>
                    setTargetMemberId(
                      member.uid
                    )
                  }
                >
                  <Text
                    style={[
                      styles.targetChipText,
                      selected &&
                        styles.targetChipTextSelected,
                    ]}
                    numberOfLines={
                      1
                    }
                  >
                    {member.name}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {selectedTarget && (
          <View
            style={
              styles.targetNotice
            }
          >
            <Text
              style={
                styles.targetNoticeText
              }
            >
              Mensagem direcionada
              para{' '}
              {
                selectedTarget.name
              }
            </Text>

            <Pressable
              onPress={() =>
                setTargetMemberId(
                  null
                )
              }
            >
              <Text
                style={
                  styles.targetClear
                }
              >
                Remover
              </Text>
            </Pressable>
          </View>
        )}

        <View
          style={
            styles.inputContainer
          }
        >
          <TextInput
            style={
              styles.input
            }
            value={
              messageText
            }
            onChangeText={
              setMessageText
            }
            placeholder={
              selectedTarget
                ? `Mensagem para ${selectedTarget.name}...`
                : 'Mensagem para o grupo...'
            }
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={
              2000
            }
            editable={
              !sending
            }
          />

          <Pressable
            style={[
              styles.sendButton,
              (
                !messageText.trim() ||
                sending
              ) &&
                styles.sendButtonDisabled,
            ]}
            onPress={
              handleSendMessage
            }
            disabled={
              !messageText.trim() ||
              sending
            }
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.sendText
                }
              >
                ➤
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F5F7FB',
    },

    centerContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      padding: 30,
      backgroundColor:
        '#F5F7FB',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: '#6B7280',
    },

    errorTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: '#111827',
    },

    errorText: {
      marginTop: 10,
      color: '#6B7280',
      textAlign: 'center',
    },

    errorButton: {
      marginTop: 24,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor:
        '#111827',
    },

    errorButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    header: {
      paddingTop: 54,
      paddingHorizontal: 16,
      paddingBottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E5E7EB',
    },

    backButton: {
      width: 42,
      height: 42,
      justifyContent:
        'center',
      alignItems: 'center',
      marginRight: 4,
    },

    backText: {
      fontSize: 38,
      lineHeight: 40,
      color: '#111827',
    },

    groupHeaderButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
    },

    groupImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },

    groupPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    groupPlaceholderText: {
      fontSize: 20,
    },

    headerTexts: {
      flex: 1,
      marginLeft: 12,
    },

    groupName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
    },

    groupSubtitle: {
      marginTop: 3,
      fontSize: 12,
      color: '#6B7280',
    },

    infoArrow: {
      marginLeft: 8,
      fontSize: 30,
      color: '#9CA3AF',
    },

    messagesList: {
      flex: 1,
    },

    messagesContent: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 18,
    },

    emptyMessages: {
      flexGrow: 1,
    },

    emptyContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },

    emptyIcon: {
      fontSize: 54,
    },

    emptyTitle: {
      marginTop: 16,
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
    },

    emptyDescription: {
      marginTop: 8,
      fontSize: 15,
      color: '#6B7280',
      textAlign: 'center',
    },

    messageRow: {
      width: '100%',
      marginBottom: 10,
    },

    myMessageRow: {
      alignItems:
        'flex-end',
    },

    otherMessageRow: {
      alignItems:
        'flex-start',
    },

    messageBubble: {
      maxWidth: '80%',
      paddingHorizontal: 14,
      paddingTop: 9,
      paddingBottom: 7,
      borderRadius: 18,
    },

    myMessageBubble: {
      backgroundColor:
        '#111827',
      borderBottomRightRadius:
        5,
    },

    otherMessageBubble: {
      backgroundColor:
        '#FFFFFF',
      borderBottomLeftRadius:
        5,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    authorName: {
      marginBottom: 4,
      fontSize: 12,
      fontWeight: '700',
      color: '#4B5563',
    },

    myAuthorName: {
      color: '#D1D5DB',
    },

    targetLabel: {
      marginBottom: 5,
      fontSize: 11,
      fontWeight: '700',
      color: '#6B7280',
    },

    myTargetLabel: {
      color: '#D1D5DB',
    },

    messageText: {
      fontSize: 16,
      lineHeight: 21,
    },

    myMessageText: {
      color: '#FFFFFF',
    },

    otherMessageText: {
      color: '#111827',
    },

    messageTime: {
      marginTop: 4,
      fontSize: 10,
      alignSelf:
        'flex-end',
    },

    myTime: {
      color: '#D1D5DB',
    },

    otherTime: {
      color: '#9CA3AF',
    },

    composerArea: {
      backgroundColor:
        '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor:
        '#E5E7EB',
      paddingTop: 9,
    },

    sendToLabel: {
      paddingHorizontal: 14,
      marginBottom: 7,
      fontSize: 11,
      fontWeight: '700',
      color: '#6B7280',
      textTransform:
        'uppercase',
    },

    targetList: {
      paddingHorizontal: 12,
      paddingBottom: 9,
      gap: 8,
    },

    targetChip: {
      maxWidth: 160,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#D1D5DB',
      backgroundColor:
        '#FFFFFF',
    },

    targetChipSelected: {
      backgroundColor:
        '#111827',
      borderColor:
        '#111827',
    },

    targetChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#374151',
    },

    targetChipTextSelected: {
      color: '#FFFFFF',
    },

    targetNotice: {
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor:
        '#F3F4F6',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    targetNoticeText: {
      flex: 1,
      fontSize: 12,
      color: '#374151',
    },

    targetClear: {
      marginLeft: 10,
      fontSize: 12,
      fontWeight: '700',
      color: '#111827',
    },

    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom:
        Platform.OS === 'ios'
          ? 28
          : 12,
    },

    input: {
      flex: 1,
      maxHeight: 120,
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 23,
      backgroundColor:
        '#F3F4F6',
      color: '#111827',
      fontSize: 16,
    },

    sendButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      marginLeft: 8,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#111827',
    },

    sendButtonDisabled: {
      opacity: 0.4,
    },

    sendText: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
    },
  });