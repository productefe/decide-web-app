# Faz 5-6 — App Store Checklist

Kod tarafi (Capacitor + `/privacy`) hazir. Asagidaki adimlar senin panel/Apple tarafinda.

## Kimlik

| Alan | Deger |
|------|--------|
| App adi | DECIDE |
| Bundle ID | `com.productefe.decide` |
| Production URL | https://decide-web-app-nine.vercel.app |
| Privacy Policy URL | https://decide-web-app-nine.vercel.app/privacy |

## Faz 5 — Apple hesap ve build

| # | Adim | Zorluk | Not |
|---|------|--------|-----|
| 5.1 | [Apple Developer Program](https://developer.apple.com/programs/) ($99/yil) | Kolay | |
| 5.2 | App Store Connect → Bundle ID: `com.productefe.decide` | Kolay | |
| 5.3 | App ikonu 1024x1024 → Xcode `ios/App/App/Assets.xcassets/AppIcon.appiconset/` | Orta | **Sen eklersin** — kod tarafinda placeholder birakildi |
| 5.4 | `npm run cap:ios` → Xcode → Signing (Team) → Product → Archive | Orta | |
| 5.5 | App Store Connect → TestFlight → gercek cihazda test | Orta | |

### TestFlight test listesi

- [ ] Kayit / giris
- [ ] Onboarding (beden, cinsiyet, tek tarz)
- [ ] Alt tab bar: Yükle / Geçmiş / Profil
- [ ] Kamera veya galeriden foto
- [ ] Analiz sonucu (3 kart + aciklama skeleton)
- [ ] Geçmiş aramalar listesi
- [ ] Profil kaydet + cikis yap (profil altinda)
- [ ] Dis magaza linki aciliyor (Safari)
- [ ] Gecersiz/bos foto → hata modalı (teknik mesaj yok)
- [ ] `/privacy` sayfasi aciliyor

## Faz 6 — Store basvurusu

| # | Adim | Zorluk |
|---|------|--------|
| 6.1 | Gizlilik politikasi URL: `/privacy` | Tamamlandi (kod) |
| 6.2 | App Store Connect: aciklama, anahtar kelimeler, kategori (Shopping) | Kolay |
| 6.3 | Ekran goruntuleri: landing, yukle, sonuc, gecmis, profil (**final UI sonrasi**) | Orta |
| 6.4 | App Privacy formu (asagidaki cheat sheet) | Orta |
| 6.5 | Submit for Review | Orta |

## App Privacy formu — cheat sheet (Faz 6.4)

App Store Connect → App Privacy → Start. Asagidaki cevaplar DECIDE icin rehber:

| Veri turu | Toplaniyor mu? | Amac | Kullaniciyla bagli mi? | Tracking? |
|-----------|----------------|------|------------------------|-----------|
| **Email Address** (Contact Info) | Evet | App Functionality (hesap) | Evet | Hayir |
| **Photos** (User Content) | Evet | App Functionality (urun analizi) | Evet | Hayir |
| **Product Interaction** (Usage Data) | Evet | App Functionality (arama gecmisi) | Evet | Hayir |
| **Other User Content** (profil: beden/cinsiyet/tarz) | Evet | App Functionality (kisisellestirme) | Evet | Hayir |

**Third-party SDK notlari (formda sorulursa):**

- **Supabase:** Auth, DB, Storage — app functionality, not used for tracking
- **OpenAI:** Vision + text generation — app functionality, photo sent for analysis only
- **SerpAPI:** Shopping search — app functionality, query derived from photo analysis

**Data linked to user:** Yes (account-based)
**Data used to track you:** No

## Yararli komutlar

```bash
export CAPACITOR_SERVER_URL=https://decide-web-app-nine.vercel.app
npm run generate:splash   # krem splash + DECIDE logo (ikon/storyboard guncellemeden once)
npm run cap:sync
npm run cap:ios
```

### Splash / acilis ekrani degistirdiysen (native rebuild)

1. `npm run generate:splash` — iOS splash PNG + logo asset uretir
2. `npm run cap:sync` — Xcode projesine kopyalar
3. Xcode → **Product → Archive** → App Store Connect upload
4. TestFlight’ta yeni build’i yukle (web deploy yetmez)

Review suresi genelde 1-7 gun.

## Publish oncesi sira

1. Agent Faz 5 kod (privacy + docs) — tamamlandi
2. **Sen:** Son UI pass
3. **Sen:** App ikonu 1024x1024 ekle → yeni Archive
4. **Sen:** Screenshot'lar (final UI sonrasi)
5. TestFlight → Submit for Review
