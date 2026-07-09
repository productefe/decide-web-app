"use client";

import { ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type BottomSheetProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** When true, only the sheet body scrolls — never the page behind it. */
  scrollable?: boolean;
  className?: string;
  zIndex?: number;
};

export function BottomSheet({
  open,
  onClose,
  children,
  scrollable = false,
  className = "",
  zIndex = 50,
}: BottomSheetProps) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
      style={{ zIndex }}
    >
      {onClose ? (
        <button
          type="button"
          aria-label="Kapat"
          className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-none overscroll-none"
          onClick={onClose}
        />
      ) : (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-none overscroll-none"
          aria-hidden
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full max-w-lg sm:max-w-sm animate-fade-in-up ${
          scrollable
            ? "flex max-h-[min(90dvh,920px)] flex-col overflow-hidden"
            : "overflow-hidden"
        } rounded-t-2xl border border-border border-b-0 bg-card px-6 pt-2 shadow-xl sm:rounded-2xl sm:border-b pb-[max(1rem,env(safe-area-inset-bottom))] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden"
          aria-hidden
        />

        {scrollable ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
