import ProfileForm from "@/components/profile-form";
import ProfileLogout from "@/components/profile-logout";
import { createClient } from "@/utils/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userPreferences } = await supabase
    .from("user_preferences")
    .select("id, height, weight, gender, preferences")
    .eq("id", user.id)
    .single();

  return (
    <section aria-label="Profil">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">Hesabın</p>
        <h1 className="text-3xl font-semibold text-foreground mt-1">Profil</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Boy, kilo, cinsiyet ve tarzını buradan güncelleyebilirsin.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
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

      <div className="mt-6 pt-6 border-t border-border">
        <ProfileLogout />
      </div>
    </section>
  );
}
