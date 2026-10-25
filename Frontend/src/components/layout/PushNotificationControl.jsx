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

function browserSupportsPush() {
  return Boolean(
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window,
  );
}

export default function PushNotificationControl() {
  const { accessToken } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(true);
  const [checking, setChecking] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const checkSubscription = useCallback(async () => {
    if (!browserSupportsPush()) {
      setAvailable(false);
      setChecking(false);
      return;
    }

    try {
      const config = await getPushConfigRequest(accessToken);
      setAvailable(Boolean(config.enabled && config.publicKey));
      if (!config.enabled || !config.publicKey) return;
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        const workerUrl = import.meta.env.DEV ? "/sw.js?dev=1" : "/sw.js";
        registration = await navigator.serviceWorker.register(workerUrl);
      }
      registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Rebind a previously enabled device to the account currently signed in.
        await savePushSubscriptionRequest(subscription.toJSON(), accessToken);
      }
      setEnabled(Boolean(subscription));
    } catch (requestError) {
      setError(requestError.message || "Could not check this device's push settings.");
    } finally {
      setChecking(false);
    }
  }, [accessToken]);

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
      let registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await removePushSubscriptionRequest(subscription.endpoint, accessToken);
        await subscription.unsubscribe();
        setEnabled(false);
        return;
      }

      // Permission must be requested directly from this user gesture.
      const permissionPromise = Notification.requestPermission();
      const permission = await permissionPromise;
      if (permission !== "granted") {
        throw new Error(permission === "denied"
          ? "Notifications are blocked in browser settings. Allow them for FixFlow to continue."
          : "Allow notifications to enable complaint updates on this device.");
      }

      const config = await getPushConfigRequest(accessToken);
      if (!config.enabled || !config.publicKey) {
        throw new Error("Push notifications are not configured on this server yet.");
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationServerKey(config.publicKey),
      });

      try {
        await savePushSubscriptionRequest(subscription.toJSON(), accessToken);
      } catch (saveError) {
        await subscription.unsubscribe();
        throw saveError;
      }
      setEnabled(true);
    } catch (requestError) {
      setError(requestError.message || "Could not update push notification settings.");
    } finally {
      setWorking(false);
    }
  }

  if (!available) {
    return (
      <p className="px-4 py-3 text-xs leading-5 text-muted">
        Device notifications are unavailable or not configured for this browser.
      </p>
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
              {checking ? "Checking this device…" : enabled ? "Enabled on this device" : "Get updates when FixFlow is closed"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={checking || working}
          className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${enabled ? "border border-line bg-white text-ink hover:bg-stone-50" : "bg-brand text-white hover:bg-brand-dark"}`}
        >
          {working ? <LoaderCircle size={14} className="animate-spin" /> : null}
          {enabled ? "Turn off" : "Enable"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-rose-700">{error}</p>}
    </div>
  );
}
