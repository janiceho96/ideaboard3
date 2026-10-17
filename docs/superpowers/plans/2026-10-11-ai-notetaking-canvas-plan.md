# Ideaboard: AI Note Taking and Canvas Improvement Plan

Date: 2026-10-11, Asia/Kuala_Lumpur

Status: Proposed implementation plan. No application changes or AI requests have been made for this plan.

## 1. Product Outcome

Help the user describe an outcome and have an AI Board Assistant use Ideaboard's existing features to create a useful workspace: choose frameworks, write relevant section notes, create supporting cards, organize the canvas, and help revisit decisions and next steps. Preserve the approved Marker Workshop direction: bold outlines, punchy accent colors, compact controls, and a spacious canvas.

The main journey is:

`Describe the goal -> Build with frameworks and notes -> Refine -> Organize -> Revisit`

The canvas is the overview of the work. A comfortable writing view is where the user develops a note. A command such as Build board authorizes creating new frameworks and draft notes for that task without approving every individual item. Rewrites of existing content show a comparison before replacement. A completed task is reversible as one logical action.

Working assumptions: prioritize the installed Mac app and brainstorm/project notes first. Meeting notes and research can use the same foundation. The user has not yet selected a provider or confirmed whether all processing must stay on the Mac; the cloud recommendation below is a proposal, not permission to transmit notes.

## 2. What Exists and What Needs Attention

The current React/Vite interface runs in an AppKit window with WKWebView. The native app bundles the interface and serves it through its own loopback listener. There is no connected LLM; existing AI examples describe externally generated content pasted onto a board.

Existing capabilities to extend:

- Markdown card bodies, title editing, templates, status, colors, due dates, locking, collapse, and duplication.
- Formatted text blocks, named frames, PDF page tiles, and board categories.
- Card/slide multiselection, group movement, search, an item outline, pan/zoom, and import/export.
- Local persistence in several localStorage keys, PDF images in IndexedDB, and whole-workspace backup/export.

Source findings that affect sequencing:

| Finding | Implication | Source |
| --- | --- | --- |
| Undo restores React state only, without writing restored records to storage. Its snapshots cover cards and goal tags. | Repair persistent Undo before AI modifies saved content; extend history before organization also changes frames/text. | `src/hooks/useBoard.ts:37`, `:67` |
| The card form invokes Save and closes without awaiting persistence; its Markdown body field is small. | Retain drafts on failure and provide room for long notes. | `src/components/CardModal.tsx:34`, `:66`, `:138` |
| Fit currently considers cards with approximate dimensions. The overview uses fixed illustrative rectangles. | Reuse existing geometry helpers to fit real content and implement a real overview. | `src/components/Board.tsx:1124`, `:1850`; `src/lib/boardGeometry.ts` |
| Selection covers cards/slides, while free text and frame membership need additional handling. | Organization must explicitly define supported item types and persistent membership. | `src/components/Board.tsx:710`, `:828`; `src/types/index.ts` |
| Canvas and outline filtering use different paths. | Search should consistently reveal the destination or explain that it is filtered. | `src/components/Board.tsx:311`, `:338`; `src/lib/boardNavigation.ts` |
| The app retains a saved port and reports an error if it is occupied. | Keep that origin stable: changing it changes the WebKit storage namespace. Any future fallback needs an explicit recovery/migration path. | `macOS/IdeaboardMac/Sources/LocalWebServer.swift:23`; `macOS/IdeaboardMac/Sources/AppDelegate.swift:43` |
| PDF import currently stores rendered page images, without extracted text. | PDF-grounded AI needs a later text-extraction/OCR step; it cannot assume searchable source text already exists. | `src/lib/pdfImport.ts` |
| Frames already persist section notes, but section meanings and geometry are embedded in the renderer; some frameworks share generic position IDs. | Create a shared semantic framework registry before AI chooses or fills sections. Preserve existing section keys in saved boards. | `src/components/FrameworkOverlay.tsx:263`; `src/hooks/useFrames.ts:226` |

Repository guidance contains older descriptions of fonts, PDF loading, and Undo. The current source and approved Marker Workshop specification are the evidence used here.

## 3. The Proposed Experience

### Board Assistant: Use the App to Do the Work

The assistant can carry out a multi-step board task through supported app operations. It must understand the purpose of each framework and write relevant content inside its actual editable sections, not merely paste a generic response onto the canvas.

