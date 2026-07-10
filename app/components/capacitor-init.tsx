"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN_SPLASH_MS = 1500;

function isNativeCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as Window & { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform()
  );
}

function applyCreamBackground() {
  document.documentElement.style.backgroundColor = "#F7F2E8";
  document.body.style.backgroundColor = "#F7F2E8";
}

function waitForDocumentLoad(): Promise<void> {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function waitForPaintFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function waitForMinimumSplash(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= MIN_SPLASH_MS) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, MIN_SPLASH_MS - elapsed);
  });
}

export function CapacitorInit() {
  const splashStartedAt = useRef<number | null>(null);
  const [showSplash, setShowSplash] = useState(isNativeCapacitor);

  useLayoutEffect(() => {
    if (!isNativeCapacitor()) return;

    splashStartedAt.current = Date.now();
    applyCreamBackground();
    setShowSplash(true);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        if (splashStartedAt.current === null) {
          splashStartedAt.current = Date.now();
        }
        applyCreamBackground();
        setShowSplash(true);

        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#F7F2E8" });

        await waitForPaintFrames(2);
        await waitForDocumentLoad();
        await waitForPaintFrames(2);
        await waitForMinimumSplash(splashStartedAt.current);

        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
        await waitForPaintFrames(1);
        setShowSplash(false);
        window.dispatchEvent(new CustomEvent("decide:splash-hidden"));
      } catch {
        // Capacitor plugins not available in browser
      }
    }
    void init();
  }, []);

  if (!showSplash) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-[#F7F2E8]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decide-logo.png" alt="" className="h-8 w-auto object-contain" />
    </div>
  );
}
