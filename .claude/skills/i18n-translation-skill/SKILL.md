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
2. **Translate** — Claude translates missing keys from English in Cursor chat (the only AI step)
3. **Merge** — `pnpm i18n:merge` writes translations back, preserving en.json key order
4. **Test** — `pnpm i18n:test` validates all locales match en.json structure

## Hard constraints (must follow)

- Never create ad-hoc runner scripts or inline interpreter blocks.
- Forbidden patterns: `python - <<`, `node -e`, `tsx -e`, `bash <<`, heredoc scripts that execute custom code.
- Never create new temporary executable files (`.py`, `.sh`, `.js`, `.ts`) for this workflow.
- Use only pre-existing repo scripts for automation:
  - `pnpm i18n:compare`
  - `pnpm i18n:merge`
  - `pnpm i18n:test`
- Translation is chat-driven. Do not call external translation APIs from shell commands.
- If a required script is missing or fails, stop and ask the user before taking another approach.

## Prerequisites

- `messages/en.json` is the source of truth
- Locales are auto-discovered from `messages/*.json` (excluding en.json)

## Scripts

All scripts live in `.claude/skills/sync-i18n-via-en/scripts/`:

- `helpers.ts` — Shared utilities (flatten, unflatten, key ordering, locale discovery)
- `compare-locales.ts` — Find missing keys, output report to `i18n-via-en/YYYY-MM-DD/`
- `merge-translations.ts` — Merge temp files into `messages/*.json` with en.json key order
- `test-locales.ts` — Validate all locales match en.json (missing keys, extra keys, structure)

## Execution Steps

When `/sync-i18n-via-en` is invoked, follow these steps exactly:

### Step 1: Compare

Run `pnpm i18n:compare` to generate the missing keys report at `i18n-via-en/YYYY-MM-DD/missing-keys-report.json`.

If no missing keys are found, stop here.

### Step 2: Translate

Read the missing keys report and `messages/en.json`.

**Resume support**: Check for existing temp files in `i18n-via-en/YYYY-MM-DD/` and skip already-translated keys.

For each locale with missing keys:
1. Read existing temp file (if any) to find already-translated keys
2. Calculate remaining keys = missing keys - already translated keys
3. If no remaining keys, skip this locale
4. Flatten en.json and extract values for remaining keys
5. Split into batches of 200 keys
6. For each batch:
   - Translate to target language (SEO-friendly, natural for native speakers)
   - Preserve HTML tags, `{variable}` placeholders, and special formatting
   - Write batch immediately to temp file `i18n-via-en/YYYY-MM-DD/{locale}.json` (incremental save)
   - Auto-retry once on failure before moving to next locale
7. **Main agent writes files directly** (no sub-agent delegation)
8. **Do not run translation code in shell**. Translation is performed in Cursor chat and then written to temp JSON files.

### Step 3: Merge

Run `pnpm i18n:merge` to merge temp files into `messages/*.json`. Existing translations are overwritten. Key order follows en.json.

### Step 4: Test

Run `pnpm i18n:test` to validate all locale files match en.json structure.

Report summary: which locales succeeded, which failed, which need retry.

## Translation rules

- Translations must be SEO-friendly and natural for native speakers
- Preserve all HTML tags exactly as-is
- Preserve all `{variable}` placeholders exactly as-is
- Preserve special formatting (newlines, markdown, etc.)
- Do not translate brand names or product names
- Use the language name from `getLanguageName()` in helpers.ts for translation prompts
