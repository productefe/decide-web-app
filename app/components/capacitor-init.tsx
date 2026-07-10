"use client";

import { useEffect, useState } from "react";

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

export function CapacitorInit() {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        document.documentElement.style.backgroundColor = "#F7F2E8";
        document.body.style.backgroundColor = "#F7F2E8";
        setShowSplash(true);

        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#F7F2E8" });

        await waitForPaintFrames(2);
        await waitForDocumentLoad();
        await waitForPaintFrames(2);

        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
        await waitForPaintFrames(1);
        setShowSplash(false);
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
