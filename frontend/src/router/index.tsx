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
const LazyResultsPage = lazy(() =>
  import("../pages/ResultsPage").then((m) => ({ default: m.ResultsPage }))
);
const LazyModelComparisonPage = lazy(() =>
  import("../pages/ModelComparisonPage").then((m) => ({ default: m.ModelComparisonPage }))
);
const LazyBillingPage = lazy(() =>
  import("../pages/BillingPage").then((m) => ({ default: m.BillingPage }))
);
const LazyAdminPage = lazy(() =>
  import("../pages/AdminPage").then((m) => ({ default: m.AdminPage }))
);

// eslint-disable-next-line react-refresh/only-export-components
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
    path: "/pipelines/:pipelineId/compare",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyModelComparisonPage /></SuspenseWrapper>
        </Layout>
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
  {
    path: "/models/:versionId/results",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyResultsPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/billing",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyBillingPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <Layout>
          <SuspenseWrapper><LazyAdminPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
]);
