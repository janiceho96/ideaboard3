# Full UI-guidance control: qualitative comparison

The same 12 pilot case IDs were compared between `output/assistant-generation/` and `output/assistant-generation-ui-control/`. The control still shows the broad routing, response-shape, and target-selection failures seen in the original pilot. Some generated text differs usefully, but neither a higher frontend acceptance count nor useful prose establishes a delivered, compliant artifact.

This is a Codex subagent review, not a human score or a statistical comparison. Both runs identify `gpt-6-luna`; each case has one sample per run. Model stochasticity, the small selected sample, and baseline provenance limits prevent attributing differences to the guidance change alone.

## Scope and evidence limits

- The original diagnostic pilot used **reduced catalog guidance**: `selectionGuidance` without the additional `sourceRequirements` sentence. It therefore was not an exact replay of the installed UI request.
- The control's intended build-request difference is catalog guidance combining `selectionGuidance + sourceRequirements`, matching `BoardAssistantPanel`. Non-build payloads are intended to be unchanged. Production routing and native/frontend validators were not modified for this comparison.
- The control has a pre-dispatch fingerprint manifest. The original pilot predates fingerprinting; its records were later explicitly adopted with `provenance: "unverified-before-adoption"`. Adoption cannot retrospectively prove the original requests or native-source snapshot. The current manifests share the same `nativeSourceHash`, but that does not remove this **baseline legacy provenance limitation**.
- Only these 12 pilot IDs are compared. Later baseline records, including resumed work after network errors, are excluded. Evidence is saved provider payloads and local validation results; no real-board apply, rendering, persistence, or Undo behavior was tested here.

## All 12: acceptance and automated assertions

`N` means native-valid and `F` means frontend-valid. “None” means no explicit automated content assertions exist for that case; it is **not** a semantic pass. “Not run” means validation rejection prevented those checks.

| ID | Original N / F | Original explicit checks | UI control N / F | UI control explicit checks |
| --- | --- | --- | --- | --- |
| D001 | Yes / Yes | 2 failed: count, labels | Yes / Yes | 2 failed: count, labels |
| C001 | Yes / Yes | None | Yes / Yes | None |
| B001 | No / No | Not run | No / No | Not run |
| D002 | Yes / No | Not run | Yes / Yes | 1 failed: count |
| C002 | Yes / No | Not run | Yes / No | Not run |
| B002 | Yes / No | Not run | Yes / No | Not run |
| D003 | Yes / Yes | 1 failed: count | Yes / Yes | 1 failed: count |
| C003 | Yes / No | Not run | Yes / No | Not run |
| D004 | Yes / No | Not run | Yes / No | Not run |
| B003 | Yes / No | Not run | Yes / No | Not run |
| C004 | Yes / Yes | None | Yes / Yes | None |
| B004 | Yes / No | Not run | Yes / No | Not run |

Native acceptance is **11/12 in each run**. Frontend acceptance is **4/12 original and 5/12 control**. No explicit content assertion that ran passed: **0/3 original and 0/4 control**. These are descriptive counts for this selected sample, not accuracy estimates. All 12 still disagree with the corpus's desired principal route in both runs; the guidance change occurs after route selection.

Frontend rejection categories also persist. C002/B003 retain unauthorized-framework errors; B002 retains the incomplete built-in-framework error. D004/B004 change from unsupported-framework errors to unauthorized-framework errors, which is a different rejection rather than task completion. B001 is rejected natively in both runs.

## Six cases inspected in detail

| ID | Comparison and raw evidence | Content and delivery judgment |
| --- | --- | --- |
| D001 | Original uses `type: "first-principles"` with `assumptions/truths/rebuild`; control uses `type: "grow"` with `goal/reality/options/will`. The control adds a useful **140 + 170 + 190 = 500** paragraph word budget that the original lacked. Both supply conditional opening options in a note card. | Useful guidance, still **partial**. Neither returns the exact three named essay sections, empty writing areas, and separate chat openings. Both are frontend-valid builds rather than the requested framework design; the control's added word budget does not repair the artifact shape. Neither asserts invented personal outcomes as facts. |
| C001 | Both use `type: "ooda"`, with `observe/orient/decide/act`, populated scaffold text, and an opening-options card. Control calls this an “OODA-based essay scaffold”; its `sections` and `revisions` arrays are empty. | Still **partial**. The three requested paragraph topics and provisional openings are useful, and neither payload proposes overwriting the earlier artifacts. The fourth OODA section, populated writing fields, and note-card openings do not satisfy the requested three-section template plus chat answer. Both pass frontend validation under the wrong `build` route. |
| B001 | Original raw draft uses `custom-essay` and three blank `belief/skills/portfolio` sections. Control raw draft uses three blank First Principles sections and explicitly states that the exact custom section names “remain open.” | Both are **undelivered**: native replies reject them. Raw drafts never reached the app as successful results. The original is closer on names/count; the control preserves blank text but substitutes section identities. Neither rejection alone identifies its exact decoder rule, so no more specific causal diagnosis is claimed. |
| D002 | Original includes standalone section writes addressed to `frameId: "ooda"` and fails frontend authorization. Control has `sections: []` and is frontend-valid. However, control still puts **Claim and Experiment together in `observe`**, Weaknesses in `orient`, Next test in `decide`, and an additional test-plan slot in `act`. | Useful reading prompts, still **partial**. The extra accepted reply is not a compliant four-section reading template: section identities remain OODA, requested fields are merged, and writing contains placeholders. The raw shape explains the different validation outcome; one stochastic pair does not prove guidance caused the change. No paper results or citations are fabricated. |
| C003 | Both select `fill` for a question that explicitly leaves the essay unchanged. Both put the substantive answer in a new note card while returning `sections: []`. Control says a dramatic opening is optional, then describes its result as an added answer. | Still **failed** as a chat-only request, although the advice is useful. Both fail frontend validation with **“No sections were drafted.”** Preserving existing essay text is insufficient when the answer also proposes an unrequested new note. This non-build pair is not a test of the catalog-guidance change. |
| C004 | Both select `fill` and propose replacements for all four sections of `f-essay` without asking which artifact “it” means. Control additionally assumes the existing OODA content is the authorized target; the user had not resolved that ambiguity. | Still **failed**, despite frontend acceptance in both runs. Cautious wording about missing evidence does not authorize choosing a target and replacing its writing. These are proposed writes in saved outputs; the logs do not show a real board being overwritten. This non-build pair is also outside the intended guidance intervention. |

The control narrows the original pilot's UI-guidance limitation but does not resolve its central finding: requests are being assigned an unsuitable action or artifact format before generation, and validation acceptance can coexist with failure to follow the user's requested structure or edit scope. Further implementation should preserve the distinction between a reusable framework template, a chat answer, and a bounded write to an explicitly identified existing object.
