// Enable only after the website-only backend contract and deployment are verified.
// This never changes the desktop analytics configuration or consent.
export const websiteAnalyticsConfig = Object.freeze({
  enabled: false,
  origin: 'https://writersstudio.app',
  endpoint: 'https://telemetry.writersstudio.app/api/telemetry/landing-events'
})
