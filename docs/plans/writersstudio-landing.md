# WritersStudio landing page

## Goal

Create a polished, conversion-focused landing page for `writersstudio.app` that
explains the value of WritersStudio, makes the free local desktop application
the primary offer, and sends people to official GitHub release assets.

The page is a narrative marketing surface: the first viewport must communicate
the product, its free desktop promise, and the primary download action. The
rest of the page should reward scrolling by progressively revealing real product
screens rather than relying on decorative mockups.

## Product and audience

- Primary audience: novelists and long-form fiction writers who have outgrown a
  single document but do not want a complex project-management tool.
- Primary action: download the latest compatible WritersStudio release.
- Secondary actions: inspect the product, choose an older release, open the
  sample project, or visit GitHub release notes.
- Positioning: direct, capable, stored on the user's computer, and permanently free for the desktop
  application. A future optional WritersStudio Cloud service may be paid, but it
  is not required for local writing.

## Experience stages

1. **Hero and trust:** concise promise, prominent free-desktop treatment,
   Windows/macOS download controls, no-account/offline/local assurances, and a
   real manuscript screenshot.
2. **Scroll story:** a sticky product frame changes between manuscript,
   organization, character, and timeline views as the visitor reads the
   corresponding copy.
3. **Ownership and revision:** explain portable local files, local History, and
   exports without making claims beyond the current product contract.
4. **Download center:** platform tabs, current release details, explicit empty
   states, and an accessible older-version selector populated from the public
   GitHub Releases API.
5. **Cloud boundary and FAQ:** make the future optional paid service distinct
   from the permanently free desktop application. Mark Cloud explicitly as
   `TO BE DONE`; reserve a future support/donation action without publishing an
   unapproved destination.

## Localization

- Keep all editable interface copy in `locales.json`, synchronized across
  English, Russian, and Spanish.
- Use a visitor's saved choice first, then match the device language for `ru`
  or `es`, and fall back to English for every other device language or failure.
- Let visitors change the language from an application-owned keyboard-accessible
  picker and remember that choice locally without an account or network request.
- Keep English metadata in the static document as the crawler-safe fallback;
  update page title and description when the runtime locale loads.

## Copy voice

- Write like a person explaining a useful writing tool to another person. Prefer
  concrete actions and file behavior over slogans, abstractions, and stacked
  fragments.
- Lead with automatic saves, version history, and the ability to return to an
  older draft. Writers should not need to know what Git is before the product
  becomes useful to them.
- Mention Git once in the detailed history section, explain it immediately in
  plain language, and avoid repeating the technology name in headlines or
  benefit lists.
- State the business model plainly: the desktop app is free and will remain
  free; Cloud does not exist yet and may later be an optional paid service.

## Visual direction

- Present WritersStudio as a serious working tool: modern sans-serif type,
  neutral surfaces, crisp rules, compact spacing, and mostly rectangular
  geometry.
- Use the existing coral color only for functional emphasis such as status,
  focus, and primary interaction. Avoid decorative gradients, paper texture,
  calligraphic display type, seals, ornamental circles, and oversized romantic
  composition.
- Let real application captures carry the visual interest inside consistent,
  understated desktop frames.
- Keep motion short and functional; reduced-motion users see a stable, fully
  understandable sequence.
- Responsive layouts preserve readable copy and place download actions before
  secondary product detail.

## Release behavior

- Fetch published releases from
  `https://api.github.com/repos/TrinkieYinkie/WritersStudio_releases/releases`.
- Ignore drafts and classify assets conservatively by platform and extension.
- Use the newest asset for the primary platform action and list older matching
  assets in a custom accessible disclosure.
- When no matching release exists, show an honest `Coming soon`/`Not published
  yet` state and link to the official releases page; never imply that an asset is
  available when it is not.
- When the API is unavailable or rate-limited, preserve a working link to the
  official GitHub releases page.

## Edge cases and risks

- No releases exist yet, or a release contains only one platform.
- A release contains checksums, metadata, or multiple architectures that must
  not be mistaken for the primary installer.
- GitHub is offline, rate-limited, or returns malformed data.
- The page is opened from `file://`, GitHub Pages, or the custom domain.
- Local storage is unavailable, the locale file fails to load, or the device
  reports an unsupported language; the page must remain usable in English.
- Visitors use keyboard navigation, a screen reader, forced colors, reduced
  motion, a narrow phone, or a short viewport.
- Marketing claims must not promise macOS availability, cloud functionality,
  automatic backup, source availability, or analytics behavior that is not in
  the current product contract.

## Verification

- Run repository-owned validation through the bounded lifecycle runner with a
  checked-in plan.
- Check HTML landmark/metadata requirements, internal asset references, script
  syntax, release-classification fixtures, and policy-sensitive copy.
- Start the preview with a bounded task owner, request the exact page once, and
  inspect the rendered result at desktop and mobile sizes.
- Verify keyboard focus, custom disclosure behavior, reduced-motion fallbacks,
  empty/error release states, and no horizontal overflow.

## Definition of done

- The landing page is production-ready on the feature branch without modifying
  repository-hosted workflow files.
- The first viewport clearly says what WritersStudio is, that the desktop app is
  free and will remain free, and where downloads come from.
- Windows and macOS have distinct states and older versions are discoverable.
- Existing real product screenshots drive the scroll narrative.
- English, Russian, and Spanish copy stays synchronized and the first visit
  selects a supported device language while defaulting safely to English.
- The site passes the bounded validation plan and remains usable when GitHub's
  API is unavailable.
- The only remaining launch inputs are factual release/legal/support details or
  optional new media that cannot be derived from existing repository assets.
