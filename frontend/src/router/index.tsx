import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "../components/common/Layout";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { TotpPage } from "../pages/TotpPage";
import { ProfilePage } from "../pages/ProfilePage";
import { CompanyPage } from "../pages/CompanyPage";

// Data pages — imported lazily to keep initial bundle small
const DataPage = () => import("../pages/DataPage").then((m) => ({ default: m.DataPage }));
const DatasetDetailPage = () =>
  import("../pages/DatasetDetailPage").then((m) => ({ default: m.DatasetDetailPage }));

import { lazy, Suspense } from "react";
import { CircularProgress, Box } from "@mui/material";

const LazyDataPage = lazy(DataPage);
const LazyDatasetDetailPage = lazy(DatasetDetailPage);

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>}>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/2fa", element: <TotpPage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Layout><DashboardPage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <Layout><ProfilePage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/company",
    element: (
      <ProtectedRoute>
        <Layout><CompanyPage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/data",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyDataPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/data/:id",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyDatasetDetailPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
]);
