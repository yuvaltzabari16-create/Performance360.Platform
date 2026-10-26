/**
 * Safe handling of user text that ends up inside database filters.
 *
 * All values reach Postgres as bound parameters (the Supabase client never concatenates SQL), so
 * classic SQL injection is not possible. These helpers close the remaining gap: PostgREST filter
 * *syntax* (commas, parentheses, wildcards) and LIKE wildcards inside search boxes.
 */

/** Keeps letters (any language), digits, spaces and a few harmless symbols; everything else becomes a space. */
export function sanitizeSearchTerm(input: string | null | undefined, max = 80): string {
  return (input ?? "")
    .normalize("NFKC")
    .slice(0, max * 2)
    .replace(/[^\p{L}\p{N}\s@.\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Escapes LIKE/ILIKE wildcards so user text matches literally. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** `%term%` for a contains-search, from already sanitised text. */
export function containsPattern(term: string): string {
  return `%${escapeLike(term)}%`;
}
