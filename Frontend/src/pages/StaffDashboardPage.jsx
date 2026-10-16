import { useAuth } from "../context/AuthContext.jsx"

export default function StaffDashboardPage() {
  const { user } = useAuth()

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
        Staff account
      </span>

      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        Welcome, {user.username}
      </h1>

      <p className="mt-2 text-muted">
        This is your staff dashboard.
      </p>

      <section className="mt-8 max-w-xl rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-display text-lg font-bold">Your account</h2>

        <dl className="mt-4 divide-y divide-line text-sm">
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-muted">Name</dt>
            <dd className="font-semibold">{user.username}</dd>
          </div>
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-muted">Email</dt>
            <dd className="max-w-[65%] truncate font-semibold">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-3 py-3">
            <dt className="text-muted">Role</dt>
            <dd className="font-semibold">Staff</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}