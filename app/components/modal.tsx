"use client";

import { ReactNode } from "react";
import { BottomSheet } from "./bottom-sheet";

export default function Modal({
  open,
  onClose,
  children,
  scrollable = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  scrollable?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} scrollable={scrollable} zIndex={999}>
      {children}
    </BottomSheet>
  );
}
