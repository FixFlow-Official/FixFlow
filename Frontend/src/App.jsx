import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import StaffDashboardPage from "./pages/StaffDashboardPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import { AuthProvider } from "./context/AuthProvider.jsx";
import PublicOnlyRoute from "./components/auth/PublicOnlyRoute.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ComplaintDetailsPage from "./pages/ComplaintDetailsPage.jsx";


export default function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
