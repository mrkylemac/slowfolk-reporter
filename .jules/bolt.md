## 2025-05-18 - ISO String Parsing vs date-fns in Hot Loops
**Learning:** Parsing ISO 8601 dates (`yyyy-MM-ddThh:mm...`) using string slicing (`substring`) and `parseInt` in session iteration loops is ~25x faster than calling `date-fns` `parseISO` and `format`.
**Action:** Use direct string slicing for date keying and time extraction whenever processing large arrays of standard ISO 8601 session objects.
