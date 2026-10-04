import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

import * as ImagePicker
  from 'expo-image-picker';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  addMemberToGroup,
  getGroupById,
  removeMemberFromGroup,
  updateGroupSettings,
} from '@/services/groupService';

import {
  getUserById,
  getUsersExcept,
} from '@/services/userService';

import {
  uploadGroupImage,
} from '@/services/cloudinaryService';

import {
  ChatGroup,
  NotificationPolicy,
} from '@/types/group';

import {
  ChatUser,
} from '@/types/user';

type SelectedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

type PolicyOption = {
  value: NotificationPolicy;
  title: string;
  description: string;
};

const POLICY_OPTIONS:
  PolicyOption[] = [
    {
      value:
        'all_group_messages',
      title:
        'Todas as mensagens',
      description:
        'Todos do grupo, exceto o remetente, podem receber notificações.',
    },
    {
      value:
        'mentioned_members',
      title:
        'Somente mencionados',
      description:
        'Apenas usuários mencionados ou selecionados recebem push.',
    },
    {
      value:
        'direct_messages_only',
      title:
        'Somente mensagens individuais',
      description:
        'Mensagens desse grupo não geram notificação.',
    },
    {
      value: 'disabled',
      title:
        'Desativadas',
      description:
        'Nenhuma mensagem desse grupo gera push.',
    },
  ];

