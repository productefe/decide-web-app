import Navbar from "./components/Navbar"
import { ContactForm } from "./components/contact-form"
import { createClient } from "./utils/supabase/server"
import { isPermanentUser } from "./lib/auth-user"
import { redirect } from "next/navigation"
import Link from "next/link"
import "./globals.css"

const HOW_STEPS = [
  {
    num: "01",
    title: "Fotoğraf yükle",
    desc: "Beğendiğin kıyafetin net bir fotoğrafını uygulamaya ekle.",
  },
  {
    num: "02",
    title: "Decide analiz etsin",
    desc: "Yapay zeka tür, renk, kesim ve tarzı okur; giyim amacına göre arar.",
  },
  {
    num: "03",
    title: "Alternatifleri gör",
    desc: "Türk mağazalarından benzer, satın alınabilir seçenekleri karşılaştır.",
  },
];

const PRODUCT_POINTS = [
  {
    title: "Görüntüden ürün bulma",
    desc: "Tek bir fotoğraftan kıyafetin özelliklerini çıkarıp benzer ürünleri tarar.",
  },
  {
    title: "Giyim amacına göre",
    desc: "İş, gündelik, spor, akşam, ev veya sahil gibi bağlama uygun alternatifler sunar.",
  },
  {
    title: "Bütçene uygun sıralama",
    desc: "Tercih ettiğin fiyat yaklaşımına göre sonuçları düzenler.",
  },
  {
    title: "iOS uygulaması",
    desc: "Decide App Store’da; arama ve öneri bulut API üzerinden çalışır.",
  },
];

const TEAM_EMAILS = [
  { name: "Efe Sürücü", email: "efesurucu@decideshops.com" },
  { name: "Murat Efe Ergin", email: "mee@decideshops.com" },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPermanentUser(user)) {
    redirect("/workspace");
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-background">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] animate-landing-glow bg-[radial-gradient(ellipse_at_20%_0%,rgba(20,92,66,0.14),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(30,122,85,0.1),transparent_45%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-[40%] h-64 bg-[linear-gradient(180deg,transparent,rgba(237,230,216,0.65),transparent)]"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto w-full max-w-5xl px-5 pt-4 md:px-10 lg:px-12">
        <Navbar />
      </div>

      <main className="relative z-[1] mx-auto w-full max-w-5xl flex-1 px-5 pb-20 md:px-10 lg:px-12">
        {/* Hero */}
        <section className="relative py-16 md:py-24">
          <p className="animate-fade-in text-sm font-semibold tracking-[0.28em] text-secondary">
            DECIDE
          </p>
          <h1 className="animate-fade-in-up mt-5 max-w-3xl text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-[3.5rem] md:leading-[1.02]">
            Beğendiğin kıyafeti
            <span className="mt-1 block text-secondary">
              doğru alternatiflerle bul
            </span>
          </h1>
          <p
            className="animate-fade-in-up mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg"
            style={{ animationDelay: "80ms" }}
          >
            Decide, bir kıyafet fotoğrafından benzer ve satın alınabilir ürün
            alternatifleri sunan bir moda keşif uygulamasıdır. Karar sürecini
            sadeleştirir; doğru ürüne daha hızlı ulaşmanı sağlar.
          </p>
          <div
            className="animate-fade-in-up mt-9 flex flex-wrap items-center gap-4"
            style={{ animationDelay: "140ms" }}
          >
            <a
              href="https://apps.apple.com/tr/app/decide/id6789308240"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-secondary px-6 text-sm font-semibold text-secondary-foreground shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-accent active:scale-[0.98]"
            >
              App Store’da indir
            </a>
            <a
              href="#urun"
              className="inline-flex min-h-[48px] items-center text-sm font-semibold text-foreground/80 underline-offset-4 transition-colors hover:text-secondary hover:underline"
            >
              Ürünü keşfet
            </a>
          </div>
        </section>

        {/* Product */}
        <section id="urun" className="scroll-mt-24 py-14 md:py-20">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
                Ürün
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Fotoğraftan sonuca
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:text-right">
              Görüntü analizi, giyim bağlamı ve bütçe tercihiyle Türk
              mağazalarındaki alternatifleri bir araya getirir.
            </p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {PRODUCT_POINTS.map((item, i) => (
              <li
                key={item.title}
                className="group rounded-2xl border border-border/80 bg-card/70 p-5 shadow-[0_1px_0_rgba(15,61,46,0.04)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-secondary/30 hover:bg-card hover:shadow-md"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="inline-block h-1 w-8 rounded-full bg-secondary/70 transition-all duration-300 group-hover:w-12 group-hover:bg-secondary" />
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section
          id="nasil"
          className="scroll-mt-24 rounded-[1.75rem] border border-secondary/15 bg-gradient-to-br from-secondary/[0.07] via-card/40 to-accent/[0.06] px-5 py-14 md:px-10 md:py-16"
        >
          <p className="text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
            Nasıl çalışır
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Üç adımda karar
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {HOW_STEPS.map((step) => (
              <li key={step.num} className="relative">
                <span className="text-4xl font-semibold tracking-tight text-secondary/25">
                  {step.num}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* About */}
        <section id="hakkinda" className="scroll-mt-24 py-14 md:py-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
            Hakkında
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Kimler geliştirdi
          </h2>
          <div className="mt-8 max-w-2xl space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Decide, kıyafet arama sürecindeki karar yorgunluğunu azaltmak için
              geliştirilmiş bir üründür. Kullanıcı beğendiği bir parçanın
              fotoğrafını yükler; sistem benzer ürünleri bulur ve
              karşılaştırılabilir alternatifler sunar.
            </p>
            <p>
              Ürün,{" "}
              <span className="font-medium text-foreground">Efe Sürücü</span>
              {" "}ve{" "}
              <span className="font-medium text-foreground">Murat Efe Ergin</span>
              {" "}tarafından geliştirilmiştir. Hedefimiz; moda keşfini daha hızlı,
              daha net ve daha güvenilir hale getirmektir.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section id="iletisim" className="scroll-mt-24 pb-6 pt-4 md:pb-10">
          <div className="grid gap-10 md:grid-cols-[1fr_minmax(0,22rem)] md:items-start">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
                İletişim
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                Yazın, yanıtlayalım
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                Sorularınız, iş birliği veya geri bildirim için formu doldurun.
                Mesajınız bize doğrudan iletilir.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm backdrop-blur-sm md:p-6">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-[1] w-full border-t border-border bg-gradient-to-b from-muted/40 to-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 md:px-10 lg:px-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/app-icon.png"
                alt="DECIDE"
                className="size-10 shrink-0 rounded-xl object-contain shadow-sm"
              />
              <p className="text-base font-semibold tracking-tight text-foreground">
                Just decide.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <a href="#urun" className="transition-colors hover:text-secondary">
                Ürün
              </a>
              <a href="#hakkinda" className="transition-colors hover:text-secondary">
                Hakkında
              </a>
              <a href="#iletisim" className="transition-colors hover:text-secondary">
                İletişim
              </a>
              <a
                href="https://apps.apple.com/tr/app/decide/id6789308240"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-secondary"
              >
                App Store
              </a>
              <Link href="/privacy" className="transition-colors hover:text-secondary">
                Gizlilik Politikası
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
            {TEAM_EMAILS.map((person) => (
              <a
                key={person.email}
                href={`mailto:${person.email}`}
                className="transition-colors hover:text-secondary"
              >
                <span className="text-foreground/80">{person.name}</span>
                <span className="mx-2 text-border">·</span>
                {person.email}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
