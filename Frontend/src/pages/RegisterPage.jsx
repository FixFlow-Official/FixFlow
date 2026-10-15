import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

const steps = ['Verify ID', 'Check email', 'Set password']

const roleNames = {
  student: 'Student',
  staff: 'Staff',
  admin: 'Administrator',
}

const idLabels = {
  student: 'Student roll number',
  staff: 'Staff ID',
  admin: 'Admin ID',
}

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [type, setType] = useState('student')
  const [id, setId] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    // For now, advance through the UI without calling the backend.
    if (step < 2) setStep(step + 1)
    else console.log({ type, id, otp, password })
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand"
        >
          <ArrowLeft size={16} />
          Back to sign in
        </Link>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8">
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
            Institution verified
          </span>

          <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Create your account
          </h1>

          <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
            FixFlow checks your campus ID against your institution’s approved
            directory.
          </p>

          <ol className="my-7 grid grid-cols-3 gap-2 sm:gap-4">
            {steps.map((title, index) => (
              <li key={title} className="min-w-0">
                <div
                  className={`flex items-center gap-2 border-t-2 pt-3 ${
                    step >= index
                      ? 'border-brand text-brand'
                      : 'border-line text-slate-400'
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full ${
                      step > index
                        ? 'bg-brand text-white'
                        : step === index
                          ? 'bg-brand-soft'
                          : 'bg-slate-100'
                    }`}
                  >
                    {step > index ? <Check size={15} /> : index + 1}
                  </span>
                  <span className="truncate text-xs font-semibold sm:text-sm">
                    {title}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 0 && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    I am registering as
                  </span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  >
                    {Object.entries(roleNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">{idLabels[type]}</span>
                  <input
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    autoComplete="off"
                    placeholder="Enter your campus ID"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                  <span className="block text-xs leading-5 text-muted">
                    Use the ID issued by your institution. A one-time code will
                    be sent to the email on file.
                  </span>
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <div className="rounded-xl bg-brand-soft/70 p-4 text-sm leading-6 text-brand-dark">
                  Enter the 6-digit code sent to the email address registered to
                  this {roleNames[type].toLowerCase()} ID.
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">
                    Verification code
                  </span>
                  <input
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 text-center font-mono text-xl tracking-[0.35em] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Create password</span>
                  <span className="block text-xs text-muted">
                    Use at least 8 characters.
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Confirm password</span>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    className="min-h-12 w-full rounded-xl border border-line bg-white px-3.5 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </label>
              </>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="min-h-11 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
                >
                  Back
                </button>
              ) : (
                <span />
              )}

              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {step === 2
                  ? 'Create account'
                  : step === 1
                    ? 'Verify email'
                    : 'Send verification code'}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </section>

        <p className="mt-5 text-center text-sm text-muted">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}