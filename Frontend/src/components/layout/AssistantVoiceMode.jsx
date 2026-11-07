import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AudioLines,
  CheckCircle2,
  Languages,
  LoaderCircle,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import {
  extractComplaintFields,
  extractNavigationFromReply,
  findNavigationTarget,
  getUserDisplayName,
  isExitIntent,
  splitIntoSentences,
  stripRepetitiveGreeting,
} from "./assistantUtils.js";
import {
  previewComplaintTriageRequest,
  sendAssistantMessageRequest,
  sendVoiceComplaintTurnRequest,
} from "../../services/api.js";
import { useAssistantContext } from "../../context/assistantContext.jsx";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const emptyDraft = {
  title: "",
  description: "",
  category: "",
  building: "",
  room: "",
};

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
  return /\b(create|file|submit|make|report|raise)\b.{0,30}\b(complaint|issue|problem|report)\b|\b(complaint|issue|problem)\b.{0,25}\b(create|file|submit|report|raise)\b/i.test(
    text,
  );
}

function isSubmitConfirmation(text) {
  return /\b(confirm and submit|confirm complaint|submit complaint|send complaint|yes submit|yes send it)\b/i.test(
    text,
  );
}

function isCampusIssueConfirmation(text) {
  return /\b(this is|it is|it's) (an? )?(actual|real|genuine) campus issue\b|\bconfirm (this|it) is (an? )?(actual|real|genuine) issue\b/i.test(
    text,
  );
}

