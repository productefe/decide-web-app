"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { inputClass } from "@/lib/input-styles";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Mesaj gönderilemedi. Lütfen tekrar dene.");
        return;
      }
      setDone(true);
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setError("Mesaj gönderilemedi. Lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-secondary/25 bg-secondary/5 px-5 py-8 text-center">
        <p className="text-base font-semibold text-foreground">Mesajınız alındı</p>
        <p className="mt-2 text-sm text-muted-foreground">
          En kısa sürede size dönüş yapacağız.
        </p>
        <button
          type="button"
          className="mt-5 text-sm font-medium text-secondary underline-offset-2 hover:underline"
          onClick={() => setDone(false)}
        >
          Yeni mesaj gönder
        </button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <input
        name="name"
        placeholder="Adınız"
        autoComplete="name"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <input
        name="email"
        type="email"
        placeholder="E-posta adresiniz"
        autoComplete="email"
        required
        maxLength={120}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
      />
      <textarea
        name="message"
        placeholder="Mesajınız"
        required
        maxLength={2000}
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className={`${inputClass} resize-y min-h-[120px]`}
      />
      <Button disabled={loading} type="submit" size="lg" className="mt-1 min-h-[48px]">
        {loading ? "Gönderiliyor..." : "Gönder"}
      </Button>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </form>
  );
}
