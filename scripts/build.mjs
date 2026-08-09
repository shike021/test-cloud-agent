#!/usr/bin/env node
/**
 * Production build.
 *
 * Bundles and minifies the ES module sources plus the stylesheet into
 * content-hashed assets, rewrites the asset references in `index.html` and
 * copies the static `public/` folder. The output in `dist/` is a self-contained
 * static site that can be served from any web root, including a GitHub Pages
 * sub-path, because every reference stays relative.
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

async function bundleJavaScript() {
  const result = await build({
    entryPoints: [path.join(projectRoot, 'src/js/main.js')],
    bundle: true,
    format: 'esm',
    target: ['es2022'],
    minify: true,
    sourcemap: 'linked',
    legalComments: 'none',
    entryNames: `${assetsDirName}/app-[hash]`,
    outdir: outDir,
    metafile: true,
    logLevel: 'warning',
  });
  return findEntryOutput(result.metafile, '.js');
}

async function bundleStyles() {
  const result = await build({
    entryPoints: [path.join(projectRoot, 'src/styles/main.css')],
    bundle: true,
    minify: true,
    sourcemap: 'linked',
    loader: { '.svg': 'file' },
    entryNames: `${assetsDirName}/style-[hash]`,
    assetNames: `${assetsDirName}/[name]-[hash]`,
    outdir: outDir,
    metafile: true,
    logLevel: 'warning',
  });
  return findEntryOutput(result.metafile, '.css');
}

/**
 * @param {string} scriptPath
 * @param {string} stylePath
 */
async function emitHtml(scriptPath, stylePath) {
  const source = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  const replacements = [
    ['./src/styles/main.css', `./${stylePath}`],
    ['./src/js/main.js', `./${scriptPath}`],
  ];

  let html = source;
  for (const [from, to] of replacements) {
    if (!html.includes(from)) {
      throw new Error(`index.html does not reference "${from}"; the build cannot rewrite it.`);
    }
    html = html.replaceAll(from, to);
  }

  await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
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

  const [scriptPath, stylePath] = await Promise.all([bundleJavaScript(), bundleStyles()]);
  await emitHtml(scriptPath, stylePath);
  await copyStaticFiles();
  await reportSizes(['index.html', scriptPath, stylePath]);
}

main().catch((error) => {
  console.error(`Build failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
