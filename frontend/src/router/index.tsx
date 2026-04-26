import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { Layout } from "../components/common/Layout";
import { ProtectedRoute } from "../components/common/ProtectedRoute";
import { LandingPage } from "../pages/LandingPage";
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

export const router = createBrowserRouter(
  [
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/2fa", element: <TotpPage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout><DashboardPage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout><ProfilePage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/company",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout><CompanyPage /></Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/data",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyDataPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/data/:id",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyDatasetDetailPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/pipelines",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyPipelinePage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/pipelines/:id",
    element: (
      <ProtectedRoute blockAdmin>
        <SuspenseWrapper><LazyPipelineEditorPage /></SuspenseWrapper>
      </ProtectedRoute>
    ),
  },
  {
    path: "/pipelines/:pipelineId/compare",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyModelComparisonPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/models",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyModelRegistryPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/models/:versionId/results",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyResultsPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/billing",
    element: (
      <ProtectedRoute blockAdmin>
        <Layout>
          <SuspenseWrapper><LazyBillingPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute adminOnly>
        <Layout>
          <SuspenseWrapper><LazyAdminPage /></SuspenseWrapper>
        </Layout>
      </ProtectedRoute>
    ),
  },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);
