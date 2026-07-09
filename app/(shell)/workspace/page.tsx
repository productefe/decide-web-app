import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/analyze/AnalyzeModal";
import OnboardingModal from "@/components/onboarding-modal";
import { UploadScreenLayout } from "@/components/upload-screen-layout";
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

      <UploadScreenLayout
        title={
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Selam, <span className="text-secondary">{firstName}</span>
          </h1>
        }
        description="Beğendiğin kıyafetin fotoğrafını yükle, sana en uygun 3 seçeneği bulalım."
      >
        <AnalyzeModal userId={user.id} />
      </UploadScreenLayout>
    </>
  );
}
