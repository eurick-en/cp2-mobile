import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/contexts/AuthContext';

import {
  getUsersExcept,
} from '@/services/userService';

import {
  getOrCreateDirectConversation,
} from '@/services/chatService';

import { ChatUser } from '@/types/user';

export default function UsersScreen() {
  const { firebaseUser } = useAuth();

  const [users, setUsers] =
    useState<ChatUser[]>([]);

  const [search, setSearch] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [
    creatingConversationId,
    setCreatingConversationId,
  ] = useState<string | null>(
    null
  );

  const loadUsers =
    useCallback(async () => {
      if (!firebaseUser) {
        return;
      }

      try {
        setLoading(true);

        const loadedUsers =
          await getUsersExcept(
            firebaseUser.uid
          );

        setUsers(loadedUsers);
      } catch (error) {
        console.error(
          'Erro ao carregar usuários:',
          error
        );

        Alert.alert(
          'Erro',
          'Não foi possível carregar os usuários.'
        );
      } finally {
        setLoading(false);
      }
    }, [firebaseUser]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      if (!normalizedSearch) {
        return users;
      }

      return users.filter(
        (user) => {
          const name =
            user.name.toLowerCase();

          const email =
            user.email.toLowerCase();

          return (
            name.includes(
              normalizedSearch
            ) ||
            email.includes(
              normalizedSearch
            )
          );
        }
      );
    }, [search, users]);

  const handleUserPress =
    useCallback(
      async (user: ChatUser) => {
        if (!firebaseUser) {
          return;
        }

        try {
          setCreatingConversationId(
            user.uid
          );

          const conversation =
            await getOrCreateDirectConversation(
              firebaseUser.uid,
              user.uid
            );

          router.push({
            pathname:
              '/(app)/chat/[conversationId]',
            params: {
              conversationId:
                conversation.id,
            },
          });
        } catch (error) {
          console.error(
            'Erro ao iniciar conversa:',
            error
          );

          Alert.alert(
            'Erro',
            'Não foi possível iniciar a conversa.'
          );
        } finally {
          setCreatingConversationId(
            null
          );
        }
      },
      [firebaseUser]
    );

  function renderUser({
    item,
  }: {
    item: ChatUser;
  }) {
    const isCreating =
      creatingConversationId ===
      item.uid;

    return (
      <Pressable
        style={styles.userCard}
        onPress={() =>
          handleUserPress(item)
        }
        disabled={isCreating}
      >
        {item.photoUrl ? (
          <Image
            source={{
              uri: item.photoUrl,
            }}
            style={styles.avatar}
          />
        ) : (
          <View
            style={
              styles.avatarPlaceholder
            }
          >
            <Text
              style={
                styles.avatarText
              }
            >
              {item.name
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
        )}

        <View
          style={
            styles.userInformation
          }
        >
          <Text
            style={styles.userName}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          <Text
            style={styles.userEmail}
            numberOfLines={1}
          >
            {item.email}
          </Text>
        </View>

        {isCreating ? (
          <ActivityIndicator />
        ) : (
          <Text
            style={styles.arrow}
          >
            ›
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.back()
          }
          style={styles.backButton}
        >
          <Text
            style={styles.backText}
          >
            ‹
          </Text>
        </Pressable>

        <Text style={styles.title}>
          Usuários
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <View
        style={styles.content}
      >
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nome ou e-mail"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />

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
                styles.statusText
              }
            >
              Carregando usuários...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) =>
              item.uid
            }
            renderItem={renderUser}
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={
              filteredUsers.length ===
              0
                ? styles.emptyList
                : styles.list
            }
            ListEmptyComponent={
              <View
                style={
                  styles.centerContainer
                }
              >
                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  Nenhum usuário
                  encontrado
                </Text>

                <Text
                  style={
                    styles.statusText
                  }
                >
                  Cadastre outra conta
                  para iniciar uma
                  conversa.
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
      flexDirection: 'row',
      alignItems: 'center',
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
    },

    backText: {
      fontSize: 38,
      color: '#111827',
      lineHeight: 40,
    },

    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '700',
      color: '#111827',
    },

    headerSpacer: {
      width: 42,
    },

    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },

    searchInput: {
      height: 52,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      paddingHorizontal: 16,
      fontSize: 16,
      color: '#111827',
      marginBottom: 18,
    },

    list: {
      paddingBottom: 30,
    },

    userCard: {
      minHeight: 78,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 16,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },

    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        '#E5E7EB',
    },

    avatarPlaceholder: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    avatarText: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '700',
    },

    userInformation: {
      flex: 1,
      marginLeft: 14,
    },

    userName: {
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
    },

    userEmail: {
      marginTop: 4,
      fontSize: 14,
      color: '#6B7280',
    },

    arrow: {
      marginLeft: 10,
      fontSize: 32,
      color: '#9CA3AF',
    },

    centerContainer: {
      flex: 1,
      justifyContent:
        'center',
      alignItems: 'center',
      paddingHorizontal: 30,
    },

    statusText: {
      marginTop: 12,
      color: '#6B7280',
      fontSize: 15,
      textAlign: 'center',
    },

    emptyList: {
      flexGrow: 1,
    },

    emptyTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: '#111827',
      textAlign: 'center',
    },
  });