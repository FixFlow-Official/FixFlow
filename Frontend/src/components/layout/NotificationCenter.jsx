import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, LoaderCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import PushNotificationControl from "./PushNotificationControl.jsx";
import {
  getNotificationsRequest,
  markAllNotificationsReadRequest,
  markNotificationReadRequest,
} from "../../services/api.js";

const complaintPaths = {
  student: "/student/complaints",
  staff: "/staff/complaints",
  admin: "/admin/complaints",
  fallback: "/student/dashboard",
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function NotificationCenter() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const refreshNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getNotificationsRequest(accessToken);
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Keep the shared header quiet if notifications are temporarily unavailable.
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!user) return undefined;
    const initialTimeoutId = window.setTimeout(() => refreshNotifications(), 0);
    const intervalId = window.setInterval(() => refreshNotifications(), 30000);
    const handleFocus = () => refreshNotifications();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(initialTimeoutId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [user, refreshNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutsideClick(event) {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  async function handleNotificationClick(notification) {
    if (!notification.readAt) {
      try {
        await markNotificationReadRequest(notification._id, accessToken);
        setNotifications((items) => items.map((item) => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Still let the user reach their dashboard if marking read fails.
      }
    }
    setOpen(false);
    const basePath = complaintPaths[user?.role] || complaintPaths.fallback;
    navigate(notification.complaint
      ? `${basePath}/${encodeURIComponent(notification.complaint)}`
      : basePath);
  }

  async function handleMarkAllRead() {
    setUpdating(true);
    try {
      await markAllNotificationsReadRequest(accessToken);
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // The unread badge will refresh on the next poll if the update failed.
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) refreshNotifications(true);
        }}
        className="relative grid size-10 place-items-center rounded-xl text-muted transition hover:bg-stone-100 hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/10"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section role="dialog" aria-label="Notifications" className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+76px)] z-[60] flex max-h-[min(78dvh,640px)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[min(92vw,390px)]">
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-display font-bold text-ink">Notifications</h2>
              <p className="text-xs text-muted">{unreadCount} unread</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={handleMarkAllRead} disabled={!unreadCount || updating} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50">
                {updating ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCheck size={15} />}
                Mark all read
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-stone-100 hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/10">
                <X size={18} />
              </button>
            </div>
          </header>
          <PushNotificationControl />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted"><LoaderCircle size={17} className="animate-spin" /> Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">You’re all caught up. Complaint updates will appear here.</p>
            ) : notifications.map((notification) => (
              <button key={notification._id} type="button" onClick={() => handleNotificationClick(notification)} className={`block w-full border-b border-line px-4 py-3 text-left transition hover:bg-canvas/70 ${notification.readAt ? "bg-white" : "bg-brand-soft/40"}`}>
                <span className="flex items-start gap-3">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.readAt ? "bg-slate-300" : "bg-brand"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{notification.title}</span>
                    <span className="mt-1 block text-xs font-medium text-brand">{notification.complaintTitle}</span>
                    <span className="mt-1 block text-sm leading-5 text-muted">{notification.message}</span>
                    <time className="mt-2 block text-[11px] text-muted" dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
