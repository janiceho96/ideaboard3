# Ideaboard Marker Workshop UX and UI Design

Date: 2026-08-28

Status: Approved for implementation planning

## Goal

Make Ideaboard feel like a playful creative whiteboard that helps people move from a rough thought to a useful next step. The app should feel energetic and human when ideas are being made, while staying clear enough for planning, decision-making, and repeat daily use.

The redesign focuses on the existing local-first React application. It improves the user experience around the current board, card, template, import, export, and theme capabilities without adding a new backend or pretending that an AI service is connected.

## Design Direction

Marker Workshop is the selected visual direction.

Its personality comes from bold outlines, punchy color, energetic type, small intentional movement, and friendly copy. The canvas itself remains light and spacious so the ideas stay readable.

The design uses a restrained set of roles:

- Ink: `#172038` for headings, borders, controls, and primary text.
- Purple: `#6957FF` for the main action and selected state.
- Yellow: `#FFDA45` for prompts, highlights, and priority.
- Mint: `#60DCBD` for progress, connections, and positive state.
- Coral: `#FF8E8E` for attention and action-needed state.
- Canvas: `#F7F7F2` with a very subtle dot grid.
- Surface: `#FFFFFF` for panels and cards.

Visual rules:

- Use 1.5px to 2px ink borders on primary surfaces and idea cards.
- Use 6px to 10px radii. Avoid overly soft, floating card stacks.
- Use short shadows as a physical marker-board cue, not as decoration everywhere.
- Use slight rotation only on idea cards and only when it does not affect layout or readability.
- Keep UI type compact and legible. Reserve expressive display type for board names, prompts, and selected moments.
- Use existing `lucide-react` icons for actions, with accessible labels and tooltips.
- Keep motion limited to add, select, connect, and save feedback. Respect reduced-motion settings.

## Experience Flow

The main journey is:

`Home -> choose a starting shape -> capture ideas quickly -> group or connect ideas -> choose a direction -> leave with a next step`

### Home

The home screen should answer three questions immediately:

1. Where can I continue?
2. How do I start something new?
3. Which template fits the work I am doing?

The populated state contains a short welcome, recent boards with meaningful miniature previews, and a compact template strip. The first-visit state uses an encouraging prompt and a clear start action. Recent board cards show board identity and recency without making the dashboard feel like a gallery.

The new-board flow keeps title entry and template selection close together. The template preview and description must make the difference between workflows obvious before creation.

### Board workspace

The canvas is the dominant surface. A compact icon rail provides selection, text, card, connection, and search actions. A quick-add dock provides the most common creation actions without forcing the user back to a menu.

The board header contains the board name, saved status, and existing board actions. The saved state is brief and reassuring. It should not compete with the board content.

New or empty boards show one useful prompt and a first-action affordance. Once the board has content, that prompt yields to the canvas. Adding a card should focus the title immediately; body text, color, tags, and due date remain optional.

Selecting a card makes its state obvious with a stronger outline and contextual actions. Search, frame editing, import, export, dark mode, and existing canvas navigation remain available through the current behavior, with clearer visual hierarchy and labels.

### Human touches

Copy should be concise, warm, and direct. Examples include:

- `Good to see you, Janice.`
- `Pick up an idea or start with a fresh board.`
- `Nice. That is the first spark.`
- `Your ideas stay where you put them.`

These moments are used only at useful transitions. They must not become persistent instructional text or block the user's work.

## Template Identity

Templates must be distinguishable in both their previews and their generated content.

### Project Brainstorm

Purpose: collect raw ideas, group themes, and choose a next move.

Visual identity: clustered cards connected across a loose canvas, with an explicit goal card and a next-experiment card.

AI work example: a prompt card, a small set of generated directions, human-selected ideas, and a next action. The example is static template content and must not imply that an AI request is being made.

### Content Calendar

Purpose: plan content from idea through review and publication.

Visual identity: clear date or publishing-stage groups with separate draft, review, and published content.

Content should include a first-draft use of AI followed by human review, claims checking, and CTA refinement.

### Decision Matrix

Purpose: compare options by impact, effort, risk, and confidence.

