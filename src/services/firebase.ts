import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  Persistence,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

import firebaseConfig from '../../firebaseConfig.json';

const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApp();

/**
 * O Firebase possui getReactNativePersistence no bundle React Native,
 * porém algumas versões apresentam problema de tipagem no TypeScript.
 *
 * Usamos unknown em vez de any, pois o trabalho proíbe any.
 */
type ReactNativePersistenceFactory = (
  storage: typeof AsyncStorage
) => Persistence;

const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence: ReactNativePersistenceFactory;
  }
).getReactNativePersistence;

const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

const firestore = getFirestore(app);

const realtimeDatabase = getDatabase(app);

export {
  app,
  auth,
  firestore,
  realtimeDatabase,
};