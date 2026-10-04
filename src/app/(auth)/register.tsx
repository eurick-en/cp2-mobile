import {
  Alert,
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

import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import {
  useCallback,
  useState,
} from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { registerUser } from '@/services/authService';
import { uploadProfileImage } from '@/services/cloudinaryService';

type SelectedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

export default function RegisterScreen() {
  const { refreshProfile } = useAuth();

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [phoneNumber, setPhoneNumber] =
    useState('');

  const [birthDate, setBirthDate] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    selectedImage,
    setSelectedImage,
  ] = useState<SelectedImage | null>(
    null
  );

  const [loading, setLoading] =
    useState(false);

  const handleSelectPhoto =
    useCallback(async () => {
      try {
        if (Platform.OS !== 'web') {
          const permission =
            await ImagePicker
              .requestMediaLibraryPermissionsAsync();

          if (!permission.granted) {
            Alert.alert(
              'Permissão necessária',
              'Precisamos de acesso às suas fotos para selecionar uma foto de perfil.'
            );

            return;
          }
        }

        const result =
          await ImagePicker
            .launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              base64: true,
            });

        if (result.canceled) {
          return;
        }

        const asset = result.assets[0];

        if (!asset.base64) {
          Alert.alert(
            'Erro',
            'Não foi possível processar a imagem selecionada.'
          );

          return;
        }

        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64,
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

  const handleRegister =
    useCallback(async () => {
      const normalizedName =
        name.trim();

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const normalizedPhone =
        phoneNumber.trim();

      const normalizedBirthDate =
        birthDate.trim();

      if (
        !normalizedName ||
        !normalizedEmail ||
        !normalizedPhone ||
        !normalizedBirthDate ||
        !password ||
        !confirmPassword
      ) {
        Alert.alert(
          'Campos obrigatórios',
          'Preencha todos os campos.'
        );

        return;
      }

      if (!selectedImage) {
        Alert.alert(
          'Foto obrigatória',
          'Selecione uma foto de perfil.'
        );

        return;
      }

      if (
        !normalizedEmail.includes('@')
      ) {
        Alert.alert(
          'E-mail inválido',
          'Informe um endereço de e-mail válido.'
        );

        return;
      }

      if (password.length < 6) {
        Alert.alert(
          'Senha inválida',
          'A senha precisa possuir pelo menos 6 caracteres.'
        );

        return;
      }

      if (
        password !== confirmPassword
      ) {
        Alert.alert(
          'Senhas diferentes',
          'A confirmação de senha precisa ser igual à senha.'
        );

        return;
      }

      try {
        setLoading(true);

        const photoUrl =
          await uploadProfileImage(
            selectedImage.base64,
            selectedImage.mimeType
          );

        await registerUser({
          name: normalizedName,
          email: normalizedEmail,
          phoneNumber:
            normalizedPhone,
          birthDate:
            normalizedBirthDate,
          password,
          photoUrl,
        });

        await refreshProfile();

        router.replace('/(app)');
      } catch (error) {
        console.error(
          'Erro ao cadastrar usuário:',
          error
        );

        Alert.alert(
          'Não foi possível criar a conta',
          'Não conseguimos concluir seu cadastro. Verifique os dados e tente novamente.'
        );
      } finally {
        setLoading(false);
      }
    }, [
      name,
      email,
      phoneNumber,
      birthDate,
      password,
      confirmPassword,
      selectedImage,
      refreshProfile,
    ]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text style={styles.title}>
          Criar conta
        </Text>

        <Text style={styles.subtitle}>
          Preencha seus dados para
          começar
        </Text>

        <View
          style={
            styles.photoContainer
          }
        >
          <Pressable
            onPress={
              handleSelectPhoto
            }
            disabled={loading}
            style={
              styles.photoButton
            }
          >
            {selectedImage ? (
              <Image
                source={{
                  uri:
                    selectedImage.uri,
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
                    styles.photoIcon
                  }
                >
                  👤
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={
              handleSelectPhoto
            }
            disabled={loading}
          >
            <Text
              style={
                styles.photoText
              }
            >
              {selectedImage
                ? 'Alterar foto'
                : 'Escolher foto'}
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          value={name}
          onChangeText={setName}
          editable={!loading}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Número de celular"
          value={phoneNumber}
          onChangeText={
            setPhoneNumber
          }
          editable={!loading}
          keyboardType="phone-pad"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Data de nascimento - DD/MM/AAAA"
          value={birthDate}
          onChangeText={
            setBirthDate
          }
          editable={!loading}
          keyboardType="numbers-and-punctuation"
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirmar senha"
          value={confirmPassword}
          onChangeText={
            setConfirmPassword
          }
          editable={!loading}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={
            handleRegister
          }
        />

        <Pressable
          style={[
            styles.button,
            loading &&
              styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text
            style={
              styles.buttonText
            }
          >
            {loading
              ? 'Criando conta...'
              : 'Criar conta'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.back()
          }
          disabled={loading}
        >
          <Text
            style={styles.link}
          >
            Já possui conta? Entrar
          </Text>
        </Pressable>
      </ScrollView>
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

    content: {
      flexGrow: 1,
      justifyContent:
        'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
    },

    title: {
      fontSize: 30,
      fontWeight: '700',
      textAlign: 'center',
      color: '#111827',
    },

    subtitle: {
      marginTop: 8,
      marginBottom: 24,
      fontSize: 16,
      textAlign: 'center',
      color: '#6B7280',
    },

    photoContainer: {
      alignItems: 'center',
      marginBottom: 28,
    },

    photoButton: {
      borderRadius: 60,
    },

    profileImage: {
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 3,
      borderColor: '#111827',
    },

    photoPlaceholder: {
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor:
        '#E5E7EB',
      justifyContent:
        'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#D1D5DB',
    },

    photoIcon: {
      fontSize: 46,
    },

    photoText: {
      marginTop: 10,
      color: '#111827',
      fontWeight: '700',
      fontSize: 15,
    },

    input: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 14,
      fontSize: 16,
      color: '#111827',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },

    button: {
      marginTop: 8,
      backgroundColor:
        '#111827',
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
    },

    buttonDisabled: {
      opacity: 0.6,
    },

    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    link: {
      marginTop: 24,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
      color: '#111827',
    },
  });