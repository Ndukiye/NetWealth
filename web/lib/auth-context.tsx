'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { User } from './types';

interface Session {
  accessToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('netwealth_token');
    const storedUser = localStorage.getItem('netwealth_user');
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  function persistSession(session: Session) {
    localStorage.setItem('netwealth_token', session.accessToken);
    localStorage.setItem('netwealth_user', JSON.stringify(session.user));
    setUser(session.user);
  }

  async function login(email: string, password: string) {
    const session = await api.post<Session>('/auth/login', { email, password });
    persistSession(session);
    router.push('/dashboard');
  }

  async function signup(email: string, password: string, fullName: string) {
    const session = await api.post<Session>('/auth/signup', {
      email,
      password,
      fullName,
    });
    persistSession(session);
    router.push('/dashboard');
  }

  function logout() {
    localStorage.removeItem('netwealth_token');
    localStorage.removeItem('netwealth_user');
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
