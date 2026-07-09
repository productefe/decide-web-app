import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/analyze/AnalyzeModal";
import OnboardingModal from "@/components/onboarding-modal";
import { isPreferencesComplete } from "@/lib/preferences";

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
    <>
      {needsOnboarding ? <OnboardingModal userId={user.id} /> : null}

      <section
        aria-label="Karar alanı"
        className="relative flex min-h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col animate-fade-in-up"
      >
        <header className="shrink-0">
          <h1 className="text-3xl font-semibold leading-tight text-foreground">
            Selam, <span className="text-secondary">{firstName}</span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Beğendiğin kıyafetin fotoğrafını yükle, sana en uygun 3 seçeneği bulalım.
          </p>
        </header>

        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <AnalyzeModal userId={user.id} />
        </div>
      </section>
    </>
  );
}
