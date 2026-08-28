# Ideaboard Marker Workshop UX and UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Ideaboard's dashboard, board shell, cards, templates, and supporting states into the approved Marker Workshop experience while preserving current local persistence and canvas behavior.

**Architecture:** Keep the existing React/Vite application, `App.tsx` route state, component ownership, template payload builder, and local storage database. Add a small shared CSS layer and expand the existing design token module, then make focused component changes around the current handlers and data boundaries. Do not replace the canvas model, persistence layer, or local authentication behavior.

**Tech Stack:** React 18, TypeScript, Vite, inline React styles where already established, shared CSS tokens, `lucide-react`, Vitest, ESLint.

## Global Constraints

- Preserve existing board and card data shape and local persistence.
- Preserve canvas pan, zoom, selection, editing, locking, collapsing, importing, exporting, and dark mode behavior.
- Preserve existing template IDs: `weekly-plan`, `project-brainstorm`, `content-calendar`, and `decision-matrix`.
- Use Marker Workshop roles: ink `#172038`, purple `#6957FF`, yellow `#FFDA45`, mint `#60DCBD`, coral `#FF8E8E`, canvas `#F7F7F2`, surface `#FFFFFF`.
- Use 1.5px to 2px ink borders, 6px to 10px radii, short shadows, and slight rotation only on idea cards.
- Use `lucide-react` icons for interface actions, with accessible names and tooltips.
- Keep motion limited to add, select, connect, and save feedback, and respect reduced-motion settings.
- Do not add a backend, AI provider, prompt execution, data transmission, or model integration.
- Do not add a broad component library for visual polish.
- Do not use decorative color, animation, or emoji in ways that obscure board content.
- Do not create or modify tests for styling-only changes. Extend the existing board-template test because template identity and seeded content are behavioral requirements.

---

## File Map

Create:

- `src/styles/markerWorkshop.css`: shared visual tokens, global focus and motion rules, and responsive classes for the redesigned surfaces.
- `src/components/TemplatePreview.tsx`: small visual previews for the four starter templates in the new-board flow.

Modify:

- `src/lib/designTokens.ts`: expose the Marker Workshop color, type, radius, border, and shadow values used by React styles.
- `src/main.tsx`: load the shared style layer and align global font, focus, and motion behavior.
- `src/components/HomeScreen.tsx`: redesign the dashboard, new-board flow, error states, action icons, and template presentation.
- `src/components/BoardThumbnail.tsx`: show compact, data-derived board previews instead of a generic card stack.
- `src/components/IdeaCard.tsx`: apply the card visual system, accessible icon controls, and non-emoji tag presentation without changing card handlers.
- `src/components/CardModal.tsx`: apply the same visual system to card creation and editing while preserving form fields and save behavior.
- `src/components/Board.tsx`: update the board shell, toolbar hierarchy, quick-add dock, empty state, and responsive classes while preserving existing canvas callbacks.
- `src/components/AuthScreen.tsx`: align authentication and local loading copy with the approved tone and remove the old gradient treatment.
- `src/App.tsx`: align the startup loading state with the shared visual system and keep route/auth behavior unchanged.
- `src/lib/boardTemplates.ts`: retain or refine seeded content so each template has a visibly different workflow and the AI example is honest and static.
- `src/lib/boardTemplates.test.ts`: assert the distinct template frames and representative workflow content.

Read-only reference:

- `README.md`: confirm the existing AI work example remains consistent with the final static workflow language. Only edit it if the UI copy changes the documented wording materially.

---

### Task 1: Establish the Marker Workshop visual foundation

