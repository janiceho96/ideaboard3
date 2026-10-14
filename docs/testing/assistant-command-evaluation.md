# Board Assistant command check — 2026-10-14

Highlight requests now propose real colored marks in note bodies and framework sections. Framework writing displays sanitized Markdown between edits; clicking it opens the existing Markdown source editor. Review shows the proposed color. Apply changes saves the mark, and Undo restores the original writing.

The Mac bridge accepts the bounded board-command request and limits response operations to the requested command family and selected IDs. Highlighting cannot silently rewrite writing, finding cannot move cards, and source questions cannot edit dates. Compact request-to-operation examples accompany the provider instructions.

## Evidence

- 100 example phrases reach a command family; 22 previously fell through to unrelated drafting.
- 13 live provider cases on fictional notes passed checks for the requested effects, source references, and preserved writing: framework highlight, note highlight, find, create, revise, analyze, Done status, arrangement, source citation, lock, ambiguous-target clarification, highlight removal, and empty custom framework design.
- 363 frontend tests passed, including the live-reply checks; 108 compiled native checks passed.
- Playwright replayed real provider replies and verified colored marks in notes and framework sections, review before apply, save/reload, editing, and Undo.
- Inline and fenced code highlights render without exposing marker delimiters; code content remains escaped.

The first live run returned valid JSON with incorrect actions in several cases. Narrower operation schemas, selected-target enums, explicit latest-request framing, and actual request-to-operation examples corrected those failures. These checks verify the 13 cases, not a live sweep of all 100 phrases.

## Try it

Select a framework with writing, or choose note sources in Add context. Send the command, inspect the colored proposal, then click Apply changes.

- “Highlight the key points in this framework in yellow. Keep the wording unchanged.”
- “Highlight the exact phrase ‘YOUR PHRASE’ in mint in ‘YOUR NOTE’.”
- “Remove the highlight from the exact phrase ‘YOUR PHRASE’ in ‘YOUR NOTE’.”

The full phrase catalog is in [assistantCommandExamples.ts](../../src/lib/assistantCommandExamples.ts). Requests outside the supported operations should receive a clarification or explanation instead of claiming a board change.

## Sentence spacing and important words follow-up

All generation paths now request a space or paragraph break between sentences. Exact source quotes, existing text being highlighted, code, URLs, filenames and decimals stay intact. A read-only review found no whitespace-removal behavior in the Markdown renderer, sanitizer, writing areas, or plan validators; the reported missing separators were not reproduced in saved writing.

For general key-point requests, the provider now chooses a few meaningful phrases, usually 1–6 words, covering concepts, decisions, evidence, requirements or constraints. Negations, qualifiers and units remain part of a phrase when they change its meaning. Explicit full-sentence and exact-quote requests remain supported.

Four additional live OpenAI checks on fictional text passed:

- Framework key points changed from a whole sentence to phrases including “imports Medium articles,” “Google App Password,” and “every 30 minutes.”
- Note highlights selected “Do not launch,” “until approval,” “budget limit is $500,” and “deadline is 20 October,” leaving generic meeting filler unmarked and preserving all source wording.
- An explicit whole-sentence request highlighted precisely the requested sentence.
- A new three-sentence setup note kept proper sentence spacing, `medium_agent/.env`, `https://example.com/guide`, version `2.5`, and the inline command `medium_agent.py --setup`.

Playwright replayed the actual provider replies through the app's bridge interface and checked visible phrases, sentence spacing, review before apply, save/reload, editing and Undo. The focused frontend checks and all 108 native bridge checks passed; production type-check/build and scoped lint passed. The transport was simulated in the browser; the provider responses came from the real configured native client. Importance remains an AI judgment, so users review the proposed marks before applying them. These changes guide new writing; they do not silently rewrite saved notes.
