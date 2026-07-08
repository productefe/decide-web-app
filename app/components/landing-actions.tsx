"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SignUpModal from "./signup-modal";
import SignInModal from "./signin-modal";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/client";
import { isPermanentUser } from "@/lib/auth-user";

export function LandingActions({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const router = useRouter();

  const startGuestMode = async () => {
    setGuestLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isPermanentUser(user)) {
        router.push("/workspace");
        return;
      }

      if (!user) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) return;
      }

      router.push("/guest");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 mt-10">
        {isLoggedIn ? (
          <Button
            size="lg"
            className="min-h-[48px] px-8 shadow-sm"
            onClick={() => router.push("/workspace")}
          >
            Yükle!
          </Button>
        ) : (
          <Button
            size="lg"
            className="min-h-[48px] px-8 shadow-sm"
            onClick={startGuestMode}
            disabled={guestLoading}
          >
            {guestLoading ? "Açılıyor..." : "Misafir Modu"}
          </Button>
        )}
      </div>

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
    </>
  );
}