**Files:**
- Create: `src/styles/markerWorkshop.css`
- Modify: `src/lib/designTokens.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces `colors.markerInk`, `colors.markerPurple`, `colors.markerYellow`, `colors.markerMint`, `colors.markerCoral`, `colors.markerCanvas`, `colors.markerSurface`, plus `radii.card`, `radii.control`, `radii.panel`, `shadows.card`, and `shadows.control` for components to consume.
- Produces the `.ib-*` CSS classes and `@media (prefers-reduced-motion: reduce)` rules consumed by the dashboard, board shell, cards, and dialogs.

- [ ] **Step 1: Add the shared token values**

Update `src/lib/designTokens.ts` so the existing exports keep working and include the exact roles from the spec:

```ts
export const colors = {
  primary: '#6957FF',
  ink: '#172038',
  inkDark: '#10172A',
  markerPurple: '#6957FF',
  markerYellow: '#FFDA45',
  markerMint: '#60DCBD',
  markerCoral: '#FF8E8E',
  markerCyan: '#8FD7FF',
  canvasLight: '#F7F7F2',
  canvasDark: '#10182A',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#18233A',
  borderLight: '#D9DBE2',
  borderDark: '#30405E',
  sidebar: '#10172A',
} as const

export const radii = {
  card: 8,
  control: 7,
  panel: 10,
} as const

