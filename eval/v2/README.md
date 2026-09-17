# Search V2 eval fixtures

- `golden-cases.json` — 30+ synthetic golden intents + candidate pools (versioned).
- Real photos (optional): place anonymized fixtures under `../photos/` as `case-XX.jpg`.
  When photos are present, CI still uses golden JSON for deterministic gates;
  live vision scoring is opt-in via `EVAL_LIVE_VISION=1`.

Thresholds (CI):
- visible main-piece recall ≥ 95%
- apparel/jewelry recall ≥ 90%
- subtype ≥ 90%
- wrong-color top-3 ≤ 5%
- luxury leakage = 0
- empty piece ≤ 2%
- uniqueness@12 ≥ 9
