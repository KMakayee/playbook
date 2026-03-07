Fix bare markdown tables by wrapping them in fenced code blocks.

## Scope

$ARGUMENTS

If the argument is empty or not provided, default to the current directory (`.`).
If the argument is a single `.md` file, process only that file.
If the argument is a directory, find all `.md` files recursively within it.

## Task

For each `.md` file in scope:

1. Identify bare markdown tables — lines starting with `|` that are NOT already inside a fenced code block (triple backticks).
2. For each bare table found, wrap the entire contiguous block of `|`-prefixed lines in triple-backtick fences.
3. Pad columns so pipes align within the wrapped table.

## Rules

- Do NOT modify tables that are already inside fenced code blocks.
- Do NOT change any other content in the files.
- Use the Edit tool for modifications, not Write.
- After fixing, report a summary: which files were modified and how many tables were wrapped.
- If no bare tables are found, report "No bare markdown tables found."