export default function GroupManageScreen() {
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
  ] = useState<ChatUser[]>([]);

  const [
    availableUsers,
    setAvailableUsers,
  ] = useState<ChatUser[]>([]);

  const [
    name,
    setName,
  ] = useState('');

  const [
    memberLimitText,
    setMemberLimitText,
  ] = useState('');

  const [
    notificationPolicy,
    setNotificationPolicy,
  ] =
    useState<NotificationPolicy>(
      'all_group_messages'
    );

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<SelectedImage | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    memberOperationId,
    setMemberOperationId,
  ] = useState<string | null>(
    null
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null
  );

  const loadData =
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
          loadedGroup.ownerId !==
          firebaseUser.uid
        ) {
          throw new Error(
            'Somente o proprietário pode gerenciar este grupo.'
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

        const users =
          await getUsersExcept(
            firebaseUser.uid
          );

        const currentMemberIds =
          new Set(
            loadedGroup.memberIds
          );

        const usersOutsideGroup =
          users.filter(
            (user) =>
              !currentMemberIds.has(
                user.uid
              )
          );

        setGroup(
          loadedGroup
        );

        setMembers(
          validMembers
        );

        setAvailableUsers(
          usersOutsideGroup
        );

        setName(
          loadedGroup.name
        );

        setMemberLimitText(
          String(
            loadedGroup.memberLimit
          )
        );

        setNotificationPolicy(
          loadedGroup.notificationPolicy
        );
      } catch (error) {
        console.error(
          'Erro ao carregar gerenciamento do grupo:',
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

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableSlots =
    useMemo(() => {
      if (!group) {
        return 0;
      }

      return Math.max(
        group.memberLimit -
          group.memberIds.length,
        0
      );
    }, [group]);

  const handleSelectPhoto =
    useCallback(async () => {
      try {
        if (
          Platform.OS !== 'web'
        ) {
          const permission =
            await ImagePicker
              .requestMediaLibraryPermissionsAsync();

          if (
            !permission.granted
          ) {
            Alert.alert(
              'Permissão necessária',
              'Permita o acesso às fotos para alterar a imagem do grupo.'
            );

            return;
          }
        }

        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes: [
                'images',
              ],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              base64: true,
            });

        if (result.canceled) {
          return;
        }

        const asset =
          result.assets[0];

        if (!asset.base64) {
          Alert.alert(
            'Erro',
            'Não foi possível processar a imagem.'
          );

          return;
        }

        setSelectedImage({
          uri: asset.uri,
          base64:
            asset.base64,
          mimeType:
            asset.mimeType ??
            'image/jpeg',
        });
      } catch (error) {
        console.error(
          'Erro ao selecionar foto:',
          error
        );

        Alert.alert(
          'Erro',
          'Não foi possível selecionar a imagem.'
        );
      }
    }, []);

  const handleSave =
    useCallback(async () => {
      if (
        !firebaseUser ||
        !groupId ||
        !group
      ) {
        return;
      }

      const normalizedName =
        name.trim();

      if (!normalizedName) {
        Alert.alert(
          'Nome obrigatório',
          'Informe o nome do grupo.'
        );

        return;
      }

      const newLimit =
        Number(
          memberLimitText
        );

      if (
        !Number.isInteger(
          newLimit
        ) ||
        newLimit < 2
      ) {
        Alert.alert(
          'Limite inválido',
          'Informe um número inteiro maior ou igual a 2.'
        );

        return;
      }

      if (
        newLimit <
        group.memberIds.length
      ) {
        Alert.alert(
          'Limite inválido',
          `O grupo possui ${group.memberIds.length} integrantes.`
        );

        return;
      }

      try {
        setSaving(true);

        let newPhotoUrl:
          string | undefined;

        if (selectedImage) {
          newPhotoUrl =
            await uploadGroupImage(
              selectedImage.base64,
              selectedImage.mimeType
            );
        }

        await updateGroupSettings(
          groupId,
          firebaseUser.uid,
          {
            name:
              normalizedName,
            memberLimit:
              newLimit,
            notificationPolicy,
            photoUrl:
              newPhotoUrl,
          }
        );

        setSelectedImage(
          null
        );

        await loadData();

        Alert.alert(
          'Salvo',
          'Grupo atualizado com sucesso.'
        );
      } catch (error) {
        console.error(
          'Erro ao salvar grupo:',
          error
        );

        Alert.alert(
          'Erro',
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar o grupo.'
        );
      } finally {
        setSaving(false);
      }
    }, [
      firebaseUser,
      groupId,
      group,
      name,
      memberLimitText,
      notificationPolicy,
      selectedImage,
      loadData,
    ]);

  const handleAddMember =
    useCallback(
      async (
        user: ChatUser
      ) => {
        if (
          !firebaseUser ||
          !groupId
        ) {
          return;
        }

        try {
          setMemberOperationId(
            user.uid
          );

          await addMemberToGroup(
            groupId,
            firebaseUser.uid,
            user.uid
          );

          await loadData();
        } catch (error) {
          console.error(
            'Erro ao adicionar integrante:',
            error
          );

          Alert.alert(
            'Não foi possível adicionar',
            error instanceof Error
              ? error.message
              : 'Erro ao adicionar integrante.'
          );
        } finally {
          setMemberOperationId(
            null
          );
        }
      },
      [
        firebaseUser,
        groupId,
        loadData,
      ]
    );

  const handleRemoveMember =
    useCallback(
      async (
        user: ChatUser
      ) => {
        if (
          !firebaseUser ||
          !groupId
        ) {
          return;
        }

        try {
          setMemberOperationId(
            user.uid
          );

          await removeMemberFromGroup(
            groupId,
            firebaseUser.uid,
            user.uid
          );

          await loadData();
        } catch (error) {
          console.error(
            'Erro ao remover integrante:',
            error
          );

          Alert.alert(
            'Não foi possível remover',
            error instanceof Error
              ? error.message
              : 'Erro ao remover integrante.'
          );
        } finally {
          setMemberOperationId(
            null
          );
        }
      },
      [
        firebaseUser,
        groupId,
        loadData,
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
          Carregando gerenciamento...
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
            styles.primaryButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Voltar
          </Text>
        </Pressable>
      </View>
    );
  }

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
          Gerenciar grupo
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.photoArea
          }
        >
          <Pressable
            onPress={
              handleSelectPhoto
            }
            disabled={saving}
          >
            <Image
              source={{
                uri:
                  selectedImage?.uri ??
                  group.photoUrl,
              }}
              style={
                styles.groupImage
              }
            />
          </Pressable>

          <Pressable
            onPress={
              handleSelectPhoto
            }
            disabled={saving}
          >
            <Text
              style={
                styles.changePhoto
              }
            >
              Alterar foto
            </Text>
          </Pressable>
        </View>

        <Text
          style={
            styles.label
          }
        >
          Nome do grupo
        </Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={
            setName
          }
          maxLength={60}
          editable={!saving}
        />

        <Text
          style={
            styles.label
          }
        >
          Limite de integrantes
        </Text>

        <TextInput
          style={styles.input}
          value={
            memberLimitText
          }
          onChangeText={
            setMemberLimitText
          }
          keyboardType="number-pad"
          editable={!saving}
        />

        <View
          style={
            styles.capacityCard
          }
        >
          <Text
            style={
              styles.capacityMain
            }
          >
            {group.memberIds.length}
            {' / '}
            {group.memberLimit}
            {' integrantes'}
          </Text>

          <Text
            style={
              styles.capacitySecondary
            }
          >
            {availableSlots}{' '}
            {availableSlots === 1
              ? 'vaga disponível'
              : 'vagas disponíveis'}
          </Text>
        </View>

        <Text
          style={
            styles.sectionTitle
          }
        >
          Política de notificações
        </Text>

        {POLICY_OPTIONS.map(
          (option) => {
            const selected =
              notificationPolicy ===
              option.value;

            return (
              <Pressable
                key={
                  option.value
                }
                style={[
                  styles.policyCard,
                  selected &&
                    styles.policySelected,
                ]}
                onPress={() =>
                  setNotificationPolicy(
                    option.value
                  )
                }
                disabled={saving}
              >
                <View
                  style={[
                    styles.radio,
                    selected &&
                      styles.radioSelected,
                  ]}
                >
                  {selected && (
                    <View
                      style={
                        styles.radioInner
                      }
                    />
                  )}
                </View>

                <View
                  style={
                    styles.policyInfo
                  }
                >
                  <Text
                    style={
                      styles.policyTitle
                    }
                  >
                    {option.title}
                  </Text>

                  <Text
                    style={
                      styles.policyDescription
                    }
                  >
                    {
                      option.description
                    }
                  </Text>
                </View>
              </Pressable>
            );
          }
        )}

        <Pressable
          style={[
            styles.saveButton,
            saving &&
              styles.disabledButton,
          ]}
          onPress={
            handleSave
          }
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.saveButtonText
              }
            >
              Salvar alterações
            </Text>
          )}
        </Pressable>

        <Text
          style={
            styles.sectionTitle
          }
        >
          Integrantes atuais
        </Text>

        {members.map(
          (member) => {
            const isOwner =
              member.uid ===
              group.ownerId;

            const isOperating =
              memberOperationId ===
              member.uid;

            return (
              <View
                key={
                  member.uid
                }
                style={
                  styles.userCard
                }
              >
                {member.photoUrl ? (
                  <Image
                    source={{
                      uri:
                        member.photoUrl,
                    }}
                    style={
                      styles.userImage
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.userPlaceholder
                    }
                  >
                    <Text
                      style={
                        styles.userLetter
                      }
                    >
                      {member.name
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}

                <View
                  style={
                    styles.userInfo
                  }
                >
                  <Text
                    style={
                      styles.userName
                    }
                  >
                    {member.name}
                  </Text>

                  <Text
                    style={
                      styles.userEmail
                    }
                  >
                    {member.email}
                  </Text>

                  {isOwner && (
                    <Text
                      style={
                        styles.ownerText
                      }
                    >
                      Proprietário
                    </Text>
                  )}
                </View>

                {!isOwner && (
                  <Pressable
                    style={
                      styles.removeButton
                    }
                    onPress={() =>
                      handleRemoveMember(
                        member
                      )
                    }
                    disabled={
                      isOperating
                    }
                  >
                    {isOperating ? (
                      <ActivityIndicator
                        size="small"
                      />
                    ) : (
                      <Text
                        style={
                          styles.removeText
                        }
                      >
                        Remover
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          }
        )}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Adicionar integrante
        </Text>

        {availableSlots === 0 ? (
          <View
            style={
              styles.noSlotsCard
            }
          >
            <Text
              style={
                styles.noSlotsTitle
              }
            >
              Grupo sem vagas
            </Text>

            <Text
              style={
                styles.noSlotsText
              }
            >
              Aumente o limite de integrantes para adicionar novas pessoas.
            </Text>
          </View>
        ) : availableUsers.length ===
          0 ? (
          <Text
            style={
              styles.emptyText
            }
          >
            Nenhum usuário disponível para adicionar.
          </Text>
        ) : (
          <FlatList
            data={
              availableUsers
            }
            keyExtractor={(
              item
            ) => item.uid}
            scrollEnabled={false}
            renderItem={({
              item,
            }) => {
              const isOperating =
                memberOperationId ===
                item.uid;

              return (
                <View
                  style={
                    styles.userCard
                  }
                >
                  {item.photoUrl ? (
                    <Image
                      source={{
                        uri:
                          item.photoUrl,
                      }}
                      style={
                        styles.userImage
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.userPlaceholder
                      }
                    >
                      <Text
                        style={
                          styles.userLetter
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
                      styles.userInfo
                    }
                  >
                    <Text
                      style={
                        styles.userName
                      }
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={
                        styles.userEmail
                      }
                    >
                      {item.email}
                    </Text>
                  </View>

                  <Pressable
                    style={
                      styles.addButton
                    }
                    onPress={() =>
                      handleAddMember(
                        item
                      )
                    }
                    disabled={
                      isOperating
                    }
                  >
                    {isOperating ? (
                      <ActivityIndicator
                        size="small"
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={
                          styles.addText
                        }
                      >
                        Adicionar
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            }}
          />
        )}
      </ScrollView>
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
      paddingTop: 28,
      paddingBottom: 60,
    },

    photoArea: {
      alignItems: 'center',
      marginBottom: 28,
    },

    groupImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor:
        '#111827',
    },

    changePhoto: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: '700',
      color: '#111827',
    },

    label: {
      marginBottom: 8,
      fontSize: 14,
      fontWeight: '700',
      color: '#374151',
    },

    input: {
      height: 52,
      paddingHorizontal: 16,
      marginBottom: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      backgroundColor:
        '#FFFFFF',
      color: '#111827',
      fontSize: 16,
    },

    capacityCard: {
      padding: 16,
      marginBottom: 26,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      backgroundColor:
        '#FFFFFF',
    },

    capacityMain: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    capacitySecondary: {
      marginTop: 5,
      color: '#6B7280',
    },

    sectionTitle: {
      marginTop: 26,
      marginBottom: 12,
      fontSize: 20,
      fontWeight: '700',
      color: '#111827',
    },

    policyCard: {
      flexDirection: 'row',
      padding: 15,
      marginBottom: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      backgroundColor:
        '#FFFFFF',
    },

    policySelected: {
      borderColor:
        '#111827',
    },

    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor:
        '#9CA3AF',
      justifyContent:
        'center',
      alignItems: 'center',
      marginTop: 2,
    },

    radioSelected: {
      borderColor:
        '#111827',
    },

    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        '#111827',
    },

    policyInfo: {
      flex: 1,
      marginLeft: 12,
    },

    policyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#111827',
    },

    policyDescription: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 18,
      color: '#6B7280',
    },

    saveButton: {
      height: 54,
      marginTop: 20,
      borderRadius: 14,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    disabledButton: {
      opacity: 0.5,
    },

    saveButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    userCard: {
      minHeight: 74,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      backgroundColor:
        '#FFFFFF',
      flexDirection: 'row',
      alignItems: 'center',
    },

    userImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },

    userPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    userLetter: {
      color: '#FFFFFF',
      fontSize: 19,
      fontWeight: '700',
    },

    userInfo: {
      flex: 1,
      marginLeft: 12,
    },

    userName: {
      fontSize: 15,
      fontWeight: '700',
      color: '#111827',
    },

    userEmail: {
      marginTop: 3,
      fontSize: 12,
      color: '#6B7280',
    },

    ownerText: {
      marginTop: 4,
      fontSize: 11,
      fontWeight: '700',
      color: '#111827',
    },

    addButton: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor:
        '#111827',
    },

    addText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },

    removeButton: {
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor:
        '#FEE2E2',
    },

    removeText: {
      color: '#991B1B',
      fontSize: 12,
      fontWeight: '700',
    },

    noSlotsCard: {
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      backgroundColor:
        '#FFFFFF',
    },

    noSlotsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    noSlotsText: {
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      color: '#6B7280',
    },

    emptyText: {
      paddingVertical: 20,
      color: '#6B7280',
      textAlign: 'center',
    },

    primaryButton: {
      marginTop: 24,
      paddingHorizontal: 28,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor:
        '#111827',
    },

    primaryButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });