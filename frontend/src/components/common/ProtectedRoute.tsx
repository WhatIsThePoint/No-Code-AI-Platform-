import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authSlice";

interface Props {
  children: React.ReactNode;
  /**
   * When true, only super_admin may enter. Non-admin users are sent to /dashboard.
   */
  adminOnly?: boolean;
  /**
   * When true, super_admin is redirected away to /admin. Used on all non-admin
   * routes so an admin account can't accidentally browse into tenant surfaces.
   */
  blockAdmin?: boolean;
}

export function ProtectedRoute({ children, adminOnly, blockAdmin }: Props) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user?.role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  if (blockAdmin && user?.role === "super_admin") {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
