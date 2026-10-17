# Hypothesis-based Board Assistant evaluation

Generated: 17/10/2026, 02:26:07 Asia/Kuala_Lumpur

300 synthetic requests, with explicit fictional fixtures and independent desired-outcome rubrics. These cases are diagnostic coverage, not an estimate of real-world success rates. No app boards were saved.

Catalog variant: **ui**. Catalog guidance includes selectionGuidance and sourceRequirements, matching BoardAssistantPanel.

## Hypotheses

- H1: Natural phrasing, domain-specific structures, and typos are missed by keyword routing.
- H2: Compound requests need both a framework artifact and a conversational answer.
- H3: Earlier board context can divert a fresh task or follow-up.
- H4: Questions can be routed into board mutation.
- H5: Explicit selection, ambiguous targets, and locked targets need distinct handling.
- H6: Exact constraints and grounding must survive generation and validation.

## Local routing results

50/300 agree with the desired route; 250 disagree. This is route agreement, not AI-content quality. With the --fail-on-routing flag, route disagreements intentionally produce exit code 1. Catalog guidance is assembled after routing, so the omitted source-requirement sentence cannot cause this routing-gate failure. The matched probes illustrate narrow wording rules and Build/Fill fallbacks.

| Hypothesis | Cases | Agreement | Disagreement |
| --- | ---: | ---: | ---: |
| H1 | 60 | 16 | 44 |
| H2 | 40 | 1 | 39 |
| H3 | 40 | 3 | 37 |
| H4 | 60 | 12 | 48 |
| H5 | 40 | 13 | 27 |
| H6 | 60 | 5 | 55 |

| Desired → actual | Cases |
| --- | ---: |
| design → build | 64 |
| design → answer | 30 |
| answer → fill | 21 |
| answer → build | 19 |
| design → fill | 16 |
| build → clarify | 15 |
| build → canvas | 12 |
| answer → canvas | 9 |
| answer → clarify | 6 |
| design → canvas | 5 |
| build → answer | 4 |
| answer → create-note | 3 |
| build → fill | 3 |
| clarify → canvas | 3 |
| answer → revise-note | 3 |
| design → clarify | 3 |
| move → organize | 3 |
| clarify → fill | 2 |
| expand → fill | 2 |
| build → create-note | 2 |
| build → organize | 2 |
| revise-note → create-note | 2 |
| revise-note → answer | 2 |
| clarify → revise-note | 2 |
| expand → actions | 1 |
| design → organize | 1 |
| revise-note → build | 1 |
| answer → highlight | 1 |
| build → revise-note | 1 |
| build → actions | 1 |
| answer → delete | 1 |
| answer → organize | 1 |
| clarify → organize | 1 |
| delete → canvas | 1 |
| clarify → highlight | 1 |
| fill / clarify → organize | 1 |
| clarify → create-note | 1 |
| actions → clarify | 1 |
| clarify → answer | 1 |
| revise-note → organize | 1 |
| answer → design | 1 |

## Controlled routing probes (offline only)

The same eight prompts are routed with and without prior artifacts. These 16 probes are separate from the 300-case corpus and are not sent to the provider.

| Prompt | Empty board | Prior board |
| --- | --- | --- |
| Draft a framework for my 500-word career essay with Belief, Skills, and Portfolio. | build | build |
| Draft a custom framework for my 500-word career essay with Belief, Skills, and Portfolio. | design | design |
| Design a custom essay framework with three empty sections. | build | fill |
| Design a custom framework for an essay with three empty sections. | design | design |
| Suggest three opening sentences for my essay. | build | fill |
| Can you make it clearer? | build | fill |
| Do not change the board. Suggest an opening sentence. | canvas | canvas |
| Create a new SWOT framework for weighing study options. | build | build |

## Live execution

Live replies match the guarded request/model/native snapshot.

Scope: this is a completed, deliberately bounded 12-case matched control. The other prepared cases were outside the selected control and are not pending work.

