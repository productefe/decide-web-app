import type { Metadata } from "next";
import Link from "next/link";
import { DecideLogo } from "@/components/decide-logo";

export const metadata: Metadata = {
  title: "Gizlilik Politikası · DECIDE",
  description: "DECIDE uygulamasının gizlilik politikası ve kişisel verilerin işlenmesi.",
};

const LAST_UPDATED = "9 Temmuz 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full max-w-2xl mx-auto px-5 py-10 md:py-14">
      <Link
        href="/"
        className="text-sm font-medium text-secondary hover:underline underline-offset-2"
      >
        ← Ana sayfa
      </Link>

      <header className="mt-8 mb-8">
        <DecideLogo className="h-6 w-auto" />
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Gizlilik Politikası</h1>
        <p className="mt-2 text-sm text-muted-foreground">Son güncelleme: {LAST_UPDATED}</p>
      </header>

      <article className="space-y-8 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">1. Giriş</h2>
          <p className="text-muted-foreground">
            DECIDE (&quot;biz&quot;, &quot;uygulama&quot;), beğendiğin kıyafet fotoğraflarına göre Türk
            mağazalarında alternatif ürün önerileri sunar. Bu politika, hangi verileri topladığımızı,
            nasıl kullandığımızı ve haklarını açıklar.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">2. Topladığımız veriler</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Hesap bilgileri:</strong> Kayıt ve giriş için e-posta
              adresi ve şifre (Supabase Auth ile saklanır).
            </li>
            <li>
              <strong className="text-foreground">Profil tercihleri:</strong> Beden, cinsiyet ve tarz
              seçimlerin (uygulama deneyimini kişiselleştirmek için).
            </li>
            <li>
              <strong className="text-foreground">Fotoğraflar:</strong> Analiz için yüklediğin ürün
              fotoğrafları (Supabase Storage).
            </li>
            <li>
              <strong className="text-foreground">Arama geçmişi:</strong> Yüklediğin fotoğrafın adresi
              ve sana önerilen ürün sonuçları.
            </li>
            <li>
              <strong className="text-foreground">Teknik veriler:</strong> Oturum çerezleri ve kimlik
              doğrulama token&apos;ları (güvenli giriş için).
            </li>
            <li>
              <strong className="text-foreground">Misafir modu (cihazında):</strong> Kayıt olmadan
              deneme yaparken tarz tercihlerin ve son analiz sonuçların yalnızca cihazındaki yerel
              depolamada (localStorage) tutulabilir; çıkış yaptığında veya kayıt olduğunda bu veriler
              temizlenir veya hesabına taşınır.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">3. Verileri nasıl kullanıyoruz</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Hesabını oluşturmak, giriş yapmanı sağlamak ve oturumunu yönetmek</li>
            <li>Fotoğrafını analiz ederek sana uygun ürün alternatifleri bulmak</li>
            <li>Tarz ve cinsiyet tercihlerine göre arama sonuçlarını kişiselleştirmek</li>
            <li>Geçmiş aramalarını uygulama içinde göstermek</li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            Verilerini reklam profilleme veya üçüncü taraflara satma amacıyla kullanmıyoruz.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">4. Üçüncü taraf hizmetler</h2>
          <p className="text-muted-foreground mb-2">
            Hizmeti sunmak için aşağıdaki sağlayıcılarla çalışıyoruz:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Supabase:</strong> Kimlik doğrulama, veritabanı ve
              fotoğraf depolama
            </li>
            <li>
              <strong className="text-foreground">OpenAI:</strong> Fotoğraf analizi ve ürün açıklamaları
            </li>
            <li>
              <strong className="text-foreground">SerpAPI:</strong> Türk mağazalarında ürün araması
            </li>
            <li>
              <strong className="text-foreground">Vercel:</strong> Uygulama barındırma
            </li>
          </ul>
          <p className="mt-3 text-muted-foreground">
            Önerilen ürün linklerine tıkladığında ilgili mağazanın sitesine yönlendirilirsin; o sitelerin
            kendi gizlilik politikaları geçerlidir. Bazı mağaza linkleri (ör. Amazon) bağlı kuruluş
            (affiliate) programı kapsamında olabilir; bu, sana ek bir maliyet yansıtmadan uygulamanın
            sürdürülmesine katkı sağlayabilir.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">5. Saklama süresi</h2>
          <p className="text-muted-foreground">
            Hesabın aktif olduğu sürece verilerin saklanır. Hesabını sildiğinde veya silme talebinde
            bulunduğunda, makul süre içinde ilgili verileri kaldırırız.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">6. Hakların</h2>
          <p className="text-muted-foreground">
            Verilerine erişme, düzeltme ve silme talebinde bulunma hakkına sahipsin. Profil bilgilerini
            uygulama içinden güncelleyebilirsin. Hesap veya veri silme talebi için App Store Connect
            üzerinde paylaşılan geliştirici iletişim adresine yazabilirsin.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">7. Çocuklar</h2>
          <p className="text-muted-foreground">
            DECIDE, 13 yaşın altındaki çocuklara yönelik değildir. Bilerek 13 yaş altından kişisel veri
            toplamıyoruz.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">8. Değişiklikler</h2>
          <p className="text-muted-foreground">
            Bu politikayı güncelleyebiliriz. Önemli değişikliklerde sayfanın üstündeki tarih
            güncellenir. Uygulamayı kullanmaya devam etmen, güncel politikayı kabul ettiğin anlamına gelir.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-foreground mb-2">9. İletişim</h2>
          <p className="text-muted-foreground">
            Gizlilik veya veri talepleri için App Store Connect&apos;teki geliştirici iletişim
            bilgisini kullanabilirsin.
          </p>
        </section>
      </article>
    </div>
  );
}
