import { useEffect, useRef, useState } from "react";
import { AudioLines, CheckCircle2, LoaderCircle, Mic, MicOff, Pause, Upload, Volume2 } from "lucide-react";
import {
  previewComplaintTriageRequest,
  sendAssistantMessageRequest,
  sendVoiceComplaintTurnRequest,
} from "../../services/api.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const emptyDraft = { title: "", description: "", category: "", building: "", room: "" };

function speakable(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*(.*?)\*\*|__(.*?)__/g, "$1$2")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCreateIntent(text) {
  return /\b(create|file|submit|make|report|raise)\b.{0,30}\b(complaint|issue|problem|report)\b|\b(complaint|issue|problem)\b.{0,25}\b(create|file|submit|report|raise)\b/i.test(text);
}

function isSubmitConfirmation(text) {
  return /\b(confirm and submit|confirm complaint|submit complaint|send complaint|yes submit|yes send it)\b/i.test(text);
}

function isCampusIssueConfirmation(text) {
  return /\b(this is|it is|it's) (an? )?(actual|real|genuine) campus issue\b|\bconfirm (this|it) is (an? )?(actual|real|genuine) issue\b/i.test(text);
}

export default function AssistantVoiceMode({ accessToken, messages, setMessages, onClose, onNavigateText, role, onComplaintSubmit }) {
  const [phase, setPhase] = useState("ready");
  const [partialText, setPartialText] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [complaintMode, setComplaintMode] = useState(false);
  const [complaintDraft, setComplaintDraft] = useState(emptyDraft);
  const [proofImage, setProofImage] = useState(null);
  const [triagePreview, setTriagePreview] = useState(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [confirmedCampusIssue, setConfirmedCampusIssue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recognitionRef = useRef(null);
  const activeRef = useRef(false);
  const phaseRef = useRef("ready");
  const messagesRef = useRef(messages);
  const startListeningRef = useRef(null);
  const replyTimerRef = useRef(null);
  const draftRef = useRef(complaintDraft);
  const complaintModeRef = useRef(false);
  const previewRef = useRef(null);
  const imageRef = useRef(null);
  const campusConfirmedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { draftRef.current = complaintDraft; }, [complaintDraft]);
  useEffect(() => { previewRef.current = triagePreview; }, [triagePreview]);
  useEffect(() => { imageRef.current = proofImage; }, [proofImage]);
  useEffect(() => { campusConfirmedRef.current = confirmedCampusIssue; }, [confirmedCampusIssue]);

  function updatePhase(next) {
    phaseRef.current = next;
    setPhase(next);
  }

  function stopVoice() {
    activeRef.current = false;
    window.clearTimeout(replyTimerRef.current);
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
    updatePhase("ready");
  }

  useEffect(() => () => {
    activeRef.current = false;
    window.clearTimeout(replyTimerRef.current);
    recognitionRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  function resumeAfterSpeech(text) {
    window.clearTimeout(replyTimerRef.current);
    const resume = () => {
      if (phaseRef.current !== "speaking" || !activeRef.current) return;
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 250);
    };
    replyTimerRef.current = window.setTimeout(resume, Math.min(30_000, Math.max(4_500, text.length * 85)));
  }

  function speakReply(text) {
    const cleanText = speakable(text);
    if (muted || !window.speechSynthesis || !window.SpeechSynthesisUtterance || !cleanText) {
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 250);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-IN";
    utterance.rate = 0.96;
    utterance.onend = () => {
      window.clearTimeout(replyTimerRef.current);
      if (!activeRef.current) return;
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 250);
    };
    utterance.onerror = utterance.onend;
    updatePhase("speaking");
    window.speechSynthesis.speak(utterance);
    resumeAfterSpeech(cleanText);
  }

  function appendAssistantReply(userText, assistantText) {
    const next = [...messagesRef.current, { role: "user", text: userText }, { role: "assistant", text: assistantText }].slice(-20);
    messagesRef.current = next;
    setMessages(next);
  }

  async function loadTriage(nextDraft) {
    setTriageLoading(true);
    setTriagePreview(null);
    previewRef.current = null;
    try {
      const preview = await previewComplaintTriageRequest({
        title: nextDraft.title,
        description: nextDraft.description,
        category: nextDraft.category,
        building: nextDraft.building,
      }, accessToken);
      setTriagePreview(preview);
      previewRef.current = preview;
    } catch (previewError) {
      setError(previewError.message || "Could not prepare the complaint review. Please try again.");
    } finally {
      setTriageLoading(false);
    }
  }

  async function submitVoiceComplaint() {
    if (submittingRef.current) return;
    const currentDraft = draftRef.current;
    const currentPreview = previewRef.current;
    const currentImage = imageRef.current;
    const needsRelevanceConfirmation = currentPreview?.triage?.reviewSignal === "check_relevance" && !currentPreview?.triage?.safetyConcern;
    if (!currentImage) {
      setError("Attach a JPG, PNG, or WebP proof photo before submitting.");
      speakReply("Please attach a proof photo, then say confirm and submit.");
      return;
    }
    if (currentDraft.description.length < 30) {
      setError("Add at least 30 characters describing the campus issue before submitting.");
      return;
    }
    if (!currentPreview?.token) {
      setError("The complaint review is still preparing. Please wait, then confirm again.");
      return;
    }
    if (needsRelevanceConfirmation && !campusConfirmedRef.current) {
      setError("Please confirm in the review card that this is an actual campus issue for staff review.");
      return;
    }
    if (!onComplaintSubmit) {
      setError("Complaint submission is unavailable in this workspace.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    updatePhase("thinking");
    try {
      const created = await onComplaintSubmit({
        ...currentDraft,
        image: currentImage,
        triageToken: currentPreview.token,
        confirmedCampusIssue: needsRelevanceConfirmation && campusConfirmedRef.current,
      });
      if (created) {
        const done = "Your complaint has been submitted successfully. Campus staff will review it.";
        setComplaintMode(false);
        complaintModeRef.current = false;
        setComplaintDraft(emptyDraft);
        draftRef.current = emptyDraft;
        setProofImage(null);
        imageRef.current = null;
        setTriagePreview(null);
        previewRef.current = null;
        setConfirmedCampusIssue(false);
        campusConfirmedRef.current = false;
        setReply(done);
        speakReply(done);
      } else {
        setError("The complaint was not submitted. Review the details and try again.");
        updatePhase("listening");
      }
    } catch (submitError) {
      setError(submitError.message || "Could not submit the complaint. Please try again.");
      updatePhase("listening");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function processComplaintUtterance(userText) {
    if (/\b(cancel|discard) (the )?(complaint|draft)\b/i.test(userText)) {
      setComplaintMode(false);
      complaintModeRef.current = false;
      setComplaintDraft(emptyDraft);
      draftRef.current = emptyDraft;
      setTriagePreview(null);
      previewRef.current = null;
      setProofImage(null);
      imageRef.current = null;
      setReply("The complaint draft has been discarded. You can ask me anything about FixFlow.");
      speakReply("The complaint draft has been discarded. You can ask me anything about FixFlow.");
      return;
    }

    if (isCampusIssueConfirmation(userText)) {
      setConfirmedCampusIssue(true);
      campusConfirmedRef.current = true;
      if (isSubmitConfirmation(userText)) {
        await submitVoiceComplaint();
        return;
      }
      const confirmation = "Thank you. I have recorded your confirmation for staff review. Say confirm and submit when you are ready.";
      setReply(confirmation);
      speakReply(confirmation);
      return;
    }

    if (isSubmitConfirmation(userText)) {
      const prompt = "Please confirm and submit this complaint";
      appendAssistantReply(userText, prompt);
      await submitVoiceComplaint();
      return;
    }

    updatePhase("thinking");
    try {
      const result = await sendVoiceComplaintTurnRequest({ utterance: userText, draft: draftRef.current }, accessToken);
      if (!activeRef.current) return;
      setComplaintMode(true);
      complaintModeRef.current = true;
      setComplaintDraft(result.draft);
      draftRef.current = result.draft;
      appendAssistantReply(userText, result.reply);
      setReply(result.reply);
      if (result.readyForReview) await loadTriage(result.draft);
      speakReply(result.reply);
    } catch (requestError) {
      if (!activeRef.current) return;
      setError(requestError.message || "The assistant could not prepare the complaint. Please try again.");
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 600);
    }
  }

  async function processUtterance(text) {
    const userText = text.trim();
    if (!userText) {
      updatePhase("listening");
      return;
    }
    setPartialText("");
    setLastUserText(userText);
    setError("");

    if (/^(stop|stop voice|end voice chat|close voice chat)$/i.test(userText)) {
      stopVoice();
      onClose();
      return;
    }

    if (complaintModeRef.current) {
      await processComplaintUtterance(userText);
      return;
    }
    if (role === "student" && isCreateIntent(userText)) {
      setComplaintMode(true);
      complaintModeRef.current = true;
      setComplaintDraft(emptyDraft);
      draftRef.current = emptyDraft;
      setProofImage(null);
      imageRef.current = null;
      setTriagePreview(null);
      previewRef.current = null;
      await processComplaintUtterance(userText);
      return;
    }

    if (onNavigateText?.(userText)) return;
    updatePhase("thinking");
    const displayMessages = [...messagesRef.current, { role: "user", text: userText }].slice(-20);
    const nextMessages = displayMessages.slice(-8);
    if (nextMessages[0]?.role === "assistant") nextMessages.shift();
    setMessages(displayMessages);
    messagesRef.current = displayMessages;
    try {
      const data = await sendAssistantMessageRequest(nextMessages, accessToken);
      if (!activeRef.current) return;
      const assistantMessage = { role: "assistant", text: data.reply };
      messagesRef.current = [...messagesRef.current, assistantMessage].slice(-20);
      setMessages(messagesRef.current);
      setReply(data.reply);
      speakReply(data.reply);
    } catch (requestError) {
      if (!activeRef.current) return;
      setError(requestError.message || "The assistant could not respond. Please try again.");
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 600);
    }
  }

  useEffect(() => {
    startListeningRef.current = () => {
      if (!activeRef.current || phaseRef.current !== "listening") return;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        activeRef.current = false;
        setError("This browser does not support speech recognition. You can still use text chat.");
        updatePhase("ready");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index][0]?.transcript || "";
          if (event.results[index].isFinal) finalText += transcript;
          else interim += transcript;
        }
        setPartialText(interim.trim());
        if (finalText.trim()) {
          updatePhase("thinking");
          void processUtterance(finalText);
        }
      };
      recognition.onerror = (event) => {
        if (event.error === "no-speech") {
          updatePhase("listening");
          return;
        }
        const errors = {
          "not-allowed": "Microphone access is blocked. Allow it for this HTTPS site in browser and phone settings.",
          "service-not-allowed": "This browser blocked speech recognition. Try a supported browser or text chat.",
          "audio-capture": "No microphone is available. Check microphone access on your device.",
          network: "Speech recognition needs an internet connection. Check your network and retry.",
        };
        activeRef.current = false;
        setError(errors[event.error] || "Voice input stopped. Check microphone permission and retry.");
        updatePhase("ready");
      };
      recognition.onend = () => {
        if (activeRef.current && phaseRef.current === "listening") {
          window.setTimeout(() => startListeningRef.current?.(), 250);
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch {
        activeRef.current = false;
        setError("Voice input could not start. Check microphone permission and retry.");
        updatePhase("ready");
      }
    };
  });

  async function startConversation() {
    setError("");
    if (!window.isSecureContext) {
      setError("Voice chat needs an HTTPS page on mobile. Open FixFlow using its HTTPS link.");
      return;
    }
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      setError("This browser does not support speech recognition. You can still use text chat.");
      return;
    }
    activeRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      if (!activeRef.current) return;
      const greeting = role === "student"
        ? "Hello. I am your FixFlow assistant. Ask a question or say, create a complaint, to report a campus issue by voice."
        : "Hello. I am your FixFlow assistant. Ask me about the sections and workflow in your workspace.";
      setReply(greeting);
      updatePhase("speaking");
      speakReply(greeting);
    } catch (permissionError) {
      activeRef.current = false;
      const blocked = permissionError?.name === "NotAllowedError" || permissionError?.name === "PermissionDeniedError";
      setError(blocked
        ? "Microphone access is blocked. Allow it for this HTTPS site in browser and phone settings, then try again."
        : "FixFlow could not access a microphone. Check your device permissions and retry.");
      updatePhase("ready");
    }
  }

  function handleProofImage(event) {
    const file = event.target.files?.[0] || null;
    setError("");
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      event.target.value = "";
      setError("Choose a JPG, PNG, or WebP proof photo.");
      return;
    }
    if (file && file.size > MAX_IMAGE_SIZE) {
      event.target.value = "";
      setError("The proof photo must be 5 MB or smaller.");
      return;
    }
    setProofImage(file);
    imageRef.current = file;
  }

  const labels = { ready: "Ready to talk", listening: "Listening · speak naturally", thinking: submitting ? "Submitting complaint" : "Thinking", speaking: "FixFlow is speaking" };
  const needsRelevanceConfirmation = triagePreview?.triage?.reviewSignal === "check_relevance" && !triagePreview?.triage?.safetyConcern;

  return (
    <div className="assistant-voice-scroll flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-5 py-5 sm:px-8">
      <div className="flex flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3.5 py-2 text-xs font-semibold text-muted"><span className={`size-2 rounded-full ${phase === "listening" ? "animate-pulse bg-emerald-500" : phase === "thinking" ? "animate-pulse bg-amber-500" : "bg-brand/60"}`} />{labels[phase]}</p>
        <div className={`voice-orb-scene my-4 grid place-items-center sm:my-5 ${phase === "listening" ? "is-listening" : phase === "thinking" ? "is-thinking" : phase === "speaking" ? "is-speaking" : ""}`} aria-hidden="true">
          <span className="voice-orb-ring voice-orb-ring-one" /><span className="voice-orb-ring voice-orb-ring-two" />
          <span className="voice-orb-core"><span className="voice-orb-light" /><AudioLines size={28} className="relative z-10 text-white" /></span>
        </div>
        <h3 className="max-w-2xl font-display text-xl font-bold leading-8 text-ink sm:text-2xl">{phase === "ready" ? "Talk to your FixFlow assistant" : phase === "listening" ? (partialText || "I’m listening…") : phase === "thinking" ? (submitting ? "Submitting your complaint…" : "One moment while I think…") : (reply || "FixFlow is speaking")}</h3>
        {lastUserText && <p className="mt-2 max-w-xl text-sm leading-6 text-muted">You said: “{lastUserText}”</p>}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {phase !== "ready" && <button type="button" onClick={() => { setMuted((current) => !current); window.speechSynthesis?.cancel(); }} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand"><Volume2 size={14} />{muted ? "Turn voice on" : "Mute voice"}</button>}
        </div>
      </div>

      {complaintMode && <section className="mx-auto mt-5 w-full max-w-2xl rounded-2xl border border-line bg-canvas/70 p-4 text-left sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><CheckCircle2 size={18} /></span>
          <div><h4 className="font-bold text-ink">Voice complaint draft</h4><p className="mt-1 text-xs leading-5 text-muted">The assistant collects and reads back details. Review them, attach a proof photo, and confirm before submission.</p></div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[["Title", complaintDraft.title], ["Category", complaintDraft.category], ["Building", complaintDraft.building], ["Room", complaintDraft.room || "Not provided"]].map(([label, value]) => <div key={label} className="rounded-xl border border-line bg-white p-3"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 break-words font-semibold text-ink">{value || "The assistant will ask"}</dd></div>)}
          <div className="rounded-xl border border-line bg-white p-3 sm:col-span-2"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Description</dt><dd className="mt-1 whitespace-pre-wrap text-ink">{complaintDraft.description || "The assistant will ask for details"}</dd></div>
        </dl>
        {complaintDraft.title && complaintDraft.building && complaintDraft.category && complaintDraft.description.length >= 30 && <div className="mt-3 rounded-xl border border-dashed border-brand/30 bg-white p-3">
          <label htmlFor="voice-complaint-proof" className="mb-2 block text-sm font-semibold text-ink">Proof photo required</label>
          <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft/40"><Upload size={16} />{proofImage ? proofImage.name : "Choose JPG, PNG, or WebP · max 5 MB"}<input id="voice-complaint-proof" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleProofImage} /></label>
          {proofImage && <p className="mt-2 text-xs text-muted">Photo attached: {proofImage.name}</p>}
        </div>}
        {triageLoading && <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted"><LoaderCircle size={15} className="animate-spin" />Preparing the staff review summary…</p>}
        {triagePreview?.triage && <div className="mt-3 rounded-xl border border-brand/15 bg-brand-soft/40 p-3 text-sm">
          <p className="font-bold text-brand-dark">AI review suggestion · {triagePreview.triage.priority} · {triagePreview.triage.urgency}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{triagePreview.triage.summary} Suggested category: {triagePreview.triage.suggestedCategory}. This is an advisory signal; campus staff make the final decision.</p>
          {needsRelevanceConfirmation && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><input type="checkbox" checked={confirmedCampusIssue} onChange={(event) => { setConfirmedCampusIssue(event.target.checked); campusConfirmedRef.current = event.target.checked; }} className="mt-1 accent-emerald-700" />I confirm this describes an actual campus issue and may be sent to staff for review.</label>}
        </div>}
        <button type="button" disabled={submitting || triageLoading || !triagePreview?.token} onClick={() => void submitVoiceComplaint()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><CheckCircle2 size={17} />{submitting ? "Submitting…" : "Confirm and submit complaint"}</button>
        <p className="mt-2 text-[11px] leading-5 text-muted">AI cannot determine whether a report is truthful. This check only asks for clarification; staff review all complaints.</p>
      </section>}

      {error && <p role="alert" className="mx-auto mt-4 w-full max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm leading-5 text-rose-700">{error}</p>}
      <p className="mx-auto mt-4 max-w-xl text-center text-[11px] leading-5 text-muted">Voice recognition is handled by your browser and may use its speech service. FixFlow sends recognized text to the assistant; it does not store raw audio.</p>
      <div className="mx-auto mt-5 flex items-center gap-3">
        {phase === "ready" ? <button type="button" onClick={startConversation} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark"><Mic size={18} />Start voice chat</button> : <button type="button" onClick={() => { stopVoice(); onClose(); }} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-canvas"><MicOff size={17} />End voice chat</button>}
        {phase !== "ready" && <button type="button" onClick={stopVoice} aria-label="Pause voice conversation" title="Pause voice conversation" className="grid size-12 place-items-center rounded-full border border-line bg-white text-muted transition hover:bg-canvas"><Pause size={18} /></button>}
      </div>
    </div>
  );
}
