# Known issues and accepted risks

| Item | Where | Why it is accepted | Revisit |
| --- | --- | --- | --- |
| `npm audit` reports advisories for the PostCSS copy bundled inside Next 15 (GHSA-qx2v-qp2m-jg93 and related) | production dependency tree | The advisories need attacker-controlled CSS to be processed. The app only builds its own stylesheet. The fix ships only with Next 16 (a breaking upgrade). | When upgrading to Next 16 |
| `npm audit` reports advisories in the test runner (`vitest`, `tinypool`, `@vitest/mocker`) | dev dependencies only | Never shipped or run in production; runs only on developer machines and CI. | On the next Vitest major upgrade |
| Delete functions (account, GPS session, file) are not applied by the assistant's database connection | `supabase/manual/pending_delete_functions.sql` | The connection asks for a confirmation that cannot be answered there. Run the file once in the Supabase SQL editor. | After it has been run, delete this row |
| Attachments are stored in Postgres (5 MB limit) | `public.attachments` | Keeps files under the same row-level security as their record and is testable without extra services. | Move to Supabase Storage with virus scanning before large-scale use (ADR 0004) |
| Rate limiter counters are in memory per server instance | `src/lib/security/rate-limit.ts` | Fine for one instance; several instances each count separately. | Shared store or platform firewall before scaling out |
| Live GPS sync (StatSports, Catapult, Polar) is not built | GPS | Needs the club's vendor API credentials; file import works today. | When credentials exist |
| Legal texts are a working draft | `/privacy`, `/terms` | Shown with a draft notice until `LEGAL_REVIEWED=1`. | Before public launch |
| The interactive demo artifact runs on browser sample data and has no GPS, file or consent pages | claude.ai artifact | It is a showcase, not the product. | When the product is deployed |
