import Navbar from "@/components/Navbar";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden px-5 pt-[env(safe-area-inset-top)]">
      <Navbar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] pt-3">
        {children}
      </main>
    </div>
  );
}
