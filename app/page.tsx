import Navbar from "./components/Navbar"
import { LandingActions } from "./components/landing-actions"
import "./globals.css"

const STEPS = [
  { num: "01", title: "Yükle", desc: "Beğendiğin ürünün fotoğrafını seç." },
  { num: "02", title: "Karşılaştır", desc: "Türk mağazalarında alternatifleri tara." },
  { num: "03", title: "Seç", desc: "Sana en uygun üç seçeneği gör." },
];

const RESULT_TYPES = [
  { label: "Önerilen", desc: "Fotoğrafına en yakın eşleşme." },
  { label: "Daha Uygun", desc: "Benzer ürün, daha iyi fiyat." },
  { label: "Sana Özel", desc: "Tarzına göre seçilmiş alternatif." },
];

const FEATURES = [
  { title: "Türk mağazaları", desc: "Trendyol, Hepsiburada, Zara ve daha fazlası — hepsi tek aramada." },
  { title: "Yapay zeka analizi", desc: "Fotoğraftan renk, kategori ve detayları otomatik okur." },
  { title: "Kişisel öneri", desc: "Onboarding'de seçtiğin tarza göre üçüncü alternatif özelleşir." },
];

export default async function Home() {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <div className="flex-1 w-full max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-4 flex flex-col">
        <Navbar />

        <main className="flex-1 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center py-10 lg:py-16">
          <div className="lg:col-span-7">
            <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground">
              Fotoğrafla karar ver
            </p>
            <div className="w-16 h-px bg-secondary mt-4 mb-8" />

            <h1 className="text-5xl md:text-6xl lg:text-7xl leading-[1.08] font-bold tracking-wide text-secondary">
              Beğendiğin
              <br />
              ürünü bul.
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              Bir fotoğraf yeter. Türk mağazalarından sana en uygun üç alternatifi saniyeler içinde getiriyoruz.
            </p>

            <div className="mt-12 grid sm:grid-cols-3 gap-4">
              {STEPS.map((step) => (
                <div
                  key={step.num}
                  className="border border-border rounded-lg p-4 bg-card"
                >
                  <span className="text-xs tracking-[0.12em] text-muted-foreground">{step.num}</span>
                  <p className="mt-2 font-bold text-secondary">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-snug">{step.desc}</p>
                </div>
              ))}
            </div>

            <LandingActions />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4 lg:border-l lg:border-border lg:pl-14">
            <p className="text-xs tracking-[0.15em] uppercase text-muted-foreground mb-2">
              Ne elde edersin
            </p>
            {RESULT_TYPES.map((item, i) => (
              <div
                key={item.label}
                className={`border border-border rounded-lg p-5 bg-card ${i === 0 ? "lg:mt-0" : ""}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  <span className="text-sm tracking-[0.1em] uppercase font-bold text-secondary">
                    {item.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>

      <section className="border-t border-border bg-muted/40 w-full">
        <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-12 lg:py-16 grid md:grid-cols-3 gap-8 lg:gap-12">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-t border-border pt-6">
              <h3 className="text-lg font-bold text-secondary tracking-wide">{f.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border w-full">
        <div className="max-w-6xl mx-auto px-6 md:px-12 lg:px-16 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
          <span className="tracking-[0.2em] uppercase font-bold text-secondary">DECIDE</span>
          <span>Fotoğrafla alışveriş kararını kolaylaştır.</span>
        </div>
      </footer>
    </div>
  );
}
