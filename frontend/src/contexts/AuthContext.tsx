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
  onboarding_completed: boolean;
  is_system_admin: boolean;
  is_founder: boolean;
  registration_number: number | null;
  feature_ec_discovery: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (orgName: string, email: string, password: string, displayName?: string, phone?: string, corporateNumber?: string) => Promise<{ requires_verification: boolean; email: string; email_sent: boolean; verify_url?: string | null }>;
  loginFromToken: (accessToken: string, userData: AuthUser) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => ({ requires_verification: false, email: "", email_sent: false }),
  loginFromToken: () => {},
  logout: () => {},
  updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("leadhive_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interceptor = axios.interceptors.request.use((config) => {
      const t = localStorage.getItem("leadhive_token");
      if (t) {
        config.headers = config.headers || {};
        config.headers["Authorization"] = `Bearer ${t}`;
      }
      return config;
    });
    return () => axios.interceptors.request.eject(interceptor);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("leadhive_token");
    if (!savedToken) {
      setLoading(false);
      return;
    }
    axios.get("/api/auth/me")
      .then((res) => {
        setUser({
          ...res.data,
          display_name: res.data.display_name || "",
          is_system_admin: !!res.data.is_system_admin,
          is_founder: !!res.data.is_founder,
          registration_number: res.data.registration_number ?? null,
          feature_ec_discovery: !!res.data.feature_ec_discovery,
        });
        setToken(savedToken);
      })
      .catch(() => {
        localStorage.removeItem("leadhive_token");
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post("/api/auth/login", { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem("leadhive_token", access_token);
    setToken(access_token);
    setUser({
      ...userData,
      display_name: userData.display_name || "",
      is_system_admin: !!userData.is_system_admin,
      is_founder: !!userData.is_founder,
      registration_number: userData.registration_number ?? null,
      feature_ec_discovery: !!userData.feature_ec_discovery,
    });
  }, []);

  const register = useCallback(async (orgName: string, email: string, password: string, displayName?: string, phone?: string, corporateNumber?: string) => {
    const res = await axios.post("/api/auth/register", {
      org_name: orgName,
      email,
      password,
      display_name: displayName || "",
      phone: phone || "",
      corporate_number: corporateNumber || "",
    });
    return {
      requires_verification: res.data.requires_verification ?? false,
      email: res.data.email ?? email,
      email_sent: res.data.email_sent ?? false,
      verify_url: res.data.verify_url ?? null,
    };
  }, []);

  const loginFromToken = useCallback((accessToken: string, userData: AuthUser) => {
    localStorage.setItem("leadhive_token", accessToken);
    setToken(accessToken);
    setUser({
      ...userData,
      display_name: userData.display_name || "",
      is_system_admin: !!userData.is_system_admin,
      is_founder: !!userData.is_founder,
      registration_number: userData.registration_number ?? null,
      feature_ec_discovery: !!userData.feature_ec_discovery,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("leadhive_token");
    localStorage.removeItem("leadhive_project_id");
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  useEffect(() => {
    function getTokenExp(t: string): number | null {
      try {
        const payload = JSON.parse(atob(t.split(".")[1]));
        return payload.exp ?? null;
      } catch {
        return null;
      }
    }

    async function tryRefresh() {
      const t = localStorage.getItem("leadhive_token");
      if (!t) return;
      const exp = getTokenExp(t);
      if (!exp) return;
      const nowSec = Math.floor(Date.now() / 1000);
      const remainingSec = exp - nowSec;
      if (remainingSec > 60 * 60 * 24) return;
      try {
        const res = await axios.post("/api/auth/refresh");
        const newToken = res.data.access_token;
        localStorage.setItem("leadhive_token", newToken);
        setToken(newToken);
      } catch {
        /* keep using current token */
      }
    }

    tryRefresh();
    const id = setInterval(tryRefresh, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginFromToken, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
