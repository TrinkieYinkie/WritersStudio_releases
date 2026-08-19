<div align="center">

<img src="./assets/writersstudio-icon.png" alt="WritersStudio icon" width="112" />

# WritersStudio

### Build the world. Shape the story. Keep every word yours.

A calm, local-first desktop studio for novels and long-form fiction.

[![Public Beta](https://img.shields.io/badge/status-public%20beta-C56C55?style=flat-square)](../../releases/latest)
![Windows](https://img.shields.io/badge/platform-Windows-56616D?style=flat-square&logo=windows)
![Free](https://img.shields.io/badge/WS%20Local-free-60866B?style=flat-square)
![No account required](https://img.shields.io/badge/account-not%20required-6D638A?style=flat-square)

**[Download the latest release](../../releases/latest)** · [View all releases](../../releases) · [Share feedback](../../issues/new)

</div>

<p align="center">
  <img src="./assets/screenshots/writersstudio-manuscript-workspace.webp" alt="Project notes and a Pride and Prejudice manuscript chapter open side by side in WritersStudio" width="100%" />
</p>

## One place for the entire story

WritersStudio brings your manuscript, structure, characters, timeline, notes, and revision history into one focused workspace. It gives a large story room to grow without turning the writing process into project management.

| Write naturally                                                                                      | Organize without friction                                                                                                    |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Visual Markdown editor**<br>Format prose directly—without writing markup by hand.                  | **Flexible project tree**<br>Arrange chapters, scenes, notes, and custom sections around your process.                       |
| **Tabs and split views**<br>Keep a scene beside its notes, character, or timeline while you write.   | **Project-wide search and replace**<br>Find text across the whole project, with case-sensitive and regular-expression modes. |
| **Character profiles**<br>Build reusable profiles with custom fields and links to related documents. | **Visual timeline**<br>See events in story order and filter them by narrative thread.                                        |

<details>
<summary><strong>See more of the workspace</strong></summary>

<br>

<p align="center">
  <img src="./assets/screenshots/writersstudio-story-overview-split-view.webp" alt="A story timeline and editable story overview open in a horizontal split view" width="100%" />
</p>

<p align="center">
  <img src="./assets/screenshots/writersstudio-project-organization.webp" alt="Drafts, outlines, and planning notes organized in the WritersStudio project tree" width="100%" />
</p>

</details>

## Rewrite without fear

WritersStudio keeps a local History for every new project. Create named save points, browse earlier versions, preview the past without disturbing the current draft, and explore a different direction on a new story branch.

Git provides the foundation under the hood; WritersStudio presents it as a writing tool. No command line, account, remote repository, or network connection is required.

<!--
SCREENSHOT 2 — HISTORY
Place one focused History screenshot here.
Suggested file: assets/screenshots/writersstudio-history.webp
Recommended crop: approximately 3:2, 1400–1800 px wide.
Show: several clearly named save points, two visible story branches, and the preview/details area.
Keep the graph readable; five to eight points are more persuasive than a dense stress-test history.
Suggested setup: copy the included sample outside this repository, enable History, and create a short alternate revision branch from one Demo Draft.

After adding the file, remove the comment markers around this block:

<p align="center">
  <img src="./assets/screenshots/writersstudio-history.webp" alt="Local save points and story branches in WritersStudio History" width="100%" />
</p>
-->

## Your manuscript stays yours

WritersStudio is local-first by design:

- Your projects live in folders you choose on your own computer.
- Manuscript content is stored in portable Markdown and structured project files.
- Writing, editing, search, export, and History work offline.
- No account is required to create or open a project.
- Production builds currently have product analytics disabled.
- Updating or uninstalling WritersStudio does not remove your project folders.

Export selected sections to **DOCX** for further editing or **PDF** for sharing and review. You can also create a portable ZIP copy of a project whenever you want an independent backup.

> [!IMPORTANT]
> Local History protects your revisions, but it is not a replacement for a backup on another drive or service. Keep an independent copy of work you cannot afford to lose—especially while WritersStudio is in beta.

## See the story beyond the page

Open a character beside the manuscript, trace events across the visual timeline, or keep notes next to the scene that needs them. The workspace adapts to the way you think instead of forcing every part of a novel into one document.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./assets/screenshots/writersstudio-story-timeline.webp" alt="The visual story timeline in WritersStudio" width="100%" />
    </td>
    <td width="50%" align="center">
      <img src="./assets/screenshots/writersstudio-character-gallery.webp" alt="The character gallery focused on Elizabeth Bennet" width="100%" />
    </td>
  </tr>
  <tr>
    <td align="center"><sub>Trace events, story branches, and related manuscript pages.</sub></td>
    <td align="center"><sub>Keep character details, motivations, and relationships close at hand.</sub></td>
  </tr>
</table>

## Explore a complete sample project

The repository includes a ready-to-open WritersStudio edition of Jane Austen's
_Pride and Prejudice_: the complete 61-chapter novel in three volumes, plus
modern demo drafts, outlines, 15 character profiles, and a 36-event story
timeline with relationship threads and links back to the manuscript.

**[Browse the Pride and Prejudice sample](./samples/pride-and-prejudice/)**

The novel is public domain. Supplemental planning material was created for
this sample and is clearly separated from Austen's text. Copy the sample folder
to another writable location before opening it; the sample guide explains why
and provides exact source provenance.

## Download WritersStudio

The first public beta is distributed for **Windows** through GitHub Releases.

1. Open the **[latest release](../../releases/latest)**.
2. Download `WritersStudio-<version>-Setup.exe` from **Assets**.
3. Run the installer and start a new project—or open an existing WritersStudio project.

To update manually, install the newer version over the existing application. Your projects and application settings remain in place.

<details>
<summary><strong>Language support</strong></summary>

The WritersStudio interface is complete in **English**, **Russian**, and **Spanish**.

Preview translations with an explicit English fallback are available for German, French, Brazilian Portuguese, Italian, Polish, Ukrainian, Turkish, Japanese, Korean, and Simplified Chinese.

</details>

## What comes next

The first chapter of WritersStudio is deliberately local. Optional **WritersStudio Cloud** is planned for a later release, bringing multi-device sync and off-device backup while keeping the local-first foundation intact.

## Frequently asked questions

<details>
<summary><strong>Is WritersStudio free?</strong></summary>

Yes. WritersStudio Local is free to download and use.

</details>

<details>
<summary><strong>Do I need an account or an internet connection?</strong></summary>

No. An account is not required, and the core writing experience works offline. Internet access is only needed to download releases and will be needed for optional online services in the future.

</details>

<details>
<summary><strong>Does WritersStudio upload my writing?</strong></summary>

No. The current local application keeps project content on your computer and does not include a Cloud service.

</details>

<details>
<summary><strong>Is WritersStudio open source?</strong></summary>

No. This public repository hosts official installers, release notes, and product support; it does not contain or license the WritersStudio source code.

</details>

<details>
<summary><strong>Which platforms are supported?</strong></summary>

The first public release supports Windows. Additional platforms may be announced in future release notes.

</details>

## Feedback and beta notes

WritersStudio is actively evolving. If something breaks, feels confusing, or gets in the way of writing, please **[open an issue](../../issues/new)**. Include the WritersStudio version and Windows version when reporting a bug, but never attach private manuscript content or unredacted local paths to a public issue.

This repository is the official home for public WritersStudio releases. It contains distributable application files and release information, not the application source code.

<br>

<div align="center">

**Made for stories too large for a single document.**

</div>
