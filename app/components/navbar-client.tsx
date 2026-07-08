"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import SignUpModal from "./signup-modal";
import SignInModal from "./signin-modal";
import { Button } from "./ui/button";

function displayName(email: string): string {
  return email.split("@")[0] || email;
}

type Props = {
  userEmail: string | null;
};

export default function NavbarClient({ userEmail }: Props) {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const onProfile = pathname === "/profile";

  const handleLogout = async () => {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  return (
    <nav className="border-b border-border pb-4 mb-2">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-h-[44px]">
          <button
            onClick={() => router.push(userEmail ? "/workspace" : "/")}
            aria-label="Ana sayfaya git"
            className="flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0"
          >
            <span className="size-2 rounded-full bg-secondary shrink-0" aria-hidden />
            <span className="font-semibold text-lg text-secondary tracking-tight">DECIDE</span>
          </button>
          {userEmail && (
            <Link
              href="/profile"
              className={`text-sm font-medium min-h-[44px] inline-flex items-center px-2 rounded-lg transition-colors ${
                onProfile
                  ? "text-secondary bg-secondary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
              }`}
            >
              Profil
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!userEmail ? (
            <>
              <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setShowSignup(true)}>
                Kayıt ol
              </Button>
              <Button size="sm" className="min-h-[44px]" onClick={() => setShowLogin(true)}>
                Giriş yap
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline max-w-[140px] truncate">
                {displayName(userEmail)}
              </span>
              <Button variant="outline" size="sm" className="min-h-[44px]" onClick={handleLogout}>
                Çıkış
              </Button>
            </>
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
        onSwitchToLogin={() => {
          setShowSignup(false);
          setShowLogin(true);
        }}
      />
      <SignInModal
        open={showLogin}
        onClose={() => {
          setShowSignup(false);
          setShowLogin(false);
        }}
        router={router}
        onSwitchToSignup={() => {
          setShowLogin(false);
          setShowSignup(true);
        }}
      />
    </nav>
  );
}
