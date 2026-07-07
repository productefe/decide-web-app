# Faz 5-6 — App Store Checklist

Kod tarafi (Capacitor) hazir. Asagidaki adimlar senin panel/Apple tarafinda.

## Kimlik

| Alan | Deger |
|------|--------|
| App adi | DECIDE |
| Bundle ID | `com.productefe.decide` |
| Production URL | https://decide-web-app-nine.vercel.app |
| Privacy Policy URL (Faz 5) | https://decide-web-app-nine.vercel.app/privacy |

## Faz 5 — Apple hesap ve build

| # | Adim | Zorluk |
|---|------|--------|
| 5.1 | [Apple Developer Program](https://developer.apple.com/programs/) ($99/yil) | Kolay |
| 5.2 | App Store Connect → Bundle ID: `com.productefe.decide` | Kolay |
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
| 6.1 | Gizlilik politikasi URL (Faz 5 — `/privacy`) | Orta |
| 6.2 | App Store Connect: aciklama, anahtar kelimeler, kategori (Shopping) | Kolay |
| 6.3 | Ekran goruntuleri: landing, workspace, sonuc ekrani (**final UI sonrasi**) | Orta |
| 6.4 | App Privacy formu (email, photos, usage data) | Orta |
| 6.5 | Submit for Review | Orta |

## Yararli komutlar

```bash
export CAPACITOR_SERVER_URL=https://decide-web-app-nine.vercel.app
npm run cap:sync
npm run cap:ios
```

Review suresi genelde 1-7 gun.
