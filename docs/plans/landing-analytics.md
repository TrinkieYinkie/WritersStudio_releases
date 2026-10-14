> Historical v1 implementation. Superseded by [the unified v2 plan](unified-landing-analytics.md) and [contract](../contracts/landing-analytics-v2.md). The old envelope and delivery behavior are not current.

# Landing aggregate statistics

Status: client complete and informational handoff sent, 2026-10-14. Integration branch: feature/public-beta-release-2-3-0.

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

Stage 1 verified: 9 isolated contract/transport/privacy tests pass through analytics-focused.json. No network calls or browser identifiers. Production switch remains disabled.

Stage 2 verified: the full 10-step site plan passes, including 15 statistics tests,
8 lifecycle tests, 173 synchronized strings in three locales and all 12 legal pages.
Browser checks cover EN/RU/ES, light/dark themes, keyboard opt-out and reload
persistence, 320x568 and 390x844 narrow screens, 820x360 short-screen access, and
desktop layouts. No console warnings/errors were observed. New controls fit within
the narrow layout; the pre-existing body's 320px minimum width remains unchanged.
Forced-color rules and reduced-motion compatibility were reviewed in source; the
new control introduces no animation or scroll container. Dark panel contrast was
corrected to use the semantic paper token. A campaign-query regression confirms
that local download-section clicks still count without transmitting query data.
The bounded preview and validation processes exited and their locks were removed.

## Completion audit

Both implementation stages are integrated into feature/public-beta-release-2-3-0.
The combined diff was checked against the pre-task commit 0e96f67; no unrelated
application code, desktop contracts or hosted workflows changed. Full validation
ran against the final implementation before its fast-forward integration. The
only subsequent changes are this completion record. No push, main merge or deploy.

The informational handoff was sent successfully to chat
01a13b57-98fe-70e1-a3b7-04d2d58dfb30 after integration, with the contract path,
code commit 9d38f0b, event examples, closed combinations and server/privacy gates.
It explicitly says not to start work or deploy on the basis of the message.

External activation work remains: agree on and implement the dedicated backend,
verify aggregate retention and edge/access logging, applicable legal conditions,
exact-origin CORS and a staging journey. Production remains enabled:false.
The completed client may be published with statistics disabled independently of
that backend work. This does not resolve the previously identified domain/TLS
and public release availability prerequisites for the overall site launch.