Primary commands:

- Build board: describe an objective and optionally attach or select source notes. The assistant chooses a suitable starting framework, briefly explains its choice, creates it, fills its sections with relevant draft notes, adds supporting cards, arranges everything, and brings the result into view. The user can also name the desired framework directly.
- Fill this framework: use the goal and selected sources to populate the chosen frame. Fill empty sections and create related draft cards automatically. For occupied sections, offer append or a reviewed replacement rather than discarding existing writing.
- Expand this section: write more detailed notes or practical actions for a particular area, keeping the larger board goal in context.
- Use another framework: apply a different reasoning structure to the same sources, creating a separate frame with its own relevant notes. Keep the original frame available for comparison.
- Update this board: respond to additional information, identify affected notes/sections, and present existing-content revisions together. Do not repeatedly regenerate unaffected content.

The assistant selects frameworks appropriate to the task rather than adding every framework to every board. Missing facts become explicit questions or labelled assumptions. Brainstormed ideas and proposed targets are draft suggestions; they are not presented as research findings or agreed commitments.

Example request: "Help me plan a cafe campaign. Use STP to define the audience, 4P to work out the offer, and AIDA to draft the campaign messages. Write the notes and turn the useful ideas into action cards."

Expected result: three usable frames, distinct notes in the relevant sections, draft messaging and next-step cards, and a readable layout. The user can edit everything through the ordinary app controls.

### Framework Coverage

Create one typed registry shared by the frame UI, the assistant, layout, and validation. Each definition includes the existing type ID and label, when it is useful, semantic section labels and stable IDs, section-specific drafting guidance, source requirements, and layout bounds.

All existing named frameworks are in scope:

| Purpose | Framework IDs from the current app |
| --- | --- |
| Planning and execution | `eisenhower`, `ooda`, `smart-goals`, `okr`, `personal-kanban`, `gtd`, `eat-that-frog`, `impact-effort` |
| Reflection and understanding | `ikigai`, `wheel-of-life`, `grow`, `start-stop-continue`, `five-whys`, `daily-reflection`, `energy-audit` |
| Marketing | `stp`, `marketing-mix`, `aida`, `swot`, `customer-journey` |
| Idea development and comparison | `first-principles`, `six-thinking-hats`, `scamper`, `pros-cons` |

The current `blank` type is converted to an Eisenhower frame by creation helpers; it is not a functioning neutral container. Define true blank/group-container behavior separately before exposing it as an AI action.

Meaning matters more than generic section filling. SWOT distinguishes internal strengths/weaknesses from external opportunities/threats. SMART and OKR distinguish proposed targets from established dates and metrics. Kanban never marks a proposed task Done. Five Whys labels unsupported causal chains as hypotheses. Personal reflection frameworks use supplied experiences rather than inventing the user's feelings or life ratings.

For frameworks with shared positional section IDs, add semantic aliases without breaking historical `noteAreas` keys. The Wheel of Life diagram has more named life areas than its current generic note overlays; resolve that mismatch in the registry/renderer rather than claiming complete area-specific filling already works. Every framework needs its own coverage check.

### App Capability Coverage

Expose existing features through a small, typed capability layer. Each action has validated inputs, a predictable effect, and an outcome the assistant can inspect before its next step.

| App feature | Assistant capability | Interaction rule |
| --- | --- | --- |
| Boards, templates, and categories | Read the authorized workspace, create/name a board, start from a template, categorize on request | New task content is created automatically; moving existing boards between categories is explicit |
| Frameworks | List, choose, create, rename, size, populate sections, expand notes, and compare frameworks | Preserve existing section text unless the requested change is additive or a replacement is accepted |
| Cards and text blocks | Create related notes, summarize, rewrite, duplicate, and format | Reuse native item types; compare replacements and retain source links |
| Status, colors, dates, and locks | Apply meaningful presentation/status and user-specified dates; respect locked items | Do not infer completed work or factual deadlines; unlocking requires an explicit user action |
| Selection and layout | Select related items, group, align, space, move, resize, and fit the result | Layout is app-computed; existing-item rearrangements have a preview |
| Search and navigation | Find source notes, focus a section, and locate related items | Scope is visible; a current-board task does not silently read every board |
| PDFs and slides | Use user-selected files/pages as sources and arrange notes beside them | Native file selection stays user-controlled; text extraction/OCR or image input is required for content understanding |
| Import, export, Undo, and Redo | Prepare existing supported exports, import a user-selected file, recover the task | Save dialogs choose destinations; destructive imports need review; a task has persistent recovery |
| Theme and view controls | Switch theme or change zoom/view on request | Preserve user preferences during ordinary board generation |

