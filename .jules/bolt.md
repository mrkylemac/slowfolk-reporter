## 2025-05-12 - Native Date Parsing vs date-fns parseISO
**Learning:** Native `new Date(isoString)` uses V8 native C++ parsing, which is ~7x faster than `date-fns parseISO()` in hot aggregation loops. However, date-only strings (`YYYY-MM-DD`) parse as UTC midnight in standard `new Date()`, which can shift local month/day in negative timezone offsets — `parseISO` or adding time components (`T00:00:00`) avoids offset shifts.
**Action:** Use native `new Date(iso)` for timestamp parsing on full ISO strings in hot aggregation loops, and retain `parseISO` for date-only strings (`YYYY-MM-DD`).
