import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createViscaClient } from './visca.js';
import { getActiveCamera, loadConfig, saveConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createStaticHandler(publicDir) {
  return async function serveStatic(req, res) {
    const url = new URL(req.url, 'http://localhost');
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
    const absolute = path.join(publicDir, filePath);

    if (!absolute.startsWith(publicDir)) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      const data = await fs.readFile(absolute);
      const ext = path.extname(absolute);
      res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      sendJson(res, 404, { error: 'Not found' });
    }
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const config = await loadConfig();

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, config);
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'PUT') {
    const body = await readBody(req);
    await saveConfig(body);
    sendJson(res, 200, body);
    return;
  }

  let camera;
  try {
    camera = getActiveCamera(config);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const visca = createViscaClient(camera);
  const defaults = config.defaults ?? {};

  try {
    if (url.pathname === '/api/ptz/move' && req.method === 'POST') {
      const body = await readBody(req);
      await visca.panTilt(
        body.dir,
        body.panSpeed ?? defaults.panSpeed ?? 10,
        body.tiltSpeed ?? defaults.tiltSpeed ?? 8,
      );
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/ptz/zoom' && req.method === 'POST') {
      const body = await readBody(req);
      await visca.zoom(body.action, body.speed ?? defaults.zoomSpeed ?? 3);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === '/api/ptz/stop' && req.method === 'POST') {
      await visca.stop();
      sendJson(res, 200, { ok: true });
      return;
    }

    const presetMatch = url.pathname.match(/^\/api\/ptz\/preset\/(\d+)$/);
    if (presetMatch && req.method === 'POST') {
      const preset = Number(presetMatch[1]);
      const body = await readBody(req);
      if (body.action === 'save') {
        await visca.savePreset(preset);
      } else {
        await visca.recallPreset(preset);
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

export async function startServer(options = {}) {
  const publicDir = options.publicDir ?? DEFAULT_PUBLIC_DIR;
  const serveStatic = createStaticHandler(publicDir);
  const config = await loadConfig();
  const host = options.host ?? config.server?.host ?? '127.0.0.1';
  const port = options.port ?? config.server?.port ?? 8765;

  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const url = `http://${host}:${port}`;

  return {
    server,
    host,
    port,
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const isDirectRun = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  startServer()
    .then(({ url }) => {
      console.log(`OBS PTZ Web running at ${url}`);
      console.log('Add this URL in OBS: Docks → Custom Browser Docks');
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
