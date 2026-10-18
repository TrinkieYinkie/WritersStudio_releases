// Release configuration: explicit visitor consent and exact production origin remain mandatory.
// Publish only together with a verified, enabled v2 receiver; see docs/release-readiness.md.
export const landingAnalyticsConfig = Object.freeze({
  "enabled": true,
  "siteVersion": "1.1.0",
  "origin": "https://writersstudio.app",
  "endpoint": "https://telemetry.writersstudio.app/api/telemetry/landing/events",
  "preferenceKey": "writersstudio.websiteStatistics",
  "releaseRepository": "TrinkieYinkie/WritersStudio_releases",
  "downloadSection": "#download",
  "supportEmail": "support@writersstudio.app"
})
