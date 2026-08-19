# Pride and Prejudice sample project plan

Status: complete

## Objective

Add a complete, portable WritersStudio sample project based on Jane Austen's
_Pride and Prejudice_ to the public release repository. The sample must open in
the current WritersStudio project schema, demonstrate the main long-form
writing workflows, carry clear source provenance, and avoid implying that
demonstration drafts are historical Jane Austen manuscripts.

## Target layout

```text
samples/
  pride-and-prejudice/
    README.md
    SOURCES.md
    project.writersstudio
    writersstudio.project.json
    content/
      <final-manuscript-section>/
      <demo-drafts-section>/
      <outline-and-notes-section>/
      <characters-section>/
      <timeline-section>/
```

The project contains no nested `.git` directory and no machine-local
`.writersstudio` state. Portable History recording is initially set to `off`
because the sample lives inside the release repository: opening it in place
must not create WritersStudio checkpoints in the repository that distributes
it. The sample README tells users to copy the project folder elsewhere before
turning History on.

## Text and licensing policy

- Use Jane Austen's original English novel, first published in 1813.
- Use the clean chapter transcription from the Standard Ebooks
  `jane-austen_pride-and-prejudice` repository and pin its exact Git revision.
- Record the Standard Ebooks CC0 dedication, its Project Gutenberg source, the
  Project Gutenberg ebook number, and the retrieval date in `SOURCES.md`.
- Import prose chapters only. Do not copy modern introductions, blurbs,
  cover art, illustrations, or third-party commentary.
- Label all newly written outlines, character summaries, timeline text, and
  demonstration drafts as WritersStudio sample material.
- Never describe a demonstration draft as an original or historical Jane
  Austen draft.

## Project content

### Final Manuscript

- One `treeMarkdown` section.
- Three volume containers matching the novel's original three-volume shape.
- All 61 chapters in reading order: Volume I contains chapters 1–23, Volume II
  contains chapters 24–42, and Volume III contains chapters 43–61.
- Each chapter is a separate Markdown document with clean paragraph flow and
  preserved inline emphasis.

### Demo Drafts

- One `treeMarkdown` section.
- A short guide plus several deliberately unfinished working versions of key
  scenes.
- Each working document states that it was created for the WritersStudio
  sample and links to the corresponding final chapter where useful.

### Outline and Notes

- One `flatMarkdown` section.
- Project guide, novel overview, three volume outlines, themes and motifs,
  locations, relationship map, and source/licensing note.

### Characters

- One `characters` section with stable custom field definitions.
- Profiles for the principal Bennet, Darcy, Bingley, Lucas, Collins, Wickham,
  Gardiner, and de Bourgh characters.
- Profiles use only text supported by the current schema and link to relevant
  manuscript chapters.

### Story Timeline

- One `timeline` section in narrative order.
- Key events cover all three volumes.
- Tags expose the Elizabeth/Darcy, Jane/Bingley, Lydia/Wickham, and
  Charlotte/Collins threads.
- Timeline relations point to existing character entities and manuscript
  chapters.

## Edge cases and regression risks

- Every entity ID must be globally unique and every map key must equal its ID.
- Section, list, sibling, and timeline links must form complete acyclic chains
  with correct first/last boundaries.
- All storage paths must be portable, relative, collision-free, and present on
  disk with the expected content type.
- Character profiles and field definitions must pass their independent schema
  parsers.
- Relations must reference existing entities of compatible kinds.
- Chapter parsing must produce exactly 61 non-empty documents and must not
  retain XHTML, navigation text, licensing boilerplate, or decorative content.
- Unicode punctuation and emphasis must survive the XHTML-to-Markdown
  conversion without mojibake.
- No nested repository, source-download cache, temporary generator, or
  machine-local WritersStudio state may enter the release repository.
- The public sample must explain that a cloned repository is an ancestor Git
  worktree and recommend copying the sample before enabling local History.

## Implementation stages

1. **Source and foundation** — pin the public-domain source, create provenance
   and user documentation, and establish a minimal valid project skeleton.
2. **Final manuscript** — convert and import all 61 chapters and the three
   volume containers.
3. **Story data** — add demonstration drafts, outlines and notes, character
   profiles, relations, and the plot timeline.
4. **Validation and handoff** — run structural and content checks, open/read
   through the current WritersStudio runtime boundary where practical, review
   the complete diff, and update repository navigation.

Each stage is implemented on its own stage branch from the updated integration
branch, committed atomically, reviewed, and merged back before the next stage
begins.

## Verification strategy

- Validate `writersstudio.project.json` with the current
  `validateProjectConfig()` implementation.
- Parse every character profile with the current character-profile parser.
- Validate the launcher with the current launcher parser.
- Confirm every declared project-owned file exists and every content file is
  declared exactly once.
- Assert exact section/entity counts, linked ordering, relation targets,
  chapter count, non-empty chapter text, and absence of source boilerplate.
- Search generated content for XHTML fragments, replacement characters,
  absolute paths, and source-cache residue.
- Run focused current-runtime checks sequentially with explicit command
  timeouts; do not run the full release gate unless a runtime change makes it
  necessary.
- Review the final Git diff and repository status after all stage merges.

## Definition of done

- The release repository contains one documented Pride and Prejudice sample
  under `samples/pride-and-prejudice/`.
- The project opens under schema version 4 and contains the complete 61-chapter
  English novel.
- Demo Drafts, Outline and Notes, Characters, and Story Timeline are populated
  and internally linked.
- Provenance and public-domain/CC0 boundaries are explicit.
- History is safe when the sample is opened from inside the release repository.
- Generated files contain no temporary sources or unrelated project changes.
- All focused validation passes, the integration branch is clean, and it is
  ready for the user's later merge or push without merging to `main` here.

## Completion record

Completed on 2026-08-19.

- The current schema validator accepted the project with zero diagnostics.
- The launcher parser confirmed the stable project identity.
- The current repository runtime opened an isolated copy as a schema version 4
  project without rewriting its configuration.
- The final manuscript contains 61 chapters in three volumes: 64 manuscript
  nodes and 122,025 words including chapter headings.
- The supplemental layer contains five demo drafts, nine planning documents,
  15 parsed character profiles, and 36 timeline points across five story
  branches.
- Every declared storage file exists exactly once; relation targets, linked
  ordering, Unicode text, Markdown emphasis, and source boundaries passed the
  focused audit.
- No nested repository, machine-local WritersStudio state, imported XHTML,
  temporary source path, runner lock, runtime copy, or task-owned process
  remained after validation.
