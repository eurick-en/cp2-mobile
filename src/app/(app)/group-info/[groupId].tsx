import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';

import {
  useCallback,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  getGroupById,
} from '@/services/groupService';

import {
  getUserById,
} from '@/services/userService';

import {
  ChatGroup,
} from '@/types/group';

import {
  ChatUser,
} from '@/types/user';

export default function GroupInfoScreen() {
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
  ] = useState<ChatGroup | null>(
    null
  );

  const [
    members,
    setMembers,
  ] = useState<ChatUser[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

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

        setErrorMessage(
          'Grupo inválido.'
        );

        return;
      }

      try {
        setLoading(true);
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

        if (
          !loadedGroup.memberIds.includes(
            firebaseUser.uid
          )
        ) {
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

        const validMembers =
          loadedMembers.filter(
            (
              member
            ): member is ChatUser =>
              member !== null
          );

        setGroup(
          loadedGroup
        );

        setMembers(
          validMembers
        );
      } catch (error) {
        console.error(
          'Erro ao carregar informações do grupo:',
          error
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

  useFocusEffect(
    useCallback(() => {
      void loadGroup();
    }, [loadGroup])
  );

  const handleOpenProfile =
    useCallback(
      (userId: string) => {
        router.push({
          pathname:
            '/(app)/profile/[userId]',
          params: {
            userId,
          },
        });
      },
      []
    );

  const handleManageGroup =
    useCallback(() => {
      if (!groupId) {
        return;
      }

      router.push({
        pathname:
          '/(app)/group-manage/[groupId]',
        params: {
          groupId,
        },
      });
    }, [groupId]);

  function getPolicyName(): string {
    if (!group) {
      return '';
    }

    switch (
      group.notificationPolicy
    ) {
      case 'all_group_messages':
        return 'Todas as mensagens';

      case 'mentioned_members':
        return 'Somente mencionados';

      case 'direct_messages_only':
        return 'Somente mensagens individuais';

      case 'disabled':
        return 'Notificações desativadas';

      default:
        return 'Desconhecida';
    }
  }

  function renderMember({
    item,
  }: {
    item: ChatUser;
  }) {
    if (!group) {
      return null;
    }

    const isOwner =
      item.uid ===
      group.ownerId;

    const isCurrentUser =
      item.uid ===
      firebaseUser?.uid;

    return (
      <Pressable
        style={
          styles.memberCard
        }
        onPress={() =>
          handleOpenProfile(
            item.uid
          )
        }
      >
        {item.photoUrl ? (
          <Image
            source={{
              uri:
                item.photoUrl,
            }}
            style={
              styles.memberImage
            }
          />
        ) : (
          <View
            style={
              styles.memberPlaceholder
            }
          >
            <Text
              style={
                styles.memberLetter
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
            styles.memberInfo
          }
        >
          <View
            style={
              styles.memberNameRow
            }
          >
            <Text
              style={
                styles.memberName
              }
              numberOfLines={1}
            >
              {item.name}
            </Text>

            {isOwner && (
              <View
                style={
                  styles.ownerBadge
                }
              >
                <Text
                  style={
                    styles.ownerBadgeText
                  }
                >
                  DONO
                </Text>
              </View>
            )}

            {isCurrentUser && (
              <View
                style={
                  styles.youBadge
                }
              >
                <Text
                  style={
                    styles.youBadgeText
                  }
                >
                  VOCÊ
                </Text>
              </View>
            )}
          </View>

          <Text
            style={
              styles.memberEmail
            }
            numberOfLines={1}
          >
            {item.email}
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
    !group
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
            styles.backErrorButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backErrorText
            }
          >
            Voltar
          </Text>
        </Pressable>
      </View>
    );
  }

  const availableSlots =
    Math.max(
      group.memberLimit -
        group.memberIds.length,
      0
    );

  const isOwner =
    firebaseUser?.uid ===
    group.ownerId;

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.header
        }
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

        <Text
          style={
            styles.headerTitle
          }
        >
          Informações do grupo
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <FlatList
        data={members}
        keyExtractor={(
          item
        ) => item.uid}
        renderItem={
          renderMember
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
        ListHeaderComponent={
          <>
            <View
              style={
                styles.groupHeader
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

              <Text
                style={
                  styles.groupName
                }
              >
                {group.name}
              </Text>

              <Text
                style={
                  styles.groupCount
                }
              >
                {group.memberIds.length}
                {' / '}
                {group.memberLimit}
                {' integrantes'}
              </Text>

              {isOwner && (
                <Pressable
                  style={
                    styles.manageButton
                  }
                  onPress={
                    handleManageGroup
                  }
                >
                  <Text
                    style={
                      styles.manageButtonText
                    }
                  >
                    Gerenciar grupo
                  </Text>
                </Pressable>
              )}
            </View>

            <View
              style={
                styles.infoGrid
              }
            >
              <View
                style={
                  styles.infoCard
                }
              >
                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    group.memberIds
                      .length
                  }
                </Text>

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Integrantes
                </Text>
              </View>

              <View
                style={
                  styles.infoCard
                }
              >
                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    availableSlots
                  }
                </Text>

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Vagas
                </Text>
              </View>

              <View
                style={
                  styles.infoCard
                }
              >
                <Text
                  style={
                    styles.infoValue
                  }
                >
                  {
                    group.memberLimit
                  }
                </Text>

                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Limite
                </Text>
              </View>
            </View>

            <View
              style={
                styles.policyCard
              }
            >
              <Text
                style={
                  styles.policyLabel
                }
              >
                Política de notificações
              </Text>

              <Text
                style={
                  styles.policyValue
                }
              >
                {getPolicyName()}
              </Text>
            </View>

            <Text
              style={
                styles.membersTitle
              }
            >
              Integrantes
            </Text>
          </>
        }
      />
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

    backErrorButton: {
      marginTop: 24,
      paddingHorizontal: 28,
      paddingVertical: 14,
      backgroundColor:
        '#111827',
      borderRadius: 12,
    },

    backErrorText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    header: {
      paddingTop: 54,
      paddingHorizontal: 20,
      paddingBottom: 18,
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
    },

    backText: {
      fontSize: 38,
      lineHeight: 40,
      color: '#111827',
    },

    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
    },

    headerSpacer: {
      width: 42,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 30,
      paddingBottom: 50,
    },

    groupHeader: {
      alignItems: 'center',
    },

    groupImage: {
      width: 125,
      height: 125,
      borderRadius: 63,
    },

    groupPlaceholder: {
      width: 125,
      height: 125,
      borderRadius: 63,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    groupPlaceholderText: {
      fontSize: 45,
    },

    groupName: {
      marginTop: 18,
      fontSize: 25,
      fontWeight: '700',
      color: '#111827',
      textAlign: 'center',
    },

    groupCount: {
      marginTop: 6,
      fontSize: 14,
      color: '#6B7280',
    },

    manageButton: {
      marginTop: 18,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor:
        '#111827',
    },

    manageButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    infoGrid: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 28,
    },

    infoCard: {
      flex: 1,
      paddingVertical: 17,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      alignItems: 'center',
    },

    infoValue: {
      fontSize: 22,
      fontWeight: '700',
      color: '#111827',
    },

    infoLabel: {
      marginTop: 4,
      fontSize: 12,
      color: '#6B7280',
    },

    policyCard: {
      marginTop: 12,
      padding: 18,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    policyLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#6B7280',
      textTransform:
        'uppercase',
    },

    policyValue: {
      marginTop: 7,
      fontSize: 16,
      color: '#111827',
      fontWeight: '600',
    },

    membersTitle: {
      marginTop: 30,
      marginBottom: 12,
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
    },

    memberCard: {
      minHeight: 76,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    memberImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },

    memberPlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    memberLetter: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '700',
    },

    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },

    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },

    memberName: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    memberEmail: {
      marginTop: 4,
      fontSize: 13,
      color: '#6B7280',
    },

    ownerBadge: {
      marginLeft: 7,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor:
        '#111827',
      borderRadius: 5,
    },

    ownerBadgeText: {
      fontSize: 8,
      color: '#FFFFFF',
      fontWeight: '700',
    },

    youBadge: {
      marginLeft: 7,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor:
        '#E5E7EB',
      borderRadius: 5,
    },

    youBadgeText: {
      fontSize: 8,
      color: '#374151',
      fontWeight: '700',
    },

    arrow: {
      marginLeft: 8,
      fontSize: 30,
      color: '#9CA3AF',
    },
  });