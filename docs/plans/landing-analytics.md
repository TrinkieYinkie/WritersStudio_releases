# Landing analytics implementation

Status: planned, 2026-10-14. Integration branch: feature/public-beta-release-2-3-0.

## Expected behavior and boundaries

Add optional, consent-based analytics for the landing page to our own Telemetry
service. Keep website visits and conversion intent separate from desktop activity,
retention, installations and GitHub download counts. Do not change the Telemetry
repository, deploy, push, merge main, or create hosted automation.

Production sending stays disabled in a checked-in configuration until the new
server contract, exact-origin CORS and deployment behavior are verified. A disabled
client still exposes an honest settings state; it never asks for consent to a
service that is not available. Local tests exercise the enabled client with a fake
transport and never send real visitor data.

## Implementation stages

1. `feature/landing-analytics-contract`: versioned website-only event contract,
   bounded optional sender, closed attribution categories and privacy/transport tests.
2. `feature/landing-analytics-ui`: consent/settings surface, localized copy,
   download/outbound link instrumentation, privacy text and integration tests.
3. Audit the combined change on the integration branch, run the checked-in full
   sequential validation plan and browser checks; complete the backend handoff.

Each implementation branch starts at the current integration branch, is checked
and committed atomically, and is merged back before starting the next stage.

## Edge cases and risks

- No collection before opt-in, after withdrawal/expiry, under a privacy signal,
  on previews, or with the production switch disabled. Stored decisions are
  versioned and expire; no persistent visitor or installation identity.
- A random page-view identifier groups only one document lifetime. Reloads and
  tabs are separate views; these are not unique people or returning visitors.
- Never send raw URLs, referrers, query strings, UTM text, emails, browser strings,
  IP addresses or application identifiers. Closed source/campaign categories only.
- Empty GitHub results or failed API requests lead to a releases-page transition,
  never an installer-request event. Old/current installers and mobile platforms
  preserve existing download behavior. Keyboard and middle clicks count once.
- Network failure, 404, rate limits, storage failure, missing crypto or module load
  failure must not block navigation, localization, rendering or downloads.
- Bounded memory and concurrency, no durable event queue, retries or background
  loops. Consent withdrawal aborts in-flight requests and clears pending state;
  it cannot recall a request already accepted by the server.
- Consent UI uses existing semantic theme/scrollbar tokens, equal choice buttons,
  keyboard focus, English fallback, all three locales, short/narrow viewports,
  reduced motion and forced colors.
- Existing dated legal pages are unpublished drafts; only their website disclosure
  is amended. Desktop telemetry promises and version binding remain unchanged.

## Verification and definition of done

- All multi-stage checks use scripts/run-bounded-validation.mjs with checked-in
  plans, sequential stages, explicit timeouts and exact process cleanup.
- Tests cover consent, storage failure/expiry, cross-tab revocation, hostile input,
  attribution redaction, event validation, caps/timeouts, navigation independence,
  installer/fallback classification and the production-disabled invariant.
- Review all tracked links and equivalent surfaces. Browser-check light/dark,
  EN/RU/ES, keyboard, mobile and constrained height; verify no production requests
  originate from preview and no console errors or horizontal overflow.
- Full site validation passes, branch is clean, task processes/locks are gone.
- Send the specified Codex chat the final contract, examples, endpoint/CORS,
  semantics and activation requirements as information only. Explicitly say that
  the message does not request starting work.
