import { CircleHelp, Inbox, UserRound, Wrench } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";



const roleContent = {
  student: {
    label: "Student",
    title: "Your campus support starts here",
    description:
      "Your FixFlow account is ready. Campus support requests will be available here when your institution enables them.",
  },
  staff: {
    label: "Staff",
    title: "Welcome to FixFlow",
    description:
      "Your staff account is verified. Staff tools will appear here when they are supported by your institution.",
  },
  admin: {
    label: "Administrator",
    title: "Your workspace is ready",
    description:
      "Your administrator account is verified. Administration tools will appear here when they are supported by your institution.",
  },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const content = roleContent[user.role];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-7">
        <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-dark">
          {content.label} account
        </span>

        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Welcome, {user.username}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          {content.description}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <Wrench size={20} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">
                Support requests
              </h2>
              <p className="text-sm text-muted">Request tracking and updates</p>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-line bg-white/70 px-5 py-8 text-center">
            <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
              <Inbox size={21} />
            </span>
            <h3 className="font-display text-base font-bold">
              No request workspace yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Support request tracking will appear here when it is available.
            </p>
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                <UserRound size={19} />
              </span>
              <div>
                <h2 className="font-display font-bold">Account</h2>
                <p className="text-xs text-muted">Your verified profile</p>
              </div>
            </div>

            <dl className="mt-5 divide-y divide-line text-sm">
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-muted">Name</dt>
                <dd className="truncate font-semibold">{user.username}</dd>
              </div>
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-muted">Email</dt>
                <dd className="max-w-[65%] truncate font-semibold">
                  {user.email}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-muted">Role</dt>
                <dd className="font-semibold">{content.label}</dd>
              </div>
            </dl>
          </section>

          <section className="flex items-start gap-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-800">
              <CircleHelp size={18} />
            </span>
            <div>
              <h2 className="font-display font-bold">Getting started</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Your account is active. Ask your campus FixFlow administrator
                when request management will be available.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
