import { auth } from '@/services/firebase';

const API_BASE_URL =
  'https://cp2-mobile.onrender.com';

function getErrorMessage(
  value: unknown
): string | null {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return null;
  }

  const data =
    value as Record<string, unknown>;

  if (
    typeof data.error === 'string'
  ) {
    return data.error;
  }

  if (
    typeof data.message === 'string'
  ) {
    return data.message;
  }

  return null;
}

export async function requestMessagePush(
  conversationId: string,
  messageId: string
): Promise<void> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new Error(
      'Usuário não autenticado.'
    );
  }

  const idToken =
    await currentUser.getIdToken();

  const response =
    await fetch(
      `${API_BASE_URL}/notifications/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          conversationId,
          messageId,
        }),
      }
    );

  let responseData:
    unknown = null;

  try {
    responseData =
      await response.json();
  } catch {
    responseData = null;
  }

  if (!response.ok) {
    const apiMessage =
      getErrorMessage(
        responseData
      );

    throw new Error(
      apiMessage ??
        `Erro ao solicitar notificação. HTTP ${response.status}.`
    );
  }
}