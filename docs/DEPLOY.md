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

## 4. Supabase Auth

Authentication → URL Configuration:

- **Site URL:** `https://decide-web-app-nine.vercel.app`
- **Redirect URLs:** `https://decide-web-app-nine.vercel.app/**`

## 5. Canli test checklist

- [x] Landing aciliyor
- [x] Kayit / giris calisiyor
- [x] Onboarding kaydediliyor
- [x] Foto yukleme + analiz 3 sonuc donuyor
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
