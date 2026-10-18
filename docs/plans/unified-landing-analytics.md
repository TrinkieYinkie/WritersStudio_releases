# Unified landing analytics v2

Status: both implementation stages completed and verified; production collection remains disabled.

## Consent and release follow-up (2026-10-18)

The user authorizes a common consent popup, release configuration activation and local main merges
after the unfinished telemetry work is complete. The telemetry implementation now passes its full
suite. Push, deployment and repository-hosted workflows remain outside this authorization.

Stage 3, feature/landing-consent: replace default inclusion with explicit consent. Present Accept,
Configure and Reject on the first layer; configure independent page-view, download-click and other
link-click categories, with optional categories initially unchecked. Save a versioned choice for
180 days, preserve legacy opt-outs, honor DNT/GPC, fail closed on storage failure, and allow easy
withdrawal from the footer. Closing or Escape never grants consent. No pre-consent IDs, context
reads, requests or replay. Filter categories before producing events and cancel pending delivery
when preferences change, including other tabs. A click without a view stays a click; do not infer
visits. Explain common metadata, 90-day raw retention and infrastructure connection metadata.
Do not promise absolute anonymity or blanket legal compliance. The operator is an individual
publishing a free personal project; jurisdiction remains unspecified.

Verify malformed/expired choices, partial consent, legacy records, blocked storage, cross-tab
withdrawal, retries, visibility, BFCache and exact v2 compatibility. Keep shared files identical.
Use the existing bounded sequential runners, then browser-check both themes, EN/RU/ES, keyboard,
Escape, focus return and short/mobile overflow. Preserve unrelated sample edits.

Stage 4, feature/landing-release-ready: enable the reviewed client configuration with the consent
gate, run the full local site checks/builds, review public output and merge verified stages to the
integration branch and then main. Do not claim the receiver is deployed or production collection
verified: DNS/TLS, logging, database roles and backup/restore checks remain operational gates.

This follow-up supersedes earlier no-main-merge and disabled-client statements below. Earlier
completion evidence describes the prior opt-out implementation, not the new consent behavior.

## Expected behavior

Both landing sites use the same versioned event envelope, dependency-free sender,
link semantics, attribution catalogs, bounded delivery and opt-out controller.
Only reviewed site configuration and existing link placements differ. A random
page-view identity exists only in memory for one document; event identities allow
bounded retry deduplication. There is no persistent visitor identity, fingerprint,
application identity or download attribution join. The only analytics storage is
an opt-out flag. Do not change the Telemetry repository, publish, push or merge main.

## Stages

1. `feature/unified-landing-contract`: publish a common v2 specification, fixtures,
   client and protocol tests in both repositories. Preserve v1 as superseded history.
   Keep existing page integration compatible while introducing the shared modules.
2. `feature/unified-landing-settings`: connect the common UI and link mapping,
   add the Yinkie opt-out panel, synchronize English/Russian/Spanish disclosures,
   update WritersStudio privacy text, test real page integration and public output.

Use each existing non-main branch as its integration branch. Complete, verify and
commit each stage on its branch before merging back and starting the next stage.
Use the primary checkouts only. Preserve pre-existing sample changes.

## Edge cases and compatibility

- Every activation creates one event; distinguish opening download options,
  opening Releases and requesting an installer. None proves a download/install.
- Disabled/preview/unsupported environments and DNT/GPC produce no analytics ID
  or request. Preference read failure excludes collection. Failed opt-out writes
  still stop the current document. Opt-out cancels requests, retries and queues.
- Reload starts a new page identity; language/theme/hash changes and BFCache do
  not add views. Hidden/prerendered pages wait until visible. No replay of actions
  before inclusion. Cross-tab preference changes update the control immediately.
- Preserve native keyboard, middle/modifier clicks and navigation. Reject untrusted,
  prevented or unexpected links and never transmit raw URLs/referrers/UTM/free text.
- Retries keep IDs and payloads; handle offline, timeouts, 408/429/5xx, terminal 4xx,
  Retry-After, departing pages, concurrency and request/event caps deterministically.
- Keep product datasets separate. Reports describe observed page views, not unique
  people, application activity, retention or verified downloads. No backend exists yet.

## Verification strategy and definition of done

Use existing lifecycle owners only: direct shell:false child launches, single-run
locks, explicit stage deadlines, heartbeats, interruption and exact tree cleanup.
Run checks sequentially; audit locks/processes immediately after every commit.
Protocol, sender and UI tests use fake clocks/transports; local checks never send
production analytics. Verify byte-identical shared artifacts across repositories.
Run each full site check/build sequentially, inspect both themes, EN/RU/ES, keyboard
opt-out, persisted preference, narrow/short viewports, and public-asset loading.
Leave both integration branches with atomic English commits and no task leftovers.
Collection stays disabled; no Telemetry changes, deployment or hosted workflows.

## Completion evidence

- Both sites now load the same v2 client and UI. Yinkie has the statistics panel;
  WritersStudio preserves its existing opt-out key. Old clients are removed.
- Shared contract, example, digest map, EN/RU/ES disclosure catalog and tests match
  byte for byte. The page test checks every marked static link against the catalog.
- Yinkie lifecycle build passed all 15 stages, including 13 behavioral suites,
  11 link owners, HTTP/public-boundary checks and the 16-file build output.
- WritersStudio full validation passed all 11 stages, including lifecycle regression
  tests, 174 localized messages, release data, 12 legal pages, 13 behavioral suites
  and 17 static link owners. Dynamic older-release link ownership remains covered.
- Browser checks on both local previews confirmed opt-out persistence after reload,
  keyboard activation, EN/RU/ES copy, light/dark themes, 320x568 and 820x360 layouts,
  and no console errors. The new controls fit their containers. WritersStudio's
  pre-existing 320px body minimum remains outside this change.
- Preview owners were stopped and their processes/locks audited. No production
  analytics request, deployment, Telemetry change or hosted workflow was introduced.

Server ingestion, retention, reports, real endpoint/CORS verification and enabling
the deployment flags remain separate work under the v2 contract.
