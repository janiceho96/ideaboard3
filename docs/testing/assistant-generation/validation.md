# Validation evidence and limits

Validation was scoped to the evaluation tooling and artifacts; the assistant implementation and installed app were not changed.

- Parsed all three corpus files: 120 design cases, 120 conversational cases, 60 boundary cases. The 300 IDs and prompt/context pairs are unique; every case has reference behavior, positive assertions, negative assertions, format constraints, and a hypothesis. Automated-check names and value shapes are validated before running.
- JavaScript syntax and Python syntax passed. The native harness compiled and then made real provider requests using the existing native instructions, schemas, streaming transport, and decoder.
- Offline guard assertions covered changed payload/native-source/model snapshots, explicit legacy adoption, missing/tampered provenance, malformed/truncated journals, unresolved starts, preserved saved results, and inherited process locks. A separate evaluator check confirmed a changed fingerprint is rejected before replacing an existing request snapshot. These checks sent no provider requests.
- Python and JavaScript manifest hashes agreed for the full-guidance control and the resumed baseline. New dispatches have a synced started journal and request/snapshot/model fingerprints. Completed IDs are preserved rather than retried.
- The matched control has the same 12 IDs as the initial pilot. Request comparison confirmed that only catalog guidance differs in 11 build payloads; the remaining command payload is identical. The control manifest was created before dispatch.
- Initial baseline results predate fingerprints and were explicitly adopted at 122 recorded attempts. This cannot establish their original provenance cryptographically. The reduced catalog also omits the UI's additional source-requirement sentence. Both limitations are retained in the reports.
- Qualitative reviews cover 20 baseline IDs, with the full-guidance control revisiting 12. Other response content has only the declared executable checks and native/frontend validation; it is not graded as semantically correct.
- Scoped whitespace checks and `git diff --check` passed. No full application test suite/build was needed because production source was unchanged.

See the generated baseline and control reports for final attempt counts and validation results. Local routing agreement is a diagnostic metric on deliberately varied synthetic cases, not a user success rate. Native/frontend acceptance likewise does not establish that a request was completed correctly.

No drafts were applied to real boards. Browser/native UI rendering, streaming display, Apply, persistence, Undo, and installed-app updates were outside this run.

## Final artifact audit — 17 October 2026, Asia/Kuala_Lumpur

- Preserved the original first 94 baseline records; 62 still pass both validators. Existing results were not rewritten.
- Baseline: 274 records and 274 unique IDs. All API-eligible case IDs are recorded, with zero remaining eligible IDs and zero unresolved starts. The 152 resumed dispatches match their durable journal; 122 earlier records retain the explicit legacy-adoption limitation.
- Completed the intended 12-case full-guidance control, with 12 unique IDs and zero unresolved starts. These 12 matched IDs are deliberate comparisons, not accidental duplicate baseline requests. Its other 262 prepared cases were outside the control scope.
- Revalidated request hashes, production native-source hashes, model metadata, saved-result provenance, and started journals offline. No additional live requests were sent during this final audit.
- Baseline outcomes: 261 native-valid, of which 181 are also frontend-valid; 80 frontend rejections, 6 native-response rejections, and 7 transport failures. Transport failures are six `network_error` records and one `response_too_large` record. No usage-limit error was recorded.
- Control outcomes: 11 native-valid and 5 frontend-valid from 12 attempts; one native-response rejection.
- Local desired-route agreement is 50/300 with either catalog variant. The explicitly enabled `--fail-on-routing` gate returns 1 because of 250 route disagreements. This is an expected diagnostic failure, not a syntax failure or a claim that 250 generated replies were wrong. Catalog source guidance is added after routing, so its omission does not explain the routing gate.

The recorded transport failures were preserved and were not retried. No further provider calls are required for this evaluation.
