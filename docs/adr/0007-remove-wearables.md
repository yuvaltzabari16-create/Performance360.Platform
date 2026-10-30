# ADR 0007: Remove the wearables feature

Status: accepted

## Context
The app connected WHOOP (OAuth) and imported WHOOP and Fitbit export files. Live WHOOP was never switched on (it needs
the vendor's approval), Fitbit had no live connection, and the feature added a token vault, a scheduled sync, sharing
rules and a mock provider to maintain and to explain in the privacy policy.

## Decision
Remove the feature from the product: the Wearables page and menu entry, the WHOOP routes and mock provider, the daily
sync job, the athlete page card, the wearables CSV export, the assistant's recovery questions, the quick action, and the
mentions in the privacy policy and terms. GPS imports are unchanged.

## Consequences
- The database objects (`wearable_connections`, `wearable_tokens`, `wearable_daily` and their functions) are left in
  place and unused, so no stored data is destroyed by this change. Drop them in a separate, deliberate migration once
  nobody needs the data (export first).
- Staff alerts keep the code path for low recovery, but nothing feeds it.
- Environment variables `WHOOP_*`, `WEARABLE_TOKEN_KEY` and `WEARABLES_MOCK` are no longer read.
