import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const {
    firebaseUser,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!firebaseUser) {
    return (
      <Redirect href="/(auth)/login" />
    );
  }

  return (
    <Redirect href="/(app)" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});