export const shadows = {
  card: '3px 4px 0 rgba(23, 32, 56, 0.16)',
  control: '2px 2px 0 #172038',
} as const
```

Keep `fonts.ui` and `fonts.display` as the source for component styles. Use the loaded `DM Sans` and `Syne` families so the runtime does not reference an unloaded font.

- [ ] **Step 2: Add the shared CSS layer**

Create `src/styles/markerWorkshop.css` with root variables that mirror the token roles, visible `:focus-visible` outlines, stable button/input defaults, the board canvas dot grid, and responsive helpers. Include this reduced-motion rule:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Use classes with one responsibility, including `.ib-page`, `.ib-topbar`, `.ib-action`, `.ib-icon-button`, `.ib-board-shell`, `.ib-board-rail`, `.ib-quick-add`, `.ib-dialog-backdrop`, and `.ib-sr-only`. Keep selectors scoped under `.ib-*` so existing canvas overlays are not accidentally restyled.

- [ ] **Step 3: Load the CSS without changing route behavior**

Import `./styles/markerWorkshop.css` in `src/main.tsx`. Keep the existing Google font injection, but update it to load `Syne` weights 600, 700, and 800 plus `DM Sans` weights 400, 500, and 700. Leave the existing React root and authentication routing intact.

- [ ] **Step 4: Check the foundation**

Run:

```bash
npm run build
```

Expected: the TypeScript build and Vite production build pass before any component styling changes are made.

- [ ] **Step 5: Commit the foundation**

```bash
git add src/styles/markerWorkshop.css src/lib/designTokens.ts src/main.tsx
git commit -m "style: add marker workshop design tokens"
```

### Task 2: Rebuild the dashboard and template entry point

**Files:**
- Create: `src/components/TemplatePreview.tsx`
- Modify: `src/components/HomeScreen.tsx`
- Modify: `src/components/BoardThumbnail.tsx`

**Interfaces:**
- `TemplatePreview` accepts `{ templateId: BoardTemplateId; selected: boolean; dark: boolean; onSelect: () => void }` and renders a button-sized preview with a distinct arrangement for each template.
- `BoardThumbnail` continues to accept `{ cards: Card[]; dark: boolean }` and derives its mini arrangement from actual card count, tag colors, and card titles. It does not invent a template ID that is not persisted.
- `HomeScreen` continues to call `onOpenBoard`, `onSignOut`, `onToggleDark`, and the existing `db` helpers with the same argument types.

- [ ] **Step 1: Build distinct starter previews**

Create `TemplatePreview.tsx` using a real `<button>` with `aria-pressed={selected}` and a `title`/visible name. Render these arrangements:

```ts
const layoutByTemplate: Record<BoardTemplateId, string> = {
  'weekly-plan': 'lanes',
  'project-brainstorm': 'cluster',
  'content-calendar': 'calendar',
  'decision-matrix': 'matrix',
}
```

Use CSS classes for the four arrangements. Keep the preview content short, high contrast, and different in both geometry and color. The card click must call only `onSelect`.

- [ ] **Step 2: Replace the dashboard shell**

In `HomeScreen.tsx`, use `.ib-page` and `.ib-topbar` for the page shell. Replace the old purple gradient logo, emoji theme control, emoji rename control, and emoji delete control with the shared logo mark and `lucide-react` icons (`Sun`, `Moon`, `Pencil`, `Trash2`, `Plus`, `FolderPlus`, `LogOut`). Add `aria-label` and `title` to every icon-only control.

Use this information hierarchy:

```tsx
<h1>Good to see you, {displayName}.</h1>
<p>Pick up an idea or start with a fresh board.</p>
<button>New board</button>
```

Keep group management available, but subordinate it to the main board action. Keep board cards clickable and preserve rename, delete, group chips, drag reorder, and open-board behavior.

- [ ] **Step 3: Make the new-board flow inviting and explicit**

Replace the current template text buttons with `TemplatePreview` instances. Keep the existing `newName`, `selectedTemplateId`, and `createBoard` state flow. When a template is selected and the name is empty, continue prefilling the template name. The selected preview must expose `aria-pressed` and a visible selected border.

Use the copy `Choose a shape to get started` above the previews. Keep keyboard behavior: Enter creates and Escape closes. Disable the create action when both the name and template selection are empty, and keep focus on the name field when creation starts.

- [ ] **Step 4: Add explicit load and create failure states**

Wrap the initial `Promise.all` and `createBoard` operations in `try/catch`. Add `loadError` and `createError` state. Render:

```tsx
{loadError && (
  <div role="alert" className="ib-error-state">
    <strong>We could not load your boards.</strong>
    <button onClick={loadBoards}>Try again</button>
  </div>
)}
```

On a creation failure, keep the entered name and selected template, show `We could not create that board yet. Try again.` near the create action, and do not add a partial board to local state.

- [ ] **Step 5: Make existing board thumbnails data-derived**

Update `BoardThumbnail.tsx` to use `colors`, `radii`, and `shadows`. Render up to three actual cards with title snippets, tag-role colors, and deterministic positions based on index. For zero cards, show a dashed outline with `Start with an idea` as accessible text. Do not use the same centered card stack for every board.

- [ ] **Step 6: Check the dashboard**

Run:

```bash
npm run build
```

Expected: the dashboard compiles with no unused icon imports or type errors. Styling-only changes do not require a new test file.

- [ ] **Step 7: Commit the dashboard**

```bash
git add src/components/TemplatePreview.tsx src/components/HomeScreen.tsx src/components/BoardThumbnail.tsx
git commit -m "feat: refresh ideaboard dashboard flow"
```

### Task 3: Refresh cards and the card editor

**Files:**
- Modify: `src/components/IdeaCard.tsx`
- Modify: `src/components/CardModal.tsx`

**Interfaces:**
- Preserve every existing callback in `IdeaCardProps` and `CardModalProps`.
- Preserve tag keys, card colors, markdown sanitization, due-date calculations, inline title editing, and modal save payload shape.
- Consume shared tokens and `lucide-react` icons without changing the database contract.

- [ ] **Step 1: Replace emoji tag labels with readable marker labels**

Update `TAG_META` and `TAG_OPTS` to use plain labels such as `Idea`, `Critical`, `Planned`, `Delegate`, `Remove`, and `Done`, with a small colored dot or icon for meaning. Use the Marker Workshop roles consistently: yellow for planned, coral for critical/action-needed, mint for done, purple or cyan for idea/delegate, and a neutral ink treatment for remove.

- [ ] **Step 2: Apply the card geometry**

Use `radii.card`, `shadows.card`, `colors.ink`, and the existing card background value. Keep `left`, `top`, `width`, `height`, `rotation`, `zIndex`, drag handlers, and resize handlers unchanged. Use a 2px ink border for normal cards and preserve red or amber due-date borders as the semantic override.

- [ ] **Step 3: Replace hand-drawn control SVGs with icons**

Import `ChevronDown`, `ChevronRight`, `Lock`, `LockOpen`, `Copy`, `Trash2`, `CalendarDays`, `AlertTriangle`, and `Clock3` from `lucide-react`. Keep the existing buttons and callbacks, but replace their SVG or text glyph content with the icons. Add `aria-label` values that match the existing `title` values. Keep the controls inside `.no-drag` so card movement remains unchanged.

- [ ] **Step 4: Restyle the card modal without changing its form contract**

Use a 2px ink border, a 10px panel radius, a short control shadow, and `.ib-dialog-backdrop`. Keep the existing fields, template insertion behavior, `handleSave` validation, Escape handling, and `onSave` payload. Replace text glyph close actions with `X` and use color swatches with `aria-label`, `aria-pressed`, and visible focus states.

- [ ] **Step 5: Keep the first-card action focused**

When `CardModal` opens for a new card, continue focusing the title input. Keep the title error message adjacent to the title field and add `aria-invalid` when `titleErr` is true. Do not add a new required field or change the markdown behavior.

- [ ] **Step 6: Check the card surface**

Run:

```bash
npm run build
```

Expected: card and modal code compiles with no changed callback signatures.

- [ ] **Step 7: Commit the card surface**

```bash
git add src/components/IdeaCard.tsx src/components/CardModal.tsx
git commit -m "style: bring cards into marker workshop"
```

### Task 4: Rework the board workspace shell

**Files:**
- Modify: `src/components/Board.tsx`
- Modify: `src/styles/markerWorkshop.css`

**Interfaces:**
- Preserve all existing Board state, hooks, canvas coordinate calculations, handlers, overlays, import/export functions, keyboard shortcuts, and local storage keys.
- Keep existing action semantics: back, add card, add text, create frame, search, import, export, undo/redo, theme, help, zoom, and minimap.
- Add only presentational classes and accessible labels around the existing behavior.

- [ ] **Step 1: Mark the board shell and canvas regions**

Add `.ib-board-shell` to the top-level board workspace, `.ib-board-header` to the board header, `.ib-board-rail` to the compact tool rail, `.ib-board-canvas` to the canvas wrapper, and `.ib-quick-add` to the bottom quick-add dock. Keep coordinate-bearing elements inside the same positioned container so card placement does not move.

- [ ] **Step 2: Consolidate the primary board actions**

Use `ArrowLeft`, `Type`, `SquarePlus`, `Workflow`, `Search`, `FolderInput`, `Download`, `Undo2`, `Redo2`, `Sun`, `Moon`, `CircleHelp`, `ZoomIn`, `ZoomOut`, and `Maximize2` from `lucide-react` where matching controls already exist. Each icon-only button must have an `aria-label` and `title`. Keep the board name and saved status visible in the header.

- [ ] **Step 3: Add the quick-add dock**

Place three common actions at the bottom center of the board: `Note`, `Text`, and `Frame`. The first action calls the existing add-card handler and should focus the new card title through the existing modal or inline flow. The other actions call the existing text and frame handlers. Keep the dock fixed to the board viewport, not to a canvas coordinate.

- [ ] **Step 4: Add the empty-board prompt**

When the board has no cards, render a non-blocking prompt inside the canvas:

```tsx
<div className="ib-empty-board" role="status">
  <strong>What are we trying to solve?</strong>
  <span>Start with one thought. You can shape it later.</span>
  <button onClick={handleAddCard}>Add your first idea</button>
