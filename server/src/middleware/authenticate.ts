import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  DecodedIdToken,
} from 'firebase-admin/auth';

import {
  adminAuth,
} from '../services/firebaseAdmin';

export interface AuthenticatedRequest
  extends Request {
  firebaseUser?:
    DecodedIdToken;
}

export async function authenticate(
  request:
    AuthenticatedRequest,
  response: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authorization =
      request.headers
        .authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        'Bearer '
      )
    ) {
      response.status(
        401
      ).json({
        error:
          'Token de autenticação ausente.',
      });

      return;
    }

    const idToken =
      authorization.substring(
        'Bearer '.length
      );

    const decodedToken =
      await adminAuth
        .verifyIdToken(
          idToken
        );

    request.firebaseUser =
      decodedToken;

    next();
  } catch (error) {
    console.error(
      'Erro de autenticação:',
      error
    );

    response.status(
      401
    ).json({
      error:
        'Token de autenticação inválido ou expirado.',
    });
  }
}