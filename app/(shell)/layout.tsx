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
    <div className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
        <DecideLogo className="mb-3 h-6 w-auto shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
      <AppBottomNav />
    </div>
  );
}