"Use all features" means broad supported capability, with a capability inventory checked against the app's real actions. It does not mean every feature is used on every task. Future UI features must be explicitly added to the inventory before claiming assistant support.

### Capture

- The existing Note action opens a compact entry area with title and body. Status, color, and date are optional details.
- A blank-canvas double-click or New Note action places the result at the intended location. Repeated capture stays open for the next thought.
- Pasting a long list offers a preview: keep it as one note or split it into separate ideas. The user can edit the proposed titles and deselect unwanted notes.
- New notes appear in free space within view, with predictable spacing rather than piling onto the same point.

### Write

- Selecting a note exposes an explicit Edit action. Editing opens a right-side writing panel at readable text size regardless of canvas zoom.
- Offer familiar bold, italic, heading, list, checkbox, and link controls while preserving existing Markdown. Use an established editor if rich editing requires one; verify round trips before choosing it.
- Expand the panel into a focused writing view for longer notes. Closing it restores the same selection and canvas position.
- Keep Search, Write, and AI in one panel location, with one active panel at a time. At narrow widths, use a sheet/focus view so controls and note text fit.
- Save a local draft while typing. Show Saved only after persistence succeeds; preserve the draft and offer Retry on failure. A reopened draft must not silently replace a newer note version.

### Write with AI

Start with four concrete actions:

| Action | User input | Reviewed output |
| --- | --- | --- |
| Turn into notes | Rough text, bullets, or a pasted transcript | One structured note or several editable note drafts |
| Make clearer | A note or selected passage | A clearer draft that keeps the user's meaning and voice |
| Summarize | Selected notes | A short summary linked to the source notes |
| Find next steps | Selected notes | Proposed action notes; missing owners/dates remain unspecified |

Allow a short custom instruction, such as "Keep it casual" or "Separate decisions from open questions." Avoid sending a request on every keystroke.

Each request displays its scope, for example `3 selected notes` or `This frame and its notes`. Whole-board context is an explicit choice. Writing tools offer Replace, Insert, Add as note, or Discard where applicable. Build board and Fill empty sections create new draft content as part of the user's command, without repeated per-note approval. Original and suggested content are distinguishable before an existing passage is replaced.

During generation, provide progress and Stop while the user can continue working. Cancelling keeps the original and any usable draft. Missing credentials, offline mode, provider errors, and rate limits retain the input and offer an appropriate next action without repeating paid requests automatically.

### Organize

- A selection toolbar offers Align, Space evenly, Group in frame, and Organize with AI.
- AI proposes editable theme names and identifies which existing notes belong to each theme. It does not generate canvas coordinates.
- Ideaboard computes a deterministic layout from real item bounds, available space, locked items, and existing frames.
- Preview the proposed frame names, memberships, and positions before Apply. Let the user rename themes and move notes between them.
- Show possible duplicates for review. Merging requires choosing content to keep; original notes remain recoverable. Never automatically delete a note as a duplicate.
- Keep topic/theme labels separate from the existing workflow status values such as Idea, Planned, and Done.
- Store frame membership explicitly so moving an accepted group later moves its members together. Ungrouping preserves notes.

### Revisit

- Search results include a useful content snippet and open directly in the writing view or visibly locate the item on the canvas.
- A later Ask my notes action answers questions such as "What did we decide?" with clickable source-note links. If the notes do not answer, it says so.
- A review view gathers unfinished next steps and unresolved questions. Completed notes stay out of action review unless requested.
- Start with keyword search and explicit board scope. Evaluate semantic retrieval only when realistic examples show that existing search misses useful matches.

## 4. Canvas Interaction Contract

Preserve the expressive cards and accents, and reduce friction through consistent interaction:

