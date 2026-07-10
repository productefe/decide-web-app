# Faz 1 — Vercel Production Deploy

Production URL: **https://decide-web-app-nine.vercel.app**

## 1. GitHub

Fork: `productefe/decide-web-app` — push to `main` triggers Vercel deploy.

## 2. Vercel

1. [vercel.com](https://vercel.com) → Project linked to GitHub fork
2. Framework: **Next.js**
3. Root Directory: repo root (not a monorepo subfolder)

## 3. Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Variable | Not |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `OPENAI_API_KEY` | Server-only |
| `SERPAPI_KEY` | Server-only |
| `AMAZON_AFFILIATE_TAG` | `decide07-21` |
| `CRON_SECRET` | Haftalık fiyat cron koruması — `openssl rand -hex 32` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (cron DB okuma) |
| `APNS_KEY` | Apple `.p8` dosyasının tam PEM içeriği |
| `APNS_KEY_ID` | Apple Keys listesindeki Key ID |
| `APNS_TEAM_ID` | Apple Membership Team ID |
| `APNS_BUNDLE_ID` | `com.productefe.decide` |
| `APNS_USE_SANDBOX` | Opsiyonel: `true` sadece Xcode simulator/dev test |

## 4. Supabase Auth

Authentication → URL Configuration:

- **Site URL:** `https://decide-web-app-nine.vercel.app`
- **Redirect URLs:** `https://decide-web-app-nine.vercel.app/**`

**Misafir modu:** Authentication → Providers → **Anonymous sign-ins** → Enable (Dashboard'da bir kez aç).

## 5. Supabase migrations

SQL Editor'da bir kez calistir (henuz yapilmadiysa):

- [`supabase/migrations/20250622183000_add_gender_to_user_preferences.sql`](../supabase/migrations/20250622183000_add_gender_to_user_preferences.sql) — `gender` kolonu
- [`supabase/migrations/20250707200000_search_history_and_rls.sql`](../supabase/migrations/20250707200000_search_history_and_rls.sql) — `search_history` tablosu + RLS
- [`supabase/migrations/20250708120000_add_sizes_to_user_preferences.sql`](../supabase/migrations/20250708120000_add_sizes_to_user_preferences.sql) — `sizes` kolonu (beden tercihleri)
- [`supabase/migrations/20250708180000_saved_products.sql`](../supabase/migrations/20250708180000_saved_products.sql) — `saved_products` tablosu (beğendiklerin)
- [`supabase/migrations/20250709140000_security_hardening.sql`](../supabase/migrations/20250709140000_security_hardening.sql) — profiles RLS, Storage RLS, rate limit, misafir analiz cap
- [`supabase/migrations/20250710160000_price_alerts.sql`](../supabase/migrations/20250710160000_price_alerts.sql) — fiyat düşüşü takibi + push_tokens

Güvenlik regression checklist: [docs/SECURITY_TEST.md](./SECURITY_TEST.md)

## 6. Canli test checklist

- [x] Landing aciliyor
- [x] Kayit / giris calisiyor
- [x] Onboarding kaydediliyor
- [x] Foto yukleme + analiz 3 sonuc donuyor
- [x] Alt tab bar (Yukle / Gecmis / Profil)
- [x] Gizlilik politikasi: `/privacy`
- [ ] Magaza linkleri aciliyor

---

# Faz 3 — iOS teknik ayarlar

| Ayar | Deger |
|------|--------|
| Bundle ID | `com.productefe.decide` |
| Capacitor appId | [capacitor.config.ts](../capacitor.config.ts) |
| Hosted URL | `https://decide-web-app-nine.vercel.app` |

## Capacitor sync (Mac)

```bash
export CAPACITOR_SERVER_URL=https://decide-web-app-nine.vercel.app
npm run cap:sync
npm run cap:ios
```

Xcode → **App** target → Signing → Team → iPhone simulator → Run.

Simulator'a test fotosu: Mac'ten `.jpg` dosyasini simulator penceresine surukle.

Detayli App Store adimlari: [docs/APP_STORE.md](./APP_STORE.md)

---

# Fiyat düşüşü push bildirimleri — senin checklist'in

Kod hazır. Sırayla:

## Faz 2 — Apple Developer (~15 dk)

1. [developer.apple.com/account](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**
2. **Identifiers** → `com.productefe.decide` → **Push Notifications** ✅ → Save
3. **Keys** → **+** → isim: `DECIDE Push Key` → **Apple Push Notifications service (APNs)** ✅
4. **Register** → **Download** `.p8` (bir kez indirilir — güvenli sakla)
5. Not al: **Key ID** (Keys listesi), **Team ID** (Membership)

## Faz 3 — Vercel env + Supabase migration (~15 dk)

1. Vercel → Settings → Environment Variables → yukarıdaki `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `APNS_*` ekle
2. Supabase → SQL Editor → [`20250710160000_price_alerts.sql`](../supabase/migrations/20250710160000_price_alerts.sql) çalıştır
3. `git push origin main` → Vercel deploy bitsin

## Faz 4 — Yeni iOS build (~20–30 dk)

```bash
export CAPACITOR_SERVER_URL=https://decide-web-app-nine.vercel.app
npm run cap:sync
npm run cap:ios
```

Xcode → **App** target → **Signing & Capabilities** → **+ Capability** → **Push Notifications** → **Product → Archive** → TestFlight

## Faz 5 — Telefon testi (~5 dk)

1. TestFlight build kur
2. Uygulamayı aç → **Bildirimlere izin ver**
3. Giriş yap → analiz sonucundan ürün **beğen** (eski beğeniler takip edilmez)
4. Cron: her **Pazartesi 09:00 Europe/Istanbul** (Vercel cron: `0 6 * * 1` UTC)

### Manuel cron testi (deploy sonrası)

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://decide-web-app-nine.vercel.app/api/cron/price-alerts
```

Yanıt: `{ "ok": true, "checked": N, "notified": M, "apnsReady": true }`

## Davranış özeti

| Kural | Değer |
|-------|--------|
| Kontrol | Haftada 1 — Pazartesi 09:00 Istanbul |
| Bildirim eşiği | %5 **veya** en az 50 TL düşüş |
| Tekrar spam | `last_notified_price` ile engellenir |
| Takip | Yeni beğeniler (product_id / SerpAPI ref ile) |
| Batch | Cron run başına en fazla 50 ürün |
