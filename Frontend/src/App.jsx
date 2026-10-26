import { lazy, Suspense } from "react";
import { LoaderCircle } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";
import PublicOnlyRoute from "./components/auth/PublicOnlyRoute.jsx";

// Load each page only when its route is visited, keeping the initial app chunk small.
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const StaffDashboardPage = lazy(() => import("./pages/StaffDashboardPage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage.jsx"));
const ComplaintDetailsPage = lazy(() => import("./pages/ComplaintDetailsPage.jsx"));


export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="grid min-h-[40vh] place-items-center text-sm text-muted"><span className="inline-flex items-center gap-2"><LoaderCircle size={18} className="animate-spin text-brand" />Loading…</span></div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />


          <Route
            path="/forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />

          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRole="student">
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute allowedRole="staff">
                <StaffDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/complaints/:complaintId"
            element={<ProtectedRoute allowedRole="student"><ComplaintDetailsPage /></ProtectedRoute>}
          />
          <Route
            path="/staff/complaints/:complaintId"
            element={<ProtectedRoute allowedRole="staff"><ComplaintDetailsPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/complaints/:complaintId"
            element={<ProtectedRoute allowedRole="admin"><ComplaintDetailsPage /></ProtectedRoute>}
          />

          {/* Keep the legacy student URL available behind the same access check. */}
          <Route
            path="/app"
            element={
              <ProtectedRoute allowedRole="student">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
      </Suspense>
    </AuthProvider>
  );
}
