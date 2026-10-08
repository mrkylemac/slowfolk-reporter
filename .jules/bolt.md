## 2025-03-10 - Cache Intl.DateTimeFormat in Hot Loops
**Learning:** Constructing `new Intl.DateTimeFormat(...)` inside loops processing thousands of items is extremely expensive (~0.03ms per instantiation). When calculating venue benchmark metrics across 5,000 sessions, repeated formatter instantiation and multiple array passes took over 2.4 seconds per run.
**Action:** Always cache `Intl.DateTimeFormat` instances per timezone/options in a module-level `Map` when formatting dates inside loops, and combine session calculations into a single-pass loop.
