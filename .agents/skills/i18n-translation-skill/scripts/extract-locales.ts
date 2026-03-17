#!/usr/bin/env tsx
/**
 * Extract missing locale keys into per-locale template files using en.json values.
 * Output files are created in i18n-via-en/YYYY-MM-DD/{locale}.json.
 *
 * Usage: pnpm i18n:extract
 */

/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import { flattenObject, getKeyOrder, unflattenWithOrder, type MissingReport, type NestedObject } from './helpers';

const MESSAGES_DIR = path.join(process.cwd(), 'messages');
const WORK_DIR = path.join(process.cwd(), 'i18n-via-en', new Date().toISOString().split('T')[0]);
const REPORT_PATH = path.join(WORK_DIR, 'missing-keys-report.json');

function readMissingReport(filePath: string): MissingReport[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content) as MissingReport[];
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid missing-keys-report.json format: expected an array');
  }
  return parsed;
}

function extractLocaleTemplate(
  locale: string,
  missingKeys: string[],
  enFlat: Record<string, string>,
  enKeyOrder: string[],
) {
  const extractedFlat: Record<string, string> = {};
  const missingInEn: string[] = [];

  missingKeys.forEach((key) => {
    const englishValue = enFlat[key];
    if (englishValue === undefined) {
      missingInEn.push(key);
      return;
    }
    extractedFlat[key] = englishValue;
  });

  const orderedTemplate = unflattenWithOrder(extractedFlat, enKeyOrder) as NestedObject;
  const outputPath = path.join(WORK_DIR, `${locale}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(orderedTemplate, null, 2)}\n`);

  console.log(`✅ ${locale}.json: extracted ${Object.keys(extractedFlat).length} keys`);
  if (missingInEn.length > 0) {
    console.log(`   ⚠️  ${missingInEn.length} keys were listed in report but not found in en.json`);
  }
}

async function main() {
  console.log('📦 Extracting locale templates from en.json...\n');

  if (!fs.existsSync(WORK_DIR)) {
    console.error(`❌ Error: Work directory not found: ${WORK_DIR}`);
    console.error('   Please run pnpm i18n:compare first');
    process.exit(1);
  }

  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`❌ Error: Missing report not found: ${REPORT_PATH}`);
    console.error('   Please run pnpm i18n:compare first');
    process.exit(1);
  }

  const enPath = path.join(MESSAGES_DIR, 'en.json');
  const enJson = JSON.parse(fs.readFileSync(enPath, 'utf-8')) as NestedObject;
  const enFlat = flattenObject(enJson);
  const enKeyOrder = getKeyOrder(enJson);

  const reports = readMissingReport(REPORT_PATH);
  const localesWithMissing = reports.filter((report) => report.missingCount > 0);

  if (localesWithMissing.length === 0) {
    console.log('🎉 No missing keys found. Nothing to extract.');
    return;
  }

  localesWithMissing.forEach((report) => extractLocaleTemplate(report.locale, report.missingKeys, enFlat, enKeyOrder));

  console.log('\n✅ Extraction complete!');
  console.log(`   Output directory: ${WORK_DIR}`);
  console.log(`   Locale files created: ${localesWithMissing.length}`);
}

main().catch((error) => {
  console.error('\n❌ Extraction failed:', error);
  process.exit(1);
});
