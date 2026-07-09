# DECIDE — Güvenlik Test Checklist

Migration uygulandıktan ve Vercel deploy sonrası aşağıdaki testleri çalıştır.

## Ön koşul

1. Supabase SQL Editor’da `supabase/migrations/20250709140000_security_hardening.sql` dosyasını çalıştır.
2. Supabase Dashboard → Security Advisor’ı kontrol et.
3. Production veya staging’de deploy edilmiş sürümü test et.

## API güvenlik testleri

| # | Test | Nasıl | Beklenen |
|---|------|-------|----------|
| 1 | Yetkisiz analiz | `POST /api/decide` cookiesiz | `401 Yetkisiz` |
| 2 | Yetkisiz explain | `POST /api/decide/explain` cookiesiz | `401 Yetkisiz` |
| 3 | Storage path IDOR | Oturum açıkken body’de `storage_path: "başka-user-uuid/..."` | `400 Geçersiz fotoğraf` |
| 4 | SSRF | `photo_url: "http://169.254.169.254/"` + geçerli kendi `storage_path` | Analiz kendi fotoğrafıyla çalışır; sunucu rastgele URL fetch etmez |
| 5 | Misafir 2. analiz | Misafir oturumda iki kez analiz başlat | İkincide `429 Misafir modunda tek analiz hakkın var` |
| 6 | Rate limit decide | Kayıtlı kullanıcıyla 1 saat içinde 11+ analiz | `429 Çok fazla istek` |
| 7 | Rate limit explain | 1 saat içinde 21+ explain isteği | `429 Çok fazla istek` |
| 8 | Explain parça limiti | Body’de 5+ parça | `400 En fazla 4 parça` |

## Supabase RLS testleri

| # | Test | Nasıl | Beklenen |
|---|------|-------|----------|
| 9 | Anonymous saved_products | Misafir JWT ile PostgREST `INSERT saved_products` | RLS reddi |
| 10 | Anonymous search_history | Misafir JWT ile PostgREST `INSERT search_history` | RLS reddi |
| 11 | Storage IDOR upload | User A JWT ile User B klasörüne upload | Storage policy reddi |
| 12 | profiles RLS | Başka kullanıcının profil satırını okuma | Boş / reddedilir |

## Normal kullanıcı akışı (regression — TestFlight / web)

| # | Akış | Beklenen |
|---|------|----------|
| 13 | Misafir: onboarding → 1 analiz → sonuç + açıklama | Çalışır |
| 14 | Misafir: 2. analiz denemesi | Hata modalı, kayıt yönlendirmesi |
| 15 | Misafir → kayıt → geçmiş merge | Son analiz geçmişte görünür |
| 16 | Kayıtlı: foto yükle → 3 sonuç → favori → geçmiş | Değişmeden çalışır |
| 17 | Geçmiş / favoriler dış linkler | Yalnızca `https://` linkler tıklanabilir |
| 18 | 10 MB üzeri foto | “Fotoğraf en fazla 10 MB olabilir.” |
| 19 | Çıkış yap | Misafir localStorage temizlenir |
| 20 | Privacy sayfası | Affiliate + misafir localStorage maddeleri görünür |

## HTTP header kontrolü

Tarayıcı DevTools → Network → herhangi bir sayfa yanıtı:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(self), geolocation=()`

## Notlar

- `product-photos` bucket public kalır; bilinen URL ile okuma mümkün (planlanan trade-off).
- Misafir limiti sunucuda `guest_analysis_usage` + client `localStorage` ile çift katmanlıdır.
- Rate limit penceresi: 60 dakika (`increment_api_usage` RPC).
