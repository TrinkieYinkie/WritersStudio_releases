# WritersStudio landing aggregate statistics v1

Status: client contract prepared; production sending disabled. This document is an
informational handoff, not authorization to begin server implementation or deploy.

## Scope and privacy

The owner requests **total views and clicks with opt-out**, without persistent IDs.
There are no visitor, installation, session, page-view or event identifiers at all.
No cookies, fingerprint, client timestamp, locale, device information, referrer,
UTM/campaign parameters, page URL, asset URL, release tag or free-text field is sent.
Never join these counters to desktop activity, acquisition observations or another
product. They do not support unique visitors, returning visitors, session funnels,
per-visitor conversion, attribution or confirmed downloads/installations.

The only new browser storage is `writersstudio.websiteStatistics = off`, written
when the visitor excludes their visits. It has no timestamp or expiry. Re-enabling
removes it. Unreadable storage, any non-null stored value, GPC or DNT disables
sending. A failed opt-out write still excludes the current document. Browser
privacy signals cannot be overridden using the page control.

## Endpoint and envelope

Proposed dedicated route, separate from `/api/telemetry/events`:

`POST https://telemetry.writersstudio.app/api/telemetry/landing-events`

```json
{
  "schemaVersion": 1,
  "site": "writersstudio",
  "surface": "landing",
  "event": { "name": "landing_page_viewed", "page": "home" }
}
```

Exactly these root keys; exactly one event per request. Reject unknown keys and
invalid combinations. Body limit 1024 UTF-8 bytes. `site` must agree with the
hostname-resolved product; a body field must never select another product's store.
No authentication secret in browser code. This endpoint must not require a desktop
installation ID or deletion secret or insert rows into desktop event tables.

| Event | Exact additional fields | Meaning |
|---|---|---|
| `landing_page_viewed` | none | One view per visible document lifetime. Reload counts again; theme/language changes, hash links and BFCache do not. |
| `landing_download_clicked` | `action`, `placement`, `platform` | Intent to open downloads OR request an installer, as specified below. |
| `landing_outbound_clicked` | `destination`, `placement` | A marked link transition, including internal legal pages. Never a completed download. |

Every event includes exactly `name`, `page: "home"` and its listed extra fields.

Download combinations:

- `action: "open-download-section"`, `platform: "unspecified"`, placement one of
  `header`, `hero`, `final`, `navigation`, `footer`.
- `action: "request-installer"`, platform `windows` or `macos`, placement
  `release-latest` or `release-older`. Only official repository asset URLs qualify.

Outbound destination -> allowed placements:

- `github-releases`: `release-latest`, `release-older`, `release-notes`, `footer`.
- `github-release-notes`: `release-notes`.
- `github-feedback`, `support-email`: `footer`.
- `terms`: `download-legal`, `footer`.
- `privacy`: `download-legal`, `footer`, `statistics`.

Example installer intent:

```json
{"schemaVersion":1,"site":"writersstudio","surface":"landing","event":{"name":"landing_download_clicked","page":"home","action":"request-installer","placement":"release-latest","platform":"windows"}}
```

If the release API is empty, offline or rate-limited, the same Windows button
links to Releases and emits this instead:

```json
{"schemaVersion":1,"site":"writersstudio","surface":"landing","event":{"name":"landing_outbound_clicked","page":"home","destination":"github-releases","placement":"release-latest"}}
```

## Transport and response

Browser uses JSON CORS fetch with credentials omitted, no referrer, redirects
rejected, no cache, keepalive and a 3-second abort. At most four concurrent requests
and 30 attempts per document. No event queue, retries, beacon or background loop.
Clicks never wait for analytics and navigation is not intercepted. Collection is
best-effort: blocked scripts, network failures, caps, bots and opt-outs affect counts.

Return `204` only after incrementing the aggregate; errors may use stable codes
with 400/403/413/429/503. Client ignores response content and never retries. Without
event IDs this protocol does not offer idempotent replay. Browser preflight must
allow exact origin `https://writersstudio.app`, POST and Content-Type, without
credentials, wildcards or arbitrary origin reflection. Cache preflight if useful.
Production previews/local origins remain excluded by the client. CORS is not
authentication: keep request-size, rate, concurrency and abuse controls.

## Required server storage and reporting

Increment daily counters using **server UTC date**, product, surface, event name
and the closed event dimensions. Aggregate immediately; do not retain individual
events, request bodies, timestamps, connection IPs, User-Agent, Referer, Cookie or
other request metadata in analytics tables, access logs or diagnostics. Network
infrastructure necessarily handles connection data; verify the actual edge and
hosting behavior before activation. Proposed counter expiry: 90 days, enforced
by retention and backup policy. Existing desktop retention/deletion is unchanged.

Expose a distinct landing report of views and action counts. Ratios of total
clicks/views may exceed 100% and are not per-visitor conversion. Do not connect
events into journeys, increase desktop active installations, or affect retention.
Aggregates cannot be attributed back to a visitor; opt-out stops future sending
but cannot retract an already incremented anonymous counter.

## Activation and evidence

1. Agree on this contract and add independent aggregate ingestion/storage/query
   support while preserving desktop contracts and application boundaries.
2. Verify origin handling, hostile bodies, caps, request logging, aggregate expiry,
   disabled previews and inability to correlate website activity to desktop IDs.
3. Verify applicable privacy/legal conditions for aggregate opt-out measurement,
   actual hosting behavior and the public notice; no blanket jurisdiction claim.
4. Run a staging browser journey against a reviewed test configuration. Confirm
   real counters increment, opt-out/GPC/DNT stop requests and downloads still work.
5. Only then change `website-analytics-config.js` enabled from false to true in a
   separate reviewed source change. This handoff does not request that action.

Reference rationale: ICO's statistical-purpose exception requires aggregate
service-improvement statistics, clear information and a simple free opt-out; it
does not permit individual tracking or advertising measurement. Applicability is
jurisdiction- and configuration-dependent:
https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
