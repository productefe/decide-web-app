"use client";

import { useState } from "react";
import Modal from "./modal";
import { createClient } from "../utils/supabase/client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Button } from "./ui/button";

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

    console.log(supabase.auth.getUser());

    setLoading(false);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Sign in successful!");
      setEmail("");
      setPassword("");
      router.refresh(); // refresh server components (navbar updates)
      router.push("/workspace"); // optional redirect
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full max-w-sm mx-auto flex flex-col gap-10 p-6 bg-card rounded-3xl ">
        <div className="flex items-center justify-between">
          <p className="text-secondary text-xs font-extrabold tracking-widest uppercase">
            Login
          </p>
          <h2 className="text-secondary text-lg font-extrabold tracking-widest uppercase">
            Enter DECIDE.
          </h2>
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
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
        </form>

        {message && (
          <p className="text-sm text-muted-foreground text-center">{message}</p>
        )}
      </div>
    </Modal>
  );
}
