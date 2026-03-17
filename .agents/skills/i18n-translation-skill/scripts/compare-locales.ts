#!/usr/bin/env tsx
/**
 * Compare en.json with other locale files to find missing keys
 * Output: JSON report of missing keys per locale
 *
 * Usage: pnpm i18n:compare
 */

/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import { flattenObject, getLocales, type MissingReport } from './helpers';

const MESSAGES_DIR = path.join(process.cwd(), 'messages');
const OUTPUT_DIR = path.join(process.cwd(), 'i18n-via-en', new Date().toISOString().split('T')[0]);

/**
 * Get all flattened keys from a JSON file
 */
function getKeysFromFile(filePath: string): Set<string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(content);
  const flattened = flattenObject(json);
  return new Set(Object.keys(flattened));
}

/**
 * Compare en.json with target locale file
 */
function compareLocale(locale: string, enKeys: Set<string>): MissingReport {
  const localePath = path.join(MESSAGES_DIR, `${locale}.json`);
  const localeKeys = getKeysFromFile(localePath);
  const missingKeys = Array.from(enKeys).filter((key) => !localeKeys.has(key));

  return {
    locale,
    missingKeys,
    missingCount: missingKeys.length,
  };
}

async function main() {
  console.log('🔍 Starting locale comparison...\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const enPath = path.join(MESSAGES_DIR, 'en.json');
  const enKeys = getKeysFromFile(enPath);
  console.log(`📚 Base file (en.json): ${enKeys.size} keys\n`);

  const locales = getLocales();
  const reports: MissingReport[] = locales.map((locale) => {
    const report = compareLocale(locale, enKeys);
    console.log(`${locale}.json: ${report.missingCount} missing keys`);
    return report;
  });

  const reportPath = path.join(OUTPUT_DIR, 'missing-keys-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\n✅ Report saved to: ${reportPath}`);

  const totalMissing = reports.reduce((sum, r) => sum + r.missingCount, 0);
  console.log('\n📊 Summary:');
  console.log(`   Total locales: ${locales.length}`);
  console.log(`   Total missing keys: ${totalMissing}`);

  if (totalMissing === 0) {
    console.log('\n🎉 All locales are in sync!');
  }
}

main().catch(console.error);
