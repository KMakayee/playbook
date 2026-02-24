# Setup Assistant

You are setting up the RPI playbook for this codebase. CLAUDE.md contains 7 sections marked with `[TEAM FILLS IN]`. Your job is to explore the codebase, draft content for each unfilled section, and confirm with the developer before writing.

---

## Step 1: Read CLAUDE.md and identify unfilled sections

Read `CLAUDE.md` in the project root. Identify which sections still contain the marker text `[TEAM FILLS IN`. If a section has already been filled in (no marker), skip it entirely. If all sections are filled, tell the developer and stop.

---

## Step 2: Detect the ecosystem

Before interviewing, silently explore the project to determine the tech stack. Check for these files (do NOT ask the developer — just look):

**Package/dependency files:**
- `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb` (Node.js)
- `pyproject.toml`, `setup.py`, `requirements.txt`, `Pipfile`, `poetry.lock` (Python)
- `Cargo.toml`, `Cargo.lock` (Rust)
- `go.mod`, `go.sum` (Go)
- `Gemfile`, `Gemfile.lock` (Ruby)
- `build.gradle`, `pom.xml` (Java/Kotlin)
- `composer.json` (PHP)
- `Package.swift` (Swift)
- `mix.exs` (Elixir)
- `*.csproj`, `*.sln` (C#/.NET)

**Monorepo markers:**
- `turbo.json`, `nx.json`, `pnpm-workspace.yaml`, `lerna.json`

**Framework configs:**
- `next.config.*`, `nuxt.config.*`, `vite.config.*`, `webpack.config.*`, `tsconfig.json`
- `django`, `flask`, `fastapi` in Python deps
- `.rails-version`, `config/routes.rb`

**Infrastructure/tooling:**
- `Dockerfile`, `docker-compose.yml`
- `Makefile`
- `.env.example`, `.env.local`
- CI configs: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`

**Linter/formatter configs:**
- `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `biome.json`
- `ruff.toml`, `pyproject.toml` `[tool.ruff]`
- `.rubocop.yml`
- `rustfmt.toml`, `clippy.toml`

**Database/ORM:**
- `prisma/schema.prisma`, `drizzle.config.*`
- `alembic/`, `migrations/`
- `knexfile.*`, `ormconfig.*`

**Test configs:**
- `jest.config.*`, `vitest.config.*`, `pytest.ini`, `conftest.py`, `.rspec`

Also run a 2-level directory listing (`ls` at root and one level deep) to understand project structure.

Store your findings internally — you'll use them to draft each section.

---

## Step 3: Fill each section interactively

For each unfilled section (in the order they appear in CLAUDE.md), follow this loop:

### A. Explore silently

Use the exploration strategy for that section (see table below). Read the relevant files. Do not output raw file contents to the developer.

### B. Draft a proposal

Present a proposed replacement for the section in a fenced code block. The draft should:
- Match the style hints in the `[TEAM FILLS IN]` placeholder
- Be concise — this goes in CLAUDE.md which is loaded every session
- Use specific paths, commands, and framework names (not generic placeholders)

### C. Confirm with the developer

Ask: *"Does this look accurate? Edit anything you'd like to change, or say 'looks good' to continue."*

Wait for the developer's response. If they provide corrections, incorporate them and present the revised draft. Repeat until confirmed.

### D. Write to CLAUDE.md

Once confirmed, replace the `[TEAM FILLS IN ...]` placeholder in CLAUDE.md with the confirmed content. Use the Edit tool — do not rewrite the entire file.

Then move to the next unfilled section.

---

## Exploration strategy per section

### Codebase Overview
- Read: `README.md`, package metadata (name/description fields in `package.json`, `pyproject.toml`, `Cargo.toml`, etc.)
- Check: git log `--oneline -20` for recent activity and maturity signals
- Count: rough number of source files to gauge project size
- Draft: 2-3 sentences covering what the project does, who uses it, and maturity stage

### Architecture
- Read: main config files (framework config, tsconfig, etc.)
- Explore: 2-level directory listing, entry points (`src/index.*`, `app.*`, `main.*`)
- Check: database configs (Prisma schema, ORM config, migration dirs)
- Check: `.env.example` or `.env.local` for external service hints
- Draft: primary language/framework, directory layout, key abstractions, DB layer, external services

### Conventions
- Read: linter/formatter configs for enforced rules
- Sample: 5-10 source files across different directories
- Look for: naming patterns (files, functions, variables), import ordering, error handling style, logging approach
- Draft: observed conventions with examples

### Testing
- Read: test config files (`jest.config.*`, `vitest.config.*`, `pytest.ini`, etc.)
- Find: test file locations (glob for `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`)
- Read: `package.json` scripts or `Makefile` targets for test commands
- Check: coverage config if present
- Draft: framework, file location convention, run commands, coverage expectations

### Build & Run
- Read: `package.json` scripts, `Makefile`, `Dockerfile`, CI configs
- Detect: package manager from lock files
- Look for: dev server, build, lint/format commands
- Draft: install, dev, build, lint commands

### Critical Paths
- Grep for: directories/files containing `auth`, `login`, `session`, `token`, `payment`, `billing`, `stripe`, `migration`, `schema`, `api/v`
- Present these as **candidates** — this section needs the most human input
- Ask the developer explicitly: *"Which of these are critical? Are there others I missed?"*
- Draft: confirmed critical paths with brief explanations

### Dependencies
- Read: dependency files for pinned versions, unusual packages, or version constraints
- Check: for monorepo tooling, workspace configs
- Look for: anything version-sensitive or easily breakable
- Draft: only noteworthy dependencies — skip obvious ones

---

## Step 4: Wrap up

After all sections are filled:

1. Print a summary of what was filled
2. Remind the developer: *"Review the full CLAUDE.md to make sure everything reads well together. You can always edit it manually later."*
3. If the project doesn't have the `templates/` directory or `quickref.md`, mention that they should copy those from the playbook repo as well

---

## Edge cases

- **Partially filled CLAUDE.md:** Skip any section that doesn't contain `[TEAM FILLS IN`. Only process unfilled sections.
- **Minimal/empty repo:** If very few files exist, tell the developer. Fill what you can detect, and for sections with insufficient signal, write a short placeholder like `<!-- TODO: Fill in after project structure is established -->` and explain why.
- **Monorepo:** If monorepo markers are found, note this in the Architecture section and ask the developer which package/app is the primary focus for this CLAUDE.md instance.
- **Non-standard structure:** If the project doesn't follow common conventions, rely more heavily on developer input. Present what you found and ask them to describe what's different.
