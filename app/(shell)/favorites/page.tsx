import { createClient } from "@/utils/supabase/server";
import FavoritesView from "./favorites-view";
import type { SavedProductRow } from "@/lib/saved-products";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: items } = await supabase
    .from("saved_products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <FavoritesView
      userId={user.id}
      initialItems={(items ?? []) as SavedProductRow[]}
    />
  );
}
