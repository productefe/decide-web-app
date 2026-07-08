"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export default function ProfileLogout() {
  const router = useRouter();

  const handleLogout = async () => {
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="full"
      className="min-h-[48px] text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
      onClick={handleLogout}
    >
      Çıkış yap
    </Button>
  );
}
