"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import GuestSignupUpsell from "./guest-signup-upsell";

export function GuestHeartUpsell({ onSignup }: { onSignup: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Beğenmek için üye ol"
        className="relative z-20 flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card border-border text-muted-foreground hover:border-red-300 hover:text-red-700 transition-colors touch-manipulation cursor-pointer active:scale-95"
      >
        <Heart className="size-4 pointer-events-none" aria-hidden />
      </button>
      <GuestSignupUpsell
        open={open}
        onClose={() => setOpen(false)}
        onSignup={() => {
          setOpen(false);
          onSignup();
        }}
        message="Ürünleri beğenmek ve kaydetmek için üye ol."
      />
    </>
  );
}