</div>
```

Use the existing add-card callback used by the toolbar. Do not show this prompt once a card exists.

- [ ] **Step 5: Add responsive board behavior**

In `markerWorkshop.css`, keep the desktop rail compact and collapse it to a bottom action group below 720px. Keep back, add, search, theme, and help discoverable. Let the canvas remain horizontally pannable rather than shrinking cards below their readable width. Prevent the header and quick-add dock from overlapping each other.

- [ ] **Step 6: Preserve help and overlay behavior**

Restyle existing find, framework, import/export, bulk-delete, slide, toast, shortcut, and minimap surfaces to use the shared ink, surface, border, and focus rules. Do not change their open/close handlers, keyboard shortcuts, or data behavior.

- [ ] **Step 7: Check board behavior**

Run:

```bash
npm run build
npm run lint
```

Expected: build and lint pass. Manual verification must confirm that cards still drag, resize, edit, lock, collapse, duplicate, delete, and save.

- [ ] **Step 8: Commit the board shell**

```bash
git add src/components/Board.tsx src/styles/markerWorkshop.css
git commit -m "feat: refine ideaboard workspace controls"
```

### Task 5: Align authentication and startup states

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AuthScreen.tsx`

**Interfaces:**
- Preserve `useAuth`, `signIn`, `signUp`, `signOut`, `useTheme`, and all component prop types.
- Keep authentication local-only and do not change the user data or sign-in behavior.

