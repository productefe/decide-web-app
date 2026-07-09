"use client";

import { useEffect, useState } from "react";

export function CapacitorInit() {
  const [showBridge, setShowBridge] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        setShowBridge(true);

        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#F7F2E8" });

        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 400 });

        document.documentElement.classList.add("app-loaded");
        window.setTimeout(() => setShowBridge(false), 450);
      } catch {
        // Capacitor plugins not available in browser
      }
    }
    void init();
  }, []);

  if (!showBridge) return null;

  return (
    <div
      aria-hidden
      className="app-splash-bridge pointer-events-none fixed inset-0 z-[9999] flex items-start bg-[#F7F2E8] px-5 pt-[calc(1rem+env(safe-area-inset-top))]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/decide-logo.png" alt="" className="h-7 w-auto object-contain object-left" />
    </div>
  );
}
