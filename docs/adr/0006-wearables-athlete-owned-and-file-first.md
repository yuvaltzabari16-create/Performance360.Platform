# ADR 0006: Wearable data is athlete-owned; Fitbit starts as file import

Status: accepted

Recovery, heart-rate variability and sleep are health data, so the **athlete** connects and owns them: only the
athlete (never staff) can connect, import, share or erase, and staff and the director read the data only while
sharing is on (enforced in row-level security). Device tokens are encrypted by the app (AES-256-GCM,
`WEARABLE_TOKEN_KEY`) before reaching the database and live in a table with no policies, reachable only
through functions that act on the caller's own athlete record.

WHOOP has a public OAuth API, so it connects live. The legacy Fitbit Web API is switched off on 30 October 2026
and its replacement, the Google Health API, needs Google's approval (restricted scopes), so Fitbit starts as
import of the official export files; the live link is added when access is granted. Both providers share one
daily-metrics table and one import path, so a new provider is an adapter plus a mapping.
