"use client";

import { useState } from "react";
import Modal from "./modal";
import { createClient } from "../utils/supabase/client";
import { useRouter } from "next/navigation";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "./ui/button";

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
      setMessage("Sign up successful!");
      setName("");
      setEmail("");
      setPassword("");
      router.refresh(); // refresh server components (navbar updates)
      router.push("/workspace"); // optional redirect
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4 p-6 bg-card rounded-3xl">
        <div>
          <p className="text-secondary text-xs font-extrabold tracking-widest uppercase mb-3">
            Login
          </p>
          <h2 className="text-2xl font-bold leading-none">Enter DECIDE.</h2>
        </div>

        <div className="flex flex-col gap-3" onSubmit={handleSignUp}>
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full min-h-[52px] bg-muted text-foreground border border-border rounded-2xl px-4 outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10"
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[52px] bg-muted text-foreground border border-border rounded-2xl px-4 outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[52px] bg-muted text-foreground border border-border rounded-2xl px-4 outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10"
          />
          <Button
            disabled={loading}
            type="submit"
            variant={"default"}
            size={"full"}
          >
            {loading ? "Creating..." : "Sign Up"}
          </Button>
        </div>

        {message && (
          <p className="text-sm text-muted-foreground text-center mt-1">
            {message}
          </p>
        )}
      </div>
    </Modal>
  );
}
