// components/navbar-client.tsx

"use client";

import { useState } from "react";
import SignUpModal from "./signup-modal";
import SignInModal from "./signin-modal";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type Props = {
  userEmail: string | null;
};

export default function NavbarClient({ userEmail }: Props) {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.refresh(); // refresh server components (navbar updates)
    router.push("/"); // optional redirect
  };

  return (
    <nav>
      <header className="h-[54px] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            data-go="intro"
            aria-label="Go to intro"
            className="bg-transparent text-foreground font-extrabold tracking-[.18em] text-[17px] p-0 border-0 cursor-pointer"
          >
            DECIDE
          </button>
          {userEmail && (
            <p className="text-sm text-muted-foreground">{userEmail}</p>
          )}
        </div>

        <div className="flex gap-3">
          {!userEmail ? (
            <>
              <button
                onClick={() => setShowSignup(true)}
                className="font-bold bg-muted text-foreground min-h-[40px] px-4 rounded-xl border border-border cursor-pointer"
              >
                Sign up
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="font-bold bg-secondary text-secondary-foreground min-h-[40px] px-4 rounded-xl shadow-lg cursor-pointer"
              >
                Sign in
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="font-bold bg-destructive/20 text-destructive-foreground min-h-[40px] px-4 rounded-xl border border-destructive/40 cursor-pointer"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      <SignUpModal
        open={showSignup}
        onClose={() => {
          setShowSignup(false);
          setShowLogin(false);
        }}
        router={router}
      />
      <SignInModal
        open={showLogin}
        onClose={() => {
          setShowSignup(false);
          setShowLogin(false);
        }}
        router={router}
      />
    </nav>
  );
}
