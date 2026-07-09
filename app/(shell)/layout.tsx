import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isAnonymousUser } from "@/lib/auth-user";
import AppBottomNav from "@/components/app-bottom-nav";
import { DecideLogo } from "@/components/decide-logo";

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

  if (isAnonymousUser(user)) {
    redirect("/guest");
  }

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-lg mx-auto w-full">
      <main className="flex-1 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        <DecideLogo className="h-6 w-auto mb-4" />
        {children}
      </main>
      <AppBottomNav />
    </div>
  );
}
