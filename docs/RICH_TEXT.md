# Rich text and structured paste

Notes, personal tasks and team task descriptions share the hosted TipTap 2 editor.
HTML descriptions remain the storage contract; no database migration is required.

## Paste behavior

Prefer supported HTML clipboard content. Plain-text Markdown with a recognized
GFM table converts to rich content, retaining surrounding paragraphs, lists and
formatting. Tab-separated spreadsheet data converts when it contains at least two
consistent rows and columns, including quoted tabs/newlines/quotes. Ambiguous
input stays text. Ctrl/Command+Shift+V pastes literally; code blocks retain literal
paste. Pipes alone and fenced examples do not trigger table conversion.

Semantic formatting is retained and source presentation styles are discarded.
Tables have headers, light/dark theme borders, wrapped text, cell alignment and
horizontal scrolling within the content. The Table menu inserts a 3×3 table and
offers contextual row/column/header/merge/split/delete actions. Tab/Shift+Tab use
TipTap's native cell navigation. Personal task cards show a compact text preview
when their description contains a table; opening a task shows the full table.

## Limits and fallback

- Clipboard text/HTML: 500,000 characters per representation, checked before parsing.
- Tables: 200 rows, 40 columns and 2,000 effective cells per description, including
  merged spans and empty cells filled during rectangular normalization. Editing
  transactions that exceed these limits are rejected with an explanation.
- Clipboard normalization rejects excessive element count/depth. Backend
  sanitization independently validates complexity, table dimensions and attributes.
- HTML tables with uneven rows are normalized by ProseMirror. Markdown rows with
  more cells than the header are rejected with a message and a plain-text shortcut;
  GFM's default behavior would silently discard those extra cells.
- Nested HTML tables become text inside the containing cell with a notice.
- Unsupported embedded images become their alt text or an `[Image]` placeholder
  with a notice; the user can upload originals using Insert image. Pure clipboard
  image files use the existing authenticated upload/offline-image flow. Rich HTML
  takes precedence over duplicate image-file representations.
- Scripts, executable attributes, foreign classes/styles, unsafe URLs and
  unsupported image schemes are removed. Valid bounded spans and left/center/right
  alignment are retained. Existing team image membership/path restrictions apply.

Paste is undoable. Autosave, drafts, sync and existing team conflict recovery
continue to carry the HTML. Preview/search extraction separates rows and cells.
Previously flattened content cannot be reliably reconstructed; re-paste the source.

## Client compatibility and rollout

The hosted web editor sends `X-Dayflow-Rich-Content: tables-v1` on API requests.
Sync upserts and team task description patches without this capability cannot
change an existing table description: the API returns HTTP 409
`EDITOR_UPDATE_REQUIRED` and retains the server copy. Metadata-only changes with
an unchanged description remain supported. A capable editor can intentionally
remove a table. This is a compatibility declaration, not an authorization control.

Existing Android installations do not gain table editing in this web release.
They may display flattened local content, but their rewritten description cannot
overwrite the server table. Use the updated website for table-bearing documents.
Old offline drafts remain on their originating device; do not clear app storage
to work around a rejected sync. Desktop uses the hosted web editor after refresh.
Shared editor table modules are optional so the existing mobile bundle continues
to build without silently enabling a partial table implementation.

Deploy backend support alongside/before the new frontend, using the existing
backup-first VPS workflow. No nginx, MongoDB schema or native binary change is
needed. Automated evidence belongs in AUDIT_LOG.md; real application/browser
clipboard variations beyond synthetic fixtures remain manual acceptance checks.
