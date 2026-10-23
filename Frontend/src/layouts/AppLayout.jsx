import { useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/useAuth.js"
import { logoutRequest, logoutAllRequest } from "../services/api.js"
import AppHeader from "../components/layout/AppHeader.jsx"
import SignOutDialog from "../components/layout/SignOutDialog.jsx"


export default function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, setUser, accessToken, setAccessToken } = useAuth()

  const [showSignOutDialog, setShowSignOutDialog] = useState(false)
  const [signOutScope, setSignOutScope] = useState("current")
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState("")

  const isDashboard =
    location.pathname === "/app" || location.pathname.endsWith("/dashboard")
  const isLogin = location.pathname === "/login"
  const isRegister = location.pathname === "/register"

  async function handleConfirmSignOut() {
    setSigningOut(true)
    setSignOutError("")

    try {
      if (signOutScope === "all") {
        await logoutAllRequest(accessToken)
      } else {
        await logoutRequest(accessToken)
      }

      setUser(null)
      setAccessToken(null)
      setShowSignOutDialog(false)
      navigate("/login", { replace: true })
    } catch (error) {
      setSignOutError(error.message)
    } finally {
      setSigningOut(false)
    }
  }

  function handleOpenSignOutDialog() {
    setSignOutScope("current")
    setSignOutError("")
    setShowSignOutDialog(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <AppHeader
        isDashboard={isDashboard}
        isLogin={isLogin}
        isRegister={isRegister}
        user={user}
        onSignOut={handleOpenSignOutDialog}
      />

      {signOutError && !showSignOutDialog && (
        <p
          role="alert"
          className="bg-rose-50 px-4 py-2 text-center text-sm text-rose-800"
        >
          {signOutError}
        </p>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-7 text-xs text-muted sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} FixFlow</span>
        <span>Campus account support</span>
      </footer>

      <SignOutDialog
        open={showSignOutDialog}
        signOutScope={signOutScope}
        setSignOutScope={setSignOutScope}
        signOutError={signOutError}
        signingOut={signingOut}
        onClose={() => setShowSignOutDialog(false)}
        onConfirm={handleConfirmSignOut}
      />
    </div>
  )
}