import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AppHeader from "@/components/app-header";
import AppBottomNav from "@/components/app-bottom-nav";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
      <AppHeader />
      <main className="flex-1 px-5 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <AppBottomNav />
    </div>
  );
}
