# WritersStudio landing release readiness — 2026-10-18

Release configuration is enabled: true, site version 1.1.0, with the common v2
receiver contract. This is permission to offer optional statistics, never default visitor consent.
The client sends only at its exact production HTTPS origin and only after explicit consent to the
event category. Local previews send no telemetry. Previously denied choices remain respected.

The shared Accept / Reject / Configure popup supports EN/RU/ES, both themes, keyboard interaction,
Escape, focus return and a footer settings entry. Choices expire after 180 days; unsupported dialog
or browser APIs, DNT/GPC and storage failure suppress sending. The popup discloses common event
metadata and temporary identifiers without claiming absolute anonymity. App analytics and GitHub
release counters remain independent. Full refusal does not limit site use or downloads.

Local verification covers 18 shared behavioral suites, all static-site and localization checks,
public assets and legal-page consistency where applicable. Browser verification covers 320x568,
820x360 and 1280x800 layouts; controls remain visible while detailed settings scroll. Shared
contract/client/UI/test/copy artifacts match in both repositories.
The current privacy policy is dated 2026-10-18; historical policy URLs remain unchanged.

## Publishing gates

This repository change is local release preparation, not deployment or proof of accepted events.
Before publishing the active configuration, deploy the corresponding Telemetry revision, apply
all migrations/role grants, enable landingCollectionEnabled, and verify exact-host DNS/TLS,
CORS, absence of sensitive access logs, raw retention and a backup/restore rehearsal. Exercise a
consented synthetic journey at the real origin and verify durable acceptance without recording
request bodies or identifiers. GitHub acquisition has its own worker flag and schedule gates.

The operator is an individual publishing a free project. That alone does not establish exemption
from data-protection law. Confirm controller/jurisdiction information and actual hosting before
public activation; this UI change is not a legal certification. If the receiver is unavailable,
site navigation and downloads continue; delivery is bounded and no persistent queue is created.

No push, deployment, DNS change, hosted workflow or installer publication is performed by this
preparation. Existing product release assets and other launch inputs remain separate checks.
