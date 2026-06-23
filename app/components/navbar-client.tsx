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
    router.refresh();
    router.push("/");
  };

  return (
    <nav className="border-b border-border pb-4 mb-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            aria-label="Ana sayfaya git"
            className="bg-transparent text-secondary font-bold tracking-[0.2em] text-base p-0 border-0 cursor-pointer"
          >
            DECIDE
          </button>
          {userEmail && (
            <p className="text-sm text-muted-foreground hidden sm:block">{userEmail}</p>
          )}
        </div>

        <div className="flex gap-2">
          {!userEmail ? (
            <>
              <button
                onClick={() => setShowSignup(true)}
                className="text-sm font-bold bg-transparent text-foreground min-h-[40px] px-4 rounded-md border border-border cursor-pointer hover:border-accent/50 transition-colors"
              >
                Kayıt Ol
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="text-sm font-bold bg-secondary text-secondary-foreground min-h-[40px] px-4 rounded-md cursor-pointer hover:bg-accent transition-colors"
              >
                Giriş Yap
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="text-sm font-bold bg-destructive/20 text-destructive-foreground min-h-[40px] px-4 rounded-md border border-destructive/40 cursor-pointer hover:bg-destructive/30 transition-colors"
            >
              Çıkış
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
