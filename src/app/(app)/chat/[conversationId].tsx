import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  useRef,
  useState,
} from 'react';

import {
  getDirectConversation,
  sendDirectMessage,
  subscribeToMessages,
} from '@/services/chatService';

import {
  getUserById,
} from '@/services/userService';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  ChatMessage,
} from '@/types/chat';

import {
  ChatUser,
} from '@/types/user';

export default function ChatScreen() {
  const {
    firebaseUser,
    loading: authLoading,
  } = useAuth();

  const {
    conversationId,
  } = useLocalSearchParams<{
    conversationId: string;
  }>();

  const [
    otherUser,
    setOtherUser,
  ] = useState<ChatUser | null>(
    null
  );

  const [
    messages,
    setMessages,
  ] = useState<ChatMessage[]>([]);

  const [
    messageText,
    setMessageText,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    conversationReady,
    setConversationReady,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const listReference =
    useRef<FlatList<ChatMessage>>(
      null
    );

  const loadConversation =
    useCallback(async () => {
      if (authLoading) {
        return;
      }

      if (!firebaseUser) {
        setConversationReady(false);
        setLoading(false);

        setErrorMessage(
          'Sua sessão não está disponível.'
        );

        return;
      }

      if (!conversationId) {
        setConversationReady(false);
        setLoading(false);

        setErrorMessage(
          'Conversa inválida.'
        );

        return;
      }

      try {
        setLoading(true);
        setConversationReady(false);
        setErrorMessage(null);

        const conversation =
          await getDirectConversation(
            conversationId
          );

        if (!conversation) {
          throw new Error(
            'Conversa não encontrada.'
          );
        }

        const isParticipant =
          conversation.participantIds.includes(
            firebaseUser.uid
          );

        if (!isParticipant) {
          throw new Error(
            'Você não participa desta conversa.'
          );
        }

        const otherUserId =
          conversation.participantIds.find(
            (participantId) =>
              participantId !==
              firebaseUser.uid
          );

        if (!otherUserId) {
          throw new Error(
            'Outro participante não encontrado.'
          );
        }

        const user =
          await getUserById(
            otherUserId
          );

        if (!user) {
          throw new Error(
            'Perfil do participante não encontrado.'
          );
        }

        setOtherUser(user);
        setConversationReady(true);
      } catch (error) {
        console.error(
          'Erro ao carregar conversa:',
          error
        );

        setConversationReady(false);

        setErrorMessage(
          'Não foi possível carregar esta conversa.'
        );
      } finally {
        setLoading(false);
      }
    }, [
      authLoading,
      firebaseUser,
      conversationId,
    ]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (
      authLoading ||
      !firebaseUser ||
      !conversationId ||
      !conversationReady
    ) {
      return;
    }

    const unsubscribe =
      subscribeToMessages(
        conversationId,
        (newMessages) => {
          setMessages(
            newMessages
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
            'Erro no listener de mensagens:',
            error
          );

          Alert.alert(
            'Erro',
            'Não foi possível atualizar as mensagens.'
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    authLoading,
    firebaseUser,
    conversationId,
    conversationReady,
  ]);

  const handleOpenProfile =
    useCallback(() => {
      if (!otherUser) {
        return;
      }

      router.push({
        pathname:
          '/(app)/profile/[userId]',
        params: {
          userId:
            otherUser.uid,
        },
      });
    }, [otherUser]);

  const handleSendMessage =
    useCallback(async () => {
      if (
        authLoading ||
        !firebaseUser ||
        !conversationId ||
        !conversationReady ||
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

        await sendDirectMessage(
          conversationId,
          firebaseUser.uid,
          normalizedText
        );

        setMessageText('');
      } catch (error) {
        console.error(
          'Erro ao enviar mensagem:',
          error
        );

        Alert.alert(
          'Erro no envio',
          'Não foi possível enviar a mensagem.'
        );
      } finally {
        setSending(false);
      }
    }, [
      authLoading,
      firebaseUser,
      conversationId,
      conversationReady,
      messageText,
      sending,
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
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
              </Text>
            </View>
          </View>
        );
      },
      [firebaseUser]
    );

  if (
    authLoading ||
    loading
  ) {
    return (
      <View
        style={
          styles.loadingContainer
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
          Carregando conversa...
        </Text>
      </View>
    );
  }

  if (
    errorMessage ||
    !otherUser ||
    !firebaseUser
  ) {
    return (
      <View
        style={
          styles.errorContainer
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
            'Conversa indisponível.'}
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
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <View
        style={styles.header}
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.backButton
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
          onPress={
            handleOpenProfile
          }
        >
          {otherUser.photoUrl ? (
            <Image
              source={{
                uri:
                  otherUser.photoUrl,
              }}
              style={
                styles.avatar
              }
            />
          ) : (
            <View
              style={
                styles.avatarPlaceholder
              }
            >
              <Text
                style={
                  styles.avatarLetter
                }
              >
                {otherUser.name
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={
            styles.headerTexts
          }
          onPress={
            handleOpenProfile
          }
        >
          <Text
            style={
              styles.headerName
            }
            numberOfLines={1}
          >
            {otherUser.name}
          </Text>

          <Text
            style={
              styles.headerStatus
            }
          >
            Toque para ver o perfil
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listReference}
        data={messages}
        keyExtractor={(item) =>
          item.id
        }
        renderItem={
          renderMessage
        }
        style={
          styles.messagesList
        }
        contentContainerStyle={
          messages.length === 0
            ? styles.emptyMessages
            : styles.messagesContent
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
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
              Nenhuma mensagem
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Envie a primeira
              mensagem para{' '}
              {otherUser.name}.
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          if (
            messages.length > 0
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
          styles.inputContainer
        }
      >
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={
            setMessageText
          }
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={2000}
          editable={!sending}
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

    loadingContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#F5F7FB',
    },

    loadingText: {
      marginTop: 12,
      fontSize: 15,
      color: '#6B7280',
    },

    errorContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      padding: 30,
      backgroundColor:
        '#F5F7FB',
    },

    errorTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: '#111827',
    },

    errorText: {
      marginTop: 10,
      fontSize: 15,
      color: '#6B7280',
      textAlign: 'center',
    },

    errorButton: {
      marginTop: 24,
      paddingHorizontal: 28,
      paddingVertical: 13,
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

    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        '#E5E7EB',
    },

    avatarPlaceholder: {
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent:
        'center',
      alignItems: 'center',
      backgroundColor:
        '#111827',
    },

    avatarLetter: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '700',
    },

    headerTexts: {
      flex: 1,
      marginLeft: 12,
    },

    headerName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
    },

    headerStatus: {
      marginTop: 2,
      fontSize: 12,
      color: '#6B7280',
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
      alignItems: 'flex-end',
    },

    otherMessageRow: {
      alignItems: 'flex-start',
    },

    messageBubble: {
      maxWidth: '80%',
      paddingHorizontal: 14,
      paddingTop: 10,
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
      alignSelf: 'flex-end',
    },

    myTime: {
      color: '#D1D5DB',
    },

    otherTime: {
      color: '#9CA3AF',
    },

    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom:
        Platform.OS === 'ios'
          ? 28
          : 12,
      backgroundColor:
        '#FFFFFF',
      borderTopWidth: 1,
      borderTopColor:
        '#E5E7EB',
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