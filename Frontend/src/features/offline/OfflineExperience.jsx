import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, WifiOff, Wrench, X } from "lucide-react";
import RunnerCanvas from "./CampusDashCanvas.jsx";
import { createGame, GROUND_Y } from "./campusDashConfig.js";

function readBestScore() {
  try {
    return Number(localStorage.getItem("fixflow-campus-dash-best") || 0);
  } catch {
    return 0;
  }
}

export default function OfflineExperience() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [dismissed, setDismissed] = useState(false);
  const [gameStatus, setGameStatus] = useState("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBestScore);
  const gameRef = useRef(createGame(readBestScore()));

  useEffect(() => {
    const handleOffline = () => {
      setOnline(false);
      setDismissed(false);
      gameRef.current = createGame(readBestScore());
      setGameStatus("ready");
      setScore(0);
      setBest(readBestScore());
    };
    const handleOnline = () => {
      setOnline(true);
      setDismissed(false);
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const startGame = useCallback(() => {
    gameRef.current = createGame(best);
    gameRef.current.status = "running";
    setScore(0);
    setGameStatus("running");
  }, [best]);

  const jump = useCallback(() => {
    const game = gameRef.current;
    if (game.status === "ready" || game.status === "over") {
      startGame();
      gameRef.current.runnerVelocity = -690;
      return;
    }
    if (game.status === "running" && game.runnerBottom >= GROUND_Y) {
      game.runnerVelocity = -690;
    }
  }, [startGame]);

  const togglePause = useCallback(() => {
    const game = gameRef.current;
    if (game.status === "running") {
      game.status = "paused";
      setGameStatus("paused");
    } else if (game.status === "paused") {
      game.status = "running";
      setGameStatus("running");
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (online || dismissed) return;
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        jump();
      } else if (event.code === "Escape" || event.code === "KeyP") {
        togglePause();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismissed, jump, online, togglePause]);

  const handleScore = useCallback((nextScore, nextBest) => {
    setScore(nextScore);
    setBest(nextBest);
  }, []);

  const handleGameOver = useCallback((nextScore, nextBest) => {
    setScore(nextScore);
    setBest(nextBest);
    setGameStatus("over");
  }, []);

  if (online) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="fixed bottom-4 right-4 z-[100] inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl"
      >
        <WifiOff size={16} /> Offline · Play Campus Dash
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-md sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-title"
        className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/70 bg-white p-4 shadow-2xl [scrollbar-width:none] sm:max-h-[calc(100dvh-3rem)] sm:p-6 [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Close offline game"
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 sm:right-5 sm:top-5"
        >
          <X size={19} />
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4 pr-12 sm:pr-14">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              <WifiOff size={14} /> You’re offline
            </div>
            <h1 id="offline-title" className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              Take a quick campus dash
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              FixFlow will reconnect when your internet returns. Until then, help our campus repair worker dodge the mess.
            </p>
          </div>

          <div className="flex gap-2 pt-1 pr-1">
            <div className="rounded-2xl bg-brand-soft px-4 py-2 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Score</span>
              <span className="font-display text-xl font-extrabold tabular-nums text-brand">{String(score).padStart(5, "0")}</span>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Best</span>
              <span className="font-display text-xl font-extrabold tabular-nums text-ink">{String(best).padStart(5, "0")}</span>
            </div>
          </div>
        </div>

        <div className="relative mt-5 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 shadow-inner">
          <RunnerCanvas
            gameRef={gameRef}
            gameStatus={gameStatus}
            onScore={handleScore}
            onGameOver={handleGameOver}
            onJump={jump}
          />
          {gameStatus === "ready" && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/20 p-4 text-center backdrop-blur-[2px]">
              <div className="rounded-2xl border border-white/70 bg-white/95 px-6 py-5 shadow-xl">
                <Wrench className="mx-auto mb-2 text-brand" size={27} />
                <h2 className="font-display text-xl font-extrabold text-ink">Ready, repair runner?</h2>
                <p className="mt-1 text-sm text-muted">Jump toolboxes, bins, barriers, puddles, and cables. Grab wrenches for bonus points.</p>
                <button type="button" onClick={startGame} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-md transition hover:bg-brand-dark">
                  <Play size={16} fill="currentColor" /> Start running
                </button>
              </div>
            </div>
          )}
          {gameStatus === "paused" && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/25 backdrop-blur-[2px]">
              <div className="rounded-2xl bg-white/95 px-7 py-5 text-center shadow-xl">
                <h2 className="font-display text-xl font-extrabold text-ink">Run paused</h2>
                <button type="button" onClick={togglePause} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white">
                  <Play size={15} fill="currentColor" /> Resume
                </button>
              </div>
            </div>
          )}
          {gameStatus === "over" && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/25 p-4 backdrop-blur-[2px]">
              <div className="rounded-2xl bg-white/95 px-7 py-5 text-center shadow-xl">
                <h2 className="font-display text-xl font-extrabold text-ink">Run over</h2>
                <p className="mt-1 text-sm text-muted">Campus won this round. Your best score is saved on this device.</p>
                <button type="button" onClick={startGame} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white">
                  <RotateCcw size={15} /> Play again
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            <span className="font-semibold text-ink">Controls:</span> Space / ↑ / tap to jump · P / Esc to pause
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={jump}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink shadow-sm hover:bg-slate-50 sm:hidden"
            >
              <Play size={15} fill="currentColor" /> Jump
            </button>
            {gameStatus === "running" && (
              <button type="button" onClick={togglePause} aria-label="Pause game" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink shadow-sm hover:bg-slate-50">
                <Pause size={15} /> Pause
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
