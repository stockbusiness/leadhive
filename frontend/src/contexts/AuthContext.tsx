import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import axios from "axios";

interface AuthUser {
  id: number;
  email: string;
  role: string;
  org_id: number;
  org_name: string;
  display_name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (orgName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("escms_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      const t = localStorage.getItem("escms_token");
      if (t) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${t}`;
      }
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("escms_token");
    if (!savedToken) {
      setLoading(false);
      return;
    }
    axios.get("/api/auth/me")
      .then((res) => {
        setUser({ ...res.data, display_name: res.data.display_name || "" });
        setToken(savedToken);
      })
      .catch(() => {
        localStorage.removeItem("escms_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post("/api/auth/login", { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem("escms_token", access_token);
    setToken(access_token);
    setUser({ ...userData, display_name: userData.display_name || "" });
  }, []);

  const register = useCallback(async (orgName: string, email: string, password: string) => {
    const res = await axios.post("/api/auth/register", { org_name: orgName, email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem("escms_token", access_token);
    setToken(access_token);
    setUser({ ...userData, display_name: userData.display_name || "" });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("escms_token");
    localStorage.removeItem("escms_project_id");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