- Add explicit Select and Hand tools. Dragging empty space with Select draws a selection; Hand pans. Space temporarily pans while the user is outside a text field. Keep existing shortcuts available during the transition.
- On the Mac trackpad, two-finger scrolling pans; pinch or modifier-wheel zooms around the pointer. Scrolling inside the editor scrolls the note. Verify this behavior in WKWebView rather than assuming browser behavior transfers.
- Include text blocks in selection and collective movement. Clearly show which locked items are excluded from rearrangement. Make snapping a visible toggle.
- Provide Fit board, Fit selection, and a real clickable minimap that includes cards, text, frames, and slides. Use measured item bounds, including tall notes.
- Persist each board's viewport and last selected note. Returning to a board resumes where the user left it.
- Use a contextual toolbar for selection actions. Keep frequent capture, search, and view controls easy to reach; put occasional import/export actions in a menu.
- Use compact card previews at distant zoom levels and readable note content in the writing view. Avoid rendering long text at an unusably small size.
- Keep focus visible and restore it after a panel closes. Support keyboard selection/movement as well as pointer input. Use existing Lucide icons, tooltips, reduced motion, and both themes.

## 5. AI and Data Architecture Recommendation

### Provider

For the first Mac release, recommend one cloud provider using the user's own API key, entered through native settings and stored in macOS Keychain. Benchmark a currently available model on the actual note tasks before choosing the default; do not hard-code an assumed model or price in this plan.

Cloud inference requires an internet connection and sends the explicitly selected content to that provider. If keeping all note processing on this Mac is a binding requirement, use a local model instead and assess its speed and quality on this machine first. Ollama is a later optional provider, with local models and cloud features disabled for a local-only configuration. It adds a model download and runtime dependency, which the current basic Mac app does not require.

### Native connection

Add a small native AI service and a narrowly scoped WebKit message bridge:

`Goal and authorized context -> Native AI service -> Typed app actions -> Validated app executor -> Updated board`

- Use native networking for provider calls. Keep the key out of React, localStorage, exports, source control, logs, and the bundled JavaScript.
- Accept requests only from the app's exact local origin and main frame. Validate operation names, request IDs, sizes, and cancellation; return typed results safely rather than interpolating model content into executable JavaScript.
- Configure credentials in a native settings sheet. The web interface receives only availability/error status.
- Treat supplied notes as source material, not executable instructions. The assistant can request only explicitly registered Ideaboard operations; it has no arbitrary filesystem, shell, or network tools.
- Bound input/output size and task steps, expose provider/model settings, show usage when available, and support cancellation. Model text is not executable code; the validated app executor owns writes.
- For the browser/Windows version, continue normal note taking. A future cloud-AI browser release needs a separate authenticated server integration; do not reuse a secret embedded in the browser build.

### Suggestions and application

Use validated structured actions for board tasks: operation type, target board/frame/section IDs, source-note IDs, draft content, and suggested memberships. Schema conformance is only one check; the app must also verify source IDs, board ownership, current item versions, registry section IDs, supported statuses, and safe content.

Implement a bounded multi-step task controller: inspect authorized context, choose a framework, draft section notes, create related items, arrange, and verify the resulting state. Return actual IDs and operation outcomes to the model so later steps refer to real items. Request IDs make retries idempotent; cancelled or stale jobs cannot modify a different active board.

Default authority is additive: the user's Build/Fill command permits automatic creation of new draft items and filling empty sections. Replacing existing notes, deleting/merging originals, and reorganizing existing layouts require the relevant review. Keep that review at the meaningful task level rather than requesting approval for each generated sentence.

Stream progress reflecting actual actions, such as Choosing framework, Writing section notes, and Arranging board. Newly generated content is visibly drafted and editable. A stopped or failed task keeps original content intact and provides a clear partial-result/retry or discard path. Commit a completed multi-item task through the operation coordinator, with one task-level Undo and a recoverable journal.

Generate new IDs in Ideaboard. Treat links and Markdown/HTML as untrusted and pass them through the existing sanitization boundary. Keep source references and an AI-assisted indicator on accepted drafts. Missing facts, dates, owners, and decisions are not filled in as established facts.

If a note changes while AI runs, show a stale-result notice and offer to generate again or insert as a separate note. Never overwrite the newer text silently.

### Persistence and recovery

Reuse current card/text/frame stores and stable IDs initially. Make additive metadata optional so older boards and imports still open. Do not build a second independent notes database.

Introduce one board-operation coordinator for accepted rewrites and arrangements. A logical operation includes affected content, memberships, and positions; Undo/Redo saves the resulting state. Keep history scoped to its board and avoid sending typing Undo to the board history while an editor has focus.

