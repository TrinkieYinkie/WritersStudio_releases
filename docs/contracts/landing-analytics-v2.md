# Shared landing analytics v2

Status: client implemented for both landing sites; production sending is disabled.
This specification supersedes both incompatible landing v1 proposals. It does not
change application telemetry or authorize deployment. Keep this document, the JSON
catalog/example and the shared client/UI/tests byte-identical in both repositories.

## Population and privacy

Measure displayed page loads and deliberate link activations. A fresh random
`pageViewId` exists only in memory for one document; each event has a random ID for
retry deduplication. Reload creates a new page identity. BFCache, language, theme
and hash navigation do not add a view. No persistent visitor/session/installation
identity, cookies, fingerprint or connection to editor/download identities exists.
These observations are not unique people, returning users or completed downloads.

The only analytics browser storage is `<product>.websiteStatistics = off`. Keep
the existing WritersStudio preference key. Opt-out has no expiry; re-enabling
removes the flag. Read failure, GPC or DNT suppresses sending. Failed writes still
exclude the current document. Cross-tab changes update the UI and stop pending
requests/retries. Opt-out discards the in-memory outbox and aborts requests but
cannot undo a request already accepted by the server. Re-inclusion does not replay
previous actions or create another view in an already-counted document.

Capture only reviewed coarse context. Never send full URLs/referrers, arbitrary
UTM values, query/hash, link text, user-agent, device/OS details, content, email,
installation IDs or deletion secrets. A selected installer platform is a button
choice, not a detected device attribute. The server must not log raw bodies,
identifiers, IP, UA, Cookie or Referer. Audit actual edge/hosting logs before use.

## Endpoint and exact envelope

`POST https://telemetry.<landing-host>/api/telemetry/landing/events`

The configured exact landing origin must match the browser origin; only `/` and
`/index.html` collect. Product/store resolution belongs to the server hostname.
The body never selects another product or its database. Preview/local origins and
altered endpoint paths are disabled. Both deployment flags remain `enabled: false`.

Root keys are exactly `schemaVersion: 1`, `contractVersion: 2`, `events` (1–8 items).
Each event contains exactly:

- `eventId`: UUID v4, unchanged on retry.
- `eventName`: one of the three entries below; `eventVersion: 2`.
- `pageViewId`: UUID v4 shared by that document and all events in a batch.
- `sequence`: integer 1–32, increasing in production order; receipt can be unordered.
- `siteVersion`: three dot-separated numeric components (1–3 digits each).
- `page: home`; `locale: en | ru | es`, observed at event time.
- `occurredAt`: ISO UTC timestamp with milliseconds; keep receipt time separately.
- `attribution`: the exact four-field object below, frozen at first collected view.
- `properties`: the exact object for that event. Unknown fields fail closed.

One activation produces one event. Do not emit both a download intent and a
second outbound event for the same link. The previous paired Yinkie events and
WritersStudio aggregate-only envelope must not be accepted as v2.

| Event | Exact properties | Meaning |
| --- | --- | --- |
| `landing_page_viewed` | `{}` | First displayed view after collection is permitted |
| `landing_download_clicked` | `action`, `placement`, `platform` | One of the download actions below |
| `landing_link_clicked` | `destination`, `placement` | One reviewed link activation, including internal legal links |

Download action combinations:

- `open-download-section`: platform `unspecified`; placement `header`, `hero`,
  `navigation`, `platforms`, `final` or `footer`.
- `open-releases`: platform `unspecified`; placement `platforms`, `final`, `footer`,
  `release-latest`, `release-older` or `release-notes`.
- `request-installer`: platform `windows`, `macos` or `linux`; placement
  `release-latest` or `release-older`. Only a reviewed official repository asset
  link qualifies. Fallback to the Releases index uses `open-releases` instead.

Link destination combinations:

- `github-releases`, `github-release-notes`: `release-notes`.
- `github-repository`, `github-feedback`, `support-email`: `footer`.
- `terms`: `download-legal`, `footer`.
- `privacy`: `download-legal`, `footer`, `statistics`.
- `web-app`: `header`, `hero`, `platforms`, `free`, `final`, `footer`.

