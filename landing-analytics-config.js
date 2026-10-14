// Public reviewed configuration. Enable only after the shared v2 receiver and release gates are ready.
export const landingAnalyticsConfig = Object.freeze({
  "enabled": false,
  "siteVersion": "1.0.0",
  "origin": "https://writersstudio.app",
  "endpoint": "https://telemetry.writersstudio.app/api/telemetry/landing/events",
  "preferenceKey": "writersstudio.websiteStatistics",
  "releaseRepository": "TrinkieYinkie/WritersStudio_releases",
  "downloadSection": "#download",
  "supportEmail": "support@writersstudio.app"
})
