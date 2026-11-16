import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Crown,
  Flame,
  Info,
  LoaderCircle,
  Lock,
  Medal,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  getStudentReputationRequest,
  getStudentLeaderboardRequest,
  updateStudentReputationRequest,
} from "../../services/api.js";

const ALL_BADGES = [
  {
    name: "Early Hazard Spotter",
    description: "Awarded for reporting your first verified P1 critical or safety concern.",
    icon: ShieldAlert,
    color: "amber",
  },
  {
    name: "Campus Guardian",
    description: "Awarded after reaching 5 successfully verified facility repairs.",
    icon: ShieldCheck,
    color: "emerald",
  },
  {
    name: "Reliable Reporter",
    description: "Milestone unlocked upon reaching 50 total reputation points.",
    icon: Trophy,
    color: "purple",
  },
];

export default function StudentReputationLeaderboard({ accessToken, onBack }) {
  const [reputation, setReputation] = useState({
    points: 0,
    badges: [],
    verifiedReports: 0,
    leaderboardOptIn: true,
    rank: null,
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [optInLoading, setOptInLoading] = useState(false);
  const [optInSuccess, setOptInSuccess] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [repData, lbData] = await Promise.all([
        getStudentReputationRequest(accessToken),
        getStudentLeaderboardRequest(accessToken, 20),
      ]);

      setReputation({
        points: repData.points || 0,
        badges: repData.badges || [],
        verifiedReports: repData.verifiedReports || 0,
        leaderboardOptIn: repData.leaderboardOptIn !== false,
        rank: repData.rank || null,
      });

      setLeaderboard(lbData.leaderboard || []);
    } catch (err) {
      setError(err.message || "Could not load reputation data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggleOptIn() {
    setOptInLoading(true);
    setOptInSuccess("");
    const newValue = !reputation.leaderboardOptIn;

    try {
      await updateStudentReputationRequest({ leaderboardOptIn: newValue }, accessToken);
      setReputation((prev) => ({ ...prev, leaderboardOptIn: newValue }));
      setOptInSuccess(newValue ? "You are now visible on the leaderboard!" : "You have been hidden from the leaderboard.");
      setTimeout(() => setOptInSuccess(""), 4000);
      loadData(true);
    } catch (err) {
      setError(err.message || "Could not update leaderboard preference.");
    } finally {
      setOptInLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink shadow-2xs transition hover:border-brand hover:text-brand active:scale-[0.98]"
          >
            <ArrowLeft size={16} /> Back to report issue
          </button>
        )}

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={loading || refreshing}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink shadow-2xs transition hover:bg-stone-50 active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {optInSuccess && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{optInSuccess}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-muted">
          <LoaderCircle size={28} className="animate-spin text-brand" />
          <span>Loading Campus Guardians reputation…</span>
        </div>
      ) : (
        <>
          {/* Header Banner */}
          <section className="relative overflow-hidden rounded-3xl border border-white bg-gradient-to-br from-white via-white to-[#e8f3ef] p-6 shadow-sm ring-1 ring-line/70 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-brand-soft/70 blur-3xl" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
                  <ShieldCheck size={14} className="text-brand" />
                  Campus Guardians Program
                </span>
                <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                  Your Facility Reputation
                </h1>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">
                  Earn points and badges only when your reported issues are fixed and verified. Spam reports earn 0 points.
                </p>
              </div>

              {/* Opt-in toggle */}
              <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-line/80 bg-white/90 p-3 shadow-2xs backdrop-blur-sm">
                <label htmlFor="optin-toggle" className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-ink">
                  <input
                    id="optin-toggle"
                    type="checkbox"
                    checked={reputation.leaderboardOptIn}
                    onChange={handleToggleOptIn}
                    disabled={optInLoading}
                    className="size-4 rounded border-line text-brand focus:ring-brand/20"
                  />
                  <span>Show me on campus leaderboard</span>
                </label>
              </div>
            </div>
          </section>

          {/* User Scorecard Bento Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Points */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Reputation Points</span>
                <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                  <Trophy size={18} />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {reputation.points}
                <span className="ml-1 text-sm font-semibold text-muted">pts</span>
              </p>
              <p className="mt-1 text-xs text-muted">Based on verified resolutions</p>
            </div>

            {/* Campus Rank */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Campus Standing</span>
                <span className="grid size-9 place-items-center rounded-xl bg-purple-50 text-purple-600">
                  <Crown size={18} />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {reputation.rank ? `#${reputation.rank}` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {reputation.rank ? "Rank on campus leaderboard" : "Verify a fix to rank"}
              </p>
            </div>

            {/* Verified Reports */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Verified Fixes</span>
                <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={18} />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {reputation.verifiedReports}
              </p>
              <p className="mt-1 text-xs text-muted">Confirmed repair outcomes</p>
            </div>

            {/* Badges Unlocked */}
            <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Badges Earned</span>
                <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
                  <Medal size={18} />
                </span>
              </div>
              <p className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {reputation.badges?.length || 0}
                <span className="ml-1 text-sm font-semibold text-muted">/ 3</span>
              </p>
              <p className="mt-1 text-xs text-muted">Guardian milestones</p>
            </div>
          </div>

          {/* Badges Showcase */}
          <section className="rounded-3xl border border-line bg-white p-6 shadow-2xs sm:p-7">
            <h2 className="font-display text-lg font-bold text-ink">Campus Guardian Badges</h2>
            <p className="mt-1 text-xs text-muted">Earn special badges by identifying urgent issues and verifying campus repairs.</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {ALL_BADGES.map((badge) => {
                const Icon = badge.icon;
                const isEarned = reputation.badges?.includes(badge.name);

                return (
                  <div
                    key={badge.name}
                    className={`relative flex flex-col justify-between rounded-2xl border p-5 transition ${
                      isEarned
                        ? "border-emerald-300 bg-gradient-to-br from-emerald-50/70 to-white shadow-xs"
                        : "border-line bg-stone-50/60 opacity-80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-11 place-items-center rounded-xl ${
                            isEarned ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          <Icon size={22} />
                        </span>
                        {isEarned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            <CheckCircle2 size={12} /> Unlocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            <Lock size={11} /> Locked
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 font-display text-base font-bold text-ink">{badge.name}</h3>
                      <p className="mt-1.5 text-xs leading-5 text-muted">{badge.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Grid: How it Works & Campus Leaderboard */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left: How Points Work (2 cols) */}
            <section className="rounded-3xl border border-line bg-white p-6 shadow-2xs lg:col-span-2">
              <h2 className="font-display text-lg font-bold text-ink">How Points Work</h2>
              <p className="mt-1 text-xs text-muted">Fair and spam-proof reputation rules.</p>

              <div className="mt-5 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl border border-line/60 bg-stone-50/70 p-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-800">
                    +10
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Verified Fix</p>
                    <p className="text-[11px] text-muted">Awarded when an issue you reported is resolved and verified.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-line/60 bg-stone-50/70 p-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-xs font-bold text-amber-800">
                    +25
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">P1 Safety Hazard</p>
                    <p className="text-[11px] text-muted">Bonus points for catching critical safety and high-priority repairs.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-line/60 bg-stone-50/70 p-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-100 text-xs font-bold text-sky-800">
                    +5
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink">Community Impact</p>
                    <p className="text-[11px] text-muted">Bonus points if 5 or more students upvote (+1 Me Too) your report.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-line/60 bg-rose-50/50 p-3.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-100 text-xs font-bold text-rose-800">
                    0
                  </span>
                  <div>
                    <p className="text-xs font-bold text-rose-950">Submissions Alone</p>
                    <p className="text-[11px] text-rose-800/80">Submitting complaints never awards points. Fixes must be verified.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Right: Leaderboard (3 cols) */}
            <section className="rounded-3xl border border-line bg-white p-6 shadow-2xs lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">Campus Guardians Leaderboard</h2>
                  <p className="mt-0.5 text-xs text-muted">Top contributing student facility reporters.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                  {leaderboard.length} active
                </span>
              </div>

              {leaderboard.length === 0 ? (
                <div className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-canvas/60 p-6 text-center">
                  <Trophy size={28} className="text-muted" />
                  <p className="mt-3 font-display font-bold text-ink">No verified guardians yet</p>
                  <p className="mt-1 text-xs text-muted">Be the first student to verify a repair and take the #1 spot!</p>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  {leaderboard.map((leader) => {
                    const isTop1 = leader.rank === 1;
                    const isTop2 = leader.rank === 2;
                    const isTop3 = leader.rank === 3;

                    return (
                      <div
                        key={`${leader.rank}-${leader.firstName}`}
                        className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition ${
                          isTop1
                            ? "border-amber-300 bg-amber-50/40 shadow-xs"
                            : isTop2
                              ? "border-slate-300 bg-slate-50/50"
                              : isTop3
                                ? "border-amber-200/60 bg-amber-50/20"
                                : "border-line/70 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid size-8 place-items-center rounded-xl text-xs font-extrabold ${
                              isTop1
                                ? "bg-amber-400 text-amber-950 shadow-xs"
                                : isTop2
                                  ? "bg-slate-300 text-slate-800"
                                  : isTop3
                                    ? "bg-amber-200 text-amber-900"
                                    : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${leader.rank}`}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-ink">{leader.firstName}</span>
                              {leader.badges?.length > 0 && (
                                <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">
                                  {leader.badges[0]}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted">
                              {leader.verifiedReports} verified {leader.verifiedReports === 1 ? "repair" : "repairs"}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-display text-base font-extrabold tabular-nums text-ink">
                            {leader.points}
                          </span>
                          <span className="ml-1 text-xs text-muted">pts</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 text-center text-[11px] text-muted">
                🛡️ Privacy guaranteed: Only first names are shown. Student emails, phones, and IDs are never shared.
              </p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
