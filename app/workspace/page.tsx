import Navbar from "@/components/Navbar"
import "@/globals.css"
import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/AnalyzeModal";

export default async function workspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div><h1>Giriş yapmadın</h1></div>;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return <p>Profil yüklenemedi</p>;

  return (
    <div className="w-full max-w-6xl min-h-screen mx-auto px-10 py-4">
      <Navbar />
      <section aria-label="Karar alanı">
        <div className="flex flex-col py-10 gap-2">
          <p className="text-secondary text-xs font-extrabold tracking-widest uppercase">
            Karar alanı
          </p>
          <h2 className="text-3xl font-bold leading-none">
            Merhaba, {profile?.full_name}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
            Beğendiğin bir ürünün fotoğrafını yükle, sana en uygun 3 seçeneği bulalım.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="bg-card border border-border rounded-3xl shadow-2xl p-5">
            <AnalyzeModal userId={user.id} />
          </div>
        </div>
      </section>
    </div>
  );
}
