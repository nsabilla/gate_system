import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import type { JSX } from "react/jsx-dev-runtime";

type PermissionKey = "rfq_crud" | "rfq_approve" | "pfs_crud" | "pfs_approve";

const ProtectedRoute = ({
  children,
  roles,
  permissions,
}: {
  children: JSX.Element;
  roles?: string[];
  permissions?: PermissionKey[];
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <p>Loading...</p>;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (roles && roles.length > 0) {
    const role = user?.role || "";
    if (!roles.includes(role)) return <Navigate to="/main/dashboard" replace />;
  }

  if (permissions && permissions.length > 0) {
    const access = user?.permissions;
    const allowed = permissions.some((key) => Boolean(access?.[key]));
    if (!allowed) return <Navigate to="/main/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
