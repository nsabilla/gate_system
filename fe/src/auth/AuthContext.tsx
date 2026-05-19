import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

export type UserMe = {
  name: string;
  role: string;
  userid: string;
  badge: "prepared" | "approve";
  permissions: {
    rfq_crud: boolean;
    rfq_approve: boolean;
    pfs_crud: boolean;
    pfs_approve: boolean;
  };
};

const normalizeBadge = (value: unknown): "prepared" | "approve" => {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "approve" ? "approve" : "prepared";
};

const buildPermissions = (role: unknown, badge: "prepared" | "approve") => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "admin") {
    return {
      rfq_crud: true,
      rfq_approve: true,
      pfs_crud: true,
      pfs_approve: true,
    };
  }

  return {
    rfq_crud: normalizedRole === "marketing" && badge === "prepared",
    rfq_approve: normalizedRole === "marketing" && badge === "approve",
    pfs_crud: normalizedRole === "engineering" && badge === "prepared",
    pfs_approve: normalizedRole === "engineering" && badge === "approve",
  };
};

const normalizeUserMe = (raw: any): UserMe | null => {
  if (!raw) return null;
  const badge = normalizeBadge(raw?.badge);
  const permissions = {
    ...buildPermissions(raw?.role, badge),
    ...(raw?.permissions || {}),
  };

  return {
    name: String(raw?.name || ""),
    role: String(raw?.role || "").trim().toLowerCase(),
    userid: String(raw?.userid || ""),
    badge,
    permissions,
  };
};

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user: UserMe | null;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserMe | null>(null);

  const refreshMe = async () => {
    try {
      const res = await api.get("/me", { withCredentials: true });
      setUser(normalizeUserMe(res.data?.data));
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    refreshMe().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      await api.post("/logout", {}, { withCredentials: true });
    } finally {
      // always clear local state
      setUser(null);
      setIsAuthenticated(false);
    }
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, user, refreshMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
