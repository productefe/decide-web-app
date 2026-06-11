import Navbar from "@/components/Navbar"
import "@/styles.css"
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
    <div className="p-10">
      <Navbar />
      <section aria-label="Karar alanı">
        <div className="flex flex-col py-10">
          <p className="text-(--blue) text-sm font-bold">Karar alanı</p>
          <h2 className="text-3xl">Merhaba, {profile?.full_name}</h2>
          <p className="text-sm text-zinc-400 mt-2">
            Beğendiğin bir ürünün fotoğrafını yükle, sana en uygun 3 seçeneği bulalım.
          </p>
        </div>
        <div className="analyze-layout">
          <div className="analyze-card">
            <AnalyzeModal userId={user.id} />
          </div>
        </div>
      </section>
    </div>
  );
}
