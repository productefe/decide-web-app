import Navbar from "@/components/Navbar"
import "@/globals.css"
import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/analyze/AnalyzeModal";
import OnboardingModal from "@/components/onboarding-modal";

export default async function workspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-muted-foreground">Giriş yapmadın — önce hesabına giriş yap.</p>
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
    .select("id")
    .eq("id", user.id)
    .single();

  if (error) return <p className="p-10 text-muted-foreground">Profil yüklenemedi, sayfayı yenile.</p>;

  const needsOnboarding = !userPreferences;
  const firstName = profile?.full_name?.split(" ")[0] || "sen";

  return (
    <div className="w-full max-w-3xl min-h-screen mx-auto px-5 py-6 md:px-8">
      <Navbar />

      {needsOnboarding && <OnboardingModal userId={user.id} />}

      <section aria-label="Karar alanı" className="border-t border-border pt-8 mt-2">
        <div className="flex flex-col gap-2 mb-6">
          <p className="text-sm font-medium text-muted-foreground">
            Karar alanın
          </p>
          <h2 className="text-3xl font-semibold leading-tight text-foreground">
            Selam, {firstName}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
            Beğendiğin bir ürünün fotoğrafını yükle — sana en uygun 3 seçeneği bulalım.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm">
          <AnalyzeModal userId={user.id} />
        </div>
      </section>
    </div>
  );
}
