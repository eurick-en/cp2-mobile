import {
  useEffect,
  useRef,
} from 'react';

import {
  Stack,
} from 'expo-router';

import {
  AuthProvider,
  useAuth,
} from '@/contexts/AuthContext';

import {
  registerDeviceForPush,
} from '@/services/notificationService';

function PushNotificationBootstrap() {
  const {
    firebaseUser,
    loading,
  } = useAuth();

  const registeredUserId =
    useRef<string | null>(
      null
    );

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!firebaseUser) {
      registeredUserId.current =
        null;

      return;
    }

    if (
      registeredUserId.current ===
      firebaseUser.uid
    ) {
      return;
    }

    const userId =
      firebaseUser.uid;

    let active = true;

    async function registerPush() {
      const result =
        await registerDeviceForPush(
          userId
        );

      if (!active) {
        return;
      }

      switch (result.status) {
        case 'registered':
          registeredUserId.current =
            userId;

          console.log(
            '✅ Dispositivo registrado para push:',
            result.token
          );

          break;

        case 'permission-denied':
          console.warn(
            '⚠️ Permissão de notificações negada.'
          );

          break;

        case 'project-id-missing':
          console.warn(
            '⚠️ EAS projectId ainda não está configurado.'
          );

          break;

        case 'unsupported-platform':
          console.log(
            'ℹ️ Push remoto não será registrado nesta plataforma.'
          );

          break;

        case 'error':
          console.warn(
            '⚠️ Falha ao registrar dispositivo para push.'
          );

          break;
      }
    }

    void registerPush();

    return () => {
      active = false;
    };
  }, [
    firebaseUser,
    loading,
  ]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PushNotificationBootstrap />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AuthProvider>
  );
}