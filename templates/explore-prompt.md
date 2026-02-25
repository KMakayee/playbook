Explore this codebase to gather information for setting up a project playbook. Complete both parts below.

## Part 1 — Ecosystem Detection

Check for these files to determine the tech stack (do not output raw file contents):

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

Also run a 2-level directory listing (root and one level deep) to understand project structure.

## Part 2 — Section Findings

For each of the following sections, follow its exploration strategy and return a **Summary** (what you found, with specific file paths and line numbers) and a **Proposed draft** (concise content ready to paste into CLAUDE.md).

Sections to explore: [UNFILLED_SECTIONS]

### Exploration strategies

**Codebase Overview**
- Read: `README.md`, package metadata (name/description fields in `package.json`, `pyproject.toml`, `Cargo.toml`, etc.)
- Check: git log --oneline -20 for recent activity and maturity signals
- Count: rough number of source files to gauge project size
- Draft: 2-3 sentences covering what the project does, who uses it, and maturity stage

**Architecture**
- Read: main config files (framework config, tsconfig, etc.)
- Explore: 2-level directory listing, entry points (`src/index.*`, `app.*`, `main.*`)
- Check: database configs (Prisma schema, ORM config, migration dirs)
- Check: `.env.example` or `.env.local` for external service hints
- Draft: primary language/framework, directory layout, key abstractions, DB layer, external services

**Conventions**
- Read: linter/formatter configs for enforced rules
- Sample: 5-10 source files across different directories
- Look for: naming patterns (files, functions, variables), import ordering, error handling style, logging approach
- Draft: observed conventions with examples

**Testing**
- Read: test config files (`jest.config.*`, `vitest.config.*`, `pytest.ini`, etc.)
- Find: test file locations (glob for `*.test.*`, `*.spec.*`, `test_*`, `*_test.*`)
- Read: `package.json` scripts or `Makefile` targets for test commands
- Check: coverage config if present
- Draft: framework, file location convention, run commands, coverage expectations

**Build & Run**
- Read: `package.json` scripts, `Makefile`, `Dockerfile`, CI configs
- Detect: package manager from lock files
- Look for: dev server, build, lint/format commands
- Draft: install, dev, build, lint commands

**Critical Paths**
- Grep for: directories/files containing `auth`, `login`, `session`, `token`, `payment`, `billing`, `stripe`, `migration`, `schema`, `api/v`
- List these as **candidates** that the developer will confirm
- Draft: candidate critical paths with brief explanations

**Dependencies**
- Read: dependency files for pinned versions, unusual packages, or version constraints
- Check: for monorepo tooling, workspace configs
- Look for: anything version-sensitive or easily breakable
- Draft: only noteworthy dependencies — skip obvious ones

## Output format

Return your findings in exactly this structure:

## Ecosystem
[Summary of detected tech stack, package manager, framework, monorepo status, etc.]

## [Section Name] Findings
**Summary:** [what you found, key files and line numbers]
**Proposed draft:**
```
[draft content for CLAUDE.md]
```

(Repeat the above block for each section in [UNFILLED_SECTIONS].)
