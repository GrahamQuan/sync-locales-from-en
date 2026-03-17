#!/usr/bin/env tsx
/**
 * Merge translated temp files back to messages/ directory
 * Preserves key order from en.json
 *
 * Usage: pnpm i18n:merge
 */

/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import { flattenObject, getKeyOrder, getLocales, unflattenWithOrder, type NestedObject } from './helpers';

const MESSAGES_DIR = path.join(process.cwd(), 'messages');
const WORK_DIR = path.join(process.cwd(), 'i18n-via-en', new Date().toISOString().split('T')[0]);

/**
 * Merge one locale file
 */
function mergeLocale(locale: string, keyOrder: string[]) {
  const tempPath = path.join(WORK_DIR, `${locale}.json`);
  const targetPath = path.join(MESSAGES_DIR, `${locale}.json`);

  if (!fs.existsSync(tempPath)) {
    console.log(`⏭️  ${locale}.json: No temp file, skipping`);
    return;
  }

  const existingFlat = flattenObject(JSON.parse(fs.readFileSync(targetPath, 'utf-8')) as NestedObject);
  const tempFlat = flattenObject(JSON.parse(fs.readFileSync(tempPath, 'utf-8')) as NestedObject);

  // Merge: temp translations overwrite existing ones
  const mergedFlat = { ...existingFlat, ...tempFlat };
  const ordered = unflattenWithOrder(mergedFlat, keyOrder);

  fs.writeFileSync(targetPath, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(`✅ ${locale}.json: Merged successfully (${Object.keys(tempFlat).length} new/updated keys)`);
}

async function main() {
  console.log('🔄 Starting merge process...\n');

  if (!fs.existsSync(WORK_DIR)) {
    console.error(`❌ Error: Work directory not found: ${WORK_DIR}`);
    console.error('   Please run translation step first');
    process.exit(1);
  }

  const enPath = path.join(MESSAGES_DIR, 'en.json');
  const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8')) as NestedObject;
  const keyOrder = getKeyOrder(enJson);
  console.log(`📚 Key order from en.json: ${keyOrder.length} keys\n`);

  const locales = getLocales();
  locales.forEach((locale) => mergeLocale(locale, keyOrder));

  console.log('\n✅ Merge complete!');
  console.log(`   Updated files in: ${MESSAGES_DIR}`);
}

main().catch(console.error);
