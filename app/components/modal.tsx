"use client";

import { ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full animate-fade-in-up rounded-t-2xl border border-border border-b-0 bg-card p-6 pt-5 shadow-xl overscroll-contain sm:max-w-sm sm:rounded-2xl sm:border-b max-h-[92dvh] overflow-y-auto"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        {children}
      </div>
    </div>
  );
}
