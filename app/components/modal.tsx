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
      className="fixed inset-0 bg-black/75 flex justify-center items-end sm:items-center z-[999] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-lg p-6 w-full max-w-sm"
      >
        {children}
      </div>
    </div>
  );
}
