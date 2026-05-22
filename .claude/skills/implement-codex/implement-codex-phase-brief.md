# `/implement-codex` Phase Brief

You are implementing one phase of an approved plan in `tasks/plan.md`. The plan was authored by Claude after research and design phases. Your job is to apply the surgical edits this phase prescribes — nothing more, nothing less.

## Surgical-changes rule

Surgical changes — every changed line needs a reason traceable to the plan. No features, refactoring, or "improvements" beyond what the plan specifies. If you can't explain why a line changed, revert it.

Adjacent code that *looks improvable* is out of scope. Improvements that the plan does not specify are scope drift, even if they would be net wins.

## Edit allow-list rule

Edit ONLY the files listed below in §Variable Slots → file_allow_list. Do not modify any file outside that list, including tests, docs, configs, or comments in adjacent code. If the plan's premise is wrong and the right edit lives outside the allow-list, follow the §Mismatch contract instead — do not edit out-of-list files.

## Test-ownership rule

Do NOT run tests, lint, type checks, build commands, or any verification command. Do NOT execute scripts. Edit source files, write the §Output schema final message, and exit. Claude will run all verification after you return.

Rationale: Claude needs direct test evidence to gate the per-phase commit. Trusting a "tests passed" claim from the writer is weaker than running tests in the verifier's session.

## Network constraint

Network is disabled in this sandbox (`workspace-write` default). If your edits require `npm install`, `pip install`, fetching a package, or any network call, STOP and follow the §Blocked contract — do not attempt the network call.

## Mismatch contract

Before editing, read the plan-cited files (Variable Slots → plan_lines and file_allow_list). If the actual code structure does not match what the plan's premise assumes (e.g., the plan says "add a parameter to function X" but X has been deleted or relocated; or "edit the foo() block at file.ts:47" but lines 40-60 are unrelated), DO NOT edit.

Instead: write `tasks/codex-mismatch-{N}.tmp` (replace `{N}` with §Variable Slots → phase_number) containing:
- (a) what the plan assumed
- (b) what you found
- (c) the file:line evidence
- (d) the smallest delta you'd need to proceed

Then exit without making any source edits. Claude will re-research and adapt the plan.

## Blocked contract

If you hit a wall that is not a structural mismatch (you reached an ambiguity the plan does not resolve, your model wall on the language/framework, the phase needs network access, etc.), DO NOT guess and DO NOT half-implement.

Instead: write `tasks/codex-blocked-{N}.tmp` containing:
- (a) what you tried
- (b) where you stopped
- (c) what input you'd need to proceed

Then exit without making source edits. Claude will take over and complete the phase.

## Output schema

Your `-o` final message MUST contain this block:

```
STATUS: done | mismatch | blocked
FILES_MODIFIED:
- path/to/file1.ext
- path/to/file2.ext
FILES_CREATED:
- path/to/new-file.ext
SUMMARY: <one-line description of what was done in this phase>
NOTES: <any non-blocking observations; "none" if nothing>
```

If STATUS is `mismatch` or `blocked`, you must still emit this block — `FILES_MODIFIED` and `FILES_CREATED` should be empty under those states. Claude cross-checks your file enumeration against `git diff --name-only`; mismatches between your list and the actual diff are findings.
