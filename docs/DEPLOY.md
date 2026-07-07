# Faz 1 — Vercel Production Deploy

Bu adimlari tamamladiktan sonra `CAPACITOR_SERVER_URL` degerini Capacitor config'e yazin.

## 1. GitHub

```bash
git add .
git commit -m "Prepare for production and iOS"
git push -u origin main
```

## 2. Vercel

1. [vercel.com](https://vercel.com) → New Project → GitHub reposunu sec
2. Framework: **Next.js** (otomatik algilanir)
3. Root Directory: `decide-web-app` (monorepo degilse bos birak)

## 3. Environment Variables (Vercel Dashboard → Settings → Environment Variables)

| Variable | Not |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `OPENAI_API_KEY` | Server-only |
| `SERPAPI_KEY` | Server-only |
| `AMAZON_AFFILIATE_TAG` | `decide07-21` |

## 4. Deploy sonrasi

1. Production URL'yi not al (ornegin `https://decide.vercel.app`)
2. `.env.local` veya shell'de: `export CAPACITOR_SERVER_URL=https://SENIN-URL.vercel.app`
3. Supabase → Authentication → URL Configuration:
   - **Site URL:** production URL
   - **Redirect URLs:** production URL + `/workspace`

## 5. Canli test checklist

- [ ] Landing aciliyor
- [ ] Kayit / giris calisiyor
- [ ] Onboarding kaydediliyor
- [ ] Foto yukleme + analiz 3 sonuc donuyor
- [ ] Magaza linkleri aciliyor

Deploy URL hazir olunca:

```bash
export CAPACITOR_SERVER_URL=https://SENIN-URL.vercel.app
npm run cap:sync
npm run cap:ios
```

Detayli App Store adimlari: [docs/APP_STORE.md](./APP_STORE.md)
