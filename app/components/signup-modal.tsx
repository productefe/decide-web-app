"use client";

import { useState } from "react";
import Modal from "./modal";
import { createClient } from "../utils/supabase/client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "./ui/button";
import { inputClass } from "@/lib/input-styles";
import { mergeGuestSessionToDb } from "@/lib/guest";

export default function SignUpModal({
  open,
  onClose,
  router,
  onSwitchToLogin,
}: {
  open: boolean;
  onClose: () => void;
  router: AppRouterInstance;
  onSwitchToLogin?: () => void;
}) {
  const supabase = createClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let error: { message: string } | null = null;
    let savedGuestResults = false;
    const wasAnonymous = user?.is_anonymous ?? false;

    if (user?.is_anonymous) {
      const result = await supabase.auth.updateUser({
        email,
        password,
        data: { full_name: name },
      });
      error = result.error;
      if (!error) {
        savedGuestResults = await mergeGuestSessionToDb(user.id, name);
      }
    } else {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      error = result.error;
      if (!error && result.data.user) {
        savedGuestResults = await mergeGuestSessionToDb(result.data.user.id, name);
      }
    }

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setName("");
      setEmail("");
      setPassword("");
      onClose();
      router.refresh();
      router.push(wasAnonymous && savedGuestResults ? "/history" : "/workspace");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Hemen başla</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ücretsiz hesap oluştur, ilk aramana birkaç saniye kaldı.</p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSignUp}>
          <input
            placeholder="Adın"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <Button disabled={loading} type="submit" variant="default" size="full">
            {loading ? "Hesap oluşturuluyor..." : "Kayıt ol"}
          </Button>
        </form>

        {message && (
          <p className="text-sm text-destructive text-center">{message}</p>
        )}

        {onSwitchToLogin && (
          <p className="text-sm text-center text-muted-foreground">
            Zaten hesabın var mı?{" "}
            <button type="button" onClick={onSwitchToLogin} className="font-semibold text-secondary underline-offset-2 hover:underline">
              Giriş yap
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}
