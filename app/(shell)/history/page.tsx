import { createClient } from "@/utils/supabase/server";
import HistoryView from "./history-view";
import type { SearchHistoryRow } from "@/lib/search-history";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: rows } = await supabase
    .from("search_history")
    .select("id, photo_url, results, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return <HistoryView userId={user.id} items={(rows ?? []) as SearchHistoryRow[]} />;
}
