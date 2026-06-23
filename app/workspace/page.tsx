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
        <p className="text-muted-foreground">Giriş yapmadın.</p>
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

  if (error) return <p className="p-10 text-muted-foreground">Profil yüklenemedi</p>;

  const needsOnboarding = !userPreferences;

  return (
    <div className="w-full max-w-3xl min-h-screen mx-auto px-6 py-6 md:px-10">
      <Navbar />

      {needsOnboarding && <OnboardingModal userId={user.id} />}

      <section aria-label="Karar alanı" className="border-t border-border pt-10">
        <div className="flex flex-col gap-3 mb-8">
          <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
            Karar alanı
          </p>
          <h2 className="text-3xl font-bold leading-tight tracking-wide">
            Merhaba, {profile?.full_name}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
            Beğendiğin bir ürünün fotoğrafını yükle, sana en uygun 3 seçeneği bulalım.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <AnalyzeModal userId={user.id} />
        </div>
      </section>
    </div>
  );
}
