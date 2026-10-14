# Landing aggregate statistics

Status: planned, 2026-10-14. Integration branch: feature/public-beta-release-2-3-0.

## Expected behavior and boundaries

The owner requests total page views and clicks, without a persistent visitor ID,
with an opt-out instead of an opt-in prompt. Count events, not unique people,
visits/sessions, installations, completed downloads or application retention.
No event, session, page-view or installation identifiers are needed.

Prepare the landing client and an exact backend handoff. Do not edit Telemetry,
deploy, push, merge main, or create hosted automation. Production sending stays
disabled until the separate backend endpoint, aggregation, exact-origin CORS,
privacy configuration and applicable legal conditions are verified.

## Implementation stages

1. feature/landing-analytics-contract: closed aggregate-only event contract,
   bounded sender, opt-out and transport/classification tests.
2. feature/landing-analytics-ui: localized notice/opt-out control, tracked links,
   privacy disclosure and integration checks.
3. Audit the combined result on the integration branch, run the full sequential
   site plan and browser checks, then send the informational backend handoff.

Each stage starts from the integration branch, is checked and committed, and is
merged back before the next stage. Use only the primary checkout.

## Edge cases and verification

- No IDs, analytics cookies, device/browser details, locale, raw URLs, referrers,
  UTM/campaigns, timestamps, free text or desktop data in event bodies.
- Backend must increment daily aggregate counters immediately, without retaining
  raw requests or individual event records; aggregate retention proposed at 90 days.
  Network metadata inevitably reaches the edge; do not persist or join it.
- The only new local storage is a plain off preference, written only when the
  visitor opts out. No expiry that silently re-enables collection. No events on
  previews, disabled deployments, GPC/DNT, or unreadable preference storage.
- Withdrawal aborts in-flight requests; previously incremented anonymous counters
  cannot be attributed to a visitor and are not undone. Cross-tab opt-out applies.
- One view per visible document lifetime; reload is another view, language/theme
  changes and BFCache restoration do not inflate it. Do not count hidden prerenders.
- Empty/error release data records a releases-page transition, not an installer
  request. Test current/older assets, malicious links, middle/keyboard activation.
- Network/storage failures must not block navigation or rendering. Use bounded
  requests, concurrency and per-document event limits. No queues/retries/beacons.
- All three locales, theme tokens, keyboard semantics, short/narrow viewports,
  reduced motion and forced colors; existing equivalent controls are audited.
- Existing dated legal pages are unpublished drafts. Amend only the website
  disclosure; desktop consent and event promises remain unchanged.

## Definition of done

Meaningful tests and the checked-in full site plan pass under the existing bounded
runner. Browser checks verify layout/settings/navigation with production sending
still disabled. Integration branch is clean; no owned processes or locks remain.
Send chat 01a13b57-98fe-70e1-a3b7-04d2d58dfb30 the contract, examples, server changes
and activation requirements. Explicitly state this is information only, not a
request to begin implementation.
