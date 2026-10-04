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
  uploadGroupImage,
} from '@/services/cloudinaryService';

import {
  createGroup,
} from '@/services/groupService';

import {
  getUsersExcept,
} from '@/services/userService';

import {
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
        'Todos os integrantes recebem push das mensagens gerais.',
    },
    {
      value:
        'mentioned_members',
      title:
        'Somente mencionados',
      description:
        'Apenas integrantes mencionados recebem push.',
    },
    {
      value:
        'direct_messages_only',
      title:
        'Somente mensagens individuais',
      description:
        'Mensagens deste grupo não geram push.',
    },
    {
      value: 'disabled',
      title:
        'Notificações desativadas',
      description:
        'Nenhuma mensagem deste grupo gera push.',
    },
  ];

export default function NewGroupScreen() {
  const {
    firebaseUser,
  } = useAuth();

  const [
    name,
    setName,
  ] = useState('');

  const [
    memberLimitText,
    setMemberLimitText,
  ] = useState('5');

  const [
    users,
    setUsers,
  ] = useState<ChatUser[]>([]);

  const [
    selectedMemberIds,
    setSelectedMemberIds,
  ] = useState<string[]>([]);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<SelectedImage | null>(
    null
  );

  const [
    notificationPolicy,
    setNotificationPolicy,
  ] =
    useState<NotificationPolicy>(
      'all_group_messages'
    );

  const [
    loadingUsers,
    setLoadingUsers,
  ] = useState(true);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const memberLimit =
    Number(memberLimitText);

  const currentMemberCount =
    selectedMemberIds.length + 1;

  const availableSlots =
    Number.isInteger(memberLimit)
      ? Math.max(
          memberLimit -
            currentMemberCount,
          0
        )
      : 0;

  const loadUsers =
    useCallback(async () => {
      if (!firebaseUser) {
        return;
      }

      try {
        setLoadingUsers(true);

        const loadedUsers =
          await getUsersExcept(
            firebaseUser.uid
          );

        setUsers(
          loadedUsers
        );
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
        setLoadingUsers(false);
      }
    }, [firebaseUser]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const selectedMembers =
    useMemo(
      () =>
        users.filter(
          (user) =>
            selectedMemberIds.includes(
              user.uid
            )
        ),
      [
        users,
        selectedMemberIds,
      ]
    );

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
              'Precisamos de acesso às suas fotos para selecionar uma foto do grupo.'
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
          'Não foi possível selecionar a foto.'
        );
      }
    }, []);

  const handleToggleMember =
    useCallback(
      (
        userId: string
      ) => {
        const alreadySelected =
          selectedMemberIds.includes(
            userId
          );

        if (alreadySelected) {
          setSelectedMemberIds(
            (
              currentMembers
            ) =>
              currentMembers.filter(
                (
                  currentMemberId
                ) =>
                  currentMemberId !==
                  userId
              )
          );

          return;
        }

        if (
          !Number.isInteger(
            memberLimit
          ) ||
          memberLimit < 2
        ) {
          Alert.alert(
            'Limite inválido',
            'Informe primeiro um limite válido.'
          );

          return;
        }

        if (
          currentMemberCount >=
          memberLimit
        ) {
          Alert.alert(
            'Grupo sem vagas',
            'O limite de integrantes foi atingido.'
          );

          return;
        }

        setSelectedMemberIds(
          (
            currentMembers
          ) => [
            ...currentMembers,
            userId,
          ]
        );
      },
      [
        selectedMemberIds,
        memberLimit,
        currentMemberCount,
      ]
    );

  const handleCreateGroup =
    useCallback(async () => {
      if (!firebaseUser) {
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

      if (!selectedImage) {
        Alert.alert(
          'Foto obrigatória',
          'Selecione uma foto para o grupo.'
        );

        return;
      }

      if (
        !Number.isInteger(
          memberLimit
        ) ||
        memberLimit < 2
      ) {
        Alert.alert(
          'Limite inválido',
          'Informe um número inteiro maior ou igual a 2.'
        );

        return;
      }

      if (
        currentMemberCount < 2
      ) {
        Alert.alert(
          'Poucos integrantes',
          'Selecione pelo menos mais uma pessoa.'
        );

        return;
      }

      if (
        currentMemberCount >
        memberLimit
      ) {
        Alert.alert(
          'Limite excedido',
          'A quantidade de integrantes ultrapassa o limite.'
        );

        return;
      }

      try {
        setCreating(true);

        const photoUrl =
          await uploadGroupImage(
            selectedImage.base64,
            selectedImage.mimeType
          );

        const group =
          await createGroup({
            name:
              normalizedName,
            photoUrl,
            ownerId:
              firebaseUser.uid,
            memberIds:
              selectedMemberIds,
            memberLimit,
            notificationPolicy,
          });

        Alert.alert(
          'Grupo criado',
          'O grupo foi criado com sucesso.'
        );

        router.replace(
          '/(app)'
        );

        console.log(
          'Grupo criado:',
          group.id
        );
      } catch (error) {
        console.error(
          'Erro ao criar grupo:',
          error
        );

        Alert.alert(
          'Erro',
          error instanceof Error
            ? error.message
            : 'Não foi possível criar o grupo.'
        );
      } finally {
        setCreating(false);
      }
    }, [
      firebaseUser,
      name,
      selectedImage,
      memberLimit,
      currentMemberCount,
      selectedMemberIds,
      notificationPolicy,
    ]);

  function renderUser({
    item,
  }: {
    item: ChatUser;
  }) {
    const selected =
      selectedMemberIds.includes(
        item.uid
      );

    return (
      <Pressable
        style={[
          styles.userCard,
          selected &&
            styles.userCardSelected,
        ]}
        onPress={() =>
          handleToggleMember(
            item.uid
          )
        }
        disabled={creating}
      >
        {item.photoUrl ? (
          <Image
            source={{
              uri:
                item.photoUrl,
            }}
            style={
              styles.userAvatar
            }
          />
        ) : (
          <View
            style={
              styles.userAvatarPlaceholder
            }
          >
            <Text
              style={
                styles.userAvatarText
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

        <View
          style={[
            styles.checkBox,
            selected &&
              styles.checkBoxSelected,
          ]}
        >
          {selected && (
            <Text
              style={
                styles.checkMark
              }
            >
              ✓
            </Text>
          )}
        </View>
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
          Novo grupo
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
            styles.photoSection
          }
        >
          <Pressable
            onPress={
              handleSelectPhoto
            }
            disabled={creating}
          >
            {selectedImage ? (
              <Image
                source={{
                  uri:
                    selectedImage.uri,
                }}
                style={
                  styles.groupImage
                }
              />
            ) : (
              <View
                style={
                  styles.groupImagePlaceholder
                }
              >
                <Text
                  style={
                    styles.groupImageIcon
                  }
                >
                  👥
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={
              handleSelectPhoto
            }
            disabled={creating}
          >
            <Text
              style={
                styles.photoButtonText
              }
            >
              {selectedImage
                ? 'Alterar foto'
                : 'Escolher foto'}
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
          onChangeText={setName}
          placeholder="Ex.: Grupo FIAP"
          editable={!creating}
          maxLength={60}
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
          placeholder="5"
          keyboardType="number-pad"
          editable={!creating}
        />

        <View
          style={
            styles.capacityCard
          }
        >
          <Text
            style={
              styles.capacityText
            }
          >
            Integrantes:{' '}
            {currentMemberCount}
            {' / '}
            {Number.isInteger(
              memberLimit
            )
              ? memberLimit
              : '-'}
          </Text>

          <Text
            style={
              styles.availableText
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
            styles.label
          }
        >
          Integrantes
        </Text>

        <Text
          style={
            styles.helperText
          }
        >
          Você já faz parte do grupo
          como proprietário.
        </Text>

        {loadingUsers ? (
          <ActivityIndicator
            size="large"
            style={{
              marginVertical: 30,
            }}
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(
              item
            ) => item.uid}
            renderItem={
              renderUser
            }
            scrollEnabled={false}
            ListEmptyComponent={
              <Text
                style={
                  styles.emptyText
                }
              >
                Nenhum outro usuário
                disponível.
              </Text>
            }
          />
        )}

        {selectedMembers.length >
          0 && (
          <Text
            style={
              styles.selectedText
            }
          >
            Selecionados:{' '}
            {selectedMembers
              .map(
                (member) =>
                  member.name
              )
              .join(', ')}
          </Text>
        )}

        <Text
          style={[
            styles.label,
            styles.policyLabel,
          ]}
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
                key={option.value}
                style={[
                  styles.policyCard,
                  selected &&
                    styles.policyCardSelected,
                ]}
                onPress={() =>
                  setNotificationPolicy(
                    option.value
                  )
                }
                disabled={
                  creating
                }
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
            styles.createButton,
            creating &&
              styles.createButtonDisabled,
          ]}
          onPress={
            handleCreateGroup
          }
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.createButtonText
              }
            >
              Criar grupo
            </Text>
          )}
        </Pressable>
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
      lineHeight: 40,
      color: '#111827',
    },

    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 21,
      fontWeight: '700',
      color: '#111827',
    },

    headerSpacer: {
      width: 42,
    },

    content: {
      paddingHorizontal: 22,
      paddingTop: 30,
      paddingBottom: 50,
    },

    photoSection: {
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

    groupImagePlaceholder: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor:
        '#E5E7EB',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    groupImageIcon: {
      fontSize: 46,
    },

    photoButtonText: {
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
      fontSize: 16,
      color: '#111827',
    },

    capacityCard: {
      padding: 16,
      marginBottom: 24,
      borderRadius: 14,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
    },

    capacityText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    availableText: {
      marginTop: 5,
      fontSize: 14,
      color: '#6B7280',
    },

    helperText: {
      marginTop: -3,
      marginBottom: 14,
      fontSize: 13,
      color: '#6B7280',
    },

    userCard: {
      minHeight: 72,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      backgroundColor:
        '#FFFFFF',
    },

    userCardSelected: {
      borderColor:
        '#111827',
    },

    userAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },

    userAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    userAvatarText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 18,
    },

    userInfo: {
      flex: 1,
      marginLeft: 12,
    },

    userName: {
      fontSize: 16,
      fontWeight: '700',
      color: '#111827',
    },

    userEmail: {
      marginTop: 3,
      fontSize: 13,
      color: '#6B7280',
    },

    checkBox: {
      width: 25,
      height: 25,
      borderRadius: 7,
      borderWidth: 2,
      borderColor:
        '#D1D5DB',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    checkBoxSelected: {
      backgroundColor:
        '#111827',
      borderColor:
        '#111827',
    },

    checkMark: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    emptyText: {
      paddingVertical: 20,
      color: '#6B7280',
      textAlign: 'center',
    },

    selectedText: {
      marginTop: 4,
      fontSize: 13,
      color: '#6B7280',
    },

    policyLabel: {
      marginTop: 28,
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

    policyCardSelected: {
      borderColor:
        '#111827',
    },

    radio: {
      width: 22,
      height: 22,
      marginTop: 2,
      borderRadius: 11,
      borderWidth: 2,
      borderColor:
        '#9CA3AF',
      justifyContent:
        'center',
      alignItems: 'center',
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

    createButton: {
      height: 54,
      marginTop: 28,
      borderRadius: 14,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    createButtonDisabled: {
      opacity: 0.6,
    },

    createButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });