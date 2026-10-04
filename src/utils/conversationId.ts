export function createDirectConversationId(
  firstUserId: string,
  secondUserId: string
): string {
  if (firstUserId === secondUserId) {
    throw new Error(
      'Não é possível criar uma conversa consigo mesmo.'
    );
  }

  const sortedUserIds = [
    firstUserId,
    secondUserId,
  ].sort();

  return `${sortedUserIds[0]}_${sortedUserIds[1]}`;
}