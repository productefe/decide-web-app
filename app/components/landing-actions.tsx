"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SignUpModal from "./signup-modal";
import SignInModal from "./signin-modal";
import { Button } from "./ui/button";

export function LandingActions() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="flex flex-wrap gap-3 mt-10">
        <Button
          size="lg"
          className="min-h-[48px] px-8"
          onClick={() => setShowLogin(true)}
        >
          Giriş Yap
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="min-h-[48px] px-8"
          onClick={() => setShowSignup(true)}
        >
          Kayıt Ol
        </Button>
      </div>

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
    </>
  );
}
