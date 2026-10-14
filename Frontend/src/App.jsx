import { Navigate, Route, Routes } from 'react-router-dom'

function LoginPage() {
  return <h1>Login screen</h1>
}

function RegisterPage() {
  return <h1>Registration screen</h1>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
    </Routes>
  )
}