import { createClient } from "@/utils/supabase/server";
import FavoritesView from "./favorites-view";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return <FavoritesView userId={user.id} />;
}
