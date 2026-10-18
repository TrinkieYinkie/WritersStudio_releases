# Landing statistics and consent

Both public sites use the same [v2 contract](contracts/landing-analytics-v2.md), client and consent
popup. All optional categories are off until an explicit choice. Accept, Configure and Reject are
available on the first layer; the settings separately control page views, download clicks and
other link clicks. No event IDs, context or requests are produced before consent. Disabled
categories and earlier actions are never replayed. Temporary page/event IDs remain in memory;
the versioned category choice is stored locally for 180 days, without a visitor identity.

GPC/DNT, unreadable preference storage, expired or invalid choices suppress collection. Prior
opt-outs remain refusals. Withdrawal from the footer cancels pending attempts and future events;
it cannot undo events already accepted by the receiver. Missing page views are never inferred
from clicks. Reports cover consenting observations and have selection bias. Raw receiver events
expire within 90 days. App telemetry and GitHub cumulative download counts remain separate.

The popup lists the collected categories and common metadata. It does not promise absolute
anonymity: temporary identifiers link same-page events and infrastructure receives connection
metadata. A free personal project is not by itself proof of exemption from privacy obligations.
The jurisdiction and actual hosting configuration must be assessed before deployment. References:
[CNIL audience measurement](https://www.cnil.fr/fr/node/677) and
[EDPB consent-banner report](https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf).

The release configuration controls production eligibility; it does not bypass consent. Local
previews cannot send to the production receiver. Public activation still needs a deployed and
verified TLS endpoint, exact-origin CORS, logging, database roles and backup/restore behavior.
Pushing, deploying and DNS changes are separate operational work. No hosted workflow is added.
