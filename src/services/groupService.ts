import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';

import {
  firestore,
} from '@/services/firebase';

import {
  ChatGroup,
  CreateGroupInput,
  NotificationPolicy,
} from '@/types/group';

export type UpdateGroupSettingsInput = {
  name?: string;
  photoUrl?: string;
  memberLimit?: number;
  notificationPolicy?: NotificationPolicy;
};

function isNotificationPolicy(
  value: unknown
): value is NotificationPolicy {
  return (
    value === 'all_group_messages' ||
    value === 'mentioned_members' ||
    value === 'direct_messages_only' ||
    value === 'disabled'
  );
}

function isChatGroup(
  value: unknown
): value is ChatGroup {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const data =
    value as Record<string, unknown>;

  return (
    typeof data.id === 'string' &&
    typeof data.name === 'string' &&
    typeof data.photoUrl === 'string' &&
    typeof data.ownerId === 'string' &&
    Array.isArray(data.memberIds) &&
    data.memberIds.every(
      (memberId) =>
        typeof memberId === 'string'
    ) &&
    typeof data.memberLimit === 'number' &&
    isNotificationPolicy(
      data.notificationPolicy
    ) &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

export async function createGroup(
  input: CreateGroupInput
): Promise<ChatGroup> {
  const normalizedName =
    input.name.trim();

  if (!normalizedName) {
    throw new Error(
      'Informe o nome do grupo.'
    );
  }

  if (!input.photoUrl.trim()) {
    throw new Error(
      'Informe uma foto para o grupo.'
    );
  }

  if (
    !Number.isInteger(
      input.memberLimit
    ) ||
    input.memberLimit < 2
  ) {
    throw new Error(
      'O limite deve ser um número inteiro maior ou igual a 2.'
    );
  }

  const uniqueMembers =
    Array.from(
      new Set([
        input.ownerId,
        ...input.memberIds,
      ])
    );

  if (
    uniqueMembers.length < 2
  ) {
    throw new Error(
      'O grupo precisa possuir pelo menos dois integrantes.'
    );
  }

  if (
    uniqueMembers.length >
    input.memberLimit
  ) {
    throw new Error(
      'A quantidade de integrantes ultrapassa o limite do grupo.'
    );
  }

  const groupReference = doc(
    collection(
      firestore,
      'groups'
    )
  );

  const now = Date.now();

  const group: ChatGroup = {
    id: groupReference.id,
    name: normalizedName,
    photoUrl:
      input.photoUrl.trim(),
    ownerId:
      input.ownerId,
    memberIds:
      uniqueMembers,
    memberLimit:
      input.memberLimit,
    notificationPolicy:
      input.notificationPolicy,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(
    groupReference,
    group
  );

  return group;
}

export async function getGroupById(
  groupId: string
): Promise<ChatGroup | null> {
  const snapshot =
    await getDoc(
      doc(
        firestore,
        'groups',
        groupId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data: unknown =
    snapshot.data();

  if (!isChatGroup(data)) {
    throw new Error(
      'Dados do grupo são inválidos.'
    );
  }

  return data;
}

export async function getGroupsForUser(
  userId: string
): Promise<ChatGroup[]> {
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
      userId
    )
  );

  const snapshot =
    await getDocs(
      groupsQuery
    );

  const groups: ChatGroup[] =
    [];

  snapshot.forEach(
    (documentSnapshot) => {
      const data: unknown =
        documentSnapshot.data();

      if (isChatGroup(data)) {
        groups.push(data);
      }
    }
  );

  groups.sort(
    (first, second) =>
      second.updatedAt -
      first.updatedAt
  );

  return groups;
}

export async function addMemberToGroup(
  groupId: string,
  ownerId: string,
  newMemberId: string
): Promise<void> {
  if (
    ownerId === newMemberId
  ) {
    return;
  }

  const groupReference = doc(
    firestore,
    'groups',
    groupId
  );

  await runTransaction(
    firestore,
    async (transaction) => {
      const snapshot =
        await transaction.get(
          groupReference
        );

      if (!snapshot.exists()) {
        throw new Error(
          'Grupo não encontrado.'
        );
      }

      const data: unknown =
        snapshot.data();

      if (!isChatGroup(data)) {
        throw new Error(
          'Dados do grupo são inválidos.'
        );
      }

      if (
        data.ownerId !==
        ownerId
      ) {
        throw new Error(
          'Somente o proprietário pode adicionar integrantes.'
        );
      }

      if (
        data.memberIds.includes(
          newMemberId
        )
      ) {
        throw new Error(
          'Esse usuário já participa do grupo.'
        );
      }

      if (
        data.memberIds.length >=
        data.memberLimit
      ) {
        throw new Error(
          'O grupo atingiu o limite de integrantes.'
        );
      }

      transaction.update(
        groupReference,
        {
          memberIds: [
            ...data.memberIds,
            newMemberId,
          ],
          updatedAt:
            Date.now(),
        }
      );
    }
  );
}

export async function removeMemberFromGroup(
  groupId: string,
  ownerId: string,
  memberId: string
): Promise<void> {
  const groupReference = doc(
    firestore,
    'groups',
    groupId
  );

  await runTransaction(
    firestore,
    async (transaction) => {
      const snapshot =
        await transaction.get(
          groupReference
        );

      if (!snapshot.exists()) {
        throw new Error(
          'Grupo não encontrado.'
        );
      }

      const data: unknown =
        snapshot.data();

      if (!isChatGroup(data)) {
        throw new Error(
          'Dados do grupo são inválidos.'
        );
      }

      if (
        data.ownerId !==
        ownerId
      ) {
        throw new Error(
          'Somente o proprietário pode remover integrantes.'
        );
      }

      if (
        memberId ===
        data.ownerId
      ) {
        throw new Error(
          'O proprietário não pode remover a si mesmo.'
        );
      }

      if (
        !data.memberIds.includes(
          memberId
        )
      ) {
        throw new Error(
          'Esse usuário não pertence ao grupo.'
        );
      }

      const newMemberIds =
        data.memberIds.filter(
          (currentMemberId) =>
            currentMemberId !==
            memberId
        );

      if (
        newMemberIds.length < 2
      ) {
        throw new Error(
          'O grupo precisa manter pelo menos dois integrantes.'
        );
      }

      transaction.update(
        groupReference,
        {
          memberIds:
            newMemberIds,
          updatedAt:
            Date.now(),
        }
      );
    }
  );
}

export async function updateGroupSettings(
  groupId: string,
  ownerId: string,
  updates: UpdateGroupSettingsInput
): Promise<void> {
  const groupReference = doc(
    firestore,
    'groups',
    groupId
  );

  await runTransaction(
    firestore,
    async (transaction) => {
      const snapshot =
        await transaction.get(
          groupReference
        );

      if (!snapshot.exists()) {
        throw new Error(
          'Grupo não encontrado.'
        );
      }

      const groupData: unknown =
        snapshot.data();

      if (
        !isChatGroup(
          groupData
        )
      ) {
        throw new Error(
          'Dados do grupo são inválidos.'
        );
      }

      if (
        groupData.ownerId !==
        ownerId
      ) {
        throw new Error(
          'Somente o proprietário pode alterar o grupo.'
        );
      }

      const newName =
        updates.name !==
        undefined
          ? updates.name.trim()
          : groupData.name;

      if (!newName) {
        throw new Error(
          'O nome do grupo não pode ficar vazio.'
        );
      }

      const newPhotoUrl =
        updates.photoUrl !==
        undefined
          ? updates.photoUrl.trim()
          : groupData.photoUrl;

      if (!newPhotoUrl) {
        throw new Error(
          'O grupo precisa possuir uma foto.'
        );
      }

      const newMemberLimit =
        updates.memberLimit ??
        groupData.memberLimit;

      if (
        !Number.isInteger(
          newMemberLimit
        ) ||
        newMemberLimit < 2
      ) {
        throw new Error(
          'O limite deve ser um número inteiro maior ou igual a 2.'
        );
      }

      if (
        newMemberLimit <
        groupData.memberIds.length
      ) {
        throw new Error(
          `O grupo possui ${groupData.memberIds.length} integrantes. O limite não pode ser menor que isso.`
        );
      }

      const newPolicy =
        updates.notificationPolicy ??
        groupData.notificationPolicy;

      if (
        !isNotificationPolicy(
          newPolicy
        )
      ) {
        throw new Error(
          'Política de notificações inválida.'
        );
      }

      transaction.update(
        groupReference,
        {
          name: newName,
          photoUrl:
            newPhotoUrl,
          memberLimit:
            newMemberLimit,
          notificationPolicy:
            newPolicy,
          updatedAt:
            Date.now(),
        }
      );
    }
  );
}

export async function updateGroupMemberLimit(
  groupId: string,
  ownerId: string,
  newLimit: number
): Promise<void> {
  await updateGroupSettings(
    groupId,
    ownerId,
    {
      memberLimit:
        newLimit,
    }
  );
}

export async function updateGroupNotificationPolicy(
  groupId: string,
  ownerId: string,
  policy: NotificationPolicy
): Promise<void> {
  await updateGroupSettings(
    groupId,
    ownerId,
    {
      notificationPolicy:
        policy,
    }
  );
}