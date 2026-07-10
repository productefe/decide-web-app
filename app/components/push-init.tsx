"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { isPermanentUser } from "@/lib/auth-user";

function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (
    window as Window & {
      Capacitor?: { isNativePlatform: () => boolean; getPlatform: () => string };
    }
  ).Capacitor;
  return Boolean(cap?.isNativePlatform() && cap.getPlatform() === "ios");
}

function waitForSplashHidden(): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, 2500);
    const onHidden = () => {
      window.clearTimeout(timer);
      resolve();
    };
    window.addEventListener("decide:splash-hidden", onHidden, { once: true });
  });
}

export function PushInit() {
  const started = useRef(false);

  useEffect(() => {
    if (!isNativeIOS() || started.current) return;
    started.current = true;

    let removeRegistration: (() => void) | undefined;
    let removeError: (() => void) | undefined;

    async function initPush() {
      try {
        await waitForSplashHidden();

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!isPermanentUser(user)) return;

        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") return;

        const regHandle = await PushNotifications.addListener("registration", async (token) => {
          const value = token.value?.trim();
          if (!value) return;
          try {
            await fetch("/api/push/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: value, platform: "ios" }),
            });
          } catch (err) {
            console.warn("push register failed", err);
          }
        });

        const errHandle = await PushNotifications.addListener("registrationError", (err) => {
          console.warn("push registration error", err);
        });

        removeRegistration = () => void regHandle.remove();
        removeError = () => void errHandle.remove();

        await PushNotifications.register();
      } catch {
        // Push not available (browser dev)
      }
    }

    void initPush();

    return () => {
      removeRegistration?.();
      removeError?.();
    };
  }, []);

  return null;
}
