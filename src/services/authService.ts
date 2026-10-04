import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';

import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

import { auth, firestore } from '@/services/firebase';
import {
  ChatUser,
  LoginUserInput,
  RegisterUserInput,
} from '@/types/user';

export async function registerUser(
  data: RegisterUserInput
): Promise<ChatUser> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    data.email.trim(),
    data.password
  );

  const firebaseUser = credential.user;

  await updateProfile(firebaseUser, {
    displayName: data.name.trim(),
  });

  const userProfile: ChatUser = {
    uid: firebaseUser.uid,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phoneNumber: data.phoneNumber.trim(),
    birthDate: data.birthDate.trim(),
    photoUrl: data.photoUrl ?? '',
    createdAt: Date.now(),
  };

  await setDoc(
    doc(firestore, 'users', firebaseUser.uid),
    userProfile
  );

  return userProfile;
}

export async function loginUser(
  data: LoginUserInput
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    auth,
    data.email.trim(),
    data.password
  );

  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function getUserProfile(
  uid: string
): Promise<ChatUser | null> {
  const snapshot = await getDoc(
    doc(firestore, 'users', uid)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as ChatUser;
}

export function observeAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}