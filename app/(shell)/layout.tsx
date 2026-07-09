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
      <header className="fixed top-0 inset-x-0 z-40 bg-card/95 backdrop-blur-md shadow-[0_4px_24px_rgba(15,61,46,0.06)]">
        <div className="mx-auto flex max-w-lg w-full px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <DecideLogo className="h-6 w-auto" />
        </div>
      </header>
      <main className="flex-1 px-5 pt-[calc(3.25rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <AppBottomNav />
    </div>
  );
}
