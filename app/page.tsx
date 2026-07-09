import Navbar from "./components/Navbar"
import { LandingActions } from "./components/landing-actions"
import { createClient } from "./utils/supabase/server"
import { isPermanentUser } from "./lib/auth-user"
import Link from "next/link"
import { Upload, Search, CheckCircle2, Store, Sparkles, Heart, Star, Tag, UserRound } from "lucide-react"
import { DecideLogo } from "./components/decide-logo"
import "./globals.css"

const STEPS = [
  { num: "1", title: "Yükle", desc: "Beğendiğin kıyafetin fotoğrafını yükle", icon: Upload },
  { num: "2", title: "Karşılaştır", desc: "Alternatifleri tarayalım", icon: Search },
  { num: "3", title: "Seç", desc: "Sana uygun olduğunu düşündüğümüz 3 seçeneği gör", icon: CheckCircle2 },
];

const RESULT_TYPES = [
  { label: "Önerilen", desc: "Fotoğrafına en yakın eşleşme.", icon: Star },
  { label: "Daha uygun", desc: "Benzer ürün, daha iyi fiyat.", icon: Tag },
  { label: "Sana özel", desc: "Tarzına göre seçilmiş alternatif.", icon: UserRound },
];

const FEATURES = [
  {
    title: "Senin mağazaların",
    desc: "Son alışveriş yaptığın 10 mağazanın en az 9'u burada, fotoğrafını bekliyor",
    icon: Store,
  },
  {
    title: "Yapay zeka analizi",
    desc: "Fotoğraftan renk, kategori ve detayları otomatik okur.",
    icon: Sparkles,
  },
  {
    title: "Kişisel öneri",
    desc: "Tarzına özel alternatif",
    icon: Heart,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
      <div className="flex-1 w-full max-w-6xl mx-auto px-5 md:px-10 lg:px-14 py-4 flex flex-col">
        <Navbar />

        <main className="flex-1 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center py-8 lg:py-14">
          <div className="lg:col-span-7 relative">
            <div
              className="pointer-events-none absolute -top-8 -left-6 h-56 w-56 rounded-full bg-secondary/15 blur-3xl md:h-72 md:w-72"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute top-32 -right-4 h-40 w-40 rounded-full bg-accent/10 blur-3xl hidden md:block"
              aria-hidden
            />

            <p className="relative inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-gradient-to-r from-secondary/10 to-accent/10 px-4 py-1.5 text-sm font-semibold text-secondary shadow-sm">
              <span className="size-1.5 rounded-full bg-secondary animate-pulse" aria-hidden />
              Doğru karar, doğru kıyafet
            </p>

            <h1 className="relative mt-6 text-4xl md:text-5xl lg:text-[3.25rem] leading-[1.08] font-semibold text-foreground">
              Beğendiğin{" "}
              <span className="text-secondary underline decoration-secondary/30 decoration-[3px] underline-offset-[6px]">
                kıyafeti
              </span>
              <br />
              saniyeler içinde bul
            </h1>

            <p className="relative mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              Tek fotoğraf yeter, gerisini biz hallederiz
              <br className="hidden sm:block" />
              {" "}Türk mağazalarından sana en uygun üç alternatifi getiriyoruz
            </p>

            <div className="relative mt-10 grid sm:grid-cols-3 gap-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    className={`rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      i === 0
                        ? "border-secondary/40 ring-1 ring-secondary/10 bg-gradient-to-br from-card to-secondary/[0.06]"
                        : i === 1
                          ? "border-border hover:border-secondary/25"
                          : "border-border hover:border-accent/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground shadow-sm">
                        {step.num}
                      </span>
                      <span className="flex size-9 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                        <Icon className="size-4" aria-hidden />
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground leading-snug">{step.desc}</p>
                  </div>
                );
              })}
            </div>

            <LandingActions isLoggedIn={isPermanentUser(user)} />
          </div>

          <div className="lg:col-span-5 relative flex flex-col gap-3 lg:border-l lg:border-border lg:pl-12">
            <div
              className="pointer-events-none absolute -top-6 right-0 h-32 w-32 rounded-full bg-secondary/10 blur-2xl lg:block hidden"
              aria-hidden
            />
            <p className="text-sm font-semibold text-foreground mb-1">
              Birazdan ne göreceksin?
            </p>
            {RESULT_TYPES.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={`flex gap-3 rounded-2xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
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
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      <section className="border-t border-border bg-gradient-to-b from-muted/60 to-muted/30 w-full relative overflow-hidden">
        <div
          className="pointer-events-none absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-secondary/8 blur-3xl"
          aria-hidden
        />
        <div className="max-w-6xl mx-auto px-5 md:px-10 lg:px-14 py-10 lg:py-14 grid md:grid-cols-3 gap-5 relative">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`rounded-2xl border bg-card/80 p-5 shadow-sm transition-shadow hover:shadow-md ${
                  i === 0 ? "border-secondary/30 ring-1 ring-secondary/10 md:col-span-1" : "border-border"
                }`}
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary mb-3">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border bg-gradient-to-r from-card via-card to-secondary/5 w-full">
        <div className="max-w-6xl mx-auto px-5 md:px-10 lg:px-14 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <DecideLogo className="h-7 w-auto" />
          <div className="flex flex-col sm:items-end gap-1">
            <p className="text-sm sm:text-base font-semibold text-foreground text-center sm:text-right">
              Doğru karar, doğru kıyafet
            </p>
            <Link
              href="/privacy"
              className="text-xs text-muted-foreground hover:text-secondary transition-colors text-center sm:text-right"
            >
              Gizlilik Politikası
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
