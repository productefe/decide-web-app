import Navbar from "@/components/Navbar";
import ProfileForm from "@/components/profile-form";
import { createClient } from "@/utils/supabase/server";
import "@/globals.css";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: userPreferences } = await supabase
    .from("user_preferences")
    .select("id, height, weight, gender, preferences")
    .eq("id", user.id)
    .single();

  return (
    <div className="w-full max-w-lg min-h-screen mx-auto px-5 py-6 md:px-8">
      <Navbar />

      <section className="border-t border-border pt-8 mt-2">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">Hesabın</p>
          <h1 className="text-3xl font-semibold text-foreground mt-1">Profil</h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Boy, kilo, cinsiyet ve tarzını buradan güncelleyebilirsin.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-sm">
          <ProfileForm
            userId={user.id}
            initial={{
              id: user.id,
              height: userPreferences?.height ?? null,
              weight: userPreferences?.weight ?? null,
              gender: (userPreferences?.gender as "men" | "women" | null) ?? null,
              preferences: (userPreferences?.preferences as string[] | null) ?? null,
            }}
          />
        </div>
      </section>
    </div>
  );
}
