const CLOUDINARY_CLOUD_NAME = 'z7ohm9hr';

const CLOUDINARY_PROFILE_UPLOAD_PRESET =
  'firebase_chat_profiles';

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
};

function isCloudinaryUploadResponse(
  value: unknown
): value is CloudinaryUploadResponse {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return false;
  }

  const data =
    value as Record<string, unknown>;

  return (
    typeof data.secure_url === 'string' &&
    typeof data.public_id === 'string'
  );
}

async function uploadImage(
  base64: string,
  mimeType: string,
  folder: string
): Promise<string> {
  const endpoint =
    `https://api.cloudinary.com/v1_1/` +
    `${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const formData = new FormData();

  const dataUri =
    `data:${mimeType};base64,${base64}`;

  formData.append(
    'file',
    dataUri
  );

  formData.append(
    'upload_preset',
    CLOUDINARY_PROFILE_UPLOAD_PRESET
  );

  formData.append(
    'asset_folder',
    folder
  );

  const response = await fetch(
    endpoint,
    {
      method: 'POST',
      body: formData,
    }
  );

  const responseData: unknown =
    await response.json();

  if (!response.ok) {
    console.error(
      'Erro retornado pelo Cloudinary:',
      responseData
    );

    throw new Error(
      'Não foi possível enviar a imagem.'
    );
  }

  if (
    !isCloudinaryUploadResponse(
      responseData
    )
  ) {
    throw new Error(
      'Resposta inválida do serviço de imagens.'
    );
  }

  return responseData.secure_url;
}

export async function uploadProfileImage(
  base64: string,
  mimeType: string
): Promise<string> {
  return uploadImage(
    base64,
    mimeType,
    'firebase-chat/profiles'
  );
}

export async function uploadGroupImage(
  base64: string,
  mimeType: string
): Promise<string> {
  return uploadImage(
    base64,
    mimeType,
    'firebase-chat/groups'
  );
}