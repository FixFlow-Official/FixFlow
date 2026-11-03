import { useCallback, useEffect, useState } from "react";
import { BellRing, LoaderCircle } from "lucide-react";
import { useAuth } from "../../context/useAuth.js";
import {
  getPushConfigRequest,
  removePushSubscriptionRequest,
  savePushSubscriptionRequest,
} from "../../services/api.js";

function decodeApplicationServerKey(encodedKey) {
  const padding = "=".repeat((4 - (encodedKey.length % 4)) % 4);
  const base64 = (encodedKey + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalledWebApp() {
  return Boolean(navigator.standalone) ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches;
}

function getUnsupportedReason() {
  if (!window.isSecureContext) return "Device notifications require a secure HTTPS connection.";
  if (isIosDevice() && !isInstalledWebApp()) {
    return "On iPhone or iPad, add FixFlow to your Home Screen first, then open the installed app and enable notifications here.";
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    if (isIosDevice()) return "Web push on iPhone and iPad requires iOS/iPadOS 16.4 or later and a Home Screen app.";
    return "This browser does not support web push notifications. Try an up-to-date browser that supports notifications.";
  }
  return "";
}

function matchesApplicationServerKey(subscription, encodedKey) {
  const existingKey = subscription?.options?.applicationServerKey;
  if (!existingKey) return true;
  const existingBytes = new Uint8Array(existingKey);
  const currentBytes = decodeApplicationServerKey(encodedKey);
  return existingBytes.length === currentBytes.length &&
    existingBytes.every((value, index) => value === currentBytes[index]);
}

export default function PushNotificationControl() {
  const { accessToken, user } = useAuth();
  const preferenceKey = user?.id ? `fixflow:push-opt-in:${user.role}:${user.id}` : null;
  const [enabled, setEnabled] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState("");
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const getSavedOptIn = useCallback(() => {
    if (!preferenceKey) return false;
    try {
      return window.localStorage.getItem(preferenceKey) === "1";
    } catch {
      return false;
    }
  }, [preferenceKey]);

  const saveOptIn = useCallback((value) => {
    if (!preferenceKey) return;
    try {
      window.localStorage.setItem(preferenceKey, value ? "1" : "0");
    } catch {
      // Push itself remains usable when browser storage is restricted.
    }
  }, [preferenceKey]);

  const createAndSaveSubscription = useCallback(async (registration, publicKey) => {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(publicKey),
    });
    try {
      await savePushSubscriptionRequest(subscription.toJSON(), accessToken);
      return subscription;
    } catch (saveError) {
      await subscription.unsubscribe();
      throw saveError;
    }
  }, [accessToken]);

  const checkSubscription = useCallback(async () => {
    const unsupportedReason = getUnsupportedReason();
    if (unsupportedReason) {
      setUnavailableReason(unsupportedReason);
      setChecking(false);
      return;
    }

    try {
      const config = await getPushConfigRequest(accessToken);
      if (!config.enabled || !config.publicKey) {
        setUnavailableReason("Device notifications are not configured by the FixFlow server yet.");
        return;
      }
      setUnavailableReason("");
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        const workerUrl = import.meta.env.DEV ? "/sw.js?dev=1" : "/sw.js";
        registration = await navigator.serviceWorker.register(workerUrl);
      }
      registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      let shouldRestore = getSavedOptIn() && Notification.permission === "granted";
      if (subscription && Notification.permission === "granted") {
        // An existing browser subscription proves the person previously opted in.
        saveOptIn(true);
        shouldRestore = true;
      }
      if (subscription) {
        if (!matchesApplicationServerKey(subscription, config.publicKey)) {
          await removePushSubscriptionRequest(subscription.endpoint, accessToken);
          await subscription.unsubscribe();
          subscription = null;
        }
      }
      if (!subscription && shouldRestore) {
        // Some mobile browsers expire or drop a subscription. Repair it on the next app visit
        // only when the user previously enabled push and the browser still grants permission.
        subscription = await createAndSaveSubscription(registration, config.publicKey);
      }
      if (subscription) {
        // Rebind a previously enabled device to the account currently signed in.
        await savePushSubscriptionRequest(subscription.toJSON(), accessToken);
      }
      setEnabled(Boolean(subscription) && Notification.permission === "granted");
      if (!subscription && getSavedOptIn() && Notification.permission !== "granted") {
        setError("Your browser or device has blocked notifications. Allow them in site and device settings, then reopen FixFlow to reconnect this device.");
      }
    } catch (requestError) {
      setError(requestError.message || "Could not check this device's push settings.");
    } finally {
      setChecking(false);
    }
  }, [accessToken, createAndSaveSubscription, getSavedOptIn, saveOptIn]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => checkSubscription(), 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [checkSubscription]);

  async function handleToggle() {
    if (working) return;
    setWorking(true);
    setError("");

    try {
      if (enabled) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await removePushSubscriptionRequest(subscription.endpoint, accessToken);
          await subscription.unsubscribe();
        }
        saveOptIn(false);
        setEnabled(false);
        return;
      }

      // Call the permission API immediately from the tap. Some mobile browsers
      // discard user activation after any network or service-worker await.
      const permissionPromise = Notification.permission === "granted"
        ? Promise.resolve("granted")
        : Notification.permission === "denied"
          ? Promise.resolve("denied")
          : Notification.requestPermission();

      let registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      const config = await getPushConfigRequest(accessToken);
      if (!config.enabled || !config.publicKey) {
        throw new Error("Push notifications are not configured on this server yet.");
      }

      if (subscription && !matchesApplicationServerKey(subscription, config.publicKey)) {
        await removePushSubscriptionRequest(subscription.endpoint, accessToken);
        await subscription.unsubscribe();
        subscription = null;
      }

      const permission = await permissionPromise;
      if (permission !== "granted") {
        throw new Error(permission === "denied"
          ? "Notifications are blocked in browser settings. Allow them for FixFlow to continue."
          : "Allow notifications to enable complaint updates on this device.");
      }

      if (subscription) {
        await savePushSubscriptionRequest(subscription.toJSON(), accessToken);
      } else {
        subscription = await createAndSaveSubscription(registration, config.publicKey);
      }
      saveOptIn(true);
      setEnabled(true);
    } catch (requestError) {
      setError(requestError.message || "Could not update push notification settings.");
    } finally {
      setWorking(false);
    }
  }

  if (unavailableReason) {
    return (
      <div className="border-b border-line bg-canvas/50 px-4 py-3">
        <p className="text-sm font-semibold text-ink">Device notifications</p>
        <p className="mt-1 text-xs leading-5 text-muted">{unavailableReason}</p>
      </div>
    );
  }

  return (
    <div className="border-b border-line bg-canvas/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <BellRing size={16} className="shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Device notifications</p>
            <p className="text-xs text-muted">
              {checking ? "Checking this device…" : enabled ? "Enabled on this device" : Notification.permission === "denied" ? "Blocked in browser or device settings" : "Get updates when FixFlow is closed"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={checking || working || (!enabled && Notification.permission === "denied")}
          className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? "border border-line bg-white text-ink hover:bg-stone-50" : "bg-brand text-white hover:bg-brand-dark"}`}
        >
          {working ? <LoaderCircle size={14} className="animate-spin" /> : null}
          {enabled ? "Turn off" : Notification.permission === "denied" ? "Blocked" : "Enable"}
        </button>
      </div>
      {!checking && !enabled && Notification.permission === "denied" && (
        <p className="mt-2 text-xs leading-5 text-amber-800">
          Notifications are blocked for this site. Change the site’s notification permission in your browser or device settings, then try again.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-700">{error}</p>}
    </div>
  );
}