The shared catalog permits these categories; each site's actual controls determine
the subset emitted. Do not invent unsupported buttons, platforms or destinations.
Link URLs are validated locally against explicit site configuration and discarded.
Clicks preserve native navigation, keyboard, modifiers and middle-button behavior.

## Attribution

| Field | Allowed values |
| --- | --- |
| `source` | `direct`, `search`, `social`, `ai`, `github`, `email`, `internal`, `campaign`, `referral` |
| `utmSource` | `none`, `other`, `google`, `bing`, `yandex`, `duckduckgo`, `github`, `telegram`, `reddit`, `youtube`, `x`, `linkedin`, `facebook`, `instagram`, `chatgpt`, `claude`, `perplexity`, `newsletter` |
| `utmMedium` | `none`, `other`, `organic`, `cpc`, `paid_social`, `social`, `email`, `referral`, `partner` |
| `utmCampaign` | `none`, `other`, `launch` |

Missing parameters become `none`; empty, duplicate, unknown and literal `none` or
`other` input become `other`. A single value is lowercased and trimmed. Presence
of any of the three UTM parameters takes precedence over referrer classification.
GitHub maps to github, newsletter/email medium to email, known search/social/AI
sources to those categories; other UTM combinations map to campaign. With no UTM,
known referrer domains use safe subdomain boundaries; the configured landing and
web origins are internal. Unknown/invalid referrers are referral. No referrer is
direct, including browser-hidden referrers. No browser header is forwarded.
`utm_term` and `utm_content` are ignored. Add campaign codes to both clients and
the future server together; arbitrary campaigns never leave the browser verbatim.

## Delivery, validation and storage requirements

Both clients send UTF-8 JSON as `text/plain;charset=UTF-8` using fetch keepalive,
credentials omit, no-referrer, redirect error and no-store. This avoids a browser
preflight for the ordinary POST. Exact-origin CORS must return on all responses,
with no credentials/wildcard/reflection, and expose `Retry-After`. CORS is not
authentication. Apply body/rate/concurrency bounds independently of product traffic.

Limits: 16 KiB before JSON decoding, 8 events per batch, 32 produced events per
document, 2 simultaneous requests, 5-second request timeout. Network failures,
408, 429 and 5xx retry at most 3 total attempts per event, preserving IDs and
payloads. Other HTTP responses are terminal. Numeric Retry-After up to 30 seconds
is respected with a minimum 1-second delay; longer or date-form instructions drop
the retry instead of retrying early. No persisted queue or beacon. Page departure
flushes eligible new events but starts no more retries. Delivery remains best-effort.

The future receiver must validate exact fields/catalogs and property combinations,
UUIDs, timestamp bounds and same-page batches; reject malformed batches atomically.
Return 2xx only after durable acceptance. Deduplicate exact retries atomically and
reject an event-ID collision with changed data. Tolerate out-of-order sequences;
do not reconstruct a missing view from clicks. Do not trust client input as bot
proof. Keep identifiers only within the landing dataset and out of logs.

Proposed maximum raw-event/page-ID retention is 90 days, subject to explicit server
and backup-policy agreement before activation. Bounded aggregate retention must
also be specified. There is no durable identity for per-person deletion; the UI
must not claim that opting out erases accepted events. No production retention or
legal compliance is established by this client-only implementation.

## Reporting and activation

Report raw views/clicks and distinct observed page IDs separately. Same-page
funnels require a real view and increasing sequence; orphan clicks remain visible
as clicks without increasing the view denominator. Use the view's dimensions for
view-based funnels; event-time locale and placement may describe raw clicks.
Raw click/view ratios can exceed 100%; matched page-view funnel rates cannot.
Do not sum overlapping attribution/locale/placement segments as distinct visitors.
Keep GitHub API download counts and editor activity/retention separate.

Before activation: implement and test the receiver, deduplication, retention,
reports, exact-origin CORS/TLS, actual logging and applicable privacy requirements;
verify real staged browser journeys and both client fixtures. Only a separate
reviewed configuration change may enable sending. No deploy, DNS change, GitHub
Actions workflow or application-telemetry change is part of this client update.
