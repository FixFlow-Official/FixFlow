import { Navigate } from "react-router-dom"
import { useAuth } from "../../context/useAuth.js"

const dashboardPaths = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
}

export default function ProtectedRoute({ allowedRole, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <main className="p-8 text-center text-muted">Loading account…</main>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== allowedRole) {
    return (
      <Navigate
        to={dashboardPaths[user.role] || "/login"}
        replace
      />
    )
  }

  return children
}                           