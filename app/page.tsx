import Navbar from "./components/Navbar"
import { LandingActions } from "./components/landing-actions"
import { createClient } from "./utils/supabase/server"
import { isPermanentUser } from "./lib/auth-user"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Upload, Search, CheckCircle2, Star, Tag, UserRound } from "lucide-react"
import "./globals.css"

const STEPS = [
  { num: "1", title: "Yükle", desc: "Beğendiğin kıyafetin fotoğrafını yükle", icon: Upload },
  { num: "2", title: "Karşılaştır", desc: "Alternatifleri tarayalım", icon: Search },
  { num: "3", title: "Seç", desc: "Sana uygun 3 seçeneği gör", icon: CheckCircle2 },
];

const RESULT_TYPES = [
  { label: "Önerilen", desc: "Fotoğrafına en yakın eşleşme.", icon: Star },
  { label: "Daha uygun", desc: "Benzer ürün, daha iyi fiyat.", icon: Tag },
  { label: "Sana özel", desc: "Tarzına göre seçilmiş alternatif.", icon: UserRound },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPermanentUser(user)) {
    redirect("/workspace");
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden overscroll-y-none bg-background -mb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-6 pt-4 md:px-10 md:pb-10 lg:px-14">
        <Navbar />

        <main className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-12 lg:gap-14 lg:py-14">
          <div className="relative lg:col-span-7">
            <div
              className="pointer-events-none absolute -top-8 -left-6 h-40 w-40 rounded-full bg-secondary/15 blur-3xl md:h-72 md:w-72"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute top-32 -right-4 hidden h-40 w-40 rounded-full bg-accent/10 blur-3xl md:block"
              aria-hidden
            />

            <p className="relative inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-gradient-to-r from-secondary/10 to-accent/10 px-3 py-1 text-xs font-semibold text-secondary shadow-sm sm:px-4 sm:py-1.5 sm:text-sm">
              <span className="size-1.5 rounded-full bg-secondary animate-pulse" aria-hidden />
              Doğru karar, doğru kıyafet
            </p>

            <h1 className="relative mt-4 text-[2rem] font-semibold leading-[1.1] text-foreground sm:mt-6 sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
              Beğendiğin{" "}
              <span className="text-secondary underline decoration-secondary/30 decoration-[3px] underline-offset-[6px]">
                kıyafeti
              </span>
              <br />
              saniyeler içinde bul
            </h1>

            <p className="relative mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg md:text-xl">
              Tek fotoğraf yeter — Türk mağazalarından sana en uygun üç alternatifi getiriyoruz.
            </p>

            <div className="relative mt-6 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    className={`rounded-xl border bg-card p-2.5 shadow-sm sm:rounded-2xl sm:p-4 ${
                      i === 0
                        ? "border-secondary/40 bg-gradient-to-br from-card to-secondary/[0.06] ring-1 ring-secondary/10"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground shadow-sm sm:size-8 sm:text-sm">
                        {step.num}
                      </span>
                      <span className="hidden size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary sm:flex">
                        <Icon className="size-4" aria-hidden />
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground sm:mt-3">{step.title}</p>
                    <p className="mt-0.5 hidden text-sm leading-snug text-muted-foreground sm:block">
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <LandingActions isLoggedIn={isPermanentUser(user)} />
          </div>

          <div className="relative hidden flex-col gap-3 lg:col-span-5 lg:flex lg:border-l lg:border-border lg:pl-12">
            <div
              className="pointer-events-none absolute -top-6 right-0 hidden h-32 w-32 rounded-full bg-secondary/10 blur-2xl lg:block"
              aria-hidden
            />
            <p className="mb-1 text-sm font-semibold text-foreground">
              Birazdan ne göreceksin?
            </p>
            {RESULT_TYPES.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    i === 0
                      ? "border-secondary/35 bg-gradient-to-br from-card to-secondary/5 shadow-sm"
                      : i === 2
                        ? "border-accent/25 bg-gradient-to-br from-card to-accent/5"
                        : "border-border bg-card shadow-sm"
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                      i === 0
                        ? "bg-secondary/15 text-secondary ring-4 ring-secondary/10"
                        : i === 2
                          ? "bg-accent/15 text-accent"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      <footer className="mt-auto w-full shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-row items-center justify-between gap-4 px-5 py-3 md:px-10 md:py-4 lg:px-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app-icon.png" alt="DECIDE" className="size-9 shrink-0 rounded-xl object-contain sm:size-11 sm:rounded-2xl" />
          <div className="flex min-w-0 flex-col items-end justify-center gap-0.5">
            <p className="text-right text-xs font-semibold text-foreground sm:text-sm">
              Doğru karar, doğru kıyafet
            </p>
            <Link
              href="/privacy"
              className="text-right text-xs text-muted-foreground transition-colors hover:text-secondary"
            >
              Gizlilik Politikası
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