Visual identity: impact-effort positioning with supporting decision cards, rather than a generic brainstorm arrangement.

Content should make the decision rule visible and end with a chosen direction.

### Weekly Plan

Purpose: manage priorities, waiting items, blockers, and wins.

Visual identity: clear planning lanes that distinguish urgent work, in-progress work, waiting items, and review.

## Component and State Boundaries

No major architectural change is required.

- `App.tsx` continues to own authentication, theme state, active-board navigation, and initial board setup.
- `HomeScreen.tsx` owns the dashboard layout, recent-board presentation, template selection, and new-board entry point.
- `Board.tsx` remains the canvas coordinator. Its existing board loading, navigation, frame, text, import, export, and selection behavior should be preserved while the shell and controls are visually simplified.
- `IdeaCard.tsx` owns card presentation and card-level actions. It should receive the visual language through shared tokens and expose clear selected, locked, collapsed, and editing states.
- `BoardThumbnail.tsx` should render compact previews from the board's actual cards, frame type, or template identity rather than repeating a generic stack.
- `boardTemplates.ts` remains the source of template names, descriptions, and initial board content. Template payload generation should continue to use the existing types and local database functions.
- `designTokens.ts` should become the source for the Marker Workshop color roles, typography, radii, borders, and shadows used by the redesigned surfaces.
- `lucide-react` should replace hand-drawn action icons where an equivalent exists. Existing domain-specific visuals can remain if they are not being used as interface controls.

The existing local storage database remains the persistence boundary. UI changes should not require a migration. Board creation, card creation, card updates, tag updates, group membership, imports, and exports continue to use the existing database helpers.

## AI-Assisted Work Example

The product will demonstrate a realistic AI-assisted workflow through template content and README documentation:

1. Define a question or campaign goal on the board.
2. Use an external AI tool to generate possible directions.
3. Paste the useful output into separate idea cards.
4. Group, edit, combine, and discard suggestions.
5. Mark the human-selected direction.
6. Add a concrete next action.

The app should describe this honestly as a workflow example. There is no new AI API, prompt execution, data transmission, or model integration in this redesign.

## Accessibility and Responsive Behavior

- All icon-only controls have accessible names and hover or focus tooltips.
- Keyboard users can reach board actions, open dialogs, edit cards, and close transient panels.
- Focus states use a visible ink or purple outline with sufficient contrast.
- Text remains readable at small widths. The board toolbar may collapse into a compact control group, but add, search, back, and theme actions remain discoverable.
- Reduced-motion users receive no decorative rotation or transition effects that are not necessary for understanding state.
- Light and dark themes retain readable contrast and preserve the meaning of yellow, mint, coral, and purple states.
- Empty, loading, saved, and failure states use clear text and do not depend on color alone.

## Preservation and Risk Boundaries

Preserve:

- Existing board and card data shape.
- Local persistence and current authentication behavior.
- Canvas pan, zoom, selection, editing, locking, collapsing, importing, exporting, and dark mode behavior.
- Existing template IDs so saved or imported boards do not break.

Avoid:

- Adding a backend or AI provider.
- Replacing the canvas model or persistence layer.
- Introducing a broad component library only for visual polish.
- Making the app look like a marketing landing page.
- Using decorative color, animation, or emoji in ways that obscure board content.

## Validation Plan

After implementation, use focused validation:

- Run the production build to catch TypeScript and bundling issues.
- Run the existing board-template tests because template identity and generated content are part of the change.
- Run the linter if the touched components contain JSX or state changes.
- Manually check the Home screen, new-board flow, each template preview, empty board, populated board, selected card, dark mode, and a narrow viewport.
- Confirm that existing local data still loads and that import and export controls remain available.

## Definition of Done

The redesign is complete when:

- Marker Workshop is visible across Home, board controls, cards, and template previews.
- The four templates look meaningfully different before and after creation.
- A new user can understand how to start without reading a tutorial.
- A returning user can reopen a recent board and reach quick-add actions immediately.
- The AI example clearly shows human judgment after AI output.
- Existing board behavior and saved data continue to work.
- Light mode, dark mode, keyboard focus, reduced motion, and narrow layouts remain usable.
- Production build and focused validation pass.
