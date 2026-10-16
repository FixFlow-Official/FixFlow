import { Navigate, Route, Routes } from "react-router-dom"
import AppLayout from "./layouts/AppLayout.jsx"
import LoginPage from "./pages/LoginPage.jsx"
import RegisterPage from "./pages/RegisterPage.jsx"
import DashboardPage from "./pages/DashboardPage.jsx"
import StaffDashboardPage from "./pages/StaffDashboardPage.jsx"
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx"
import ProtectedRoute from "./components/ProtectedRoute.jsx"
import { AuthProvider } from "./context/AuthContext.jsx"

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

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

          {/* Keep the old URL working until we update login routing next. */}
          <Route path="/app" element={<DashboardPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}