- [ ] **Step 1: Restyle startup loading**

Replace the old gradient loading mark with the shared Marker Workshop logo mark. Keep the loading state centered, readable, and compatible with dark mode. Use `Loading your workspace...` as the only loading copy.

- [ ] **Step 2: Restyle the auth screen**

Use the same logo mark, ink border, marker-yellow highlight, and off-white canvas treatment. Use clear copy such as `Make room for the next good idea.` and `Your boards stay on this device.` because persistence is local. Keep sign-in and sign-up forms and error messages functional without claiming collaboration or remote syncing.

- [ ] **Step 3: Check auth routing**

Run:

```bash
npm run build
```

Expected: unauthenticated and loading branches compile, and the authenticated branch still receives the same props.

- [ ] **Step 4: Commit auth states**

```bash
git add src/App.tsx src/components/AuthScreen.tsx
git commit -m "style: humanize ideaboard entry states"
```

### Task 6: Lock in distinct template content and honest AI examples

**Files:**
- Modify: `src/lib/boardTemplates.ts`
- Modify: `src/lib/boardTemplates.test.ts`
- Read: `README.md`

**Interfaces:**
- Preserve the `BoardTemplateId` union and `buildBoardTemplatePayload` return shape.
- Preserve board-scoped IDs and local storage frame/text-block persistence.

- [ ] **Step 1: Confirm representative seeded content**

Keep or update the payload so these exact identity signals remain present:

```ts
const expectedTitles = {
  'project-brainstorm': ['Campaign Goal', 'AI Prompt', 'Next Experiment'],
  'content-calendar': ['Mon: Short Reel', 'Review Queue', 'Published Assets'],
  'decision-matrix': ['AI Research Summary', 'Decision'],
  'weekly-plan': ['Top Priority', 'Waiting On', 'Friday Review'],
} as const
```

The Project Brainstorm AI content must describe static external AI assistance, pasted suggestions, human selection, and a next experiment. It must not imply that an in-app AI call occurs.

- [ ] **Step 2: Add focused template identity tests**

Extend `src/lib/boardTemplates.test.ts` with a test that builds every template and checks its frame type and representative titles:

```ts
it('keeps each starter board visually and behaviorally distinct', () => {
  const frameTypes = BOARD_TEMPLATES.map(template =>
    buildBoardTemplatePayload({ templateId: template.id, boardId: 'board-1', createId: () => 'id' }).frames[0].type
  )

  expect(new Set(frameTypes).size).toBe(4)
  expect(buildBoardTemplatePayload({ templateId: 'project-brainstorm', boardId: 'board-1', createId: () => 'id' }).cards.map(card => card.title))
    .toEqual(expect.arrayContaining(['AI Prompt', 'Next Experiment']))
  expect(buildBoardTemplatePayload({ templateId: 'content-calendar', boardId: 'board-1', createId: () => 'id' }).cards.map(card => card.title))
    .toEqual(expect.arrayContaining(['Review Queue', 'Published Assets']))
})
```

