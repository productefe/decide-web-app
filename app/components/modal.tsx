"use client";

import { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-card border border-border border-b-0 sm:border-b rounded-t-2xl sm:rounded-2xl p-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl max-h-[92vh] overflow-y-auto overscroll-contain animate-fade-in-up"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        {children}
      </div>
    </div>
  );
}
