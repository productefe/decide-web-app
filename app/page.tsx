import Navbar from "./components/Navbar"
import { LandingActions } from "./components/landing-actions"
import "./globals.css"

const STEPS = [
  { num: "1", title: "Yükle", desc: "Beğendiğin parçanın fotoğrafını seç." },
  { num: "2", title: "Karşılaştır", desc: "Türk mağazalarında alternatifleri tararız." },
  { num: "3", title: "Seç", desc: "Sana en uygun 3 seçeneği görürsün." },
];

const RESULT_TYPES = [
  { label: "Önerilen", desc: "Fotoğrafına en yakın eşleşme." },
  { label: "Daha uygun", desc: "Benzer ürün, daha iyi fiyat." },
  { label: "Sana özel", desc: "Tarzına göre seçilmiş alternatif." },
];

const FEATURES = [
  { title: "Türk mağazaları", desc: "Trendyol, Hepsiburada, Zara ve daha fazlası — tek aramada." },
  { title: "Yapay zeka analizi", desc: "Fotoğraftan renk, kategori ve detayları otomatik okur." },
  { title: "Kişisel öneri", desc: "Tarzına göre üçüncü alternatif senin için özelleşir." },
];

export default async function Home() {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <div className="flex-1 w-full max-w-6xl mx-auto px-5 md:px-10 lg:px-14 py-4 flex flex-col">
        <Navbar />

        <main className="flex-1 grid lg:grid-cols-12 gap-10 lg:gap-14 items-center py-8 lg:py-14">
          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-muted-foreground">
              Fotoğrafla alışveriş kararı
            </p>

            <h1 className="mt-4 text-4xl md:text-5xl lg:text-6xl leading-[1.1] font-semibold text-foreground">
              Beğendiğin parçayı
              <br />
              saniyeler içinde bul.
            </h1>

            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl">
              Tek fotoğraf yeter — gerisini biz hallederiz. Türk mağazalarından sana en uygun üç alternatifi getiriyoruz.
            </p>

            <div className="mt-10 grid sm:grid-cols-3 gap-3">
              {STEPS.map((step) => (
                <div
                  key={step.num}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {step.num}
                  </span>
                  <p className="mt-3 font-semibold text-foreground">{step.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground leading-snug">{step.desc}</p>
                </div>
              ))}
            </div>

            <LandingActions />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3 lg:border-l lg:border-border lg:pl-12">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Ne elde edersin?
            </p>
            {RESULT_TYPES.map((item) => (
              <div
                key={item.label}
                className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" />
                <div>
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <section className="border-t border-border bg-muted/50 w-full">
        <div className="max-w-6xl mx-auto px-5 md:px-10 lg:px-14 py-10 lg:py-14 grid md:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border w-full">
        <div className="max-w-6xl mx-auto px-5 md:px-10 lg:px-14 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-secondary">DECIDE</span>
          <span>Alışveriş kararını kolaylaştır.</span>
        </div>
      </footer>
    </div>
  );
}