Single-store updates write once per operation. Before operations spanning multiple localStorage keys ship, add a durable before/after journal with idempotent apply, rollback, and startup recovery. Cross-store writes are not inherently atomic. Test interruption at each write boundary. If this proves insufficient, propose a versioned IndexedDB transaction migration separately, using backups and record-count/ID checks.

Add versioned automatic recovery snapshots through the native app, using the existing workspace export as the starting payload. Proposed location: `~/Library/Application Support/Ideaboard/Backups`. This folder is a planned feature, not an existing backup location. Include slide images and new metadata; exclude credentials and transient AI input. Define retention and restore UX before implementation.

## 6. Delivery Order and Checkpoints

Each phase is a separately reviewable change. The first release includes a complete framework-building task through Phase 3, with the shared registry covering every named framework. General rewrites alone do not satisfy the clarified goal.

| Phase | Deliverable | Completion checkpoint |
| --- | --- | --- |
| 1. Safe capture and comfortable writing | Persistent Undo, protected drafts/save failures, quick capture, writing panel, accurate Fit board, board-view restoration | Write a long note, reopen the app, undo a change, reopen again, and find the expected content and position. Existing boards and backups still work. |
| 2. Framework-aware AI foundation | Shared registry for every named framework, native settings/Keychain/bridge, typed app actions, writing tools, section-aware drafting | Choose or specify each framework, validate every section ID, write relevant draft content, and preserve populated sections. Provider failures retain input. |
| 3. Build and organize a complete board | Bounded Board Assistant task controller, automatic draft creation, frame filling, supporting notes, capability inventory, mixed selection/layout, minimap, Mac gestures | One goal produces a usable framework and related notes without per-item approval. Verify multi-framework tasks, cancel/retry, locked items, Undo, and reopen. |
| 4. Find and review knowledge | Consistent search, source-linked board answers, next-step review | Every answer link resolves to the right note; unsupported questions do not invent answers; completed work is excluded from action review. |
| 5. Additional sources/providers | Complete PDF content understanding through extraction/OCR or explicit image input, plus optional local-only AI, voice capture, or semantic search | PDF claims resolve to the selected source page; any remaining unsupported capability is named. Each provider/input has setup, accuracy, and recovery checks. |

Likely code boundaries:

- `Board.tsx`: canvas coordination, selection context, panel state, and viewport; extract new panel/navigation components where they remove actual complexity.
- `CardModal.tsx`, `IdeaCard.tsx`, `TextBlockItem.tsx`: quick capture, writing actions, and consistent editing behavior.
- `useBoard.ts`, `useFrames.ts`, `useTextBlocks.ts`, `db.ts`: persistent operations and recovery; reuse these ownership boundaries.
- `types/index.ts`, `workspaceBackup.ts`, import/export helpers: optional source/membership metadata and backward compatibility.
- Proposed `frameworkRegistry`, shared with `FrameworkOverlay.tsx` and `useFrames.ts`: framework semantics, section IDs, drafting rules, and note-area layout; preserve historical keys.
- Proposed `NoteEditor`, `AIAssistPanel`, `useAIAssist`, typed `BoardCapabilities`, task controller, and pure suggestion/layout validators: isolate agent behavior from the canvas coordinator.
- Proposed native `AIService` and `KeychainStore`, registered by `AppDelegate.swift`: credentials and provider networking. Do not turn the static asset server into a public AI proxy.

## 7. Acceptance Criteria and Planned Verification

These are future checks, not evidence that the features already work.

