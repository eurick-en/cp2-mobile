import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useAuth,
} from '@/contexts/AuthContext';

import {
  canViewUserProfile,
  getUserById,
} from '@/services/userService';

import {
  ChatUser,
} from '@/types/user';

export default function ProfileScreen() {
  const {
    firebaseUser,
    loading: authLoading,
  } = useAuth();

  const {
    userId,
  } = useLocalSearchParams<{
    userId: string;
  }>();

  const [
    profile,
    setProfile,
  ] = useState<ChatUser | null>(
    null
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

  const loadProfile =
    useCallback(async () => {
      if (authLoading) {
        return;
      }

      if (!firebaseUser) {
        setErrorMessage(
          'Sua sessão não está disponível.'
        );

        setLoading(false);

        return;
      }

      if (!userId) {
        setErrorMessage(
          'Perfil inválido.'
        );

        setLoading(false);

        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);

        const allowed =
          await canViewUserProfile(
            firebaseUser.uid,
            userId
          );

        if (!allowed) {
          setProfile(null);

          setErrorMessage(
            'Você não possui permissão para visualizar este perfil.'
          );

          return;
        }

        const user =
          await getUserById(
            userId
          );

        if (!user) {
          setProfile(null);

          setErrorMessage(
            'Usuário não encontrado.'
          );

          return;
        }

        setProfile(user);
      } catch (error) {
        console.error(
          'Erro ao carregar perfil:',
          error
        );

        setProfile(null);

        setErrorMessage(
          'Não foi possível carregar o perfil.'
        );
      } finally {
        setLoading(false);
      }
    }, [
      authLoading,
      firebaseUser,
      userId,
    ]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

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
          Carregando perfil...
        </Text>
      </View>
    );
  }

  if (
    errorMessage ||
    !profile
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
            'Perfil indisponível.'}
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
          Perfil
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
        showsVerticalScrollIndicator={
          false
        }
      >
        {profile.photoUrl ? (
          <Image
            source={{
              uri:
                profile.photoUrl,
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
                styles.photoLetter
              }
            >
              {profile.name
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
        )}

        <Text
          style={
            styles.profileName
          }
        >
          {profile.name ||
            'Nome indisponível'}
        </Text>

        <Text
          style={
            styles.profileSubtitle
          }
        >
          Perfil do usuário
        </Text>

        <View
          style={
            styles.informationContainer
          }
        >
          <InformationItem
            label="E-mail"
            value={
              profile.email
            }
          />

          <InformationItem
            label="Celular"
            value={
              profile.phoneNumber
            }
          />

          <InformationItem
            label="Data de nascimento"
            value={
              profile.birthDate
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

type InformationItemProps = {
  label: string;
  value: string;
};

function InformationItem({
  label,
  value,
}: InformationItemProps) {
  return (
    <View
      style={
        styles.informationItem
      }
    >
      <Text
        style={
          styles.informationLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.informationValue
        }
      >
        {value.trim()
          ? value
          : 'Não informado'}
      </Text>
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
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 50,
    },

    profileImage: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor:
        '#E5E7EB',
      borderWidth: 3,
      borderColor:
        '#111827',
    },

    photoPlaceholder: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor:
        '#111827',
      justifyContent:
        'center',
      alignItems: 'center',
    },

    photoLetter: {
      color: '#FFFFFF',
      fontSize: 48,
      fontWeight: '700',
    },

    profileName: {
      marginTop: 22,
      fontSize: 25,
      fontWeight: '700',
      color: '#111827',
      textAlign: 'center',
    },

    profileSubtitle: {
      marginTop: 5,
      fontSize: 14,
      color: '#6B7280',
    },

    informationContainer: {
      width: '100%',
      maxWidth: 520,
      marginTop: 35,
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#E5E7EB',
      overflow: 'hidden',
    },

    informationItem: {
      paddingHorizontal: 20,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor:
        '#F3F4F6',
    },

    informationLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#6B7280',
      textTransform:
        'uppercase',
      marginBottom: 6,
    },

    informationValue: {
      fontSize: 16,
      color: '#111827',
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
      fontSize: 27,
      fontWeight: '700',
      color: '#111827',
    },

    errorText: {
      marginTop: 10,
      maxWidth: 350,
      fontSize: 15,
      lineHeight: 22,
      color: '#6B7280',
      textAlign: 'center',
    },

    backErrorButton: {
      marginTop: 24,
      backgroundColor:
        '#111827',
      paddingHorizontal: 30,
      paddingVertical: 14,
      borderRadius: 12,
    },

    backErrorText: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });