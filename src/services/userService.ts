import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { firestore } from '@/services/firebase';
import { ChatUser } from '@/types/user';

import {
  createDirectConversationId,
} from '@/utils/conversationId';

export async function getUsersExcept(
  currentUserId: string
): Promise<ChatUser[]> {
  const snapshot = await getDocs(
    collection(
      firestore,
      'users'
    )
  );

  const users: ChatUser[] = [];

  snapshot.forEach(
    (documentSnapshot) => {
      const data =
        documentSnapshot.data();

      const user: ChatUser = {
        uid: data.uid,
        name: data.name,
        email: data.email,
        phoneNumber:
          data.phoneNumber,
        birthDate:
          data.birthDate,
        photoUrl:
          data.photoUrl,
        createdAt:
          data.createdAt,
      };

      users.push(user);
    }
  );

  return users
    .filter(
      (user) =>
        user.uid !==
        currentUserId
    )
    .sort(
      (
        firstUser,
        secondUser
      ) =>
        firstUser.name.localeCompare(
          secondUser.name
        )
    );
}

export async function getUserById(
  userId: string
): Promise<ChatUser | null> {
  const snapshot =
    await getDoc(
      doc(
        firestore,
        'users',
        userId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  const user: ChatUser = {
    uid: data.uid,
    name: data.name,
    email: data.email,
    phoneNumber:
      data.phoneNumber,
    birthDate:
      data.birthDate,
    photoUrl:
      data.photoUrl,
    createdAt:
      data.createdAt,
  };

  return user;
}

export async function canViewUserProfile(
  currentUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (
    currentUserId ===
    targetUserId
  ) {
    return true;
  }

  const conversationId =
    createDirectConversationId(
      currentUserId,
      targetUserId
    );

  const conversationSnapshot =
    await getDoc(
      doc(
        firestore,
        'directConversations',
        conversationId
      )
    );

  if (
    conversationSnapshot.exists()
  ) {
    return true;
  }

  const groupsReference =
    collection(
      firestore,
      'groups'
    );

  const groupsQuery = query(
    groupsReference,
    where(
      'memberIds',
      'array-contains',
      currentUserId
    )
  );

  const groupsSnapshot =
    await getDocs(
      groupsQuery
    );

  let shareGroup = false;

  groupsSnapshot.forEach(
    (groupSnapshot) => {
      const data =
        groupSnapshot.data();

      const memberIds:
        unknown =
          data.memberIds;

      if (
        Array.isArray(
          memberIds
        ) &&
        memberIds.includes(
          targetUserId
        )
      ) {
        shareGroup = true;
      }
    }
  );

  return shareGroup;
}