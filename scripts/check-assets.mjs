#!/usr/bin/env node
/**
 * Static integrity check for the shipped front-end.
 *
 * Catches the classes of breakage that a unit test cannot see:
 *   1. An entry page references an asset that does not exist on disk.
 *   2. An asset is referenced with a root-absolute path, which breaks when the
 *      site is served from a GitHub Pages sub-path.
 *   3. An ES module imports a relative file that is missing (typo in a path).
 *   4. A stylesheet references a missing `url()` asset.
 *   5. An entry page of the arcade is missing entirely.
 *
 * Usage: node scripts/check-assets.mjs [--root .]
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every HTML entry point of the arcade, relative to the checked root. */
const ENTRY_PAGES = Object.freeze(['index.html', 'snake/index.html', 'gomoku/index.html']);

const HTML_REFERENCE_PATTERN = /(?:href|src)\s*=\s*"([^"]+)"/g;
const IMPORT_PATTERN =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSS_URL_PATTERN = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
const CSS_IMPORT_PATTERN = /@import\s+(?:url\()?['"]([^'"]+)['"]/g;

const EXTERNAL_PREFIXES = ['http://', 'https://', 'data:', 'mailto:', 'tel:', '//', '#'];

/** @type {string[]} */
const errors = [];
/** @type {Set<string>} */
const visitedModules = new Set();
let checkedReferences = 0;

/**
 * @param {string} reference
 * @returns {boolean}
 */
function isExternal(reference) {
  return EXTERNAL_PREFIXES.some((prefix) => reference.startsWith(prefix));
}

/**
 * @param {string} reference
 * @returns {string} The reference without query string or hash fragment.
 */
function stripSuffix(reference) {
  return reference.split('#')[0].split('?')[0];
}

/**
 * @param {string} sourceFile Absolute path of the referencing file.
 * @param {string} reference
 * @param {string} kind Human readable reference category.
 * @returns {string|null} Absolute path of the referenced file when it exists.
 */
function verifyReference(sourceFile, reference, kind) {
  if (isExternal(reference) || reference.length === 0) {
    return null;
  }

  const relativeSource = path.relative(projectRoot, sourceFile);

  if (reference.startsWith('/')) {
    errors.push(
      `${relativeSource}: ${kind} "${reference}" uses a root-absolute path, ` +
        'which breaks when the site is hosted under a sub-path. Use a relative path instead.',
    );
    return null;
  }

  const target = path.resolve(path.dirname(sourceFile), stripSuffix(reference));
  checkedReferences += 1;

  if (!existsSync(target)) {
    errors.push(
      `${relativeSource}: ${kind} "${reference}" does not exist ` +
        `(resolved to ${path.relative(projectRoot, target)}).`,
    );
    return null;
  }

  return target;
}

/**
 * @param {string} content
 * @param {RegExp} pattern
 * @returns {string[]}
 */
function collectMatches(content, pattern) {
  /** @type {string[]} */
  const references = [];
  for (const match of content.matchAll(pattern)) {
    const value = match[1] ?? match[2];
    if (value) {
      references.push(value);
    }
  }
  return references;
}

/**
 * @param {string} cssFile
 */
async function checkStylesheet(cssFile) {
  if (visitedModules.has(cssFile)) {
    return;
  }
  visitedModules.add(cssFile);

  const content = await readFile(cssFile, 'utf8');
  for (const reference of collectMatches(content, CSS_URL_PATTERN)) {
    verifyReference(cssFile, reference, 'CSS url()');
  }
  for (const reference of collectMatches(content, CSS_IMPORT_PATTERN)) {
    const target = verifyReference(cssFile, reference, 'CSS @import');
    if (target) {
      await checkStylesheet(target);
    }
  }
}

/**
 * @param {string} moduleFile
 */
async function checkModule(moduleFile) {
  if (visitedModules.has(moduleFile)) {
    return;
  }
  visitedModules.add(moduleFile);

  const content = await readFile(moduleFile, 'utf8');
  for (const specifier of collectMatches(content, IMPORT_PATTERN)) {
    if (!specifier.startsWith('.')) {
      // Bare specifiers are resolved by the bundler, not by the browser.
      continue;
    }
    const target = verifyReference(moduleFile, specifier, 'import');
    if (target) {
      await checkModule(target);
    }
  }
}

/**
 * @param {string} htmlFile
 */
async function checkHtml(htmlFile) {
  const content = await readFile(htmlFile, 'utf8');
  const references = collectMatches(content, HTML_REFERENCE_PATTERN);

  if (references.length === 0) {
    errors.push(`${path.relative(projectRoot, htmlFile)}: no asset references found.`);
  }

  for (const reference of references) {
    const target = verifyReference(htmlFile, reference, 'HTML reference');
    if (!target) {
      continue;
    }
    if (target.endsWith('.css')) {
      await checkStylesheet(target);
    } else if (target.endsWith('.js') || target.endsWith('.mjs')) {
      await checkModule(target);
    }
  }
}

async function main() {
  const rootArgumentIndex = process.argv.indexOf('--root');
  const root =
    rootArgumentIndex === -1
      ? projectRoot
      : path.resolve(projectRoot, process.argv[rootArgumentIndex + 1] ?? '.');

  /** @type {string[]} */
  const missingPages = [];
  for (const page of ENTRY_PAGES) {
    const entryHtml = path.join(root, page);
    if (!existsSync(entryHtml)) {
      missingPages.push(path.relative(projectRoot, entryHtml));
      continue;
    }
    await checkHtml(entryHtml);
  }

  if (missingPages.length > 0) {
    console.error(`Asset check failed: missing entry page(s): ${missingPages.join(', ')}.`);
    process.exitCode = 1;
    return;
  }

  if (errors.length > 0) {
    console.error(`Asset check failed with ${errors.length} problem(s):`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Asset check passed: ${ENTRY_PAGES.length} entry page(s), ${checkedReferences} ` +
      `reference(s) resolved across ${visitedModules.size} module/stylesheet file(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
