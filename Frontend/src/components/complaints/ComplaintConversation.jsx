import { useEffect, useState } from "react";
import { LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { useAuth } from "../../context/useAuth.js";
import {
  addComplaintCommentRequest,
  getComplaintCommentsRequest,
} from "../../services/api.js";

function formatMessageDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ComplaintConversation({ complaint }) {
  const { user, accessToken } = useAuth();
  const [comments, setComments] = useState(complaint.comments ?? []);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getComplaintCommentsRequest(complaint._id, accessToken)
      .then((data) => {
        if (active) setComments(data.comments ?? []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load messages.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [complaint._id, accessToken]);

  async function handleSubmit(event) {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage || sending) return;
    setSending(true);
    setError("");
    try {
      const data = await addComplaintCommentRequest(
        complaint._id,
        cleanMessage,
        accessToken,
      );
      setComments((current) => [...current, data.comment]);
      setMessage("");
    } catch (requestError) {
      setError(requestError.message || "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-4 sm:p-5" aria-labelledby={`complaint-conversation-${complaint._id}`}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
          <MessageSquareText size={18} />
        </span>
        <div>
          <h3 id={`complaint-conversation-${complaint._id}`} className="font-display font-bold text-ink">
            Complaint conversation
          </h3>
          <p className="text-xs text-muted">Messages are visible to the student, assigned staff, and administrators.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl bg-canvas/60 p-3" aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 py-3 text-sm text-muted">
            <LoaderCircle size={16} className="animate-spin" /> Loading messages…
          </p>
        ) : comments.length === 0 ? (
          <p className="py-3 text-sm text-muted">No messages yet. Use this conversation to ask for details or share an update.</p>
        ) : (
          comments.map((comment) => {
            const author = comment.authorSnapshot?.name || "Former account";
            const role = comment.authorRole ? comment.authorRole[0].toUpperCase() + comment.authorRole.slice(1) : "User";
            return (
              <article key={comment._id || `${comment.createdAt}-${author}`} className="rounded-xl border border-line bg-white p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-ink">{author} <span className="font-normal text-muted">· {role}</span></p>
                  <time className="text-xs text-muted" dateTime={comment.createdAt}>{formatMessageDate(comment.createdAt)}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{comment.message}</p>
              </article>
            );
          })
        )}
      </div>

      {user?.role !== "admin" && (
        <form onSubmit={handleSubmit} className="mt-4">
          <label htmlFor={`complaint-message-${complaint._id}`} className="mb-1.5 block text-sm font-semibold text-ink">Write a message</label>
          <textarea
            id={`complaint-message-${complaint._id}`}
            value={message}
            onChange={(event) => setMessage(event.target.value.slice(0, 1000))}
            maxLength={1000}
            rows={3}
            placeholder="Ask a question or share an update…"
            className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{message.length}/1000</span>
            <button type="submit" disabled={!message.trim() || sending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">
              {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              Send message
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
