#!/usr/bin/env node
// Static server for local preview. Serves the repo root at / and at /frontier-prep/
// (the GitHub Pages subpath) so relative links behave exactly as they will in production.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8791);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pathname.startsWith('/frontier-prep/')) pathname = pathname.slice('/frontier-prep'.length);
    if (pathname === '/frontier-prep') pathname = '/';
    if (pathname.includes('..') || pathname.includes('\0')) return send(res, 400, 'bad path');
    let file = path.join(root, pathname);
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      const notFound = path.join(root, '404.html');
      const nf = await stat(notFound).catch(() => null);
      if (nf?.isFile()) {
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        return createReadStream(notFound).pipe(res);
      }
      return send(res, 404, 'not found');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch (error) {
    send(res, 500, String(error));
  }
});

function send(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${root}`);
  console.log(`  http://127.0.0.1:${port}/`);
  console.log(`  http://127.0.0.1:${port}/frontier-prep/`);
});