- Native requests prepared: 274. Local actions/clarifications: 26.
- Model: gpt-6-luna.
- Provider attempts recorded: 12. Recorded outcomes: 12; eligible cases without a recorded outcome: 262.
- Transport failures: 0. Replies rejected by native decoding: 1.
- Replies passing the native decoder: 11.
- Replies also passing frontend validation: 5.
- Frontend-valid replies with executable content assertions: 3; 3 failed one or more. Other content requirements remain ungraded.
- Correctly routed designs lacking a separate chat-answer artifact: 1.
- Tokens reported on decoded replies: 65890. Failed responses may lack usage; this is not a billing total.
- Must Include / Must Avoid / Format Rule / Reference Answer remain content-review rubrics. Unreviewed outputs are never counted as semantic passes.

## Interpretation and refinement priorities

The [qualitative pilot review](semantic-review.md) distinguishes useful content from completed requests. D001/C001 offer usable opening ideas but substitute existing framework structures; D004/B004 closely follow requested stages but invent unsupported types; C003 turns advice into a note; C004 proposes replacing four sections for an ambiguous follow-up. These are observations from a deliberately small pilot, not semantic grades for the remaining replies. The additional [six-case advisory review](advisory-review.md) includes safe answer-only replies despite a wrong route label, and a source-instruction case that preserves the boundary but misses the requested template. The pilot and advisory reviews inspect 18 baseline cases. The [two protected-target checks](protected-target-review.md) show frontend rejection of proposed edits to a locked note. The baseline therefore has 20 qualitatively inspected cases in total, while the control revisits 12 IDs. Other content remains unreviewed.

1. Recognise custom structures from meaning and requested section names, without requiring adjacent magic words.
2. Resolve an action before generation and use an action-specific schema. New drafts must not contain existing-frame writes; built-in frame and section IDs should be constrained to supplied values.
3. Give advice a chat-only action and resolve genuine target ambiguity instead of silently selecting the previous framework for replacement.
4. Support a framework-template artifact plus a separate answer for compound requests, keeping guidance distinct from answer fields.
5. Preserve generated material on validation failure and explain the mismatch in everyday language. A bounded repair must keep the original action and target scope.

No assistant implementation or installed app was changed by this evaluation. UI rendering, apply, save/reload, and Undo are outside the evidence here.

## Reproduce

Run `node scripts/evaluate-assistant.mjs --catalog ui --output output/assistant-generation-ui-control --report docs/testing/assistant-generation/control-report.md` for local checks and to evaluate saved replies. Raw fictional requests, replies, and results stay under ignored `output/assistant-generation-ui-control/`. Use `--fail-on-routing` to make desired-route mismatches fail CI. The separate live runner must be invoked explicitly and resumes completed IDs. It never applies drafts to the workspace.

## Example failures

- **D001** (empty): i want to work on a 500 essay about why i transit from marketer to AI engineer, help me to draft a framework that help me with the essay (belief/transistion) for first paragrah, second (Skills), third ( Result/portfolio). with some suggestions on the opening.
  - Expected: design. Actual: build. Live: validated
- **C001** (prior-board): I want to work on a 500 word essay about why I moved from marketer to AI engineer. Help me draft a framework: first paragraph belief and transition, second skills, third results and portfolio. Give me a few suggestions for the opening too.
  - Expected: design. Actual: build. Live: validated
- **B001** (empty): Design a custom essay framework with exactly 3 sections named Belief, Skills, and Portfolio. Keep every writing area empty.
  - Expected: design. Actual: build. Live: native-response-rejected — OpenAI did not return a valid JSON draft. Your notes were kept.
- **D002** (empty): Can you make me a reusable reading sheet for papers on retrieval augmented generation? I want places for the claim, the experiment, weaknesses, and what I should test next. Leave it blank.
  - Expected: design. Actual: build. Live: validated
- **C002** (prior-board): New topic: design a framework for comparing three apartments before I rent one. I care about commute, total cost, noise, and lease flexibility.
  - Expected: design. Actual: build. Live: frontend-rejected — The assistant tried to write to an unauthorized framework.
