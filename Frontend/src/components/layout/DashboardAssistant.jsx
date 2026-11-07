import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  AudioLines,
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
import { useAssistantContext } from "../../context/assistantContext.jsx";
import AssistantVoiceMode from "./AssistantVoiceMode.jsx";
import {
  findNavigationTarget,
  extractNavigationFromReply,
  extractComplaintFields,
  isExitIntent,
  getUserDisplayName,
  stripRepetitiveGreeting,
} from "./assistantUtils.js";

function roleSuggestions(role) {
  if (role === "student")
    return [
      "Open create complaint",
      "How do I track my complaints?",
      "How do I enable notifications?",
    ];
  if (role === "staff")
    return [
      "Open assigned complaints",
      "Show resolved complaints",
      "How should I write a status update?",
    ];
  return [
    "Open Campus Map & GIS",
    "Open SLA tracking",
    "Open reports",
  ];
}

function MessageBubble({ message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${isAssistant ? "rounded-tl-md bg-stone-100 text-ink" : "rounded-tr-md bg-brand text-white"}`}
      >
        {message.text}
      </div>
    </div>
  );
}

function toSpokenText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*|__(.*?)__/g, "$1$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function DashboardAssistant({
  navItems,
  onNavigate,
  onComplaintSubmit,
  onFillFormFields,
}) {
  const { user, accessToken } = useAuth();
  const { screenContext, dispatchAction } = useAssistantContext();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceOrbMode, setVoiceOrbMode] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [listening, setListening] = useState(false);
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const recognitionRef = useRef(null);
  const suggestions = useMemo(() => roleSuggestions(user?.role), [user?.role]);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  useEffect(() => {
    if (!open) return undefined;
    endOfMessagesRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
    return undefined;
  }, [messages, open, pending]);

  useEffect(() => {
    if (open && !voiceOrbMode) inputRef.current?.focus();
  }, [open, voiceOrbMode]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") closeAssistant();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open || voiceOrbMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, voiceOrbMode]);

  function closeAssistant() {
    recognitionRef.current?.abort();
    setListening(false);
    window.speechSynthesis?.cancel();
    setVoiceMode(false);
    setVoiceOrbMode(false);
    setOpen(false);
    launcherRef.current?.focus();
  }

  function navigateFromText(textOrItem, fromVoice = false) {
    let navigationTarget = null;
    if (typeof textOrItem === "object" && textOrItem !== null && textOrItem.id) {
      navigationTarget = textOrItem;
    } else {
      navigationTarget = findNavigationTarget(textOrItem, navItems);
    }
    if (!navigationTarget) return null;
    const reply = `Opening ${navigationTarget.label}.`;
    setMessages((current) =>
      [...current, { role: "assistant", text: reply }].slice(-20),
    );
    onNavigate?.(navigationTarget);
    if (!fromVoice) {
      speak(reply);
      closeAssistant();
    }
    return navigationTarget;
  }

  function speak(text) {
    if (
      !voiceReplies ||
      !window.speechSynthesis ||
      !window.SpeechSynthesisUtterance
    )
      return;
    window.speechSynthesis.cancel();
    const spokenText = toSpokenText(text);
    if (!spokenText) return;
    const utterance = new window.SpeechSynthesisUtterance(spokenText);
    utterance.lang = "en-IN";
    utterance.rate = 0.96;
    utterance.pitch = 1.02;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (voice) => voice.lang?.toLowerCase() === utterance.lang.toLowerCase(),
      ) ||
      voices.find((voice) =>
        voice.lang?.toLowerCase().startsWith(utterance.lang.slice(0, 2)),
      );
    if (preferredVoice) utterance.voice = preferredVoice;
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

    // 1. Check exit command
    if (isExitIntent(text)) {
      const farewell =
        "Goodbye! Let me know if you need any help with campus facilities.";
      setMessages((current) =>
        [...current, { role: "assistant", text: farewell }].slice(-20),
      );
      speak(farewell);
      closeAssistant();
      return;
    }

    // 2. Check navigation command
    const navTarget = navigateFromText(text, false);
    if (navTarget) return;

    // 3. Check complaint form field filling command
    const formFields = extractComplaintFields(text);
    if (
      formFields &&
      (formFields.title ||
        formFields.category ||
        formFields.building ||
        formFields.room)
    ) {
      onFillFormFields?.(formFields);
      window.dispatchEvent(
        new CustomEvent("fixflow:fill-complaint-form", { detail: formFields }),
      );
      const newComplaintTarget = navItems.find(
        (item) => item.id === "newComplaint",
      );
      if (newComplaintTarget) onNavigate?.(newComplaintTarget);

      const fieldDesc = `${formFields.title || "Complaint"}${formFields.building ? ` in ${formFields.building}` : ""}${formFields.room ? ` Room ${formFields.room}` : ""}`;
      const fillReply = `I've filled the complaint details for "${fieldDesc}". You can review them, attach a proof photo, and submit!`;
      setMessages((current) =>
        [...current, { role: "assistant", text: fillReply }].slice(-20),
      );
      speak(fillReply);
      return;
    }

    setPending(true);
    try {
      const history = withUserMessage.slice(-8);
      if (history[0]?.role === "assistant") history.shift();
      const data = await sendAssistantMessageRequest(
        history,
        accessToken,
        user?.username,
        screenContext,
      );
      const callerName = getUserDisplayName(user);
      const cleanedReply = stripRepetitiveGreeting(data.reply, callerName);

      // Execute structured component action tags returned by Gemini
      if (Array.isArray(data.actions) && data.actions.length > 0) {
        for (const action of data.actions) {
          if (action.type === "navigate") {
            onNavigate?.(action.params.target);
          } else if (action.type === "fillForm") {
            onFillFormFields?.(action.params);
            window.dispatchEvent(
              new CustomEvent("fixflow:fill-complaint-form", { detail: action.params }),
            );
          } else if (action.type === "filter") {
            window.dispatchEvent(
              new CustomEvent("fixflow:set-filters", { detail: action.params }),
            );
          } else if (action.type === "clearFilters") {
            window.dispatchEvent(new CustomEvent("fixflow:clear-filters"));
          } else if (action.type === "openComplaint") {
            window.dispatchEvent(
              new CustomEvent("fixflow:open-complaint", { detail: action.params }),
            );
          }
          dispatchAction?.(action);
        }
      }

      const fallbackTarget =
        extractNavigationFromReply(cleanedReply, navItems) ||
        findNavigationTarget(cleanedReply, navItems);
      if (fallbackTarget) {
        onNavigate?.(fallbackTarget);
      }
      const assistantMessage = { role: "assistant", text: cleanedReply };
      setMessages((current) => [...current, assistantMessage].slice(-20));
      speak(cleanedReply);
    } catch (requestError) {
      setError(
        requestError.message ||
          "The assistant could not respond. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  function startVoiceInput() {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setVoiceError(
        "Voice input needs a secure HTTPS page on mobile. Open FixFlow through its HTTPS link and try again.",
      );
      return;
    }

    if (!SpeechRecognition) {
      setVoiceError(
        "This browser does not support speech recognition, so it cannot open a voice permission prompt. Try a browser with Web Speech support or type your message.",
      );
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    setVoiceError("");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript && !navigateFromText(transcript)) {
        setDraft((current) => `${current}${current ? " " : ""}${transcript}`);
      }
    };
    recognition.onerror = (event) => {
      const voiceErrors = {
        "not-allowed":
          "Microphone or speech permission is blocked. Allow Microphone for FixFlow in your browser and phone settings, then try again.",
        "service-not-allowed":
          "This browser or its speech service blocked recognition. Check browser permissions or try another supported browser.",
        "audio-capture":
          "No microphone is available. Check that your phone microphone works and that the browser can access it.",
        network:
          "The browser speech service could not connect. Check your internet connection and try again.",
        "no-speech":
          "No speech was detected. Tap the microphone and speak clearly.",
      };
      setVoiceError(
        voiceErrors[event.error] ||
          "Voice input could not start. Check microphone permission and try again, or type your message.",
      );
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
    <>
      <div
        aria-hidden={!open || voiceOrbMode}
        inert={!open ? true : undefined}
        className={`fixed inset-0 z-40 grid place-items-center p-0 sm:p-6 ${open && !voiceOrbMode ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close assistant"
          onClick={closeAssistant}
          className={`absolute inset-0 cursor-default bg-slate-950/25 transition-opacity duration-200 motion-reduce:transition-none ${open && !voiceOrbMode ? "backdrop-blur-md opacity-100" : "backdrop-blur-0 opacity-0 pointer-events-none"}`}
        />

        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-assistant-title"
          className={`relative z-10 flex h-[100dvh] w-screen origin-bottom flex-col overflow-hidden rounded-none border-0 bg-white shadow-none ring-0 transition-[opacity,transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none sm:h-[min(86dvh,58rem)] sm:w-[min(calc(100vw-3rem),56rem)] sm:rounded-[2rem] sm:border sm:border-white/70 sm:shadow-[0_32px_100px_-28px_rgba(15,23,42,0.55)] sm:ring-1 sm:ring-slate-900/5 ${open && !voiceOrbMode ? "translate-y-0 scale-100 opacity-100 pointer-events-auto" : "translate-y-4 scale-[0.97] opacity-0 pointer-events-none hidden"}`}
        >
          <header className="relative isolate overflow-hidden border-b border-brand/10 bg-gradient-to-br from-[#e5f4ee] via-white to-[#f0f7f4] px-5 py-5 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute -right-12 -top-20 -z-10 size-52 rounded-full bg-brand/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 -z-10 size-48 rounded-full bg-emerald-200/35 blur-3xl" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/20 ring-4 ring-white/70 sm:size-14">
                  <Sparkles size={23} />
                </span>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-dark ring-1 ring-brand/10">
                      AI copilot
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Full app access
                    </span>
                  </div>
                  <h2
                    id="dashboard-assistant-title"
                    className="truncate font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl"
                  >
                    FixFlow assistant
                  </h2>
                  <p className="mt-0.5 text-xs text-muted sm:text-sm">
                    {user?.role
                      ? `${user.role[0].toUpperCase()}${user.role.slice(1)} workspace`
                      : "Dashboard help"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Open voice conversation"
                  title="Voice conversation"
                  onClick={() => setVoiceMode(true)}
                  className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-white hover:text-brand"
                >
                  <AudioLines size={19} />
                </button>
                <button
                  type="button"
                  aria-label={
                    voiceReplies
                      ? "Turn off spoken replies"
                      : "Turn on spoken replies"
                  }
                  title={
                    voiceReplies ? "Spoken replies on" : "Spoken replies off"
                  }
                  onClick={() => {
                    setVoiceReplies((enabled) => !enabled);
                    window.speechSynthesis?.cancel();
                  }}
                  className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-white hover:text-brand"
                >
                  {voiceReplies ? <Volume2 size={19} /> : <VolumeX size={19} />}
                </button>
                <button
                  type="button"
                  aria-label="Close assistant"
                  onClick={closeAssistant}
                  className="grid size-10 place-items-center rounded-xl text-muted transition hover:bg-white hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </header>

          {voiceMode ? (
            <AssistantVoiceMode
              accessToken={accessToken}
              user={user}
              role={user?.role}
              messages={messages}
              setMessages={setMessages}
              navItems={navItems}
              onClose={() => {
                closeAssistant();
              }}
              onNavigateText={(targetOrText, fromVoice) =>
                navigateFromText(targetOrText, fromVoice)
              }
              onComplaintSubmit={onComplaintSubmit}
              onFillFormFields={onFillFormFields}
              isOrbMode={voiceOrbMode}
              setIsOrbMode={setVoiceOrbMode}
            />
          ) : (
            <>
              <div
                className="assistant-chat-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#f4faf7_0%,_#ffffff_48%)] px-4 py-5 sm:gap-5 sm:px-6 sm:py-6"
                aria-live="polite"
              >
                {messages.length === 0 ? (
                  <>
                    <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                      <span className="grid size-6 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Bot size={14} />
                      </span>
                      Start a conversation
                    </div>
                    <MessageBubble
                      message={{
                        role: "assistant",
                        text: getUserDisplayName(user)
                          ? `Hello ${getUserDisplayName(user)}! This is your FixFlow assistant with complete access to guide you around the app, navigate sections, and fill in complaint details. How can I help you today?`
                          : "Hello! This is your FixFlow assistant with complete access to guide you around the app, navigate sections, and fill in complaint details. How can I help you today?",
                      }}
                    />
                    <div className="mt-1">
                      <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Popular actions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setDraft(suggestion)}
                            className="rounded-full border border-brand/15 bg-white px-3.5 py-2 text-left text-xs font-semibold text-brand-dark shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand/35 hover:bg-brand-soft/40 hover:shadow-md motion-reduce:transform-none"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                    {navItems.some((item) => !item.disabled) && (
                      <div className="mt-2">
                        <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Jump to a section
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {navItems
                            .filter((item) => !item.disabled)
                            .map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  navigateFromText(`open ${item.label}`)
                                }
                                className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/40"
                              >
                                {item.label}
                              </button>
                            ))}
                          {navItems.some((item) => item.id === "complaints") &&
                            navItems.some(
                              (item) => item.id === "newComplaint",
                            ) &&
                            navItems
                              .filter(
                                (item) =>
                                  item.id === "newComplaint" ||
                                  item.id === "myComplaints",
                              )
                              .map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    navigateFromText(`open ${item.label}`)
                                  }
                                  className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:border-brand/30 hover:bg-brand-soft/40"
                                >
                                  {item.label}
                                </button>
                              ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  messages.map((message, index) => (
                    <MessageBubble
                      key={`${index}-${message.role}`}
                      message={message}
                    />
                  ))
                )}
                {pending && (
                  <div className="flex items-center gap-2 self-start rounded-2xl rounded-tl-md border border-brand/10 bg-white px-3.5 py-2.5 text-xs text-muted shadow-sm">
                    <LoaderCircle size={15} className="animate-spin text-brand" />{" "}
                    Thinking…
                  </div>
                )}
                <div ref={endOfMessagesRef} />
              </div>

              {(error || voiceError) && (
                <p
                  role="alert"
                  className="mx-4 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700 sm:mx-6"
                >
                  {error || voiceError}
                </p>
              )}

              <form
                onSubmit={submitMessage}
                className="border-t border-line bg-white/95 p-3.5 sm:p-5"
              >
                <label htmlFor="dashboard-assistant-input" className="sr-only">
                  Message the FixFlow assistant
                </label>
                <div className="flex items-end gap-2 rounded-2xl border border-line bg-stone-50 p-1.5 transition focus-within:border-brand/50 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand/10">
                  <textarea
                    ref={inputRef}
                    id="dashboard-assistant-input"
                    value={draft}
                    onChange={(event) =>
                      setDraft(event.target.value.slice(0, 1500))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submitMessage();
                      }
                    }}
                    rows={1}
                    maxLength={1500}
                    placeholder="Ask to navigate, fill complaint fields, or campus questions…"
                    className="max-h-24 min-h-11 min-w-0 flex-1 resize-y bg-transparent px-2.5 py-2.5 text-sm text-ink outline-none placeholder:text-muted/70"
                  />
                  <button
                    type="button"
                    onClick={startVoiceInput}
                    aria-label={
                      listening ? "Stop voice input" : "Start voice input"
                    }
                    title={listening ? "Stop listening" : "Speak"}
                    className={`grid size-11 shrink-0 place-items-center rounded-xl transition duration-200 ${listening ? "animate-pulse bg-rose-100 text-rose-700" : "text-muted hover:bg-brand-soft hover:text-brand"}`}
                  >
                    <Mic size={19} />
                  </button>
                  <button
                    type="submit"
                    disabled={!draft.trim() || pending}
                    aria-label="Send message"
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transform-none"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p className="mt-2 px-1 text-[10px] leading-4 text-muted">
                  Passwords and private security credentials cannot be accessed or shared.
                </p>
              </form>
            </>
          )}
        </section>
      </div>

      <button
        ref={launcherRef}
        type="button"
        aria-label={open ? "Close FixFlow assistant" : "Open FixFlow assistant"}
        aria-expanded={open}
        aria-hidden={open || voiceOrbMode}
        tabIndex={open || voiceOrbMode ? -1 : 0}
        onClick={() => (open ? closeAssistant() : setOpen(true))}
        className={`fixed bottom-4 right-4 z-50 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/25 transition duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-brand-dark hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 motion-reduce:transform-none sm:bottom-6 sm:right-6 ${open || voiceOrbMode ? "pointer-events-none scale-75 opacity-0" : "scale-100 opacity-100"}`}
      >
        <span className="relative">
          <MessageCircle size={23} />
          <Bot
            size={12}
            className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-brand"
          />
        </span>
      </button>
    </>
  );
}
