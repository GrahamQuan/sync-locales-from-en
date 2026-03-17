---
name: sync-i18n-via-en
description:
  Sync all locale translation files with en.json as the base reference. Finds missing keys, translates them, and merges
  back.
user-invocable: true
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
batchSize: 200
---

# sync-i18n-via-en

Synchronize all locale translation files with `messages/en.json` as the base reference.

## One-click workflow

1. **Compare** — `pnpm i18n:compare` finds missing keys per locale
2. **Extract** — `pnpm i18n:extract` generates locale template files with English values for missing keys
3. **Translate** — `pnpm i18n:translate -- YYYY-MM-DD` translates extracted locale files in place
4. **Merge** — `pnpm i18n:merge` writes translations back, preserving en.json key order
5. **Test** — `pnpm i18n:test` validates all locales match en.json structure

## Quick run

Run the full workflow in order:

1. `pnpm i18n:compare`
2. `pnpm i18n:extract`
3. `pnpm i18n:translate -- YYYY-MM-DD`
4. `pnpm i18n:merge`
5. `pnpm i18n:test`

Notes:

- Replace `YYYY-MM-DD` with the report folder date (example: `2026-03-16`).
- If omitted, `i18n:translate` defaults to today's date folder.

## Hard constraints (must follow)

- Never create ad-hoc runner scripts or inline interpreter blocks.
- Forbidden patterns: `python - <<`, `node -e`, `tsx -e`, `bash <<`, heredoc scripts that execute custom code.
- Never create new temporary executable files (`.py`, `.sh`, `.js`, `.ts`) for this workflow.
- Use only pre-existing repo scripts for automation:
  - `pnpm i18n:compare`
  - `pnpm i18n:extract`
  - `pnpm i18n:translate`
  - `pnpm i18n:merge`
  - `pnpm i18n:test`
- If a required script is missing or fails, stop and ask the user before taking another approach.

## Prerequisites

- `messages/en.json` is the source of truth
- Locales are auto-discovered from `messages/*.json` (excluding en.json)

## Scripts

All scripts live in `.agents/skills/sync-i18n-via-en/scripts/`:

- `helpers.ts` — Shared utilities (flatten, unflatten, key ordering, locale discovery)
- `compare-locales.ts` — Find missing keys, output report to `i18n-via-en/YYYY-MM-DD/`
- `extract-locales.ts` — Create `{locale}.json` template files from en.json using missing keys report
- `translate-locales-fast.ts` — Translate extracted locale files in `i18n-via-en/YYYY-MM-DD/` (excluding report file)
- `merge-translations.ts` — Merge temp files into `messages/*.json` with en.json key order
- `test-locales.ts` — Validate all locales match en.json (missing keys, extra keys, structure)

## Execution Steps

When `/sync-i18n-via-en` is invoked, follow these steps exactly:

### Step 1: Compare

Run `pnpm i18n:compare` to generate the missing keys report at `i18n-via-en/YYYY-MM-DD/missing-keys-report.json`.

If no missing keys are found, stop here.

### Step 2: Extract

Run `pnpm i18n:extract` to generate locale files in `i18n-via-en/YYYY-MM-DD/{locale}.json`.

Each generated file contains missing keys only, populated with English values from `messages/en.json`.

### Step 3: Translate

Run `pnpm i18n:translate -- YYYY-MM-DD` to translate all extracted locale files in `i18n-via-en/YYYY-MM-DD/` (excluding
`missing-keys-report.json`).

If `YYYY-MM-DD` is omitted, the script defaults to today's date folder.

### Step 4: Merge

Run `pnpm i18n:merge` to merge temp files into `messages/*.json`. Existing translations are overwritten. Key order
follows en.json.

### Step 5: Test

Run `pnpm i18n:test` to validate all locale files match en.json structure.

Report summary: which locales succeeded, which failed, which need retry.

## Translation rules

- Translations must be SEO-friendly and natural for native speakers
- Preserve all HTML tags exactly as-is
- Preserve all `{variable}` placeholders exactly as-is
- Preserve special formatting (newlines, markdown, etc.)
- Do not translate brand names or product names
- Use the language name from `getLanguageName()` in helpers.ts for translation prompts
