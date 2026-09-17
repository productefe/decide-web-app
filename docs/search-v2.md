# Search Backend V2

Parallel search stack behind feature flags. V1 remains the rollback path.

## Flags (Vercel env)

| Variable | Default | Meaning |
|----------|---------|---------|
| `SEARCH_V2_ENABLED` | `true` | Master switch. `false` → always V1. |
| `SEARCH_V2_ROLLOUT_PCT` | `100` | Sticky 0–100 bucket by user id. |
| `SEARCH_V2_SHADOW` | `false` | Run V2 for metrics, return V1. |
| `SEARCH_V2_VISION_MODEL` | `gpt-4o` | Vision model |
| `SEARCH_V2_VISION_TIMEOUT_MS` | `4500` | Vision hard timeout |
| `SEARCH_V2_SERP_TIMEOUT_MS` | `3500` | SerpAPI timeout |
| `SEARCH_V2_RERANK_MODEL` | `gpt-4o-mini` | Multimodal rerank |

Rollback: set `SEARCH_V2_ENABLED=false` on Vercel (no git reset needed).

## Modules

- `app/lib/search-v2/` — schema, vision, normalize, query-plan, Lens+Shopping providers, verify, rank, paginate, sessions, combine, metrics
- `app/api/decide/run-v2.ts` — first analysis
- `app/api/decide/more-v2.ts` — per-piece session show-more
- `app/api/combine/run-v2.ts` — deterministic CombineIntent
- `app/api/product-link` — lazy immersive link resolve on click

## Eval

```bash
npm run eval:v2
```

Golden cases: `eval/v2/golden-cases.json` (32 cases). CI workflow: `.github/workflows/search-v2-eval.yml`.

## DB (optional)

Migration `supabase/migrations/20260917120000_search_v2_vision_cache.sql` for persistent vision cache. Without it, in-memory cache still works per instance.
