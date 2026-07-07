# Faz 5-6 — App Store Checklist

Kod tarafi (Capacitor) hazir. Asagidaki adimlar senin panel/Apple tarafinda.

## Faz 5 — Apple hesap ve build

| # | Adim | Zorluk |
|---|------|--------|
| 5.1 | [Apple Developer Program](https://developer.apple.com/programs/) ($99/yil) | Kolay |
| 5.2 | Bundle ID: `com.decide.app` (Capacitor ile ayni) | Kolay |
| 5.3 | App ikonu 1024x1024 → Xcode `ios/App/App/Assets.xcassets` | Orta |
| 5.4 | `npm run cap:ios` → Xcode → Signing (Team) → Product → Archive | Orta |
| 5.5 | App Store Connect → TestFlight → gercek cihazda test | Orta |

### TestFlight test listesi

- [ ] Kayit / giris
- [ ] Onboarding tercihleri
- [ ] Kamera veya galeriden foto
- [ ] Analiz sonucu (3 kart)
- [ ] Dis magaza linki aciliyor

## Faz 6 — Store basvurusu

| # | Adim | Zorluk |
|---|------|--------|
| 6.1 | Gizlilik politikasi URL (foto, hesap, OpenAI/SerpAPI kullanimi) | Orta |
| 6.2 | App Store Connect: aciklama, anahtar kelimeler, kategori (Shopping) | Kolay |
| 6.3 | Ekran goruntuleri: landing, workspace, sonuc ekrani | Orta |
| 6.4 | App Privacy formu (email, photos, usage data) | Orta |
| 6.5 | Submit for Review | Orta |

## Supabase (Faz 4.4)

Authentication → URL Configuration:

- Site URL: `https://SENIN-PRODUCTION-URL`
- Redirect URLs: ayni domain + `/workspace`

OAuth eklersen ileride: `decide://auth/callback` deep link.

## Yararli komutlar

```bash
export CAPACITOR_SERVER_URL=https://SENIN-URL.vercel.app
npm run cap:sync
npm run cap:ios
```

Review suresi genelde 1-7 gun.
