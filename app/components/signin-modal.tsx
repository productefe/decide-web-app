"use client";

import { useState } from "react";
import Modal from "./modal";
import { createClient } from "../utils/supabase/client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "./ui/button";

const inputClass =
  "w-full min-h-[48px] bg-muted text-foreground border border-border rounded-md px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function SignInModal({
  open,
  onClose,
  router,
}: {
  open: boolean;
  onClose: () => void;
  router: AppRouterInstance;
}) {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignIn = async (e: React.SubmitEvent) => {
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
      setMessage("Giriş başarılı.");
      setEmail("");
      setPassword("");
      router.refresh();
      router.push("/workspace");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="border-b border-border pb-4">
          <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2">
            Giriş
          </p>
          <h2 className="text-2xl font-bold tracking-wide">DECIDE&apos;a hoş geldin.</h2>
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            placeholder="E-posta"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            placeholder="Şifre"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <Button disabled={loading} type="submit" variant="default" size="full">
            {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>

        {message && (
          <p className="text-sm text-muted-foreground text-center">{message}</p>
        )}
      </div>
    </Modal>
  );
}
