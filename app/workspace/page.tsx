import Navbar from "@/components/Navbar"
import "@/globals.css"
import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/analyze/AnalyzeModal";
import OnboardingModal from "@/components/onboarding-modal";
import { isPreferencesComplete } from "@/lib/preferences";
import { Upload } from "lucide-react";

export default async function workspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-muted-foreground">Giriş yapmadın. Önce hesabına giriş yap.</p>
      </div>
    );
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: userPreferences } = await supabase
    .from("user_preferences")
    .select("id, height, weight, gender, preferences")
    .eq("id", user.id)
    .single();

  if (error) return <p className="p-10 text-muted-foreground">Profil yüklenemedi, sayfayı yenile.</p>;

  const needsOnboarding = !isPreferencesComplete(userPreferences);
  const firstName = profile?.full_name?.split(" ")[0] || "sen";

  return (
    <div className="w-full max-w-3xl min-h-screen mx-auto px-5 py-6 md:px-8 relative overflow-x-hidden">
      <div
        className="pointer-events-none absolute top-16 -left-8 h-48 w-48 rounded-full bg-secondary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-40 right-0 h-32 w-32 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <Navbar />

      {needsOnboarding && <OnboardingModal userId={user.id} />}

      <section aria-label="Karar alanı" className="relative border-t border-border pt-8 mt-2">
        <p className="inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-gradient-to-r from-secondary/10 to-accent/10 px-4 py-1.5 text-sm font-semibold text-secondary shadow-sm">
          <span className="size-1.5 rounded-full bg-secondary animate-pulse" aria-hidden />
          Karar alanın
        </p>

        <h2 className="mt-5 text-3xl md:text-4xl font-semibold leading-tight text-foreground">
          Selam,{" "}
          <span className="text-secondary underline decoration-secondary/30 decoration-[3px] underline-offset-[5px]">
            {firstName}
          </span>
        </h2>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-lg">
          Beğendiğin kıyafetin fotoğrafını yükle, sana en uygun 3 seçeneği bulalım.
        </p>

        <div className="mt-8 rounded-2xl border border-secondary/20 bg-card/90 p-5 md:p-6 shadow-sm ring-1 ring-secondary/10 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
            <span className="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
              <Upload className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Fotoğraf yükle</p>
              <p className="text-xs text-muted-foreground">Tek fotoğraf yeter</p>
            </div>
          </div>
          <AnalyzeModal userId={user.id} />
        </div>
      </section>
    </div>
  );
}
