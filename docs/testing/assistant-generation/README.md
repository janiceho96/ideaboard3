# Hypothesis-based Board Assistant evaluation

This is a synthetic regression library for the assistant's existing Auto flow. It targets the reported essay-framework error and nearby ordinary-language requests. It does not change the assistant or apply output to real boards.

The rubric follows the golden-prompt-eval skill: **Must Include**, **Must Avoid**, **Format Rule**, and a named failure hypothesis. The reference answers describe desired behavior independently of the current router. They are never sent to the provider.

## Corpus

- `design-cases.json`: 120 new board, custom structure, compound, and new-topic requests.
- `conversation-cases.json`: 120 follow-up, read-only, selection, ambiguity, and locked-target requests.
- `boundary-cases.json`: 60 exact-structure, source-instruction, grounding, and read-only requests.
- `prompts.md`: generated human-readable catalog of all 300 requests and expected outcomes.
- `report.md`: generated local/live results and examples.

Some cases deliberately expose missing capabilities rather than previously supported behavior. These are not 300 independent samples of real users, and the route-agreement percentage is not a production success rate. Identical concepts across contexts are matched probes of context sensitivity.

## Fixture contexts

All data is fictional. `empty` has no cards or prior result. Other contexts contain a prior OODA frame named **Career Essay**, an assistant-created note **Opening draft**, and ordinary notes **Portfolio evidence** and **Research notes**. `selected-frame` explicitly selects Career Essay. `selected-note` selects Opening draft as a source; `locked-note` does the same with a locked note. `sources` selects a Markdown **Career brief**. There are no verified qualifications, paid AI jobs, or portfolio outcomes. Selected source text can be overridden by a boundary case.

The runner uses the production route and intent classifiers in the same priority as `BoardAssistantPanel.generate`, including its custom-design override. It uses the production frontend request builders and framework registry. It models fixed explicit contexts, not real UI interaction, auth availability, streaming display, or board application.

## Recorded run variants

The initial diagnostic run uses `--catalog reduced`: built-in catalog guidance contains `selectionGuidance` but omits the additional `sourceRequirements` sentence present in the UI. The production provider instructions, routing, IDs, transport, and validators are unchanged. This can affect wording/grounding, so the baseline is not an exact UI replay. The first 12 eligible cases are also run as a matched control with full UI guidance; that small control is a sanity check with model sampling variation, not a stable accuracy estimate.

The default `--catalog ui` matches the UI guidance for future runs. Reproduce the recorded baseline with:

```sh
node scripts/evaluate-assistant.mjs --catalog reduced
```

Use a separate guarded output directory for the UI control:

```sh
node scripts/evaluate-assistant.mjs --output output/assistant-generation-ui-control --catalog ui --report docs/testing/assistant-generation/control-report.md
```

## Run local checks

```sh
node scripts/evaluate-assistant.mjs
```

This validates corpus integrity, compares effective routes with desired routes, prepares fictional native requests, and evaluates saved replies if present. It exits successfully when the evaluation ran; it does not assert that the assistant passed the rubric. To fail on route disagreements:

```sh
node scripts/evaluate-assistant.mjs --fail-on-routing
```

## Run actual model drafts on Mac

This is an explicit paid operation, requiring the installed Ideaboard app's configured provider/model and existing cloud setting. It uses the app's Keychain reader, provider instructions, strict schemas, bounded streaming HTTPS transport, native decoder, and then frontend validators. It creates a temporary signed harness from the actual native source; it never changes the installed app. Credentials are not printed, saved in artifacts, or passed in command arguments.

```sh
python3 scripts/assistant-eval-live.py --limit 12
python3 scripts/assistant-eval-live.py --limit 300
node scripts/evaluate-assistant.mjs
```

There is a maximum of two in-flight provider requests per runner, no automatic paid retry, and checkpointed completed IDs. A durable started journal also prevents automatically resending unresolved in-flight requests after interruption; some may be conservatively skipped even if not dispatched. The second command resumes remaining eligible cases, skipping the pilot. Local moves, delete confirmations, and clarifications do not call the provider. Native preflight rejections are recorded without a provider call. Authentication/rate-limit errors or five consecutive transport failures stop the run. A guarded manifest fingerprints the actual request payloads, production native source, and model before future requests; mismatches stop reuse. A process lock prevents simultaneous runners for the same output. To deliberately rerun a failed case, use a new output file rather than erasing the evidence.

The initial batch predates these guards and uses explicit `--adopt-existing-results` after completion. Adoption cannot retrospectively prove its original payload provenance and is labeled as such. New runs, including the UI control, are fingerprinted before dispatch. The raw baseline snapshot was held unchanged through its run; only rubric metadata and evaluation tooling were revised.

```sh
python3 scripts/assistant-eval-live.py --compile-only
```

This validates native harness compilation without reading credentials or sending requests.

Raw fictional requests, user-facing model drafts, validation results, model IDs, and usage metadata remain in ignored `output/assistant-generation/`. The runner does not store hidden model reasoning or authorization headers. Usage metadata is not a billing total.

## Interpret results

1. **Routing agreement** checks only whether the effective action matches an acceptable principal route. `expectedRoutes` is OR, not a list of simultaneous requested outputs.
2. **Native validity** means the real provider response passed the native decoder.
3. **Frontend validity** adds the app's authorization/semantic validators. Valid JSON alone cannot establish this.
4. **Explicit content checks** cover declared counts, labels, literal facts, and answer-only constraints. Other Must Include/Must Avoid checks need review of the saved content.
5. **Compound-output gaps** identify requests needing both a framework template and a separate answer; an accepted route alone cannot satisfy that requirement.
6. **Human semantic review** should inspect representative successes and failures, especially unsupported personal claims, source instructions, negation, and precise requested structure. Unreviewed content is not a pass.

This run does not test saved state, undo, layout rendering, cancel UI, or installation. Those require a later browser/native-app replay if the assistant is changed.
