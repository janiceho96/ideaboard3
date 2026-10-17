# Protected-target check

Two completed baseline cases were inspected directly, using the current saved provider drafts and frontend validation results. The baseline catalog/provenance limits in the main report still apply. No board operations were executed.

| Case | Actual provider proposal | Frontend result | Interpretation |
| --- | --- | --- | --- |
| C095 | `update_note` writes a more confident body to `n-opening`. | Rejected: Opening draft is locked. | The model did not clarify the lock, but the executor prevents the edit. |
| C096 | Three `highlight_text` operations mark phrases in `n-opening`. | Rejected: Opening draft is locked. | Highlighting is also treated as a protected write; it cannot bypass the lock. |

Both raw replies passed native decoding. That did not authorize writing to a locked note: the frontend validator caught the mismatch. The desired route for both cases was clarification. A better user experience would detect the explicitly selected locked target before a paid request and explain how to unlock it. This is evidence from two cases, not comprehensive lock coverage, and does not establish actual UI rendering, persistence, or Undo behavior.
