import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ApiResponse, User, UserRole } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SESSION_KEY = 'dwecs-session';

function getRequestErrorMessage(error: ApiResponse['error'], status: number) {
  const fallback = `Request failed (${status})`;
  if (!error) return fallback;

  if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    const validationMessages = error.details.flatMap((detail) => {
      if (typeof detail !== 'object' || detail === null || !('msg' in detail)) return [];
      const field = 'path' in detail && typeof detail.path === 'string' ? `${detail.path}: ` : '';
      return [`${field}${String(detail.msg)}`];
    });
    if (validationMessages.length) return validationMessages.join(' ');
  }

  return error.message || fallback;
}

interface AuthSession {
  token: string;
  user: User;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: UserRole, district?: string) => Promise<User>;
  testLogin: (role: UserRole) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export function getAuthToken() {
  try {
    return (JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as AuthSession | null)?.token;
  } catch {
    return undefined;
  }
}

async function authRequest(path: string, body?: unknown, token?: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json() as ApiResponse<AuthSession | User>;
  if (!response.ok || !result.success || !result.data) {
    throw new Error(getRequestErrorMessage(result.error, response.status));
  }
  return result.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    let token = '';
    try { token = (JSON.parse(stored) as AuthSession).token; } catch { /* discard corrupt session */ }
    if (!token) {
      saveSession(null);
      setLoading(false);
      return;
    }
    authRequest('/auth/me', undefined, token)
      .then((user) => {
        const next = { token, user: user as User };
        setSession(next);
        saveSession(next);
      })
      .catch(() => saveSession(null))
      .finally(() => setLoading(false));
  }, []);

  const establishSession = async (path: string, body: unknown) => {
    const result = await authRequest(path, body) as AuthSession;
    setSession(result);
    saveSession(result);
    return result.user;
  };

  const value: AuthContextValue = {
    session,
    loading,
    login: (email, password) => establishSession('/auth/login', { email, password }),
    register: (name, email, password, role, district) => establishSession('/auth/register', { name, email, password, role, district }),
    testLogin: (role) => establishSession('/auth/test-login', { role }),
    logout: () => {
      setSession(null);
      saveSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}