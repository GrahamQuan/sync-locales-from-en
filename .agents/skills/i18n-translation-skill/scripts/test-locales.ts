#!/usr/bin/env tsx
/**
 * Test locale files against en.json
 * Validates that all locale files have the exact same keys and nested structure as en.json
 */

/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';

import { getLocales, type NestedObject } from './helpers';

const MESSAGES_DIR = path.join(process.cwd(), 'messages');

/**
 * Get sorted keys from a nested object with their types (leaf vs branch)
 */
function getStructure(obj: NestedObject, prefix = ''): Map<string, 'branch' | 'leaf'> {
  const result = new Map<string, 'branch' | 'leaf'>();

  Object.entries(obj).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result.set(fullKey, 'branch');
      const nested = getStructure(value as NestedObject, fullKey);
      nested.forEach((v, k) => result.set(k, v));
    } else {
      result.set(fullKey, 'leaf');
    }
  });

  return result;
}

interface TestResult {
  locale: string;
  pass: boolean;
  missingKeys: string[];
  extraKeys: string[];
  typeMismatches: string[];
}

/**
 * Test a single locale file against en.json structure
 */
function testLocale(locale: string, enStructure: Map<string, 'branch' | 'leaf'>): TestResult {
  const localePath = path.join(MESSAGES_DIR, `${locale}.json`);

  if (!fs.existsSync(localePath)) {
    return {
      locale,
      pass: false,
      missingKeys: ['FILE NOT FOUND'],
      extraKeys: [],
      typeMismatches: [],
    };
  }

  const content = fs.readFileSync(localePath, 'utf-8');
  let localeJson: NestedObject;
  try {
    localeJson = JSON.parse(content) as NestedObject;
  } catch {
    return {
      locale,
      pass: false,
      missingKeys: ['INVALID JSON'],
      extraKeys: [],
      typeMismatches: [],
    };
  }

  const localeStructure = getStructure(localeJson);

  const missingKeys: string[] = [];
  const typeMismatches: string[] = [];

  Array.from(enStructure.entries()).forEach(([key, enType]) => {
    const localeType = localeStructure.get(key);
    if (!localeType) {
      missingKeys.push(key);
    } else if (localeType !== enType) {
      typeMismatches.push(`${key} (en: ${enType}, ${locale}: ${localeType})`);
    }
  });

  const extraKeys: string[] = [];
  Array.from(localeStructure.keys()).forEach((key) => {
    if (!enStructure.has(key)) {
      extraKeys.push(key);
    }
  });

  return {
    locale,
    pass: missingKeys.length === 0 && extraKeys.length === 0 && typeMismatches.length === 0,
    missingKeys,
    extraKeys,
    typeMismatches,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🧪 Testing locale files against en.json...\n');

  const enPath = path.join(MESSAGES_DIR, 'en.json');
  const enContent = fs.readFileSync(enPath, 'utf-8');
  const enJson = JSON.parse(enContent) as NestedObject;
  const enStructure = getStructure(enJson);

  const enLeafCount = Array.from(enStructure.values()).filter((v) => v === 'leaf').length;
  console.log(`📚 en.json: ${enLeafCount} leaf keys, ${enStructure.size} total entries\n`);

  let allPassed = true;

  const locales = getLocales();
  const results = locales.map((locale) => testLocale(locale, enStructure));

  results.forEach((result) => {
    if (result.pass) {
      console.log(`✅ ${result.locale}.json: PASS`);
    } else {
      allPassed = false;
      console.log(`❌ ${result.locale}.json: FAIL`);

      if (result.missingKeys.length > 0) {
        console.log(`   Missing keys (${result.missingKeys.length}):`);
        result.missingKeys.slice(0, 10).forEach((k) => console.log(`     - ${k}`));
        if (result.missingKeys.length > 10) {
          console.log(`     ... and ${result.missingKeys.length - 10} more`);
        }
      }

      if (result.extraKeys.length > 0) {
        console.log(`   Extra keys (${result.extraKeys.length}):`);
        result.extraKeys.slice(0, 10).forEach((k) => console.log(`     - ${k}`));
        if (result.extraKeys.length > 10) {
          console.log(`     ... and ${result.extraKeys.length - 10} more`);
        }
      }

      if (result.typeMismatches.length > 0) {
        console.log(`   Structure mismatches (${result.typeMismatches.length}):`);
        result.typeMismatches.slice(0, 10).forEach((k) => console.log(`     - ${k}`));
        if (result.typeMismatches.length > 10) {
          console.log(`     ... and ${result.typeMismatches.length - 10} more`);
        }
      }
    }
  });

  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n📊 Results: ${passCount}/${locales.length} passed`);

  if (allPassed) {
    console.log('\n🎉 All locale files match en.json structure!');
  } else {
    console.log('\n💥 Some locale files have issues. Run /sync-i18n-via-en to fix.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