- [ ] **Step 3: Run the focused test**

```bash
npx vitest run src/lib/boardTemplates.test.ts
```

Expected: all board-template tests pass.

- [ ] **Step 4: Reconcile README wording**

Read the existing `README.md` AI example and ensure it describes the same six-step workflow: define a goal, ask an external AI tool, paste useful output, group/edit/discard, choose the human direction, and add a next action. Do not add claims about an AI API or live collaboration.

- [ ] **Step 5: Commit template behavior**

```bash
git add src/lib/boardTemplates.ts src/lib/boardTemplates.test.ts README.md
git commit -m "test: protect distinct ideaboard templates"
```

Only include `README.md` in the commit if it was actually modified.

### Task 7: Perform final product verification

**Files:**
- No new files.
- Review all files changed by Tasks 1 through 6.

- [ ] **Step 1: Run the narrow automated checks once**

```bash
npm run build
npm run lint
npx vitest run src/lib/boardTemplates.test.ts
```

Expected: all three commands pass.

- [ ] **Step 2: Run the app and inspect the key states**

Start the existing Vite app on an available local port and inspect:

1. Loading state and auth screen.
2. First visit with no boards.
3. New-board flow with all four template previews.
4. A Project Brainstorm board with the static AI workflow example.
5. A Content Calendar board, Decision Matrix board, and Weekly Plan board.
6. Empty board prompt and quick-add dock.
7. Selected, editing, locked, collapsed, due-soon, overdue, duplicated, and deleted cards.
8. Find, import, export, frame, text, undo/redo, help, minimap, and theme controls.
9. Dark mode and a viewport narrower than 720px.

- [ ] **Step 3: Check accessibility and layout invariants**

Confirm keyboard focus is visible, every icon-only control has an accessible name, error states use `role="alert"`, selected template buttons expose `aria-pressed`, and no text overlaps a neighboring control at desktop or mobile widths. Enable reduced motion in the browser and verify the app remains usable without decorative transitions.

- [ ] **Step 4: Check local data preservation**

With an existing local board, reload the app and confirm board names, cards, positions, colors, tags, frames, text blocks, groups, imports, and exports remain available. Do not clear local storage during this check.

- [ ] **Step 5: Commit any final focused fixes**

```bash
git add src/components src/lib/designTokens.ts src/main.tsx src/styles/markerWorkshop.css
git commit -m "chore: verify marker workshop experience"
```

Use this final commit only for fixes discovered by the checks above. Do not stage unrelated user changes.

## Plan Self-Review

### Spec coverage

- Marker Workshop colors, typography, border, radius, shadow, and motion rules are covered by Task 1.
- Home hierarchy, new-board flow, recent boards, error states, and distinct previews are covered by Task 2.
- Board quick add, empty state, toolbar, saved status, overlays, responsive behavior, and preserved canvas interactions are covered by Task 4.
- Card states, tags, modal form behavior, keyboard focus, and accessible controls are covered by Task 3.
- Auth and startup copy are covered by Task 5.
- Project Brainstorm AI workflow, honest static example, and template distinction are covered by Task 6.
- Persistence, dark mode, reduced motion, keyboard access, local data preservation, build, lint, and focused tests are covered by Tasks 1 through 7.

### Placeholder scan

This plan contains no deferred implementation step. Every failure state names its message and recovery action, every new component has an interface, and every validation command has an expected result.

### Type consistency

`BoardTemplateId`, `Card`, `Board`, `IdeaCardProps`, `CardModalProps`, and the existing database helper signatures are preserved. `TemplatePreview` is the only new component interface, and its `templateId` uses the existing `BoardTemplateId` union. No task depends on a new function name that is not defined in the same task or the existing codebase.
