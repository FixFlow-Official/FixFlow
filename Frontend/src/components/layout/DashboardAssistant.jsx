import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  LoaderCircle,
  MessageCircle,
  Mic,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useAuth } from "../../context/useAuth.js";
import { sendAssistantMessageRequest } from "../../services/api.js";

const greeting = "Hi! I can guide you around FixFlow and help explain the complaint workflow. I can’t access or change your records.";

const navigationAliases = {
  complaints: ["complaint", "complaints", "my complaints", "complaint list"],
  profile: ["profile", "my profile", "profile settings"],
  users: ["user access", "directory", "user management"],
  accounts: ["accounts", "registered accounts"],
  sla: ["sla", "sla tracking", "escalations"],
  reports: ["reports", "analytics"],
};

function normalize(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function findNavigationTarget(text, navItems) {
  const value = normalize(text);
  let target = value.match(/^(?:please\s+)?(?:open|go to|show|navigate to|switch to|take me to|kholo|dikhao|par jao)\s+(?:the\s+)?(.+)$/)?.[1];
  if (!target) {
    target = value.match(/^(.+?)\s+(?:kholo|dikhao|par jao)$/)?.[1];
  }
  if (!target) return null;

  return navItems.find((item) => {
    if (item.disabled) return false;
    const aliases = [item.id, item.label, ...(navigationAliases[item.id] || [])].map(normalize);
    return aliases.some((alias) => alias && (target === alias || target.includes(alias)));
  }) || null;
}

function roleSuggestions(role) {
  if (role === "student") return ["How do I track a complaint?", "How do I enable notifications?"];
  if (role === "staff") return ["How should I write a status update?", "Open my complaints"];
  return ["How does SLA escalation work?", "Open reports"];
}

function MessageBubble({ message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${isAssistant ? "rounded-tl-md bg-stone-100 text-ink" : "rounded-tr-md bg-brand text-white"}`}>
        {message.text}
      </div>
    </div>
  );
}

export default function DashboardAssistant({ navItems, onNavigate }) {
  const { user, accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [listening, setListening] = useState(false);
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const suggestions = useMemo(() => roleSuggestions(user?.role), [user?.role]);

  const SpeechRecognition = typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

  useEffect(() => {
    if (!open) return undefined;
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    return undefined;
  }, [messages, open, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function speak(text) {
    if (!voiceReplies || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0900-\u097f]/.test(text) ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  async function submitMessage(event) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    setDraft("");
    setError("");
    setVoiceError("");
    const userMessage = { role: "user", text };
    const withUserMessage = [...messages, userMessage];
    setMessages(withUserMessage);

    const navigationTarget = findNavigationTarget(text, navItems);
    if (navigationTarget) {
      const reply = `Opening ${navigationTarget.label}.`;
      setMessages((current) => [...current, { role: "assistant", text: reply }].slice(-20));
      onNavigate?.(navigationTarget);
      speak(reply);
      return;
    }

    setPending(true);
    try {
      const history = withUserMessage.slice(-8);
      if (history[0]?.role === "assistant") history.shift();
      const data = await sendAssistantMessageRequest(history, accessToken);
      const assistantMessage = { role: "assistant", text: data.reply };
      setMessages((current) => [...current, assistantMessage].slice(-20));
      speak(data.reply);
    } catch (requestError) {
      setError(requestError.message || "The assistant could not respond. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function startVoiceInput() {
    if (!SpeechRecognition) {
      setVoiceError("Voice input is not supported by this browser. You can type your message instead.");
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    setVoiceError("");
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) setDraft((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === "not-allowed"
        ? "Allow microphone access in your browser to use voice input."
        : "Could not recognize that. Please try again or type your message.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setVoiceError("Voice input could not start. Please try again.");
      setListening(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label="FixFlow AI assistant"
          className="mb-3 flex h-[min(70vh,34rem)] w-[min(calc(100vw-2rem),25rem)] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.38)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-brand-soft/70 to-white px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Sparkles size={19} /></span>
              <div className="min-w-0">
                <h2 className="truncate font-display font-bold text-ink">FixFlow assistant</h2>
                <p className="text-xs text-muted">{user?.role ? `${user.role[0].toUpperCase()}${user.role.slice(1)} workspace` : "Dashboard help"}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={voiceReplies ? "Turn off spoken replies" : "Turn on spoken replies"}
                title={voiceReplies ? "Spoken replies on" : "Spoken replies off"}
                onClick={() => {
                  setVoiceReplies((enabled) => !enabled);
                  window.speechSynthesis?.cancel();
                }}
                className="grid size-9 place-items-center rounded-xl text-muted hover:bg-white hover:text-brand"
              >
                {voiceReplies ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button type="button" aria-label="Close assistant" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-white hover:text-ink"><X size={19} /></button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4" aria-live="polite">
            {messages.length === 0 ? (
              <>
                <MessageBubble message={{ role: "assistant", text: greeting }} />
                <div className="mt-1 space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Try asking</p>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setDraft(suggestion)}
                      className="block w-full rounded-xl border border-line bg-white px-3 py-2 text-left text-xs font-medium text-ink transition hover:border-brand/40 hover:bg-brand-soft/40"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            ) : messages.map((message, index) => <MessageBubble key={`${index}-${message.role}`} message={message} />)}
            {pending && <div className="flex items-center gap-2 self-start rounded-2xl bg-stone-100 px-3.5 py-2.5 text-xs text-muted"><LoaderCircle size={15} className="animate-spin text-brand" /> Thinking…</div>}
            <div ref={endOfMessagesRef} />
          </div>

          {(error || voiceError) && <p role="alert" className="mx-3.5 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error || voiceError}</p>}

          <form onSubmit={submitMessage} className="border-t border-line bg-white p-3">
            <label htmlFor="dashboard-assistant-input" className="sr-only">Message the FixFlow assistant</label>
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-stone-50 p-1.5 focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10">
              <textarea
                ref={inputRef}
                id="dashboard-assistant-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 1500))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage();
                  }
                }}
                rows={1}
                maxLength={1500}
                placeholder="Ask about FixFlow…"
                className="max-h-24 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-muted/70"
              />
              <button
                type="button"
                onClick={startVoiceInput}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                title={listening ? "Stop listening" : "Speak"}
                className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${listening ? "bg-rose-100 text-rose-700" : "text-muted hover:bg-white hover:text-brand"}`}
              ><Mic size={18} /></button>
              <button type="submit" disabled={!draft.trim() || pending} aria-label="Send message" className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-45"><Send size={17} /></button>
            </div>
            <p className="mt-1.5 px-1 text-[10px] leading-4 text-muted">Avoid sharing personal or sensitive complaint details. AI answers can be incorrect.</p>
          </form>
        </section>
      )}

      <button
        type="button"
        aria-label={open ? "Close FixFlow assistant" : "Open FixFlow assistant"}
        aria-expanded={open}
        onClick={() => setOpen((visible) => !visible)}
        className="ml-auto grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/25 transition hover:scale-105 hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25"
      >
        {open ? <X size={23} /> : <span className="relative"><MessageCircle size={23} /><Bot size={12} className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-brand" /></span>}
      </button>
    </div>
  );
}
