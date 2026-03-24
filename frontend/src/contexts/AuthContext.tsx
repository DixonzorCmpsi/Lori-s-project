import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@/types';
import { getMe, login as loginApi, logout as logoutApi } from '@/services/auth';
import { getStoredToken, setStoredToken, clearStoredToken } from '@/services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
  setToken: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  const setToken = useCallback((newToken: string) => {
    setStoredToken(newToken);
    setTokenState(newToken);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginApi(email, password);
    setToken(response.access_token);
    const me = await getMe();
    setUser(me);
  }, [setToken]);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore errors on logout
    }
    clearStoredToken();
    setTokenState(null);
    setUser(null);
  }, []);

  // Validate stored token on mount
  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      getMe()
        .then(setUser)
        .catch(() => {
          clearStoredToken();
          setTokenState(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        setUser,
        setToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
