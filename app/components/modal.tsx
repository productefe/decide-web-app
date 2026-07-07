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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center z-[999] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        {children}
      </div>
    </div>
  );
}
