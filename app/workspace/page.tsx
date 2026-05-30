import Navbar from "@/components/Navbar"
import "@/styles.css"
import { createClient } from "@/utils/supabase/server";
import AnalyzeModal from "@/components/AnalyzeModal";

export default async function workspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div><h1>You are not logged in</h1></div>;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return <p>Error loading profile</p>;

  return (
    <div className="p-10">
      <Navbar />
      <section aria-label="Decision workspace">
        <div className="flex flex-col py-10">
          <p className="text-(--blue) text-sm font-bold">Decision workspace</p>
          <h2 className="text-3xl">Hello, {profile?.full_name}</h2>
        </div>
        <div className="analyze-layout">
          <div className="analyze-card">
            <AnalyzeModal userId={user.id} />
          </div>
          <aside className="backend-card">
            <p className="eyebrow">Backend handoff</p>
            <h3>Ready to connect</h3>
            <div className="handoff-row"><span>Auth</span><strong>Supabase</strong></div>
            <div className="handoff-row"><span>Upload</span><strong>Product image</strong></div>
            <div className="handoff-row"><span>Analyze</span><strong>Backend API</strong></div>
          </aside>
        </div>
      </section>
    </div>
  );
}