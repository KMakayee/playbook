Wrap bare markdown tables in fenced code blocks with aligned columns.

## Scope

$ARGUMENTS — if empty, default to `.` (current directory, recursive).
Single `.md` file → process that file. Directory → process all `.md` files in it recursively.

## Algorithm

For each `.md` file in scope, read it and apply these steps:

### Step 1: Find bare tables

A "bare table" is a contiguous block of lines starting with `|` that is NOT inside an existing fenced code block (triple backticks).

### Step 2: Pad columns

For each bare table, pad every cell so pipes align:
1. Split each row by `|` to get cells (ignore leading/trailing empty splits).
2. For each column, find the max content width across all rows (excluding separator rows like `|---|---|`).
3. Pad each cell with spaces to match the max width for that column.
4. Rebuild separator rows using dashes matching each column's width.

Example — before padding:
| Command | What it does |
|---|---|
| `/commit` | Stage, commit, and push to current branch |
| `/push-pr` | Open a PR from current branch to main |

After padding:
| Command    | What it does                               |
|------------|---------------------------------------------|
| `/commit`  | Stage, commit, and push to current branch   |
| `/push-pr` | Open a PR from current branch to main       |

### Step 3: Wrap in fences

Wrap the padded table in triple-backtick fences.

## Rules

- Do NOT modify tables already inside fenced code blocks.
- Do NOT change any other content in the file.
- Use the Edit tool. Process one file at a time — read, edit all tables, move on.
- After all files: report which files were modified and how many tables were wrapped.
- If no bare tables found: report "No bare markdown tables found."
