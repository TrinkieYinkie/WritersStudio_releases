# Unified landing analytics v2

Status: implementation authorized; production collection remains disabled.

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