- **B002** (empty): Create a reusable custom coaching framework with exactly 2 sections: Current situation and Next experiment.
  - Expected: design. Actual: build. Live: frontend-rejected — Each new framework must have writing for every section, including open questions where facts are missing.
- **D003** (empty): I keep interviewing cafe owners about stock waste. Set up my own repeatable interview canvas: what happens today, painful moments, workarounds, and evidence I still need.
  - Expected: design. Actual: canvas. Live: validated
- **C003** (prior-board): Leave the essay as it is. I am only asking whether a career-change essay needs a dramatic opening.
  - Expected: answer. Actual: fill. Live: frontend-rejected — No sections were drafted. Select an empty section or enable reviewed replacement.
- **B003** (empty): Design my own four-part research framework named Question, Method, Evidence, and Limits. Use a grid with empty writing areas.
  - Expected: design. Actual: build. Live: frontend-rejected — The assistant tried to write to an unauthorized framework.
- **D004** (empty): make a framwork for learn python as a marketer pls. 5 boxs: why, basics, practice, project, review. questions only i fill later
  - Expected: design. Actual: build. Live: frontend-rejected — The assistant tried to write to an unauthorized framework.
- **C004** (prior-board): Can you make it clearer?
  - Expected: clarify. Actual: fill. Live: validated
- **B004** (empty): Draft a custom flow framework for learning Python with exactly 5 stages: Goal, Concept, Exercise, Feedback, and Reflection.
  - Expected: design. Actual: build. Live: frontend-rejected — The assistant tried to write to an unauthorized framework.
- **D005** (empty): Build a new reusable reflection pattern for a volunteer event. I need Expected, Happened, Surprised us, and Next experiment, not a ready-made model.
  - Expected: design. Actual: answer. Live: not-run
- **B005** (empty): Make a custom 6-section exhibition planning grid: Audience, Offer, Location, Operations, Budget, and Measurement. Include questions rather than answers.
  - Expected: design. Actual: build. Live: not-run
- **D006** (empty): Give me a blank decision canvas for whether to study part time: motivation, constraints, options, evidence, and revisit date.
  - Expected: design. Actual: canvas. Live: not-run
- **C006** (prior-board): In Career Essay, expand the questions under Act so I can think about next steps after showing my portfolio.
  - Expected: expand. Actual: actions. Live: not-run
- **B006** (empty): Design a custom career evidence framework with exactly 7 sections. Include proof and uncertainty in the writing questions.
  - Expected: design. Actual: build. Live: not-run
- **D007** (empty): Design my own lesson planner with a flow from prior knowledge to worked example to student practice to exit ticket. I want questions rather than lesson content.
  - Expected: design. Actual: build. Live: not-run
- **C007** (prior-board): Start a fresh idea board for my community repair cafe. Add ideas for volunteers, tools, venue, publicity, and the first event.
  - Expected: build. Actual: canvas. Live: not-run
- **B007** (empty): Create a custom eight-section product research framework. All eight areas should be blank prompts, suitable for an early-stage idea.
  - Expected: design. Actual: build. Live: not-run
- **D008** (empty): Could I have a reusable campaign postmortem with Signal, Possible cause, Evidence, and Change to try? I want a small grid I can use each month.
  - Expected: design. Actual: answer. Live: not-run
- **C008** (sources): Use the Career brief to design a reflective learning framework. Keep it empty so I can add my real evidence later.
  - Expected: design. Actual: fill. Live: not-run
- **B008** (empty): Design a custom cycle with exactly 4 stages for reviewing teaching: Plan, Teach, Observe, Adapt.
  - Expected: design. Actual: build. Live: not-run
- **D009** (selected-note): Turn the selected career notes into the shape of a reusable framework, not into an essay: Starting point, Turning point, Learning, Proof. Keep the writing spaces empty.
  - Expected: design. Actual: fill. Live: not-run
