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
    desc: "Decide, App Store’da kullanılabilir; arama ve öneri bulut API üzerinden çalışır.",
  },
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
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-background">
      <div className="mx-auto w-full max-w-5xl px-5 pt-4 md:px-10 lg:px-12">
        <Navbar />
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 md:px-10 lg:px-12">
        {/* Hero — brand first, no auth CTAs */}
        <section className="relative border-b border-border py-14 md:py-20">
          <div
            className="pointer-events-none absolute -top-10 left-0 h-56 w-56 rounded-full bg-secondary/10 blur-3xl"
            aria-hidden
          />
          <p className="relative text-sm font-semibold tracking-[0.2em] text-secondary">
            DECIDE
          </p>
          <h1 className="relative mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-[3.25rem]">
            Beğendiğin kıyafeti
            <br />
            doğru alternatiflerle bul
          </h1>
          <p className="relative mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Decide, bir kıyafet fotoğrafından benzer ve satın alınabilir ürün
            alternatifleri sunan bir moda keşif uygulamasıdır. Karar sürecini
            sadeleştirir; doğru ürüne daha hızlı ulaşmanı sağlar.
          </p>
        </section>

        {/* Product */}
        <section id="urun" className="scroll-mt-24 border-b border-border py-14 md:py-16">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">Ürün</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Decide; görüntü analizi, giyim bağlamı ve bütçe tercihiyle Türk
            mağazalarındaki alternatifleri bir araya getirir. İhtiyacın olan şey
            nettir: gördüğün parçaya yakın, alınabilir seçenekler.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2">
            {PRODUCT_POINTS.map((item) => (
              <li key={item.title} className="border-t border-border pt-5">
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="nasil" className="scroll-mt-24 border-b border-border py-14 md:py-16">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
            Nasıl çalışır
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Üç adımda fotoğraftan sonuca.
          </p>
          <ol className="mt-10 space-y-8">
            {HOW_STEPS.map((step) => (
              <li key={step.num} className="flex gap-5 md:gap-8">
                <span className="shrink-0 text-sm font-semibold tracking-wider text-secondary">
                  {step.num}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* About */}
        <section id="hakkinda" className="scroll-mt-24 border-b border-border py-14 md:py-16">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">Hakkında</h2>
          <div className="mt-6 max-w-2xl space-y-4 text-base leading-relaxed text-muted-foreground">
            <p>
              Decide, kıyafet arama sürecindeki karar yorgunluğunu azaltmak için
              geliştirilmiş bir üründür. Kullanıcı beğendiği bir parçanın
              fotoğrafını yükler; sistem benzer ürünleri bulur ve karşılaştırılabilir
              alternatifler sunar.
            </p>
            <p>
              Ürün,{" "}
              <span className="font-medium text-foreground">Efe Surucu</span>{" "}
              tarafından geliştirilmektedir. Hedefimiz; moda keşfini daha hızlı,
              daha net ve daha güvenilir hale getirmektir.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section id="iletisim" className="scroll-mt-24 py-14 md:py-16">
          <h2 className="text-2xl font-semibold text-foreground md:text-3xl">İletişim</h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
            Sorularınız, iş birliği veya geri bildirim için formu doldurun.
            Mesajınız bize doğrudan iletilir.
          </p>
          <div className="mt-8 max-w-md">
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between md:px-10 lg:px-12">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/app-icon.png"
              alt="DECIDE"
              className="size-9 shrink-0 rounded-xl object-contain"
            />
            <p className="text-sm font-semibold text-foreground">
              Doğru karar, doğru kıyafet
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <a href="#urun" className="hover:text-secondary transition-colors">
              Ürün
            </a>
            <a href="#hakkinda" className="hover:text-secondary transition-colors">
              Hakkında
            </a>
            <a href="#iletisim" className="hover:text-secondary transition-colors">
              İletişim
            </a>
            <Link
              href="/privacy"
              className="hover:text-secondary transition-colors"
            >
              Gizlilik Politikası
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
