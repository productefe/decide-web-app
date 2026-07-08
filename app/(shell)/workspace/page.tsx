import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/analyze/AnalyzeModal";
import OnboardingModal from "@/components/onboarding-modal";
import { isPreferencesComplete } from "@/lib/preferences";
import { Upload } from "lucide-react";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: userPreferences } = await supabase
    .from("user_preferences")
    .select("id, sizes, gender, preferences")
    .eq("id", user.id)
    .single();

  if (error) {
    return <p className="text-muted-foreground">Profil yüklenemedi, sayfayı yenile.</p>;
  }

  const needsOnboarding = !isPreferencesComplete(userPreferences);
  const metaName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const firstName =
    profile?.full_name?.split(" ")[0] ||
    metaName.split(" ")[0] ||
    "sen";

  return (
    <div className="relative overflow-x-hidden">
      <div
        className="pointer-events-none absolute -top-4 -left-8 h-40 w-40 rounded-full bg-secondary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-24 -right-4 h-28 w-28 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      {needsOnboarding && <OnboardingModal userId={user.id} />}

      <section aria-label="Karar alanı" className="relative">
        <p className="inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-gradient-to-r from-secondary/10 to-accent/10 px-4 py-1.5 text-sm font-semibold text-secondary shadow-sm">
          <span className="size-1.5 rounded-full bg-secondary animate-pulse" aria-hidden />
          Karar alanın
        </p>

        <h1 className="mt-5 text-3xl font-semibold leading-tight text-foreground">
          Selam,{" "}
          <span className="text-secondary underline decoration-secondary/30 decoration-[3px] underline-offset-[5px]">
            {firstName}
          </span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          Beğendiğin kıyafetin fotoğrafını yükle, sana en uygun 3 seçeneği bulalım.
        </p>

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
          <AnalyzeModal userId={user.id} />
        </div>
      </section>
    </div>
  );
}
