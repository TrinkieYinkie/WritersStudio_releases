# WritersStudio document presentation — 2026-10-19

Scope: improve the existing Terms and Privacy pages in the primary releases
repository on feature/legal-pages-design. Preserve policy text, dates, permanent
URLs, EN/RU/ES editions and historical HTML. This is presentation work, not a new
policy version or a new legal/telemetry readiness assessment.

Expected behavior: readable document hierarchy, visible version/permalink, section
navigation, links between documents, localized theme control, mobile layout and
print styles using the landing's semantic palette, controls and global scrollbars.
Legal pages load only their theme module; they do not load landing analytics or
the GitHub release client. They remain readable without JavaScript.

Stages: inspect existing generator and public assets; update its presentation and
regenerate current pages; run sequential bounded generation/consistency/site checks;
inspect both themes, language navigation and narrow/short layouts in a browser.

Risks: long translated headings, broken relative links in dated routes, JS/storage
unavailability, an old dated page depending on shared CSS, focus visibility in dark
or forced colors, and accidentally changing legal text or loading analytics.
No new dropdown or independently scrollable panel is needed.

Definition of done: generated pages match their source, current and permanent
links work, the existing site checks pass, browser review covers desktop/mobile
and keyboard controls, no task-owned processes or locks remain, and the task branch
has a focused commit. No push, main merge, deployment or hosted workflow change.

## Preview and publication

The current public routes stay /terms/ and /privacy/, with /ru/ and /es/
editions and permanent 2026-10-18 links. Publish the checked-in HTML together
with styles.css, legal.css, legal.js and assets/writersstudio-icon.png as part
of the existing landing deployment. No separate legal hosting service is needed.
The text source is legal/documents.json; presentation labels are separately
maintained in legal/presentation.json. Regeneration does not rewrite the six
archived 2026-10-14 HTML pages.

Run these commands sequentially from this repository:

- `node scripts/run-bounded-validation.mjs scripts/validation-plans/site-generate.json`
- `node scripts/run-bounded-validation.mjs scripts/validation-plans/site-full.json`
- `node scripts/run-bounded-validation.mjs scripts/validation-plans/legal-preview.json`

The last command prints a random loopback URL, serves only legal pages and their
public assets, and closes after three minutes. Its shared validation lock belongs
to the parent lifecycle runner, which performs bounded process-tree cleanup.
The main landing is intentionally outside this document-only preview.

For manual review, switch themes with Enter/Space; follow the section, document,
language and permanent links; check 320px and 390px phone widths and a short
820x360 window. Also review a dated page directly. Browser review is visual and
functional; this presentation change does not certify the policy's legal or
production-operational claims.

## Verification result

- The final sequential site-full plan passed all 12 stages: lifecycle ownership
  regressions, module syntax, static site contract, all 188 translated landing
  messages, release fixtures, all 12 regenerated legal pages, 18 shared analytics
  suites and landing integration.
- Actual asset and fragment links passed across 18 current and historical pages.
  The legal text source and the six historical HTML files have no diff.
- Browser review covered Russian Privacy in both themes at desktop size,
  keyboard Enter/Space on the theme button, preference persistence after reload,
  section anchors, English/Spanish language links and the dated Terms route.
  Both themes retained readable text and visible controls; the console had no errors.
- Viewports reviewed: 1280x960, 390x844, 320x568 and 820x360. The initial 320px
  inherited minimum-width issue was corrected; the final 320px viewport measured
  clientWidth = scrollWidth = bodyWidth = 310px, allowing for its scrollbar.
- Print and forced-color fallbacks are included in CSS but were not exercised in
  the browser. No external network transport or production telemetry acceptance
  was tested by this presentation work.