1. Capture and writing: consecutive notes can be entered quickly; a long formatted note and links survive reopening; failed saves preserve drafts. Verify focused UI flows and restart the installed app.
2. AI authorship: names, numbers, qualifiers, and uncertainty remain faithful to source notes; invented owners/dates are absent. Evaluate a small fixture set with messy bullets, ambiguous tasks, conflicting notes, duplicates, a long note, and unsupported questions.
3. Task authority and review: a Build board command creates new draft items without per-item approval, while existing-note replacement requires review; stale results do not overwrite newer edits. Verify cancellation, discard, version conflict, task retry, and double-clicking Apply.
4. Undo and batch safety: an accepted rewrite or grouping is one undoable action; Undo is persistent; a partial failure or interruption recovers the complete previous state. Add focused operation/recovery tests.
5. Layout: mixed-size selected items do not overlap after an approved arrangement; locked items are preserved; Fit handles text-only and slide-only boards. Extend geometry/selection tests and inspect rendered output.
6. Sources and compatibility: links resolve, source metadata survives export/import, and historical backups remain readable. Extend relevant import/export tests.
7. Credentials and scope: no key appears in a backup or web storage; untrusted frames/origins cannot invoke the native service; only selected context is sent. Verify native integration with a test provider before a consented real request.
8. Mac UX: trackpad gestures, editor scrolling, keyboard Undo/Redo, focus, light/dark themes, and narrow windows work in the installed app. Inspect screenshots and exercise the main workflows in WKWebView.
9. Framework coverage: every named framework has a registry entry and compatible writable sections. Verify the registry against the actual frame picker, renderer, saved note-area keys, and legacy imports; test semantic section mappings as well as schema validation.
10. Framework-specific quality: SWOT entries belong in the right categories, SMART/OKR suggestions distinguish proposed targets, Five Whys flags unsupported causes, and personal reflection does not invent lived experience. Evaluate representative drafts for every framework and inspect whether text fits each rendered section.
11. Complete board task: a goal creates a suitable frame with substantive related section notes and supporting cards, or gives a concrete missing-input reason. A requested STP -> 4P -> AIDA sequence creates distinct connected content and does not duplicate one generic note across frames. Verify a real provider task after setup, plus persistence/export/import.
12. Feature-use coverage: compare the registered app actions to the capability inventory. Exercise board/template creation, frame selection/filling, card/text creation, status/date handling, search, layout, chosen-file import, requested export, and recovery. Report unsupported actions explicitly rather than presenting them as working.

Use the project's actual commands: `npm run build` for TypeScript/bundling, `npx vitest run <affected test files>` for targeted behavior, and `npm run lint` scoped appropriately when editing code. Rebuild through the Xcode installer after native changes. Provider calls and runtime success must be verified separately from mocks or source inspection.

## 8. Example of the Intended Result

Input: "Cafe weekend promo. Try strawberry drink. Jess can make a reel. Counter sign? Need stock check. Don't discount main drink."

The user asks Build a campaign board using 4P and AIDA. Ideaboard creates the frames, drafts offer/channel notes in Product, Price, Place, and Promotion, then writes related campaign-message drafts in Attention, Interest, Desire, and Action. It adds notes for the campaign goal, reel idea, counter-sign question, and stock check beside the appropriate sections. The price suggestion respects the stated no-discount constraint; Jess is attached only to the reel; unspecified dates stay empty. Assumed audience details remain labelled as assumptions. The layout makes section notes readable and keeps supporting cards accessible. The user can refine one section without rebuilding the whole board.

Later, "What still needs deciding?" points to the counter-sign note rather than turning it into an agreed action.

## 9. Decisions to Settle Before Implementation

- First notes to optimize for: brainstorm/project notes, meeting notes, or research notes. Default proposed here: brainstorm/project notes.
- AI location: cloud using a personal API key, or local-only. The plan recommends cloud for the first integration unless privacy requires local-only; no speed/quality comparison has been run on this Mac.
- Automatic snapshot retention and restore interaction: decide a reasonable product default while implementing Phase 1; do not expose technical storage internals in ordinary writing flows.

Confirmed scope from the follow-up: the assistant must use the app's available features and frameworks to write related notes itself. The plan therefore includes goal-based tool execution and automatic creation of new draft content; it is not limited to text suggestions or manual copy/paste.

## 10. Evidence and Sources

Planning evidence: inspected current source, the approved Marker Workshop design specification, README, package scripts, and committed workspace/dashboard screenshots. The canvas reviewer completed a bounded read-only assessment. The separate native/AI reviewer hit a usage limit; that assessment was completed in the main task. No runtime, model-quality benchmark, or tests were run for this documentation-only plan.

Follow-up assessment: inspected all current frame type definitions, editable note-area mappings, frame persistence helpers, and board frame callbacks. The expanded tool-capability and framework contracts are proposed work, not existing AI functionality.

Provider references checked while planning:

- [OpenAI API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety): provider secrets must not be shipped in browser code. The proposed native Keychain approach is for the user's own desktop credential; a distributed shared credential needs a server.
- [Apple Keychain services](https://developer.apple.com/documentation/security/keychain-services): native credential-storage facility.
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): schema-constrained provider responses; app-level factual and operation validation remain necessary.
- [Ollama FAQ](https://docs.ollama.com/faq): local model behavior and disabling cloud features. This establishes a possible local-only option, not tested performance on this Mac.
