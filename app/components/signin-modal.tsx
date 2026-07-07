"use client";

import { useState } from "react";
import Modal from "./modal";
import { createClient } from "../utils/supabase/client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "./ui/button";
import { inputClass } from "@/lib/input-styles";

export default function SignInModal({
  open,
  onClose,
  router,
  onSwitchToSignup,
}: {
  open: boolean;
  onClose: () => void;
  router: AppRouterInstance;
  onSwitchToSignup?: () => void;
}) {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setEmail("");
      setPassword("");
      onClose();
      router.refresh();
      router.push("/workspace");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Tekrar hoş geldin</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hesabına giriş yap, kaldığın yerden devam et.</p>
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            placeholder="E-posta"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            placeholder="Şifre"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <Button disabled={loading} type="submit" variant="default" size="full">
            {loading ? "Giriş yapılıyor..." : "Giriş yap"}
          </Button>
        </form>

        {message && (
          <p className="text-sm text-destructive text-center">{message}</p>
        )}

        {onSwitchToSignup && (
          <p className="text-sm text-center text-muted-foreground">
            Hesabın yok mu?{" "}
            <button type="button" onClick={onSwitchToSignup} className="font-semibold text-secondary underline-offset-2 hover:underline">
              Kayıt ol
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}
