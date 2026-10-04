import 'dotenv/config';

import {
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';

import {
  getAuth,
} from 'firebase-admin/auth';

import {
  getFirestore,
} from 'firebase-admin/firestore';

import {
  getDatabase,
} from 'firebase-admin/database';

function requireEnvironmentVariable(
  name: string
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}`
    );
  }

  return value;
}

const projectId =
  requireEnvironmentVariable(
    'FIREBASE_PROJECT_ID'
  );

const clientEmail =
  requireEnvironmentVariable(
    'FIREBASE_CLIENT_EMAIL'
  );

const privateKey =
  requireEnvironmentVariable(
    'FIREBASE_PRIVATE_KEY'
  ).replace(
    /\\n/g,
    '\n'
  );

const databaseURL =
  requireEnvironmentVariable(
    'FIREBASE_DATABASE_URL'
  );

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        databaseURL,
      });

export const adminAuth =
  getAuth(firebaseApp);

export const adminFirestore =
  getFirestore(
    firebaseApp
  );

export const adminRealtime =
  getDatabase(
    firebaseApp
  );