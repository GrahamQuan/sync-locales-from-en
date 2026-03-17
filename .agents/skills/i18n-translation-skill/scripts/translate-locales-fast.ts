#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Fast locale translation for extracted i18n files.
 * - Translates all JSON files in i18n-via-en/YYYY-MM-DD
 * - Excludes missing-keys-report.json
 * - Preserves placeholders and HTML tags
 *
 * Usage:
 *   pnpm i18n:translate
 *   pnpm i18n:translate -- 2026-03-16
 */
import * as fs from 'fs';
import * as path from 'path';

interface TranslationEntry {
  keyPath: string;
  originalValue: string;
}

interface MaskResult {
  maskedText: string;
  tokenMap: Map<string, string>;
}

const ROOT_DIR = process.cwd();
const RAW_ARGS = process.argv.slice(2).filter((arg) => arg !== '--');
const DATE_ARG = RAW_ARGS[0];
const WORK_DATE = DATE_ARG || new Date().toISOString().split('T')[0];
const WORK_DIR = path.join(ROOT_DIR, 'i18n-via-en', WORK_DATE);

const LOCALE_TO_TARGET_LANG: Record<string, string> = {
  ar: 'ar',
  cn: 'zh-CN',
  de: 'de',
  es: 'es',
  fr: 'fr',
  id: 'id',
  it: 'it',
  ja: 'ja',
  ko: 'ko',
  pt: 'pt',
  ru: 'ru',
  th: 'th',
  tw: 'zh-TW',
  vi: 'vi',
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldTranslate(text: string): boolean {
  if (!text.trim()) return false;
  return /[A-Za-z]/.test(text);
}

function maskText(text: string): MaskResult {
  const patterns = [/<\/?[^>]+>/g, /\{[^{}]+\}/g, /https?:\/\/[^\s)]+/g];
  const tokenMap = new Map<string, string>();
  let maskedText = text;
  let tokenIndex = 0;

  patterns.forEach((pattern) => {
    maskedText = maskedText.replace(pattern, (matched) => {
      const token = `@@PH_${tokenIndex}@@`;
      tokenMap.set(token, matched);
      tokenIndex += 1;
      return token;
    });
  });

  return { maskedText, tokenMap };
}

function unmaskText(text: string, tokenMap: Map<string, string>): string {
  let result = text;
  tokenMap.forEach((original, token) => {
    result = result.split(token).join(original);
  });
  return result;
}

function getLeafEntries(obj: unknown, prefix = ''): TranslationEntry[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];

  const result: TranslationEntry[] = [];
  const record = obj as Record<string, unknown>;

  Object.entries(record).forEach(([key, value]) => {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.push({ keyPath: fullPath, originalValue: value });
      return;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...getLeafEntries(value, fullPath));
    }
  });

  return result;
}

function setValueAtPath(obj: Record<string, unknown>, keyPath: string, value: string) {
  const parts = keyPath.split('.');
  let current: Record<string, unknown> = obj;

  parts.slice(0, -1).forEach((part) => {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });

  current[parts[parts.length - 1]] = value;
}

async function translateText(text: string, targetLang: string): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: targetLang,
    dt: 't',
    q: text,
  });

  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
  if (!response.ok) {
    throw new Error(`Translate API failed: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  const chunks = (data as any)?.[0];
  if (!Array.isArray(chunks)) return text;

  return chunks.map((chunk: any) => chunk?.[0] || '').join('');
}

async function translateWithRetry(text: string, targetLang: string): Promise<string> {
  let attempts = 0;
  let lastError: unknown = null;

  while (attempts < 4) {
    try {
      return await translateText(text, targetLang);
    } catch (error) {
      lastError = error;
      attempts += 1;
      await sleep(200 * attempts);
    }
  }

  throw lastError;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return results;
}

async function translateLocaleFile(filePath: string) {
  const locale = path.basename(filePath, '.json');
  const targetLang = LOCALE_TO_TARGET_LANG[locale];

  if (!targetLang) {
    console.log(`⏭️  ${locale}.json: no target language mapping, skipped`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content) as Record<string, unknown>;
  const entries = getLeafEntries(json);
  const translatable = entries.filter((entry) => shouldTranslate(entry.originalValue));
  const cache = new Map<string, string>();

  console.log(`🌐 ${locale}.json: translating ${translatable.length} values...`);

  let done = 0;
  const tasks = translatable.map((entry) => async () => {
    if (cache.has(entry.originalValue)) {
      setValueAtPath(json, entry.keyPath, cache.get(entry.originalValue) as string);
      done += 1;
      if (done % 50 === 0 || done === translatable.length) {
        console.log(`   ${locale}.json: ${done}/${translatable.length}`);
      }
      return;
    }

    const { maskedText, tokenMap } = maskText(entry.originalValue);
    const translatedMasked = await translateWithRetry(maskedText, targetLang);
    const translated = unmaskText(translatedMasked, tokenMap);

    cache.set(entry.originalValue, translated);
    setValueAtPath(json, entry.keyPath, translated);

    done += 1;
    if (done % 50 === 0 || done === translatable.length) {
      console.log(`   ${locale}.json: ${done}/${translatable.length}`);
    }
  });

  await runWithConcurrency(tasks, 10);
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`✅ ${locale}.json: done`);
}

async function main() {
  console.log(`🚀 Fast locale translation in: ${WORK_DIR}\n`);

  if (!fs.existsSync(WORK_DIR)) {
    console.error(`❌ Directory not found: ${WORK_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(WORK_DIR)
    .filter((file) => file.endsWith('.json') && file !== 'missing-keys-report.json')
    .sort()
    .map((file) => path.join(WORK_DIR, file));

  if (files.length === 0) {
    console.log('No locale json files found.');
    return;
  }

  for (const file of files) {
    // Keep locale processing sequential to avoid API throttling spikes.
    await translateLocaleFile(file);
  }

  console.log('\n✅ All locale files translated.');
}

main().catch((error) => {
  console.error('\n❌ Translation failed:', error);
  process.exit(1);
});
