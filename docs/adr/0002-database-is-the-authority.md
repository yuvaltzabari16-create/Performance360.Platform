# ADR 0002: The database enforces access

Status: accepted

Health and training data are sensitive. Hiding a menu item is not security. Every table has row-level
security; business rules (who may clear an injury, import GPS, attach a file, message someone) live in
SECURITY DEFINER functions with a pinned `search_path`, which also write audit entries. The UI mirrors the
rules in `src/lib/permissions.ts` so people do not see links they cannot use, and SQL tests prove the denials.
Consequences: a bug in a page cannot leak data; every access change needs a migration and a SQL test.
