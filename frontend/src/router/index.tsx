import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { Layout } from "../components/common/Layout";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { TotpPage } from "../pages/TotpPage";
import { ProfilePage } from "../pages/ProfilePage";
import { CompanyPage } from "../pages/CompanyPage";

// Lazy-loaded pages
const LazyDataPage = lazy(() => import("../pages/DataPage").then((m) => ({ default: m.DataPage })));
const LazyDatasetDetailPage = lazy(() =>
  import("../pages/DatasetDetailPage").then((m) => ({ default: m.DatasetDetailPage }))
);
const LazyPipelinePage = lazy(() =>
  import("../pages/PipelinePage").then((m) => ({ default: m.PipelinePage }))
);
const LazyPipelineEditorPage = lazy(() =>
  import("../pages/PipelineEditorPage").then((m) => ({ default: m.PipelineEditorPage }))
);
const LazyModelRegistryPage = lazy(() =>
  import("../pages/ModelRegistryPage").then((m) => ({ default: m.ModelRegistryPage }))
);

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
  {
    path: "/pipelines",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyPipelinePage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/pipelines/:id",
    element: (
      <ProtectedRoute>
        <SuspenseWrapper><LazyPipelineEditorPage /></SuspenseWrapper>
      </ProtectedRoute>
    ),
  },
  {
    path: "/models",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyModelRegistryPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
]);
