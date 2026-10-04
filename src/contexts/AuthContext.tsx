import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { User } from 'firebase/auth';

import {
  getUserProfile,
  logoutUser,
  observeAuthState,
} from '@/services/authService';

import { auth } from '@/services/firebase';
import { ChatUser } from '@/types/user';

type AuthContextData = {
  firebaseUser: User | null;
  userProfile: ChatUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

const AuthContext = createContext<AuthContextData | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] =
    useState<User | null>(null);

  const [userProfile, setUserProfile] =
    useState<ChatUser | null>(null);

  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (uid: string) => {
      try {
        const profile = await getUserProfile(uid);
        setUserProfile(profile);
      } catch (error) {
        console.error(
          'Erro ao carregar perfil:',
          error
        );

        setUserProfile(null);
      }
    },
    []
  );

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setUserProfile(null);
      return;
    }

    setFirebaseUser(currentUser);

    await loadProfile(currentUser.uid);
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await logoutUser();

    setFirebaseUser(null);
    setUserProfile(null);
  }, []);

  useEffect(() => {
    const unsubscribe = observeAuthState(
      async (user) => {
        try {
          setFirebaseUser(user);

          if (user) {
            await loadProfile(user.uid);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error(
            'Erro ao recuperar sessão:',
            error
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return unsubscribe;
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      firebaseUser,
      userProfile,
      loading,
      logout,
      refreshProfile,
    }),
    [
      firebaseUser,
      userProfile,
      loading,
      logout,
      refreshProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth deve ser utilizado dentro de AuthProvider'
    );
  }

  return context;
}