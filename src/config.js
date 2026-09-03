import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let DEFAULT_PATH = path.join(ROOT, 'config', 'cameras.json');
let LOCAL_PATH = path.join(ROOT, 'config', 'cameras.local.json');
let cachedConfig = null;

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function setConfigPaths({ defaultPath, localPath }) {
  DEFAULT_PATH = defaultPath;
  LOCAL_PATH = localPath;
  cachedConfig = null;
}

export function clearConfigCache() {
  cachedConfig = null;
}

export async function loadConfig() {
  if (cachedConfig) return cachedConfig;

  try {
    cachedConfig = await readJson(LOCAL_PATH);
  } catch {
    try {
      cachedConfig = await readJson(DEFAULT_PATH);
    } catch (error) {
      throw new Error(`Config not found: ${DEFAULT_PATH} (${error.message})`);
    }
  }

  return cachedConfig;
}

export async function saveConfig(config) {
  cachedConfig = config;
  await writeJson(LOCAL_PATH, config);
}

export function getActiveCamera(config) {
  const camera = config.cameras.find((item) => item.id === config.activeCameraId);
  if (!camera) {
    throw new Error(`Camera not found: ${config.activeCameraId}`);
  }
  return camera;
}

export function getConfigPaths() {
  return { defaultPath: DEFAULT_PATH, localPath: LOCAL_PATH };
}

export async function ensureLocalConfig() {
  try {
    await fs.access(LOCAL_PATH);
  } catch {
    const defaults = await readJson(DEFAULT_PATH);
    await writeJson(LOCAL_PATH, defaults);
  }
}
