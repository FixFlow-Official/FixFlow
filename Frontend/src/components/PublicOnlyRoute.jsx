import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext.jsx"

const dashboardPaths = {
  student: "/student/dashboard",
  staff: "/staff/dashboard",
  admin: "/admin/dashboard",
}

export default function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="p-8 text-center text-muted">
        Checking your account…
      </main>
    )
  }

  if (user) {
    const destination = dashboardPaths[user.role]

    if (destination) {
      return <Navigate to={destination} replace />
    }

    return (
      <main role="alert" className="p-8 text-center text-rose-800">
        Your account role isn’t recognized. Please contact your administrator.
      </main>
    )
  }

  return children
}