export default function AssistantVoiceMode({
  accessToken,
  user,
  messages,
  setMessages,
  onClose,
  onNavigateText,
  navItems = [],
  role,
  onComplaintSubmit,
  onFillFormFields,
  isOrbMode = false,
  setIsOrbMode,
}) {
  const [internalOrbMode, setInternalOrbMode] = useState(false);
  const orbActive =
    typeof isOrbMode === "boolean" ? isOrbMode : internalOrbMode;
  const setOrbActive = setIsOrbMode || setInternalOrbMode;

  const [phase, setPhase] = useState("ready");
  const [partialText, setPartialText] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [reply, setReply] = useState("");
  const [currentSpokenLine, setCurrentSpokenLine] = useState("");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [complaintMode, setComplaintMode] = useState(false);
  const [complaintDraft, setComplaintDraft] = useState(emptyDraft);
  const [proofImage, setProofImage] = useState(null);
  const [triagePreview, setTriagePreview] = useState(null);
  const [triageLoading, setTriageLoading] = useState(false);
  const [confirmedCampusIssue, setConfirmedCampusIssue] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { screenContext, dispatchAction } = useAssistantContext();
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("fixflow_voice_lang") || "en";
    } catch {
      return "en";
    }
  });

  function toggleLanguage() {
    const next = language === "en" ? "hi" : "en";
    setLanguage(next);
    try {
      localStorage.setItem("fixflow_voice_lang", next);
    } catch {}
    if (recognitionRef.current) {
      recognitionRef.current.lang = next === "hi" ? "hi-IN" : "en-IN";
    }
  }

  function interruptSpeaking() {
    if (phaseRef.current === "speaking") {
      window.speechSynthesis?.cancel();
      window.clearTimeout(replyTimerRef.current);
      activeUtteranceRef.current = null;
      setCurrentSpokenLine("");
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 150);
    }
  }
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
  const activeUtteranceRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    draftRef.current = complaintDraft;
  }, [complaintDraft]);
  useEffect(() => {
    previewRef.current = triagePreview;
  }, [triagePreview]);
  useEffect(() => {
    imageRef.current = proofImage;
  }, [proofImage]);
  useEffect(() => {
    campusConfirmedRef.current = confirmedCampusIssue;
  }, [confirmedCampusIssue]);

  function updatePhase(next) {
    phaseRef.current = next;
    setPhase(next);
  }

  function stopVoice() {
    activeRef.current = false;
    window.clearTimeout(replyTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    activeUtteranceRef.current = null;
    window.speechSynthesis?.cancel();
    setCurrentSpokenLine("");
    updatePhase("ready");
  }

  useEffect(
    () => () => {
      activeRef.current = false;
      window.clearTimeout(replyTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      activeUtteranceRef.current = null;
      window.speechSynthesis?.cancel();
    },
    [],
  );

  function speakReply(text, onFinished = null) {
    const cleanText = speakable(text);
    if (!cleanText) {
      if (onFinished) onFinished();
      else {
        updatePhase("listening");
        window.setTimeout(() => startListeningRef.current?.(), 250);
      }
      return;
    }

    const sentences = splitIntoSentences(cleanText);
    if (!sentences.length) sentences.push(cleanText);

    if (
      muted ||
      !window.speechSynthesis ||
      !window.SpeechSynthesisUtterance
    ) {
      setReply(cleanText);
      setCurrentSpokenLine(sentences[0]);
      if (onFinished) onFinished();
      else {
        updatePhase("listening");
        window.setTimeout(() => startListeningRef.current?.(), 250);
      }
      return;
    }

    window.speechSynthesis.cancel();
    window.clearTimeout(replyTimerRef.current);
    updatePhase("speaking");

    // Keep microphone listening during speech playback so user can interrupt at any moment!
    if (activeRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        // Recognition already active
      }
    }

    let sentenceIndex = 0;

    function speakCurrentSentence() {
      if (!activeRef.current) return;
      if (sentenceIndex >= sentences.length) {
        window.clearTimeout(replyTimerRef.current);
        activeUtteranceRef.current = null;
        setCurrentSpokenLine("");
        if (onFinished) {
          onFinished();
        } else {
          updatePhase("listening");
          window.setTimeout(() => startListeningRef.current?.(), 250);
        }
        return;
      }

      const line = sentences[sentenceIndex];
      sentenceIndex += 1;
      setReply(line);
      setCurrentSpokenLine(line);

      const isHindi = /[\u0900-\u097F]/.test(line) || language === "hi";
      const utterance = new window.SpeechSynthesisUtterance(line);
      utterance.lang = isHindi ? "hi-IN" : "en-IN";
      utterance.rate = isHindi ? 0.90 : 0.96;
      utterance.pitch = 1.02;

      const voices = window.speechSynthesis.getVoices();
      let preferredVoice = null;
      if (isHindi) {
        preferredVoice =
          voices.find((voice) => voice.lang?.toLowerCase().startsWith("hi")) ||
          voices.find((voice) => voice.name?.toLowerCase().includes("hindi") || voice.name?.includes("हिन्दी")) ||
          voices.find((voice) => voice.lang?.toLowerCase() === "en-in");
      } else {
        preferredVoice =
          voices.find(
            (voice) => voice.lang?.toLowerCase() === utterance.lang.toLowerCase(),
          ) ||
          voices.find((voice) =>
            voice.lang?.toLowerCase().startsWith(utterance.lang.slice(0, 2)),
          );
      }
      if (preferredVoice) utterance.voice = preferredVoice;

      activeUtteranceRef.current = utterance;

      let advanced = false;
      const advance = () => {
        if (advanced) return;
        advanced = true;
        activeUtteranceRef.current = null;
        window.clearTimeout(replyTimerRef.current);
        window.setTimeout(() => {
          if (activeRef.current && phaseRef.current === "speaking") {
            speakCurrentSentence();
          }
        }, 120);
      };

      utterance.onend = advance;
      utterance.onerror = advance;

      window.speechSynthesis.speak(utterance);

      // Guard timer per sentence to prevent stalling if speech synthesis events don't fire
      replyTimerRef.current = window.setTimeout(
        advance,
        Math.min(18_000, Math.max(3_500, line.length * 90)),
      );
    }

    speakCurrentSentence();
  }

  function appendAssistantReply(userText, assistantText) {
    const next = [
      ...messagesRef.current,
      { role: "user", text: userText },
      { role: "assistant", text: assistantText },
    ].slice(-20);
    messagesRef.current = next;
    setMessages(next);
  }

  async function loadTriage(nextDraft) {
    setTriageLoading(true);
    setTriagePreview(null);
    previewRef.current = null;
    try {
      const preview = await previewComplaintTriageRequest(
        {
          title: nextDraft.title,
          description: nextDraft.description,
          category: nextDraft.category,
          building: nextDraft.building,
        },
        accessToken,
      );
      setTriagePreview(preview);
      previewRef.current = preview;
    } catch (previewError) {
      setError(
        previewError.message ||
          "Could not prepare the complaint review. Please try again.",
      );
    } finally {
      setTriageLoading(false);
    }
  }

  async function submitVoiceComplaint() {
    if (submittingRef.current) return;
    const currentDraft = draftRef.current;
    const currentPreview = previewRef.current;
    const currentImage = imageRef.current;
    const needsRelevanceConfirmation =
      currentPreview?.triage?.reviewSignal === "check_relevance" &&
      !currentPreview?.triage?.safetyConcern;
    if (!currentImage) {
      setError("Attach a JPG, PNG, or WebP proof photo before submitting.");
      speakReply("Please attach a proof photo, then say confirm and submit.");
      return;
    }
    if (currentDraft.description.length < 30) {
      setError(
        "Add at least 30 characters describing the campus issue before submitting.",
      );
      return;
    }
    if (!currentPreview?.token) {
      setError(
        "The complaint review is still preparing. Please wait, then confirm again.",
      );
      return;
    }
    if (needsRelevanceConfirmation && !campusConfirmedRef.current) {
      setError(
        "Please confirm in the review card that this is an actual campus issue for staff review.",
      );
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
        confirmedCampusIssue:
          needsRelevanceConfirmation && campusConfirmedRef.current,
      });
      if (created) {
        const done =
          "Your complaint has been submitted successfully. Campus staff will review it.";
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
        setError(
          "The complaint was not submitted. Review the details and try again.",
        );
        updatePhase("listening");
      }
    } catch (submitError) {
      setError(
        submitError.message ||
          "Could not submit the complaint. Please try again.",
      );
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
      setReply(
        "The complaint draft has been discarded. You can ask me anything about FixFlow.",
      );
      speakReply(
        "The complaint draft has been discarded. You can ask me anything about FixFlow.",
      );
      return;
    }

    if (isCampusIssueConfirmation(userText)) {
      setConfirmedCampusIssue(true);
      campusConfirmedRef.current = true;
      if (isSubmitConfirmation(userText)) {
        await submitVoiceComplaint();
        return;
      }
      const confirmation =
        "Thank you. I have recorded your confirmation for staff review. Say confirm and submit when you are ready.";
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
      const result = await sendVoiceComplaintTurnRequest(
        { utterance: userText, draft: draftRef.current },
        accessToken,
      );
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
      setError(
        requestError.message ||
          "The assistant could not prepare the complaint. Please try again.",
      );
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

    // 1. Session Termination Intent ("bye", "goodbye", "exit", etc.)
    if (isExitIntent(userText)) {
      const callerName = getUserDisplayName(user);
      const farewell = callerName
        ? `Goodbye ${callerName}! Let me know if you need any help with campus facilities.`
        : "Goodbye! Let me know if you need any help with campus facilities.";
      setReply(farewell);
      updatePhase("speaking");
      speakReply(farewell, () => {
        stopVoice();
        onClose();
      });
      return;
    }

    // 2. Complaint drafting conversational mode
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

    // 3. Navigation command (navigates & smoothly transitions into continuous floating orb)
    const navResult = onNavigateText?.(userText, true);
    if (navResult) {
      const targetName =
        typeof navResult === "object" ? navResult.label : "the requested section";
      const navReply = `Opening ${targetName}. I'm right here in the orb listening.`;
      setReply(navReply);
      setOrbActive(true);
      speakReply(navReply);
      return;
    }

    // 4. Form filling command (fills title, category, location, and description)
    const formFields = extractComplaintFields(userText);
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
      onNavigateText?.("create complaint", true);
      const fieldDesc = `${formFields.title || "Complaint"}${formFields.building ? ` in ${formFields.building}` : ""}${formFields.room ? ` Room ${formFields.room}` : ""}`;
      const fillReply = `Filled the complaint details for ${fieldDesc}. You can review them, attach a photo, and submit.`;
      setReply(fillReply);
      speakReply(fillReply);
      return;
    }

    // 5. General AI assistant query
    updatePhase("thinking");
    const displayMessages = [
      ...messagesRef.current,
      { role: "user", text: userText },
    ].slice(-20);
    const nextMessages = displayMessages.slice(-8);
    if (nextMessages[0]?.role === "assistant") nextMessages.shift();
    setMessages(displayMessages);
    messagesRef.current = displayMessages;
    try {
      const data = await sendAssistantMessageRequest(
        nextMessages,
        accessToken,
        user?.username,
        { ...screenContext, language },
      );
      if (!activeRef.current) return;
      const callerName = getUserDisplayName(user);
      const cleanedReply = stripRepetitiveGreeting(data.reply, callerName);

      // Execute structured component action tags returned by Gemini
      if (Array.isArray(data.actions) && data.actions.length > 0) {
        for (const action of data.actions) {
          if (action.type === "navigate") {
            onNavigateText?.(action.params.target, true);
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

      // Fallback: If Gemini interpreted and confirmed navigation
      const fallbackTarget =
        extractNavigationFromReply(cleanedReply, navItems) ||
        findNavigationTarget(cleanedReply, navItems);
      if (fallbackTarget) {
        onNavigateText?.(fallbackTarget, true);
        const navReply = `Opening ${fallbackTarget.label || "the requested section"}. I'm right here in the orb listening.`;
        setReply(navReply);
        setOrbActive(true);
        speakReply(navReply);
        return;
      }

      const assistantMessage = { role: "assistant", text: cleanedReply };
      messagesRef.current = [...messagesRef.current, assistantMessage].slice(
        -20,
      );
      setMessages(messagesRef.current);
      setReply(cleanedReply);
      speakReply(cleanedReply);
    } catch (requestError) {
      if (!activeRef.current) return;
      setError(
        requestError.message ||
          "The assistant could not respond. Please try again.",
      );
      updatePhase("listening");
      window.setTimeout(() => startListeningRef.current?.(), 600);
    }
  }

  useEffect(() => {
    startListeningRef.current = () => {
      if (!activeRef.current || phaseRef.current !== "listening") return;
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        activeRef.current = false;
        setError(
          "This browser does not support speech recognition. You can still use text chat.",
        );
        updatePhase("ready");
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = language === "hi" ? "hi-IN" : "en-IN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        let finalText = "";
        let interim = "";
        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const transcript = event.results[index][0]?.transcript || "";
          if (event.results[index].isFinal) finalText += transcript;
          else interim += transcript;
        }

        // Real-Time Voice Barge-In / Interruption:
        // When speech is detected while the AI is speaking, immediately interrupt the AI!
        if (phaseRef.current === "speaking" && (interim.trim() || finalText.trim())) {
          window.speechSynthesis?.cancel();
          window.clearTimeout(replyTimerRef.current);
          activeUtteranceRef.current = null;
          setCurrentSpokenLine("");
          updatePhase("listening");
        }

        setPartialText(interim.trim());
        if (finalText.trim()) {
          updatePhase("thinking");
          try {
            recognition.stop();
          } catch {
            // ignore
          }
          void processUtterance(finalText);
        }
      };
      recognition.onerror = (event) => {
        // Normal silence or browser pauses; keep voice session alive
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }
        const permanentErrors = {
          "not-allowed":
            "Microphone access is blocked. Allow it for this HTTPS site in browser and phone settings.",
          "service-not-allowed":
            "This browser blocked speech recognition. Try a supported browser or text chat.",
          "audio-capture":
            "No microphone is available. Check microphone access on your device.",
        };
        if (permanentErrors[event.error]) {
          activeRef.current = false;
          setError(permanentErrors[event.error]);
          updatePhase("ready");
          return;
        }
        if (event.error === "network") {
          return;
        }
        if (phaseRef.current === "ready") {
          setError("Voice input stopped. Check microphone permission and retry.");
        }
      };
      recognition.onend = () => {
        if (activeRef.current && phaseRef.current === "listening") {
          window.setTimeout(() => startListeningRef.current?.(), 250);
        }
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // If recognition failed to start (e.g. InvalidStateError), retry after backoff
        if (activeRef.current && phaseRef.current === "listening") {
          window.setTimeout(() => startListeningRef.current?.(), 400);
        }
      }
    };
  });

  async function startConversation() {
    setError("");
    if (!window.isSecureContext) {
      setError(
        "Voice chat needs an HTTPS page on mobile. Open FixFlow using its HTTPS link.",
      );
      return;
    }
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) {
      setError(
        "This browser does not support speech recognition. You can still use text chat.",
      );
      return;
    }
    activeRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      if (!activeRef.current) return;
      const callerName = getUserDisplayName(user);
      const nameGreeting = callerName ? `Hello ${callerName}, ` : "Hello! ";
      const greeting =
        role === "student"
          ? `${nameGreeting}this is your FixFlow assistant. How can I help you today? You can ask me to navigate, fill complaint details, or say "create a complaint".`
          : role === "admin"
            ? `${nameGreeting}this is your FixFlow assistant. How can I help you in your admin dashboard today? You can ask me to open Campus Map, SLA tracking, reports, or users.`
            : `${nameGreeting}this is your FixFlow assistant. How can I help you in your staff dashboard today? You can ask me to open assigned complaints or show resolved complaints.`;
      setReply(greeting);
      updatePhase("speaking");
      speakReply(greeting);
    } catch (permissionError) {
      activeRef.current = false;
      const blocked =
        permissionError?.name === "NotAllowedError" ||
        permissionError?.name === "PermissionDeniedError";
      setError(
        blocked
          ? "Microphone access is blocked. Allow it for this HTTPS site in browser and phone settings, then try again."
          : "FixFlow could not access a microphone. Check your device permissions and retry.",
      );
      updatePhase("ready");
    }
  }

  function handleProofImage(event) {
    const file = event.target.files?.[0] || null;
    setError("");
    if (
      file &&
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
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

  const labels = {
    ready: "Ready to talk",
    listening: "Listening · speak naturally",
    thinking: submitting ? "Submitting complaint" : "Thinking",
    speaking: "FixFlow is speaking",
  };
  const needsRelevanceConfirmation =
    triagePreview?.triage?.reviewSignal === "check_relevance" &&
    !triagePreview?.triage?.safetyConcern;

  // Render Continuous Floating Orb Portal when minimized
  if (orbActive && typeof document !== "undefined") {
    return createPortal(
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2.5 pointer-events-auto">
        {/* Live speech feedback pill */}
        {(partialText || (phase === "speaking" && (currentSpokenLine || reply))) && (
          <div
            onClick={phase === "speaking" ? interruptSpeaking : undefined}
            className={`max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-200 rounded-2xl border border-line/80 bg-white/95 px-4 py-2.5 text-xs text-ink shadow-xl backdrop-blur-md ${phase === "speaking" ? "cursor-pointer hover:bg-stone-50" : ""}`}
          >
            <div className="mb-1 flex items-center justify-between gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${phase === "speaking" ? "bg-brand animate-ping" : "bg-emerald-500 animate-pulse"}`}
                />
                {phase === "speaking" ? "FixFlow Assistant" : "Listening…"}
              </span>
              {phase === "speaking" && (
                <span className="text-[9px] lowercase text-stone-500 font-normal underline">
                  tap to interrupt
                </span>
              )}
            </div>
            <p className="font-semibold leading-relaxed">
              {phase === "speaking" ? (currentSpokenLine || reply) : partialText}
            </p>
          </div>
        )}

        {/* Floating Animated Orb Widget */}
        <div className="relative flex items-center gap-2">
          {/* Animated Radar Ripple Rings */}
          <span className="pointer-events-none absolute -inset-2 rounded-full border border-emerald-400/50 animate-ping opacity-60" />
          <span className="pointer-events-none absolute -inset-4 rounded-full border border-emerald-400/30 animate-pulse" />

          {/* Main Glowing Orb */}
          <button
            type="button"
            onClick={() => setOrbActive(false)}
            title="FixFlow Voice Assistant is active · Tap to expand"
            aria-label="Expand voice assistant"
            className="floating-voice-orb group relative flex size-16 cursor-pointer items-center justify-center rounded-full bg-gradient-to-tr from-[#164d43] via-[#267b66] to-[#55b996] shadow-2xl shadow-brand/40 transition hover:scale-105 active:scale-95"
          >
            <span className="voice-orb-light pointer-events-none absolute top-2 left-2 size-4 rounded-full bg-white/40 blur-xs" />

            {/* Live Animated Soundbars */}
            <div className="flex items-center gap-1">
              <span className="soundbar-1 w-1 rounded-full bg-white shadow-xs" />
              <span className="soundbar-2 w-1 rounded-full bg-white shadow-xs" />
              <span className="soundbar-3 w-1 rounded-full bg-white shadow-xs" />
              <span className="soundbar-4 w-1 rounded-full bg-white shadow-xs" />
            </div>

            {/* Continuous active indicator dot */}
            <span className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-white bg-emerald-400 animate-pulse" />
          </button>

          {/* End voice session button */}
          <button
            type="button"
            onClick={() => {
              stopVoice();
              onClose();
            }}
            title="End voice session (or say 'bye')"
            aria-label="End voice session"
            className="flex size-7 items-center justify-center rounded-full border border-line bg-white/95 text-stone-500 shadow-md transition hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={13} />
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  // Full Voice Dialog View
  return (
    <div className="assistant-voice-scroll flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-5 py-5 sm:px-8">
      {/* Top action bar: Minimize to Orb, Language Toggle, Mute, Interruption */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOrbActive(true)}
            title="Minimize to continuous floating orb"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand cursor-pointer"
          >
            <Minimize2 size={13} />
            <span>Minimize to Orb</span>
          </button>

          <button
            type="button"
            onClick={toggleLanguage}
            title="Switch between English and Hindi voice copilot"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:border-brand/40 hover:text-brand cursor-pointer"
          >
            <Languages size={13} className="text-brand" />
            <span>{language === "hi" ? "हिन्दी (Hindi)" : "English"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {phase === "speaking" && (
            <button
              type="button"
              onClick={interruptSpeaking}
              title="Click or speak to interrupt assistant immediately"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 cursor-pointer animate-pulse"
            >
              <Pause size={12} className="text-emerald-700" />
              <span>Interrupt</span>
            </button>
          )}

          {phase !== "ready" && (
            <button
              type="button"
              onClick={() => {
                setMuted((current) => !current);
                window.speechSynthesis?.cancel();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-muted transition hover:border-brand/30 hover:text-brand cursor-pointer"
            >
              <Volume2 size={13} />
              <span>{muted ? "Unmute" : "Mute"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-3.5 py-2 text-xs font-semibold text-muted">
          <span
            className={`size-2 rounded-full ${phase === "listening" ? "animate-pulse bg-emerald-500" : phase === "thinking" ? "animate-pulse bg-amber-500" : "bg-brand/60"}`}
          />
          {labels[phase]}
        </p>
        <div
          className={`voice-orb-scene my-4 grid place-items-center sm:my-5 ${phase === "listening" ? "is-listening" : phase === "thinking" ? "is-thinking" : phase === "speaking" ? "is-speaking" : ""}`}
          aria-hidden="true"
        >
          <span className="voice-orb-ring voice-orb-ring-one" />
          <span className="voice-orb-ring voice-orb-ring-two" />
          <span className="voice-orb-core">
            <span className="voice-orb-light" />
            <AudioLines size={28} className="relative z-10 text-white" />
          </span>
        </div>
        <h3 className="max-w-2xl font-display text-xl font-bold leading-8 text-ink sm:text-2xl transition-all duration-200">
          {phase === "ready"
            ? `Talk to your FixFlow assistant${getUserDisplayName(user) ? `, ${getUserDisplayName(user)}` : ""}`
            : phase === "listening"
              ? partialText || "I’m listening…"
              : phase === "thinking"
                ? submitting
                  ? "Submitting your complaint…"
                  : "One moment while I think…"
                : currentSpokenLine || reply || "FixFlow is speaking"}
        </h3>
        {lastUserText && (
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            You said: “{lastUserText}”
          </p>
        )}
      </div>

      {complaintMode && (
        <section className="mx-auto mt-5 w-full max-w-2xl rounded-2xl border border-line bg-canvas/70 p-4 text-left sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <CheckCircle2 size={18} />
            </span>
            <div>
              <h4 className="font-bold text-ink">Voice complaint draft</h4>
              <p className="mt-1 text-xs leading-5 text-muted">
                The assistant collects and reads back details. Review them,
                attach a proof photo, and confirm before submission.
              </p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Title", complaintDraft.title],
              ["Category", complaintDraft.category],
              ["Building", complaintDraft.building],
              ["Room", complaintDraft.room || "Not provided"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-line bg-white p-3"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="mt-1 break-words font-semibold text-ink">
                  {value || "The assistant will ask"}
                </dd>
              </div>
            ))}
            <div className="rounded-xl border border-line bg-white p-3 sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Description
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-ink">
                {complaintDraft.description ||
                  "The assistant will ask for details"}
              </dd>
            </div>
          </dl>
          {complaintDraft.title &&
            complaintDraft.building &&
            complaintDraft.category &&
            complaintDraft.description.length >= 30 && (
              <div className="mt-3 rounded-xl border border-dashed border-brand/30 bg-white p-3">
                <label
                  htmlFor="voice-complaint-proof"
                  className="mb-2 block text-sm font-semibold text-ink"
                >
                  Proof photo required
                </label>
                <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-3 text-sm font-semibold text-brand-dark transition hover:bg-brand-soft/40">
                  <Upload size={16} />
                  {proofImage
                    ? proofImage.name
                    : "Choose JPG, PNG, or WebP · max 5 MB"}
                  <input
                    id="voice-complaint-proof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleProofImage}
                  />
                </label>
                {proofImage && (
                  <p className="mt-2 text-xs text-muted">
                    Photo attached: {proofImage.name}
                  </p>
                )}
              </div>
            )}
          {triageLoading && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
              <LoaderCircle size={15} className="animate-spin" />
              Preparing the staff review summary…
            </p>
          )}
          {triagePreview?.triage && (
            <div className="mt-3 rounded-xl border border-brand/15 bg-brand-soft/40 p-3 text-sm">
              <p className="font-bold text-brand-dark">
                AI review suggestion · {triagePreview.triage.priority} ·{" "}
                {triagePreview.triage.urgency}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {triagePreview.triage.summary} Suggested category:{" "}
                {triagePreview.triage.suggestedCategory}. This is an advisory
                signal; campus staff make the final decision.
              </p>
              {needsRelevanceConfirmation && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <input
                    type="checkbox"
                    checked={confirmedCampusIssue}
                    onChange={(event) => {
                      setConfirmedCampusIssue(event.target.checked);
                      campusConfirmedRef.current = event.target.checked;
                    }}
                    className="mt-1 accent-emerald-700"
                  />
                  I confirm this describes an actual campus issue and may be
                  sent to staff for review.
                </label>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={submitting || triageLoading || !triagePreview?.token}
            onClick={() => void submitVoiceComplaint()}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <CheckCircle2 size={17} />
            {submitting ? "Submitting…" : "Confirm and submit complaint"}
          </button>
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mx-auto mt-4 w-full max-w-2xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm leading-5 text-rose-700"
        >
          {error}
        </p>
      )}

      <p className="mx-auto mt-4 max-w-xl text-center text-[11px] leading-5 text-muted">
        {role === "student" ? (
          <>
            Say <span className="font-semibold text-ink">"create complaint"</span>,{" "}
            <span className="font-semibold text-ink">"show my complaints"</span>, or{" "}
            <span className="font-semibold text-ink">"bye"</span> to end the session anytime.
          </>
        ) : role === "staff" ? (
          <>
            Say <span className="font-semibold text-ink">"show assigned complaints"</span>,{" "}
            <span className="font-semibold text-ink">"show resolved complaints"</span>, or{" "}
            <span className="font-semibold text-ink">"bye"</span> to end the session anytime.
          </>
        ) : (
          <>
            Say <span className="font-semibold text-ink">"open campus map"</span>,{" "}
            <span className="font-semibold text-ink">"SLA tracking"</span>, or{" "}
            <span className="font-semibold text-ink">"bye"</span> to end the session anytime.
          </>
        )}
      </p>

      <div className="mx-auto mt-5 flex items-center gap-3">
        {phase === "ready" ? (
          <button
            type="button"
            onClick={startConversation}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark"
          >
            <Mic size={18} />
            Start voice chat
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              stopVoice();
              onClose();
            }}
            className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-white px-6 text-sm font-semibold text-ink transition hover:bg-canvas"
          >
            <MicOff size={17} />
            End voice chat
          </button>
        )}
        {phase !== "ready" && (
          <button
            type="button"
            onClick={stopVoice}
            aria-label="Pause voice conversation"
            title="Pause voice conversation"
            className="grid size-12 place-items-center rounded-full border border-line bg-white text-muted transition hover:bg-canvas"
          >
            <Pause size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
