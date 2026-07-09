import Navbar from "@/components/Navbar";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col max-w-lg mx-auto w-full px-5 py-4">
      <Navbar />
      <main className="flex-1 py-4">{children}</main>
    </div>
  );
}
