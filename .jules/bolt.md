## 2026-10-07 - Cache Intl.DateTimeFormat instances in date loops
**Learning:** Instantiating `new Intl.DateTimeFormat(...)` inside date processing loops (e.g. converting session dates/hours across thousands of sessions) creates major CPU overhead. Caching `Intl.DateTimeFormat` instances in a Map by timezone speeds up processing by ~24x (from ~1.5s down to ~60ms for 10,000 iterations).
**Action:** Always reuse or cache `Intl.DateTimeFormat` instances when formatting or parsing dates in loops or repeated function calls.
