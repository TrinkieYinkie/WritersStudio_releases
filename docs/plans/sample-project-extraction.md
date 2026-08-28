# Sample project extraction

## Goal

Move the complete Pride and Prejudice sample out of the releases repository so
the sample repository itself is the WritersStudio project and its Git history
is the history shown by the app. Keep its GitHub entry point in the repository
README, where technical users can find the install-first instructions without
adding sample-project decisions to the public landing page.

## Stages

1. Build the standalone sample repository from the current working sample,
   preserving the user's latest project manifest and adding realistic English
   commits plus an alternate draft branch.
2. Remove the embedded sample from the releases repository and update the
   landing, translations, footer, FAQ, README, and validation contract.
3. Validate both repositories, review the combined diff, and leave clean task
   branches ready for review without pushing or merging to `main`.

## Edge cases and compatibility

- A GitHub source ZIP omits `.git`, so it cannot preserve the sample history.
- The GitHub button must not imply that a browser can open a local project.
- The sample repository root must directly contain `project.writersstudio`,
  `writersstudio.project.json`, and `content/`.
- The public-domain attribution and illustrative-history disclaimer must stay.
- English, Russian, and Spanish catalogs must remain synchronized.
- The existing local preview server must remain untouched.

## Verification

- Confirm the sample repository root, remote, branches, commit graph, required
  project files, and clean working tree.
- Run the releases repository's bounded six-stage site validation plan.
- Confirm there are no remaining local `samples/pride-and-prejudice/` links or
  files in the releases repository.
- Review staged files in each commit and audit task-owned processes and locks
  immediately after every commit.

## Definition of done

- The standalone repository is a complete, openable WritersStudio project with
  an illustrative English Git history and alternate branch.
- The releases repository no longer contains the sample project.
- The landing does not advertise or link to the standalone sample; its final
  action explains that a new project can be created from scratch.
- README points to the standalone repository and contains the install-first
  instructions.
- Both task branches are clean, validated, and not pushed.

## Completion

- Standalone project: `feature/sample-project-history` at `1516219`, with the
  alternate `draft/quieter-pemberley-reunion` branch at `64a310b`.
- Landing integration: `feature/writersstudio-landing` through merge commit
  `2f0af06`.
- No repository was pushed and neither `main` branch was changed locally.
