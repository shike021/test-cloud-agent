#!/usr/bin/env node
/**
 * Zero-dependency static file server for local development and previews.
 *
 * ES modules cannot be loaded over the `file://` protocol, so the game needs a
 * real HTTP origin. This server intentionally stays minimal: it resolves paths
 * safely inside the served root, sets the correct content types and disables
 * caching so edits show up on reload.
 *
 * Usage: node scripts/dev-server.mjs [--root dist] [--port 5173] [--host 127.0.0.1]
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
});

/**
 * @param {string[]} argv
 * @returns {{ root: string, port: number, host: string }}
 */
function parseArguments(argv) {
  const options = { root: '.', port: 5173, host: '127.0.0.1' };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    switch (flag) {
      case '--root':
      case '--port':
      case '--host': {
        if (!value) {
          throw new Error(`Missing value for ${flag}`);
        }
        if (flag === '--port') {
          const port = Number.parseInt(value, 10);
          if (!Number.isInteger(port) || port <= 0 || port > 65535) {
            throw new Error(`Invalid port: ${value}`);
          }
          options.port = port;
        } else if (flag === '--root') {
          options.root = value;
        } else {
          options.host = value;
        }
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  return options;
}

/**
 * Resolves a request path to a file inside `root`, rejecting traversal attempts.
 *
 * @param {string} root
 * @param {string} requestUrl
 * @returns {string|null}
 */
function resolveRequestPath(root, requestUrl) {
  const { pathname } = new URL(requestUrl, 'http://localhost');
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const resolved = path.resolve(root, `.${relative}`);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return null;
  }
  return resolved;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = path.resolve(projectRoot, options.root);

  const server = http.createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed');
      return;
    }

    const filePath = resolveRequestPath(root, request.url ?? '/');
    if (!filePath) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      let target = filePath;
      let info = await stat(target);
      if (info.isDirectory()) {
        target = path.join(target, 'index.html');
        info = await stat(target);
      }

      response.writeHead(200, {
        'content-type':
          CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
        'content-length': info.size,
        'cache-control': 'no-cache, no-store, must-revalidate',
      });

      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found');
    }
  });

  server.listen(options.port, options.host, () => {
    console.log(`Serving ${root}\n  http://${options.host}:${options.port}/`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
