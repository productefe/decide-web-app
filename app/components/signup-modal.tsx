"use client";

import { useState } from "react";
import Modal from "./modal";
import { createClient } from "../utils/supabase/client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "./ui/button";

const inputClass =
  "w-full min-h-[48px] bg-muted text-foreground border border-border rounded-md px-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function SignUpModal({
  open,
  onClose,
  router,
}: {
  open: boolean;
  onClose: () => void;
  router: AppRouterInstance;
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Kayıt başarılı.");
      setName("");
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
            Kayıt
          </p>
          <h2 className="text-2xl font-bold tracking-wide">Hesap oluştur.</h2>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSignUp}>
          <input
            placeholder="Adın"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
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
            {loading ? "Oluşturuluyor..." : "Kayıt Ol"}
          </Button>
        </form>

        {message && (
          <p className="text-sm text-muted-foreground text-center">{message}</p>
        )}
      </div>
    </Modal>
  );
}
