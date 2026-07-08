"use client";

import Modal from "./modal";
import { Button } from "./ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  onSignup: () => void;
  title?: string;
  message?: string;
};

export default function GuestSignupUpsell({
  open,
  onClose,
  onSignup,
  title = "Üye ol",
  message = "Bu özellik için üye olman gerekiyor.",
}: Props) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <Button size="full" onClick={onSignup}>
          Kayıt ol
        </Button>
        <Button variant="outline" size="full" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </Modal>
  );
}
