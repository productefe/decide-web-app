"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isAnonymousUser } from "@/lib/auth-user";
import { isPreferencesComplete } from "@/lib/preferences";
import OnboardingModal from "@/components/onboarding-modal";
import AnalyzeModal from "@/components/analyze/AnalyzeModal";
import SignUpModal from "@/components/signup-modal";
import { Button } from "@/components/ui/button";
import { isGuestAnalysisUsed } from "@/lib/guest";

export default function GuestPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [analysisUsed, setAnalysisUsed] = useState(false);

  useEffect(() => {
    setAnalysisUsed(isGuestAnalysisUsed());
  }, []);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      let {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error || !data.user) {
          router.push("/");
          return;
        }
        user = data.user;
      }

      if (!isAnonymousUser(user)) {
        router.replace("/workspace");
        return;
      }

      setUserId(user.id);

      const { data: prefs } = await supabase
        .from("user_preferences")
        .select("id, sizes, gender, preferences")
        .eq("id", user.id)
        .single();

      setNeedsOnboarding(!isPreferencesComplete(prefs));
      setLoading(false);
    }

    void init();
  }, [router]);

  if (loading || !userId) {
    return <p className="text-muted-foreground text-sm py-8">Hazırlanıyor...</p>;
  }

  return (
    <>
      {needsOnboarding && (
        <OnboardingModal
          userId={userId}
          redirectPath="/guest"
          onComplete={() => setNeedsOnboarding(false)}
        />
      )}

      <section aria-label="Misafir modu">
        <p className="inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-gradient-to-r from-secondary/10 to-accent/10 px-4 py-1.5 text-sm font-semibold text-secondary shadow-sm">
          Misafir modu
        </p>

        <h1 className="mt-5 text-3xl font-semibold text-foreground leading-tight">
          İlk aramanı dene
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          Fotoğrafını yükle, sana en uygun üç alternatifi bulalım.
        </p>

        <div className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-foreground leading-relaxed">
          <p>
            Bu misafir modudur: analiz geçmişi inceleme, ürün beğenme, profil değiştirme gibi özellikler için şimdi kayıt olun.
          </p>
          <Button size="full" className="mt-3 min-h-[44px]" onClick={() => setShowSignup(true)}>
            Kayıt ol
          </Button>
        </div>

        <div className="mt-6 rounded-2xl border border-secondary/20 bg-card/90 p-5 shadow-sm ring-1 ring-secondary/10">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Upload className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Fotoğraf yükle</p>
              <p className="text-xs text-muted-foreground">Tek fotoğraf yeter</p>
            </div>
          </div>

          {analysisUsed ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Misafir analiz hakkını kullandın. Sonuçlarını kaydetmek ve daha fazla arama yapmak için üye ol.
              </p>
              <Button size="full" className="mt-4 min-h-[44px]" onClick={() => setShowSignup(true)}>
                Kayıt ol
              </Button>
              <Link href="/" className="block mt-3 text-xs text-muted-foreground hover:text-secondary">
                Ana sayfaya dön
              </Link>
            </div>
          ) : (
            <AnalyzeModal
              userId={userId}
              guestMode
              onSignup={() => setShowSignup(true)}
              onAnalysisComplete={() => setAnalysisUsed(true)}
            />
          )}
        </div>
      </section>

      <SignUpModal
        open={showSignup}
        onClose={() => setShowSignup(false)}
        router={router}
      />
    </>
  );
}
