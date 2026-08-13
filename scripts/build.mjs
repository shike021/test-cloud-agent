#!/usr/bin/env node
/**
 * Production build.
 *
 * Bundles and minifies the ES module sources plus the stylesheet of every page
 * into content-hashed assets, rewrites the asset references in the HTML entry
 * points and copies the static `public/` folder. The output in `dist/` is a
 * self-contained static site that can be served from any web root, including a
 * GitHub Pages sub-path, because every reference stays relative.
 */

import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(projectRoot, 'dist');
const assetsDirName = 'assets';

/**
 * The pages of the arcade. Paths are relative to the project root and use
 * forward slashes, exactly as they appear in the HTML sources.
 *
 * @type {readonly { name: string, html: string, script: string, style: string }[]}
 */
const PAGES = Object.freeze([
  {
    name: 'lobby',
    html: 'index.html',
    script: 'src/js/lobby/main.js',
    style: 'src/styles/lobby.css',
  },
  {
    name: 'snake',
    html: 'snake/index.html',
    script: 'src/js/main.js',
    style: 'src/styles/main.css',
  },
  {
    name: 'gomoku',
    html: 'gomoku/index.html',
    script: 'src/js/gomoku/main.js',
    style: 'src/styles/gomoku.css',
  },
  {
    name: 'game2048',
    html: '2048/index.html',
    script: 'src/js/game2048/main.js',
    style: 'src/styles/game2048.css',
  },
  {
    name: 'lianliankan',
    html: 'lianliankan/index.html',
    script: 'src/js/lianliankan/main.js',
    style: 'src/styles/lianliankan.css',
  },
]);

/**
 * Builds the relative reference an HTML file uses to point at a target file.
 *
 * @param {string} htmlPath Page path relative to the project root.
 * @param {string} targetPath Target path relative to the same root.
 * @returns {string} A reference that always starts with `./` or `../`.
 */
function referenceFrom(htmlPath, targetPath) {
  const relative = path.relative(path.dirname(htmlPath), targetPath).split(path.sep).join('/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

/**
 * @param {import('esbuild').Metafile} metafile
 * @param {string} extension
 * @returns {string} Path of the emitted entry file, relative to `dist/`.
 */
function findEntryOutput(metafile, extension) {
  const match = Object.entries(metafile.outputs).find(
    ([file, output]) => file.endsWith(extension) && output.entryPoint,
  );
  if (!match) {
    throw new Error(`esbuild did not emit an entry output with extension "${extension}".`);
  }
  return path.relative(outDir, path.join(projectRoot, match[0])).split(path.sep).join('/');
}

/**
 * @param {(typeof PAGES)[number]} page
 * @returns {Promise<string>} Bundle path relative to `dist/`.
 */
async function bundleJavaScript(page) {
  const result = await build({
    entryPoints: [path.join(projectRoot, page.script)],
    bundle: true,
    format: 'esm',
    target: ['es2022'],
    minify: true,
    sourcemap: 'linked',
    legalComments: 'none',
    entryNames: `${assetsDirName}/${page.name}-[hash]`,
    outdir: outDir,
    metafile: true,
    logLevel: 'warning',
  });
  return findEntryOutput(result.metafile, '.js');
}

/**
 * @param {(typeof PAGES)[number]} page
 * @returns {Promise<string>} Stylesheet path relative to `dist/`.
 */
async function bundleStyles(page) {
  const result = await build({
    entryPoints: [path.join(projectRoot, page.style)],
    bundle: true,
    minify: true,
    sourcemap: 'linked',
    loader: { '.svg': 'file' },
    entryNames: `${assetsDirName}/${page.name}-[hash]`,
    assetNames: `${assetsDirName}/[name]-[hash]`,
    outdir: outDir,
    metafile: true,
    logLevel: 'warning',
  });
  return findEntryOutput(result.metafile, '.css');
}

/**
 * Rewrites the source references of one page to its hashed bundles.
 *
 * @param {(typeof PAGES)[number]} page
 * @param {string} scriptPath Bundle path relative to `dist/`.
 * @param {string} stylePath Stylesheet path relative to `dist/`.
 */
async function emitHtml(page, scriptPath, stylePath) {
  const source = await readFile(path.join(projectRoot, page.html), 'utf8');
  const replacements = [
    [referenceFrom(page.html, page.style), referenceFrom(page.html, stylePath)],
    [referenceFrom(page.html, page.script), referenceFrom(page.html, scriptPath)],
  ];

  let html = source;
  for (const [from, to] of replacements) {
    if (!html.includes(from)) {
      throw new Error(`${page.html} does not reference "${from}"; the build cannot rewrite it.`);
    }
    html = html.replaceAll(from, to);
  }

  const target = path.join(outDir, page.html);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

/**
 * @param {(typeof PAGES)[number]} page
 * @returns {Promise<string[]>} Emitted files, relative to `dist/`.
 */
async function buildPage(page) {
  const [scriptPath, stylePath] = await Promise.all([bundleJavaScript(page), bundleStyles(page)]);
  await emitHtml(page, scriptPath, stylePath);
  return [page.html, scriptPath, stylePath];
}

async function copyStaticFiles() {
  const publicDir = path.join(projectRoot, 'public');
  if (existsSync(publicDir)) {
    await cp(publicDir, path.join(outDir, 'public'), { recursive: true });
  }
  // Stops GitHub Pages from running the Jekyll pipeline over the artifact.
  await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');
}

/**
 * @param {string[]} files Paths relative to `dist/`.
 */
async function reportSizes(files) {
  const rows = await Promise.all(
    files.map(async (file) => {
      const { size } = await stat(path.join(outDir, file));
      return `  ${file.padEnd(34)} ${(size / 1024).toFixed(1)} kB`;
    }),
  );
  console.log(`Build output in dist/\n${rows.join('\n')}`);
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // The pages share modules but not bundles, so they can be built in parallel.
  const emitted = await Promise.all(PAGES.map((page) => buildPage(page)));
  await copyStaticFiles();
  await reportSizes(emitted.flat());
}

main().catch((error) => {
  console.error(`Build failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
