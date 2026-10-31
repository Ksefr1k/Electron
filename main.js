const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu, nativeImage, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const { execFile } = cp;
const { Readable, Transform } = require('stream');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const AdmZip = require('adm-zip');

// MCLC запускает Java через child_process: без windowsHide на Windows мигает/остаётся окно cmd
const _spawn = cp.spawn;
cp.spawn = function (cmd, args, opts) {
  if (!Array.isArray(args)) {
    opts = args;
    args = [];
  }
  return _spawn.call(this, cmd, args, { windowsHide: true, ...(opts || {}) });
};
const _exec = cp.exec;
cp.exec = function (cmd, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  return _exec.call(this, cmd, { windowsHide: true, ...(opts || {}) }, cb);
};

const { Client, Authenticator } = require('minecraft-launcher-core');
const { Auth } = require('msmc');

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const isWin = process.platform === 'win32';

let win = null;
let cfg = null;
let gameProc = null;
let manifest = null;
let javaCache = null;

/* ------------------------------ хранилище ------------------------------ */

const cfgPath = () => path.join(app.getPath('userData'), 'launcher.json');

function defaults() {
  const totalMB = Math.floor(os.totalmem() / 1048576);
  const ramMax = Math.max(1024, Math.min(4096, Math.floor((totalMB * 0.5) / 256) * 256));
  return {
    selectedVersion: null,
    activeAccount: null,
    javaPath: 'auto',
    preferredLoader: 'fabric',
    ramMax,
    ramMin: 1024,
    gameDir: path.join(app.getPath('appData'), '.mylauncher'),
    width: 1280,
    height: 720,
    fullscreen: false,
    jvmArgs: '',
    closeOnLaunch: false,
    showConsole: false,
    isolateBuilds: true,
    theme: 'green',
    lastPage: 'home',
    navMode: '',
    hzKind: 'mod',
    hzView: 'catalog',
    hzSrc: 'horizon',
  };
}

function loadCfg() {
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath(), 'utf8'));
    return { settings: { ...defaults(), ...(raw.settings || {}) }, accounts: raw.accounts || [] };
  } catch {
    return { settings: defaults(), accounts: [] };
  }
}

function saveCfg() {
  fs.mkdirSync(path.dirname(cfgPath()), { recursive: true });
  fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2));
}

const enc = (s) =>
  safeStorage.isEncryptionAvailable()
    ? 'e:' + safeStorage.encryptString(s).toString('base64')
    : 'p:' + Buffer.from(s).toString('base64');
const dec = (s) =>
  s.startsWith('e:')
    ? safeStorage.decryptString(Buffer.from(s.slice(2), 'base64'))
    : Buffer.from(s.slice(2), 'base64').toString();

const publicAccounts = () =>
  cfg.accounts.map(({ id, type, name, uuid }) => ({ id, type, name, uuid }));
const accountsState = () => ({
  ok: true,
  accounts: publicAccounts(),
  activeAccount: cfg.settings.activeAccount,
});

const send = (ch, data) => {
  if (win && !win.isDestroyed()) win.webContents.send(ch, data);
};
const logFile = () => path.join(app.getPath('userData'), 'launcher.log');
const log = (m) => {
  send('game:log', String(m));
  try {
    fs.appendFileSync(logFile(), String(m) + '\n');
  } catch {}
};
let stopping = false;

/* -------------------------------- окно --------------------------------- */

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1180,
    height: 740,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    backgroundColor: '#080d0b',
    title: 'Electron',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('win:min', () => win && win.minimize());
ipcMain.handle('win:close', () => win && win.close());

/* ------------------------------ настройки ------------------------------ */

ipcMain.handle('settings:get', () => cfg.settings);
ipcMain.handle('settings:set', (_e, patch) => {
  const allowed = Object.keys(defaults());
  for (const [k, v] of Object.entries(patch || {})) {
    if (allowed.includes(k)) cfg.settings[k] = v;
  }
  saveCfg();
  return cfg.settings;
});

ipcMain.handle('sys:info', () => ({
  totalMemMB: Math.floor(os.totalmem() / 1048576),
  cpus: os.cpus().length,
  platform: process.platform,
}));

ipcMain.handle('sys:pickFolder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('sys:openFolder', (_e, p) => {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {}
  return shell.openPath(p);
});

/* --------------------------------- Java -------------------------------- */

const javaName = isWin ? 'java.exe' : 'java';

function findJavas(root, depth = 0, out = []) {
  if (depth > 4) return out;
  const bin = path.join(root, 'bin', javaName);
  if (fs.existsSync(bin)) {
    out.push(bin);
    return out;
  }
  let ents;
  try {
    ents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) if (e.isDirectory()) findJavas(path.join(root, e.name), depth + 1, out);
  return out;
}

function probeJava(p) {
  return new Promise((resolve) => {
    execFile(p, ['-version'], { timeout: 6000, windowsHide: true }, (err, so, se) => {
      const out = (se || '') + (so || '');
      const m = out.match(/version "([^"]+)"/);
      if (!m) return resolve(null);
      const v = m[1];
      const major = v.startsWith('1.') ? parseInt(v.split('.')[1], 10) : parseInt(v, 10);
      const vendor = /Temurin|Adoptium/i.test(out)
        ? 'Temurin'
        : /Zulu/i.test(out)
        ? 'Zulu'
        : /Microsoft/i.test(out)
        ? 'Microsoft'
        : /Corretto/i.test(out)
        ? 'Corretto'
        : /Semeru|OpenJ9/i.test(out)
        ? 'Semeru'
        : /OpenJDK/i.test(out)
        ? 'OpenJDK'
        : 'Java';
      resolve({ path: p, version: v, major, vendor, is64: /64-Bit/i.test(out) });
    });
  });
}

function javaRoots() {
  const roots = [path.join(app.getPath('userData'), 'runtime')]; // Java, скачанная лаунчером
  if (process.env.JAVA_HOME) roots.push(process.env.JAVA_HOME);
  if (isWin) {
    const pfs = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean);
    const vendors = [
      'Java',
      'Eclipse Adoptium',
      'Eclipse Foundation',
      'Microsoft',
      'Zulu',
      'BellSoft',
      'Amazon Corretto',
      'Semeru',
      'AdoptOpenJDK',
    ];
    for (const pf of pfs) for (const v of vendors) roots.push(path.join(pf, v));
    const appData = process.env.APPDATA || app.getPath('appData');
    roots.push(path.join(appData, '.minecraft', 'runtime'));
    if (process.env.LOCALAPPDATA) {
      roots.push(
        path.join(process.env.LOCALAPPDATA, 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime')
      );
    }
  } else if (process.platform === 'darwin') {
    roots.push('/Library/Java/JavaVirtualMachines', path.join(os.homedir(), 'Library', 'Application Support', 'minecraft', 'runtime'));
  } else {
    roots.push('/usr/lib/jvm', path.join(os.homedir(), '.minecraft', 'runtime'));
  }
  return roots;
}

async function detectJava(force = false) {
  if (javaCache && !force) return javaCache;
  const paths = new Set();
  for (const r of javaRoots()) {
    // сам JAVA_HOME может быть корнем JDK
    findJavas(r).forEach((p) => paths.add(p));
  }
  const unique = new Map();
  for (const p of paths) {
    let key = p;
    try {
      key = fs.realpathSync(p);
    } catch {}
    if (!unique.has(key)) unique.set(key, p);
  }
  const probed = await Promise.all([...unique.values()].map(probeJava));
  const list = probed.filter(Boolean);
  const fromPath = await probeJava('java');
  if (fromPath && !list.some((j) => j.version === fromPath.version && j.vendor === fromPath.vendor)) {
    list.push({ ...fromPath, path: 'java', fromPath: true });
  }
  list.sort((a, b) => b.major - a.major);
  javaCache = list;
  return list;
}

ipcMain.handle('java:detect', (_e, force) => detectJava(!!force));

ipcMain.handle('sys:pickJava', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Выберите java.exe',
    properties: ['openFile'],
    filters: isWin ? [{ name: 'Java', extensions: ['exe'] }] : [],
  });
  if (r.canceled) return null;
  const info = await probeJava(r.filePaths[0]);
  if (!info) return { error: 'Это не похоже на рабочую Java' };
  return info;
});

function chooseJava(requiredMajor, list) {
  const pool = list.filter((j) => j.is64 || !list.some((x) => x.is64));
  const exact = pool.find((j) => j.major === requiredMajor && !j.fromPath) || pool.find((j) => j.major === requiredMajor);
  if (exact) return exact;
  const higher = pool.filter((j) => j.major > requiredMajor).sort((a, b) => a.major - b.major)[0];
  return higher || null;
}

/* --------------------------- скачивание Java --------------------------- */

const runtimeDir = () => path.join(app.getPath('userData'), 'runtime');
const adoptiumMajor = (r) => (r <= 8 ? 8 : r <= 17 ? 17 : r <= 21 ? 21 : r);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Загрузка с временным файлом, проверкой размера/контрольной суммы и повторными попытками.
async function downloadFile(url, destination, options = {}) {
  const {
    label = 'Загрузка',
    expectedSize = 0,
    expectedHash = '',
    hashType = 'sha256',
    minSize = 1,
    timeout = 15 * 60 * 1000,
    progressChannel = 'loader:progress',
    checkZip = false,
  } = options;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const partPath = destination + '.part';
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let got = 0;
    try {
      fs.rmSync(partPath, { force: true });
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Electron/1.1 (Minecraft desktop launcher)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
      const total = Number(expectedSize) || Number(res.headers.get('content-length')) || 0;
      const hash = crypto.createHash(hashType);
      let lastSent = 0;
      const meter = new Transform({
        transform(chunk, _enc, cb) {
          got += chunk.length;
          hash.update(chunk);
          const now = Date.now();
          if (now - lastSent > 150) {
            lastSent = now;
            const pct = total ? Math.min(99, Math.round((got / total) * 100)) : 0;
            send(progressChannel, {
              label: `${label}${total ? ` ${Math.floor(got / 1048576)}/${Math.max(1, Math.ceil(total / 1048576))} МБ` : ''}`,
              pct,
              attempt,
            });
          }
          cb(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(res.body), meter, fs.createWriteStream(partPath));
      const digest = hash.digest('hex').toLowerCase();
      if (got < minSize) throw new Error(`Скачан слишком маленький файл (${got} байт).`);
      if (expectedSize && got !== expectedSize) throw new Error(`Размер файла не совпадает: ожидалось ${expectedSize}, получено ${got} байт.`);
      if (expectedHash && digest !== String(expectedHash).toLowerCase()) throw new Error('Контрольная сумма скачанного файла не совпала.');
      if (checkZip) {
        const fd = fs.openSync(partPath, 'r');
        try {
          const sig = Buffer.alloc(4);
          fs.readSync(fd, sig, 0, 4, 0);
          if (!(sig[0] === 0x50 && sig[1] === 0x4b)) throw new Error('Сервер вернул не ZIP/JAR-архив.');
        } finally { fs.closeSync(fd); }
      }
      fs.rmSync(destination, { force: true });
      fs.renameSync(partPath, destination);
      send(progressChannel, { label: `${label} — готово`, pct: 100, done: true });
      return { path: destination, size: got, hash: digest };
    } catch (e) {
      lastError = e;
      fs.rmSync(partPath, { force: true });
      if (attempt < 3) {
        log(`[launcher] ${label}: попытка ${attempt}/3 не удалась (${e.message}). Повторяю…`);
        await delay(attempt * 900);
      }
    }
  }
  throw new Error(`${label}: не удалось скачать после 3 попыток. ${lastError ? lastError.message : ''}`.trim());
}

function findJavaInTree(root, depth = 0) {
  if (depth > 5) return null;
  const candidate = path.join(root, 'bin', javaName);
  if (fs.existsSync(candidate)) return candidate;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = findJavaInTree(path.join(root, entry.name), depth + 1);
    if (found) return found;
  }
  return null;
}

// Java скачивается как JDK: у Adoptium JRE-архивы доступны не для всех новых major-версий.
async function downloadJava(required) {
  if (!isWin) {
    throw new Error(`Автоматическое скачивание Java пока поддерживается в Windows. Установите Java ${required} вручную.`);
  }
  const major = adoptiumMajor(required);
  const arch = process.arch === 'ia32' ? 'x86' : 'x64';
  const runtime = runtimeDir();
  const target = path.join(runtime, 'java-' + major);
  const zipPath = path.join(runtime, `java-${major}.zip`);
  const tmp = path.join(runtime, `tmp-java-${major}`);
  const stage = path.join(runtime, `java-${major}-installing`);
  fs.mkdirSync(runtime, { recursive: true });

  log(`[launcher] Скачиваю Java ${major} (Eclipse Temurin, JDK ${arch})…`);
  const assetsUrl = `https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=${arch}&image_type=jdk&os=windows&vendor=eclipse`;
  let assets;
  try {
    assets = await fetchJson(assetsUrl);
  } catch (e) {
    throw new Error(`Не удалось получить информацию о Java ${major} с Adoptium: ${e.message}`);
  }
  const pkg = Array.isArray(assets) && assets[0] && assets[0].binary && assets[0].binary.package;
  if (!pkg || !pkg.link) throw new Error(`Adoptium не нашёл архив Java ${major} для Windows ${arch}.`);

  await downloadFile(pkg.link, zipPath, {
    label: `Скачивание Java ${major}`,
    expectedSize: Number(pkg.size) || 0,
    expectedHash: pkg.checksum || '',
    hashType: 'sha256',
    minSize: 5 * 1024 * 1024,
    progressChannel: 'game:progress',
    timeout: 15 * 60 * 1000,
    checkZip: true,
  });

  send('game:progress', { label: `Распаковка Java ${major}`, pct: 100 });
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(stage, { recursive: true, force: true });
  try {
    new AdmZip(zipPath).extractAllTo(tmp, true);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });
    throw new Error(`Архив Java ${major} повреждён и не распаковывается: ${e.message}`);
  }

  const exe = findJavaInTree(tmp);
  if (!exe) {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });
    throw new Error(`В архиве Java ${major} не найден bin\\${javaName}.`);
  }
  const extractedRoot = path.dirname(path.dirname(exe));
  const stagedExe = path.join(stage, 'bin', javaName);
  try {
    if (path.resolve(extractedRoot) === path.resolve(tmp)) {
      fs.cpSync(tmp, stage, { recursive: true });
    } else {
      fs.renameSync(extractedRoot, stage);
    }
    const checked = await probeJava(stagedExe);
    if (!checked || checked.major !== major) {
      throw new Error(`Распакованная Java не прошла проверку (ожидалась ${major}).`);
    }
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(stage, target);
  } catch (e) {
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(zipPath, { force: true });
    throw e;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });

  const installedExe = path.join(target, 'bin', javaName);
  const info = await probeJava(installedExe);
  if (!info || info.major !== major) throw new Error('Java скачалась, но итоговая установка не прошла проверку. Попробуйте ещё раз.');
  javaCache = null;
  await detectJava(true);
  log(`[launcher] Java ${info.major} установлена и проверена: ${installedExe}`);
  return info;
}

/* ------------------------------- версии -------------------------------- */

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    method: init.method || 'GET',
    body: init.body,
    headers: { 'User-Agent': 'Electron/1.1 (Minecraft desktop launcher)', 'Accept': 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 240); } catch {}
    throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }
  return res.json();
}

function installedIds() {
  const dir = path.join(cfg.settings.gameDir, 'versions');
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, d.name + '.json')))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

ipcMain.handle('versions:installed', () => installedIds());

ipcMain.handle('versions:list', async () => {
  try {
    manifest = await fetchJson(MANIFEST_URL);
    const versions = manifest.versions.map((v) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }));
    // Add only launcher-managed profiles; normal Mojang releases stay in the same list.
    const customDir = path.join(cfg.settings.gameDir, 'versions');
    for (const id of installedIds()) {
      if (versions.some((v) => v.id === id)) continue;
      let j;
      try { j = JSON.parse(fs.readFileSync(path.join(customDir, id, id + '.json'), 'utf8')); } catch { continue; }
      const meta = j.myLauncher || {};
      const loader = detectLoader(id, meta);
      if (!loader) continue;
      // служебный профиль, созданный установщиком NeoForge, — не показываем (есть наша карточка)
      if (loader === 'neoforge' && !j.myLauncher) continue;
      versions.push({
        id,
        type: j.type || 'release',
        releaseTime: j.releaseTime || null,
        loader,
        baseVersion: meta.minecraftVersion || j.inheritsFrom || '',
        loaderVersion: meta.loaderVersion || '',
        packName: meta.packName || '',
      });
    }
    // Horizon запускается на своей странице, в списке сборок его нет
    return { ok: true, latest: manifest.latest, versions };
  } catch (e) {
    const dir = path.join(cfg.settings.gameDir, 'versions');
    const versions = installedIds().map((id) => {
      let type = 'release';
      let releaseTime = null;
      let loader = '';
      let baseVersion = '';
      let loaderVersion = '';
      let packName = '';
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, id, id + '.json'), 'utf8'));
        type = j.type || type;
        releaseTime = j.releaseTime || null;
        const meta = j.myLauncher || {};
        loader = detectLoader(id, meta);
        baseVersion = meta.minecraftVersion || j.inheritsFrom || '';
        loaderVersion = meta.loaderVersion || '';
        packName = meta.packName || '';
      } catch {}
      return { id, type, releaseTime, loader, baseVersion, loaderVersion, packName };
    });
    return { ok: false, error: 'Нет связи с серверами Mojang — показаны только установленные версии', latest: {}, versions };
  }
});

const versionJsonPath = (id) => path.join(cfg.settings.gameDir, 'versions', String(id), String(id) + '.json');
// Папка конкретной сборки: свои mods/shaderpacks/resourcepacks/config/saves. Общие assets/libraries/versions остаются в gameDir.
const instDir = (id = cfg.settings.selectedVersion) => {
  const v = String(id || '');
  return cfg.settings.isolateBuilds && safeVersionId(v) ? path.join(cfg.settings.gameDir, 'instances', v) : cfg.settings.gameDir;
};
const safeVersionId = (id) => /^[A-Za-z0-9._+\-]{1,120}$/.test(String(id || ''));

// Поддерживаемые загрузчики модов.
const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
const LOADER_NAMES = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt' };
const loaderName = (l) => LOADER_NAMES[l] || String(l || '');
function detectLoader(id, meta) {
  const m = meta && meta.loader;
  if (LOADERS.includes(m)) return m;
  const v = String(id || '');
  if (/^fabric-loader-/i.test(v)) return 'fabric';
  if (/^quilt-loader-/i.test(v)) return 'quilt';
  if (/(^|-)neoforge-/i.test(v)) return 'neoforge';
  if (/-forge-/i.test(v)) return 'forge';
  return '';
}
// Какие значения "loaders" искать на Modrinth: Quilt умеет загружать моды Fabric.
const modrinthLoaders = (loader) => (loader === 'quilt' ? ['quilt', 'fabric'] : [loader]);
const hasLoader = (list, loader) => modrinthLoaders(loader).some((l) => (list || []).includes(l));

async function getMinecraftVersionInfo(id) {
  if (!safeVersionId(id)) throw new Error('Некорректная версия Minecraft.');
  let json = null;
  try { json = JSON.parse(fs.readFileSync(versionJsonPath(id), 'utf8')); } catch {}
  if (json && !json.myLauncher) return json;
  if (manifest) {
    const entry = manifest.versions.find((v) => v.id === id);
    if (entry) return fetchJson(entry.url);
  }
  const latestManifest = await fetchJson(MANIFEST_URL);
  manifest = latestManifest;
  const entry = latestManifest.versions.find((v) => v.id === id);
  if (!entry) throw new Error(`Версия Minecraft ${id} не найдена в официальном манифесте.`);
  return fetchJson(entry.url);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Electron/1.1 (Minecraft desktop launcher)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchInstallerJar(file, url, label) {
  if (fs.existsSync(file)) {
    try {
      const fd = fs.openSync(file, 'r');
      const head = Buffer.alloc(2);
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      if (head[0] === 0x50 && head[1] === 0x4b && fs.statSync(file).size > 1024) return file;
    } catch {}
    fs.rmSync(file, { force: true });
  }
  await downloadFile(url, file, { label, minSize: 1024, progressChannel: 'loader:progress', timeout: 10 * 60 * 1000, checkZip: true });
  return file;
}

async function fetchForgeInstaller(mcVersion, forgeVersion) {
  const file = path.join(app.getPath('userData'), 'loaders', `forge-${mcVersion}-${forgeVersion}-installer.jar`);
  const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/forge-${mcVersion}-${forgeVersion}-installer.jar`;
  return fetchInstallerJar(file, url, `Скачивание Forge ${forgeVersion}`);
}

/* ------------------------------- NeoForge ------------------------------- */

const NEO_MAVEN = 'https://maven.neoforged.net/releases';

// «1.21.1.» → «21.1.», «1.21» → «21.0.»; для новой схемы Mojang (26.1, 26.1.2) — «26.1.0.», «26.1.2.».
function neoForgePrefixes(mc) {
  const old = /^1\.(\d+)(?:\.(\d+))?$/.exec(mc);
  if (old) return [`${old[1]}.${old[2] || 0}.`];
  const nw = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(mc);
  if (nw) return [`${nw[1]}.${nw[2]}.${nw[3] || 0}.`, nw[3] ? `${nw[1]}.${nw[2]}.${nw[3]}.` : `${nw[1]}.${nw[2]}.`];
  return [];
}

const cmpVer = (a, b) => {
  const pa = String(a).split(/[.\-+]/);
  const pb = String(b).split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i], y = pb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) { if (+x !== +y) return +x - +y; } else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};

async function mavenVersions(base, group, artifact) {
  const gpath = group.replace(/\./g, '/');
  try {
    const xml = await fetchText(`${base}/${gpath}/${artifact}/maven-metadata.xml`);
    const list = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
    if (list.length) return list;
  } catch {}
  const r = await fetchJson(`https://maven.neoforged.net/api/maven/versions/releases/${gpath}/${artifact}`);
  return Array.isArray(r && r.versions) ? r.versions : [];
}

// Возвращает { version, installerUrl, file }.
async function resolveNeoForge(mcVersion, wanted) {
  // Для 1.20.1 NeoForge жил в старом артефакте net.neoforged:forge (версии вида 1.20.1-47.1.x).
  const legacy = mcVersion === '1.20.1';
  const group = 'net.neoforged';
  const artifact = legacy ? 'forge' : 'neoforge';
  const list = await mavenVersions(NEO_MAVEN, group, artifact);
  let version = '';
  if (wanted && list.includes(wanted)) version = wanted;
  if (!version) {
    let pool;
    if (legacy) pool = list.filter((v) => v.startsWith('1.20.1-'));
    else {
      pool = [];
      for (const prefix of neoForgePrefixes(mcVersion)) {
        pool = list.filter((v) => v.startsWith(prefix));
        if (pool.length) break;
      }
    }
    if (!pool.length) throw new Error(`Для Minecraft ${mcVersion} нет сборок NeoForge. Попробуйте другую версию Minecraft, Fabric или Forge.`);
    const stable = pool.filter((v) => !/[-+](alpha|beta|rc|snapshot)/i.test(v) && !/-/.test(v.replace(/^1\.20\.1-/, '')));
    version = (stable.length ? stable : pool).sort(cmpVer).pop();
  }
  const name = legacy ? 'forge' : 'neoforge';
  const url = `${NEO_MAVEN}/net/neoforged/${artifact}/${version}/${name}-${version}-installer.jar`;
  return { version, url, file: path.join(app.getPath('userData'), 'loaders', `neoforge-${mcVersion}-${version}-installer.jar`) };
}

function neoInstallerProfileId(installerPath) {
  const zip = new AdmZip(installerPath);
  const entry = zip.getEntry('version.json');
  if (!entry) throw new Error('В установщике NeoForge нет version.json.');
  const id = String(JSON.parse(zip.readAsText(entry)).id || '');
  if (!safeVersionId(id)) throw new Error('Установщик NeoForge вернул некорректный идентификатор.');
  return id;
}

// Запускает официальный установщик NeoForge (--installClient) один раз; возвращает id реального профиля.
async function ensureNeoForgeInstalled(installerPath, javaPath, onStatus) {
  const realId = neoInstallerProfileId(installerPath);
  const gameDir = cfg.settings.gameDir;
  const verDir = path.join(gameDir, 'versions', realId);
  const marker = path.join(verDir, '.mylauncher-installed');
  if (fs.existsSync(marker) && fs.existsSync(path.join(verDir, `${realId}.json`))) return realId;

  fs.mkdirSync(gameDir, { recursive: true });
  const lp = path.join(gameDir, 'launcher_profiles.json');
  if (!fs.existsSync(lp)) fs.writeFileSync(lp, JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2));

  log(`[launcher] Запуск установщика NeoForge (${realId})…`);
  onStatus('Установка NeoForge — это займёт несколько минут');
  await new Promise((resolve, reject) => {
    const proc = cp.spawn(javaPath, ['-jar', installerPath, '--installClient', gameDir], { cwd: gameDir, windowsHide: true });
    let tail = '';
    const feed = (d) => {
      const text = String(d);
      for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        tail = (tail + '\n' + t).slice(-2000);
        log('[neoforge-installer] ' + t);
        const m = /(Downloading|Processor|Extracting|Building|Task|Considering)[^]*/i.exec(t);
        if (m) onStatus('Установка NeoForge: ' + t.slice(0, 70));
      }
    };
    proc.stdout.on('data', feed);
    proc.stderr.on('data', feed);
    const timer = setTimeout(() => { try { proc.kill(); } catch {} reject(new Error('Установщик NeoForge работает слишком долго (больше 20 минут).')); }, 20 * 60 * 1000);
    proc.on('error', (e) => { clearTimeout(timer); reject(e); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Установщик NeoForge завершился с кодом ${code}. ${tail.split('\n').slice(-3).join(' ').slice(0, 300)}`));
    });
  });
  if (!fs.existsSync(path.join(verDir, `${realId}.json`))) throw new Error('Установщик NeoForge не создал профиль версии.');
  fs.writeFileSync(marker, new Date().toISOString());
  return realId;
}

/* -------------------------------- Quilt --------------------------------- */

async function resolveQuilt(baseVersion, wanted) {
  const list = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(baseVersion)}`);
  const items = Array.isArray(list) ? list.filter((v) => v && v.loader && v.loader.version) : [];
  if (!items.length) throw new Error(`Quilt пока не поддерживает Minecraft ${baseVersion}. Попробуйте Fabric.`);
  const chosen = (wanted && items.find((v) => v.loader.version === wanted))
    || items.find((v) => !/(alpha|beta|pre|rc)/i.test(v.loader.version))
    || items[0];
  const loaderVersion = chosen.loader.version;
  const profile = await fetchJson(`https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(baseVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`);
  return { loaderVersion, profile };
}

async function installLoaderHandler(_e, loaderInput, wantedVersion) {
  const loader = String(loaderInput || cfg.settings.preferredLoader || 'fabric').toLowerCase();
  if (!LOADERS.includes(loader)) return { ok: false, error: 'Выберите Fabric, Forge, NeoForge или Quilt.' };
  const selected = String(cfg.settings.selectedVersion || '');
  if (!selected) return { ok: false, error: 'Сначала выберите обычную версию Minecraft в списке сборок.' };
  const wanted = String(wantedVersion || '');
  if (selected === 'horizon-rust') return { ok: false, error: 'Для Horizon загрузчики не нужны. Выберите обычную версию Minecraft.' };
  try {
    let baseVersion = selected;
    let currentJson = null;
    try { currentJson = JSON.parse(fs.readFileSync(versionJsonPath(selected), 'utf8')); } catch {}
    if (currentJson) baseVersion = currentJson.myLauncher?.minecraftVersion || currentJson.inheritsFrom || selected;
    if (!safeVersionId(baseVersion)) throw new Error('Не удалось определить базовую версию Minecraft.');
    const baseJson = await getMinecraftVersionInfo(baseVersion);
    const baseType = (manifest && manifest.versions.find((v) => v.id === baseVersion)?.type) || baseJson.type || 'release';
    const profilesDir = path.join(cfg.settings.gameDir, 'versions');
    let id;
    let profile;
    let loaderVersion;

    if (loader === 'fabric') {
      send('loader:progress', { label: `Получение версий Fabric для Minecraft ${baseVersion}…`, pct: 5 });
      const loaderUrl = `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(baseVersion)}`;
      let loaderList;
      try {
        loaderList = await fetchJson(loaderUrl);
      } catch (apiError) {
        // Some proxy/CDN responses return an unhelpful 400 for an unknown game version.
        // Check Fabric's supported-game list before reporting the version as unsupported.
        let supported = [];
        try { supported = await fetchJson('https://meta.fabricmc.net/v2/versions/game'); } catch {}
        const isSupported = Array.isArray(supported) && supported.some((v) => v && v.version === baseVersion);
        if (!isSupported) {
          throw new Error(`Fabric Meta API не поддерживает версию Minecraft ${baseVersion} (ответ: ${apiError.message}). Проверьте, что выбрана обычная версия Minecraft, а не профиль загрузчика.`);
        }
        throw new Error(`Fabric Meta API вернул ошибку для Minecraft ${baseVersion}: ${apiError.message}. Попробуйте позже или проверьте подключение к meta.fabricmc.net.`);
      }
      // Fabric Meta API v2 returns { loader: { version, stable }, intermediary: ... },
      // not { version, stable } at the top level.
      const chosen = (wanted && Array.isArray(loaderList) && loaderList.find((v) => v && v.loader && v.loader.version === wanted))
        || (Array.isArray(loaderList) && loaderList.find((v) => v && v.loader && v.loader.stable))
        || (Array.isArray(loaderList) && loaderList.find((v) => v && v.loader && v.loader.version));
      if (!chosen || !chosen.loader || !chosen.loader.version) {
        throw new Error(`Fabric не вернул совместимую версию загрузчика для Minecraft ${baseVersion}. Возможно, поддержка этой версии ещё не появилась.`);
      }
      loaderVersion = chosen.loader.version;
      profile = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(baseVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`);
      id = String(profile.id || `fabric-loader-${loaderVersion}-${baseVersion}`);
      if (!safeVersionId(id)) throw new Error('Fabric вернул некорректный идентификатор сборки.');
      profile.id = id;
      profile.inheritsFrom = baseVersion;
      profile.type = baseType;
      profile.myLauncher = { loader: 'fabric', minecraftVersion: baseVersion, loaderVersion };
    } else if (loader === 'quilt') {
      send('loader:progress', { label: `Получение версий Quilt для Minecraft ${baseVersion}…`, pct: 5 });
      const q = await resolveQuilt(baseVersion, wanted);
      loaderVersion = q.loaderVersion;
      profile = q.profile;
      id = String(profile.id || `quilt-loader-${loaderVersion}-${baseVersion}`);
      if (!safeVersionId(id)) throw new Error('Quilt вернул некорректный идентификатор сборки.');
      profile.id = id;
      profile.inheritsFrom = baseVersion;
      profile.type = baseType;
      profile.myLauncher = { loader: 'quilt', minecraftVersion: baseVersion, loaderVersion };
    } else if (loader === 'neoforge') {
      send('loader:progress', { label: `Поиск версии NeoForge для Minecraft ${baseVersion}…`, pct: 5 });
      let info;
      try { info = await resolveNeoForge(baseVersion, wanted); }
      catch (e) { if (!/нет сборок NeoForge/.test(e.message)) throw new Error(`Не удалось получить список версий NeoForge: ${e.message}`); throw e; }
      loaderVersion = info.version;
      id = `${baseVersion}-neoforge-${loaderVersion}`;
      if (!safeVersionId(id)) throw new Error('NeoForge вернул некорректный идентификатор сборки.');
      const installerPath = await fetchInstallerJar(info.file, info.url, `Скачивание NeoForge ${loaderVersion}`);
      // Сам загрузчик ставится официальным установщиком при первом запуске (нужна Java).
      profile = {
        id,
        inheritsFrom: baseVersion,
        type: baseType,
        myLauncher: { loader: 'neoforge', minecraftVersion: baseVersion, loaderVersion, installerPath },
      };
    } else {
      send('loader:progress', { label: `Поиск рекомендованной версии Forge для Minecraft ${baseVersion}…`, pct: 5 });
      const promotions = await fetchJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      const promos = promotions && promotions.promos || {};
      loaderVersion = wanted || promos[`${baseVersion}-recommended`] || promos[`${baseVersion}-latest`];
      if (!loaderVersion) throw new Error(`Для Minecraft ${baseVersion} в списке Forge нет рекомендованной версии. Попробуйте другую версию Minecraft или Fabric.`);
      id = `${baseVersion}-forge-${loaderVersion}`;
      if (!safeVersionId(id)) throw new Error('Forge вернул некорректный идентификатор сборки.');
      let installerPath;
      try { installerPath = await fetchForgeInstaller(baseVersion, loaderVersion); }
      catch (e) {
        const fallback = promos[`${baseVersion}-recommended`] || promos[`${baseVersion}-latest`];
        if (!wanted || !fallback || fallback === loaderVersion) throw e;
        loaderVersion = fallback;
        id = `${baseVersion}-forge-${loaderVersion}`;
        installerPath = await fetchForgeInstaller(baseVersion, loaderVersion);
      }
      profile = {
        id,
        inheritsFrom: baseVersion,
        type: baseType,
        myLauncher: { loader: 'forge', minecraftVersion: baseVersion, loaderVersion, installerPath },
      };
    }

    fs.mkdirSync(path.join(profilesDir, id), { recursive: true });
    fs.writeFileSync(versionJsonPath(id), JSON.stringify(profile, null, 2), 'utf8');
    await setPreferredLoader(loader);
    send('loader:progress', { label: `${loaderName(loader)} установлен: Minecraft ${baseVersion}`, pct: 100, done: true });
    log(`[launcher] Установлен ${loader} ${loaderVersion} для Minecraft ${baseVersion} (профиль ${id})`);
    return { ok: true, id, loader, baseVersion, loaderVersion };
  } catch (e) {
    log(`[launcher] Не удалось установить ${loader}: ${e && e.stack ? e.stack : e}`);
    return { ok: false, error: `Не удалось установить ${loaderName(loader)}: ${e.message || e}` };
  }
}
ipcMain.handle('loaders:install', (_e, loader) => installLoaderHandler(_e, loader));

async function setPreferredLoader(loader) {
  cfg.settings.preferredLoader = loader;
  saveCfg();
}

/* ------------------------------- аккаунты ------------------------------ */

function setActiveIfEmpty(id) {
  if (!cfg.settings.activeAccount || !cfg.accounts.some((a) => a.id === cfg.settings.activeAccount)) {
    cfg.settings.activeAccount = id;
  }
}

ipcMain.handle('accounts:list', () => accountsState());

ipcMain.handle('accounts:addOffline', (_e, name) => {
  name = String(name || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
    return { ok: false, error: 'Ник: 3–16 символов, латиница, цифры и _' };
  }
  const id = 'off-' + name.toLowerCase();
  if (cfg.accounts.some((a) => a.id === id)) return { ok: false, error: 'Такой аккаунт уже добавлен' };
  const auth = Authenticator.getAuth(name);
  cfg.accounts.push({ id, type: 'offline', name, uuid: auth.uuid });
  cfg.settings.activeAccount = id;
  saveCfg();
  return accountsState();
});

ipcMain.handle('accounts:addMicrosoft', async () => {
  try {
    const authManager = new Auth('select_account');
    const xbox = await authManager.launch('electron', { width: 520, height: 720 });
    const mc = await xbox.getMinecraft();
    if (!mc.profile) return { ok: false, error: 'На этом аккаунте нет Minecraft Java Edition' };
    const id = 'ms-' + mc.profile.id;
    const entry = { id, type: 'microsoft', name: mc.profile.name, uuid: mc.profile.id, refresh: enc(xbox.save()) };
    const idx = cfg.accounts.findIndex((a) => a.id === id);
    if (idx >= 0) cfg.accounts[idx] = entry;
    else cfg.accounts.push(entry);
    cfg.settings.activeAccount = id;
    saveCfg();
    return accountsState();
  } catch (e) {
    const msg = String((e && (e.message || e)) || e);
    if (/closed/i.test(msg)) return { ok: false, error: 'Окно входа было закрыто' };
    return { ok: false, error: 'Не удалось войти: ' + msg };
  }
});

ipcMain.handle('accounts:select', (_e, id) => {
  if (cfg.accounts.some((a) => a.id === id)) {
    cfg.settings.activeAccount = id;
    saveCfg();
  }
  return accountsState();
});

ipcMain.handle('accounts:remove', (_e, id) => {
  cfg.accounts = cfg.accounts.filter((a) => a.id !== id);
  if (cfg.settings.activeAccount === id) cfg.settings.activeAccount = cfg.accounts[0] ? cfg.accounts[0].id : null;
  saveCfg();
  return accountsState();
});

// Обновляет сессию Microsoft-аккаунта и возвращает объект Minecraft (mcToken, profile, mclc())
async function msSession(acc) {
  const authManager = new Auth('none');
  const xbox = await authManager.refresh(dec(acc.refresh));
  const mc = await xbox.getMinecraft();
  acc.refresh = enc(xbox.save());
  saveCfg();
  return mc;
}

async function getAuthorization(acc) {
  if (acc.type === 'offline') return Authenticator.getAuth(acc.name);
  return (await msSession(acc)).mclc();
}

/* -------------------------------- запуск ------------------------------- */

const state = (s, extra = {}) => send('game:state', { state: s, ...extra });

// Клиент MCLC, который перед запуском дописывает jvm-аргументы из профиля загрузчика (NeoForge).
class ModularClient extends Client {
  constructor(rewrite) { super(); this.rewriteArgs = rewrite; }
  startMinecraft(args) {
    let finalArgs = args;
    try { finalArgs = this.rewriteArgs(args); } catch (e) { log(`[launcher] Не удалось применить аргументы загрузчика: ${e.message || e}`); }
    return super.startMinecraft(finalArgs);
  }
}

function buildModularArgs(mclcArgs, { loaderJson, realId, root }) {
  const cpIdx = mclcArgs.indexOf('-cp');
  if (cpIdx < 0) return mclcArgs;
  const jvm = mclcArgs.slice(0, cpIdx);
  const classpath = mclcArgs[cpIdx + 1];
  const rest = mclcArgs.slice(cpIdx + 2); // главный класс + игровые аргументы
  const osName = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux';
  const libPathRe = /^-Djava\.library\.path=/;
  const natives = (jvm.find((a) => libPathRe.test(a)) || '').replace(libPathRe, '');
  const vars = {
    library_directory: path.resolve(root, 'libraries'),
    classpath_separator: process.platform === 'win32' ? ';' : ':',
    classpath,
    version_name: realId,
    natives_directory: natives,
    launcher_name: 'Electron',
    launcher_version: '1',
  };
  const sub = (str) => String(str).replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const allowed = (rules) => {
    let ok = false;
    for (const r of rules) {
      if (r.features) continue;
      const o = r.os;
      const match = !o || ((!o.name || o.name === osName) && (!o.arch || (o.arch === 'x86' ? process.arch === 'ia32' : process.arch !== 'ia32')));
      if (match) ok = r.action === 'allow';
    }
    return ok;
  };
  const extra = [];
  for (const a of (loaderJson.arguments && loaderJson.arguments.jvm) || []) {
    if (typeof a === 'string') extra.push(sub(a));
    else if (a && a.rules && allowed(a.rules)) extra.push(...[].concat(a.value).map(sub));
  }
  // classpath и natives уже заданы MCLC
  const cleaned = [];
  for (let i = 0; i < extra.length; i++) {
    if (extra[i] === '-cp' || extra[i] === '-classpath') { i += 1; continue; }
    if (libPathRe.test(extra[i])) continue;
    cleaned.push(extra[i]);
  }
  return [...jvm, ...cleaned, '-cp', classpath, ...rest];
}

async function launchGame() {
  const s = cfg.settings;
  const acc = cfg.accounts.find((a) => a.id === s.activeAccount);
  try {
    stopping = false;
    try { fs.writeFileSync(logFile(), ''); } catch {}
    state('launching', { message: 'Проверка аккаунта' });
    const authorization = await getAuthorization(acc);
    const selectedId = String(s.selectedVersion || '');
    let selectedJson = null;
    try { selectedJson = JSON.parse(fs.readFileSync(versionJsonPath(selectedId), 'utf8')); } catch {}
    const metadata = (selectedJson && selectedJson.myLauncher) || {};
    let loader = detectLoader(selectedId, metadata);
    const baseVersion = metadata.minecraftVersion || (selectedJson && selectedJson.inheritsFrom) || selectedId;
    let baseJson = null;
    try { baseJson = await getMinecraftVersionInfo(baseVersion); } catch (e) {
      log(`[launcher] Не удалось прочитать описание Minecraft ${baseVersion}: ${e.message}`);
    }
    const entry = manifest && manifest.versions.find((v) => v.id === baseVersion);
    const versionType = (entry && entry.type) || (baseJson && baseJson.type) || (selectedJson && selectedJson.type) || 'release';
    let required = (baseJson && baseJson.javaVersion && baseJson.javaVersion.majorVersion)
      || (selectedJson && selectedJson.javaVersion && selectedJson.javaVersion.majorVersion)
      || 8;
    if (!Number.isFinite(Number(required))) required = 8;
    required = Number(required);

    if ((loader === 'forge' || loader === 'neoforge') && !(metadata.installerPath && fs.existsSync(metadata.installerPath))) {
      throw new Error(`Не найден установщик ${loaderName(loader)} для этой сборки. Переустановите ${loaderName(loader)} через раздел «Сборки».`);
    }

    // Офлайн-скин хранится в профиле лаунчера и синхронизируется в папку игры перед запуском.
    if (acc && acc.type === 'offline') syncOfflineSkinToGameDir(acc);

    let javaPath = null;
    if (s.javaPath && s.javaPath !== 'auto') {
      const manual = await probeJava(s.javaPath);
      if (!manual) {
        log(`[launcher] Выбранная Java не запускается (${s.javaPath}), подбираю Java ${required}.`);
      } else if (manual.major < required) {
        log(`[launcher] Java ${manual.major} слишком старая для Minecraft ${baseVersion}; нужна Java ${required} или новее.`);
      } else {
        javaPath = s.javaPath;
        log(`[launcher] Java ${manual.major} (выбрана вручную): ${javaPath}`);
      }
    }

    if (!javaPath) {
      let found = chooseJava(required, await detectJava());
      // Сначала устанавливаем точную Java, рекомендованную Mojang; более новую используем только как запасной вариант.
      const preferredJavaMajor = adoptiumMajor(required);
      if (!found || found.major !== preferredJavaMajor) {
        state('launching', { message: `Скачивание Java ${preferredJavaMajor}` });
        try {
          found = await downloadJava(required);
        } catch (e) {
          if (!found || found.major < required || (required <= 8 && found.major !== required)) {
            throw new Error(`Java ${required} не найдена и автоматическая установка не удалась: ${e.message}`);
          }
          log(`[launcher] Не удалось скачать точную Java ${required}: ${e.message}. Использую установленную Java ${found.major}.`);
        }
      }
      if (!found) throw new Error(`Не удалось определить подходящую Java ${required}.`);
      javaPath = found.path;
      log(`[launcher] Java ${found.major} (${found.vendor}): ${found.path}`);
    }

    fs.mkdirSync(s.gameDir, { recursive: true });
    const gameInstance = instDir(selectedId);
    fs.mkdirSync(gameInstance, { recursive: true });
    // NeoForge: официальный установщик ставит профиль версии; запуск собираем с учётом jvm-аргументов загрузчика (module path и т.д.).
    let launchCustomId = selectedId;
    let loaderJson = null;
    if (loader === 'neoforge') {
      launchCustomId = await ensureNeoForgeInstalled(metadata.installerPath, javaPath, (m) => state('launching', { message: m }));
      loaderJson = JSON.parse(fs.readFileSync(path.join(s.gameDir, 'versions', launchCustomId, `${launchCustomId}.json`), 'utf8'));
    }
    const launcher = loader === 'neoforge'
      ? new ModularClient((args) => buildModularArgs(args, { loaderJson, realId: launchCustomId, root: s.gameDir }))
      : new Client();
    const labels = {
      assets: 'Загрузка ресурсов',
      classes: 'Загрузка библиотек',
      'classes-custom': 'Загрузка библиотек',
      'assets-copy': 'Копирование ресурсов',
      natives: 'Распаковка natives',
    };
    launcher.on('progress', (e) => {
      const pct = e.total ? Math.round((e.task / e.total) * 100) : 0;
      send('game:progress', { label: `${labels[e.type] || 'Подготовка'} ${e.task}/${e.total}`, pct });
    });
    launcher.on('package-extract', () => send('game:progress', { label: 'Распаковка', pct: 100 }));
    launcher.on('arguments', () => {
      send('game:progress', { label: 'Запуск игры', pct: 100 });
      state('running', { message: 'Игра запускается' });
    });
    launcher.on('debug', (m) => log('[launcher] ' + m));
    let firstData = true;
    launcher.on('data', (m) => {
      log(String(m).trimEnd());
      if (firstData) {
        firstData = false;
        if (s.closeOnLaunch) setTimeout(() => app.quit(), 6000);
      }
    });
    let closedEmitted = false;
    launcher.on('close', (code) => {
      closedEmitted = true;
      gameProc = null;
      const failed = !stopping && code !== 0 && code !== null;
      stopping = false;
      state('idle', {
        code,
        error: failed ? `Игра завершилась с ошибкой (код ${code}). Подробности в консоли.` : undefined,
      });
    });

    const launchVersion = (loader === 'fabric' || loader === 'quilt')
      ? { number: baseVersion, custom: selectedId, type: versionType }
      : loader === 'neoforge'
      ? { number: baseVersion, custom: launchCustomId, type: versionType }
      : { number: baseVersion, type: versionType };
    const opts = {
      authorization,
      root: s.gameDir,
      javaPath,
      version: launchVersion,
      memory: { max: `${s.ramMax}M`, min: `${Math.min(s.ramMin, s.ramMax)}M` },
      window: { width: s.width, height: s.height, fullscreen: !!s.fullscreen },
      overrides: { gameDirectory: gameInstance, cwd: gameInstance, url: { mavenForge: 'https://maven.minecraftforge.net/' } },
    };
    if (loader === 'forge') {
      // MCLC caches ForgeWrapper JSON by base Minecraft version. Remove stale cache when switching Forge builds.
      const cachedForgeJson = path.join(s.gameDir, 'forge', baseVersion, 'version.json');
      try {
        const cached = JSON.parse(fs.readFileSync(cachedForgeJson, 'utf8'));
        const expectedSuffix = `forge-${metadata.loaderVersion}`;
        if (!String(cached.id || '').includes(expectedSuffix)) fs.rmSync(cachedForgeJson, { force: true });
      } catch {}
      opts.forge = metadata.installerPath;
    }
    const extra = String(s.jvmArgs || '').trim();
    if (extra) opts.customArgs = extra.split(/\s+/);

    log(`[launcher] Запуск профиля ${selectedId}${loader ? ` (${loader})` : ''}; Minecraft ${baseVersion}; Java ${required}+; папка: ${gameInstance}`);
    const proc = await launcher.launch(opts);
    if (!proc) {
      if (!closedEmitted) state('idle', { error: 'Не удалось запустить игру. Подробности в консоли.' });
      return;
    }
    gameProc = proc;
  } catch (e) {
    gameProc = null;
    log('[launcher] Ошибка: ' + (e && e.stack ? e.stack : e));
    state('idle', { error: 'Ошибка запуска: ' + String((e && e.message) || e) });
  }
}

ipcMain.handle('game:launch', () => {
  const s = cfg.settings;
  if (gameProc || hzProc || hzBusy) return { ok: false, error: 'Игра уже запущена' };
  if (!s.selectedVersion) return { ok: false, error: 'Сначала выберите сборку' };
  if (!cfg.accounts.some((a) => a.id === s.activeAccount)) return { ok: false, error: 'Сначала добавьте аккаунт' };
  if (s.selectedVersion === HZ_VERSION_ID) { hzBusy = true; launchHorizon(); return { ok: true }; }
  launchGame();
  return { ok: true };
});

ipcMain.handle('game:stop', () => {
  if (hzProc) { stopping = true; try { hzProc.kill(); } catch {} return { ok: true }; }
  if (gameProc) {
    stopping = true;
    try {
      gameProc.kill();
    } catch {}
  }
  return { ok: true };
});

/* --------------------------------- скины ------------------------------- */

const MC_API = 'https://api.minecraftservices.com';

async function fetchDataUrl(url) {
  const r = await fetch(url.replace(/^http:/, 'https:'), { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64');
}

async function activeSkin(token) {
  const r = await fetch(MC_API + '/minecraft/profile', {
    headers: { Authorization: 'Bearer ' + token },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`Профиль недоступен (HTTP ${r.status})`);
  const p = await r.json();
  const s = (p.skins || []).find((x) => x.state === 'ACTIVE') || (p.skins || [])[0];
  if (!s) return null;
  return { dataUrl: await fetchDataUrl(s.url), variant: String(s.variant || 'CLASSIC').toLowerCase() };
}

// читает PNG-скин и проверяет формат (64x64 или 64x32)
function readSkinFile(p) {
  const buf = fs.readFileSync(p);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(sig)) throw new Error('Это не PNG-файл');
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== 64 || (h !== 64 && h !== 32)) throw new Error(`Нужен скин 64×64 (или 64×32), а в файле ${w}×${h}`);
  if (buf.length > 24 * 1024) throw new Error('Файл слишком большой для скина');
  return { buf, w, h };
}

const msAccount = (id) => {
  const acc = cfg.accounts.find((a) => a.id === id);
  return acc && acc.type === 'microsoft' ? acc : null;
};

const offlineSkinStore = () => path.join(app.getPath('userData'), 'skins');
const offlineSkinFile = (acc) => path.join(offlineSkinStore(), `${acc.id}.png`);
const offlineSkinInfoFile = (acc) => path.join(offlineSkinStore(), `${acc.id}.json`);

function syncOfflineSkinToGameDir(acc) {
  if (!acc || acc.type !== 'offline') return;
  const source = offlineSkinFile(acc);
  if (!fs.existsSync(source)) return;
  const safeName = String(acc.name || '').replace(/[^A-Za-z0-9_]/g, '');
  if (!safeName) return;
  const destinations = [
    path.join(instDir(), 'CustomSkinLoader', 'LocalSkin', 'skins', `${safeName}.png`),
    path.join(instDir(), 'config', 'offlineskins', `${safeName}.png`),
  ];
  for (const destination of destinations) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

function getOfflineSkin(acc) {
  const source = offlineSkinFile(acc);
  if (!fs.existsSync(source)) return null;
  const buf = fs.readFileSync(source);
  let variant = 'classic';
  try {
    const info = JSON.parse(fs.readFileSync(offlineSkinInfoFile(acc), 'utf8'));
    variant = info.variant === 'slim' ? 'slim' : 'classic';
  } catch {}
  return { dataUrl: 'data:image/png;base64,' + buf.toString('base64'), variant };
}

ipcMain.handle('skin:get', async (_e, id) => {
  const acc = cfg.accounts.find((a) => a.id === id);
  if (!acc) return { ok: false, error: 'Аккаунт не найден' };
  if (acc.type === 'offline') {
    try {
      // Подхватим уже существующий файл из папки игры, если скин был задан до обновления лаунчера.
      const canonical = offlineSkinFile(acc);
      if (!fs.existsSync(canonical)) {
        const legacy = path.join(cfg.settings.gameDir, 'CustomSkinLoader', 'LocalSkin', 'skins', `${acc.name}.png`);
        if (fs.existsSync(legacy)) {
          fs.mkdirSync(offlineSkinStore(), { recursive: true });
          fs.copyFileSync(legacy, canonical);
        }
      }
      return { ok: true, supported: true, local: true, skin: getOfflineSkin(acc) };
    } catch (e) {
      return { ok: false, error: 'Не удалось прочитать локальный скин: ' + (e.message || e) };
    }
  }
  try {
    const mc = await msSession(acc);
    return { ok: true, supported: true, local: false, skin: await activeSkin(mc.mcToken) };
  } catch (e) {
    return { ok: false, error: 'Не удалось загрузить скин: ' + ((e && e.message) || e) };
  }
});

ipcMain.handle('skin:pick', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Выберите файл скина (PNG)',
    properties: ['openFile'],
    filters: [{ name: 'PNG', extensions: ['png'] }],
  });
  if (r.canceled) return { ok: false, canceled: true };
  try {
    const { buf, w, h } = readSkinFile(r.filePaths[0]);
    return { ok: true, path: r.filePaths[0], width: w, height: h, dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('skin:upload', async (_e, { id, filePath, variant }) => {
  const acc = cfg.accounts.find((a) => a.id === id);
  if (!acc) return { ok: false, error: 'Аккаунт не найден' };
  try {
    const { buf } = readSkinFile(filePath);
    const chosenVariant = variant === 'slim' ? 'slim' : 'classic';
    if (acc.type === 'offline') {
      fs.mkdirSync(offlineSkinStore(), { recursive: true });
      const destination = offlineSkinFile(acc);
      const temp = destination + '.tmp';
      fs.writeFileSync(temp, buf);
      fs.renameSync(temp, destination);
      fs.writeFileSync(offlineSkinInfoFile(acc), JSON.stringify({ variant: chosenVariant, updatedAt: new Date().toISOString() }, null, 2));
      syncOfflineSkinToGameDir(acc);
      return { ok: true, local: true, skin: getOfflineSkin(acc) };
    }

    const mc = await msSession(acc);
    const form = new FormData();
    form.append('variant', chosenVariant);
    form.append('file', new Blob([buf], { type: 'image/png' }), 'skin.png');
    const r = await fetch(MC_API + '/minecraft/profile/skins', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + mc.mcToken },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) {
      let detail = '';
      try {
        const j = await r.json();
        detail = j.errorMessage || j.error || '';
      } catch {}
      throw new Error(`сервер ответил ${r.status}${detail ? ': ' + detail : ''}`);
    }
    return { ok: true, local: false, skin: await activeSkin(mc.mcToken) };
  } catch (e) {
    return { ok: false, error: `Не удалось ${acc.type === 'offline' ? 'сохранить локальный скин' : 'сменить скин'}: ` + ((e && e.message) || e) };
  }
});

ipcMain.handle('skin:reset', async (_e, id) => {
  const acc = cfg.accounts.find((a) => a.id === id);
  if (!acc) return { ok: false, error: 'Аккаунт не найден' };
  if (acc.type === 'offline') {
    try {
      fs.rmSync(offlineSkinFile(acc), { force: true });
      fs.rmSync(offlineSkinInfoFile(acc), { force: true });
      const safeName = String(acc.name || '').replace(/[^A-Za-z0-9_]/g, '');
      fs.rmSync(path.join(instDir(), 'CustomSkinLoader', 'LocalSkin', 'skins', `${safeName}.png`), { force: true });
      fs.rmSync(path.join(instDir(), 'config', 'offlineskins', `${safeName}.png`), { force: true });
      return { ok: true, local: true, skin: null };
    } catch (e) {
      return { ok: false, error: 'Не удалось сбросить локальный скин: ' + (e.message || e) };
    }
  }
  const ms = msAccount(id);
  if (!ms) return { ok: false, error: 'Аккаунт не найден' };
  try {
    const mc = await msSession(ms);
    const r = await fetch(MC_API + '/minecraft/profile/skins/active', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + mc.mcToken },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error('сервер ответил ' + r.status);
    return { ok: true, skin: await activeSkin(mc.mcToken) };
  } catch (e) {
    return { ok: false, error: 'Не удалось сбросить скин: ' + ((e && e.message) || e) };
  }
});

ipcMain.handle('skin:installSupport', async (_e, id) => {
  const acc = cfg.accounts.find((a) => a.id === id);
  if (!acc || acc.type !== 'offline') return { ok: false, error: 'Эта функция предназначена для офлайн-аккаунта.' };
  const selectedId = String(cfg.settings.selectedVersion || '');
  if (!selectedId) return { ok: false, error: 'Сначала выберите сборку.' };
  try {
    let profile;
    try { profile = JSON.parse(fs.readFileSync(versionJsonPath(selectedId), 'utf8')); } catch {}
    const metadata = (profile && profile.myLauncher) || {};
    const loader = detectLoader(selectedId, metadata);
    if (!LOADERS.includes(loader)) {
      return { ok: false, error: 'Сначала установите Fabric, Forge, NeoForge или Quilt для выбранной версии в разделе «Сборки», затем выберите эту сборку внизу лаунчера.' };
    }
    const mcVersion = metadata.minecraftVersion || (profile && profile.inheritsFrom) || selectedId;
    const query = new URLSearchParams({
      game_versions: JSON.stringify([mcVersion]),
      loaders: JSON.stringify(modrinthLoaders(loader)),
    });
    send('loader:progress', { label: `Поиск CustomSkinLoader для Minecraft ${mcVersion} (${loader})…`, pct: 5 });
    const compatible = await fetchJson(`https://api.modrinth.com/v2/project/customskinloader/version?${query.toString()}`);
    const version = Array.isArray(compatible) && (compatible.find((v) => v.version_type === 'release') || compatible[0]);
    if (!version || !Array.isArray(version.files) || !version.files.length) {
      throw new Error(`CustomSkinLoader не нашёл совместимую версию для Minecraft ${mcVersion} и ${loader}.`);
    }
    const file = version.files.find((f) => f.primary) || version.files.find((f) => /\.jar$/i.test(f.filename)) || version.files[0];
    if (!file || !/\.jar$/i.test(file.filename || '')) throw new Error('Сайт модов не вернул JAR-файл CustomSkinLoader.');
    const safeFileName = path.basename(file.filename).replace(/[^A-Za-z0-9._+\-]/g, '_');
    const modsDir = path.join(instDir(selectedId), 'mods');
    fs.mkdirSync(modsDir, { recursive: true });
    const current = fs.readdirSync(modsDir).find((name) => /^customskinloader.*\.jar$/i.test(name));
    if (current && fs.existsSync(path.join(modsDir, current))) {
      syncOfflineSkinToGameDir(acc);
      return { ok: true, alreadyInstalled: true, filename: current, version: version.version_number, loader, mcVersion };
    }
    const destination = path.join(modsDir, safeFileName);
    await downloadFile(file.url, destination, {
      label: 'Установка CustomSkinLoader',
      expectedSize: Number(file.size) || 0,
      expectedHash: (file.hashes && file.hashes.sha512) || '',
      hashType: 'sha512',
      minSize: 1024,
      checkZip: true,
      progressChannel: 'loader:progress',
      timeout: 5 * 60 * 1000,
    });
    syncOfflineSkinToGameDir(acc);
    log(`[launcher] CustomSkinLoader ${version.version_number} добавлен в ${modsDir}`);
    return { ok: true, filename: safeFileName, version: version.version_number, loader, mcVersion };
  } catch (e) {
    log(`[launcher] Не удалось установить поддержку офлайн-скинов: ${e && e.stack ? e.stack : e}`);
    return { ok: false, error: 'Не удалось установить поддержку скинов: ' + (e.message || e) };
  }
});


/* ------------------------------- Modrinth / моды, шейдеры, ресурспаки ------------------------------- */
const MODRINTH = 'https://api.modrinth.com/v2';
const KINDS = {
  mod: { dir: 'mods', manifest: 'mylauncher-mods.json', ext: 'jar', projectType: 'mod', noun: 'мод' },
  shader: { dir: 'shaderpacks', manifest: 'mylauncher-shaderpacks.json', ext: 'zip', projectType: 'shader', noun: 'шейдер' },
  resourcepack: { dir: 'resourcepacks', manifest: 'mylauncher-resourcepacks.json', ext: 'zip', projectType: 'resourcepack', noun: 'ресурспак' },
};
const normKind = (k) => (Object.prototype.hasOwnProperty.call(KINDS, k) ? k : 'mod');
const extRe = (kind) => new RegExp(`\\.${KINDS[kind].ext}(?:\\.disabled)?$`, 'i');
const kindDir = (kind) => path.join(instDir(), KINDS[kind].dir);
const bestVersion = (list) => list.find((v) => v.version_type === 'release') || list.find((v) => v.version_type === 'beta') || list[0];

function selectedModTarget(kind = 'mod') {
  const selectedId = String(cfg.settings.selectedVersion || '');
  if (!selectedId) throw new Error('Сначала выберите сборку во вкладке «Сборки».');
  const jsonPath = path.join(cfg.settings.gameDir, 'versions', selectedId, `${selectedId}.json`);
  let profile;
  try { profile = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); }
  catch { throw new Error('Не удалось прочитать профиль выбранной сборки. Выберите или установите версию ещё раз.'); }
  const meta = profile.myLauncher || {};
  const loader = detectLoader(selectedId, meta);
  if (kind === 'mod' && !LOADERS.includes(loader)) {
    throw new Error('Для установки модов сначала установите Fabric, Forge, NeoForge или Quilt в разделе «Сборки», затем выберите этот профиль внизу лаунчера.');
  }
  // Для шейдеров и ресурспаков загрузчик не обязателен: подойдёт и чистая версия Minecraft.
  const mcVersion = String(meta.minecraftVersion || profile.inheritsFrom || (kind === 'mod' ? '' : profile.id || selectedId));
  if (!mcVersion) throw new Error('Не удалось определить версию Minecraft у этой сборки.');
  return { profileId: selectedId, loader: LOADERS.includes(loader) ? loader : '', mcVersion };
}

function readManifest(kind) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(instDir(), KINDS[kind].manifest), 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch { return {}; }
}
function writeManifest(kind, value) {
  const target = path.join(instDir(), KINDS[kind].manifest);
  const tmp = target + '.tmp';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}
function safeFilename(value, kind) {
  const raw = String(value || '');
  const name = path.basename(raw);
  if (!name || name !== raw || /[<>:"/\\|?*\u0000]/.test(name) || !extRe(kind).test(name)) {
    throw new Error('Некорректное имя файла.');
  }
  return name;
}
function listInstalled(kind) {
  const dir = kindDir(kind);
  fs.mkdirSync(dir, { recursive: true });
  const manifestMap = readManifest(kind);
  const re = extRe(kind);
  const stripExt = new RegExp(`\\.${KINDS[kind].ext}$`, 'i');
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && re.test(entry.name))
    .map((entry) => {
      const filename = entry.name;
      const enabled = !/\.disabled$/i.test(filename);
      const canonical = enabled ? filename : filename.replace(/\.disabled$/i, '');
      const meta = manifestMap[filename] || manifestMap[canonical] || {};
      return {
        file: filename,
        enabled,
        title: meta.title || canonical.replace(stripExt, '').replace(/[_.-]+/g, ' '),
        version: meta.version || '',
        projectId: meta.projectId || '',
        icon: meta.icon || '',
        source: meta.source || '',
        dependency: !!meta.dependency,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
}

// Какие проекты Modrinth уже лежат в папке: из манифеста + опознание «чужих» JAR по хешу одним запросом.
async function knownProjects(kind) {
  const known = new Set();
  const manifestMap = readManifest(kind);
  for (const [file, entry] of Object.entries(manifestMap)) {
    if (entry && entry.projectId && !/\.disabled$/i.test(file) && fs.existsSync(path.join(kindDir(kind), file))) known.add(entry.projectId);
  }
  if (kind !== 'mod') return known;
  try {
    const dir = kindDir(kind);
    const unknown = fs.existsSync(dir)
      ? fs.readdirSync(dir).filter((n) => /\.jar$/i.test(n) && !manifestMap[n]).slice(0, 300)
      : [];
    if (unknown.length) {
      const byHash = new Map();
      for (const name of unknown) {
        try { byHash.set(crypto.createHash('sha1').update(fs.readFileSync(path.join(dir, name))).digest('hex'), name); } catch {}
      }
      const found = await fetchJson(`${MODRINTH}/version_files`, {
        method: 'POST',
        body: JSON.stringify({ hashes: [...byHash.keys()], algorithm: 'sha1' }),
      });
      for (const v of Object.values(found || {})) if (v && v.project_id) known.add(v.project_id);
    }
  } catch (e) { log(`[launcher] Не удалось опознать уже установленные моды: ${e.message || e}`); }
  return known;
}

async function resolveVersion({ ref, versionId, kind, target, allowAnyVersion, force }) {
  const wantLoader = kind === 'mod';
  if (force && versionId) {
    const v = await fetchJson(`${MODRINTH}/version/${encodeURIComponent(versionId)}`);
    if (wantLoader && !hasLoader(v.loaders, target.loader)) throw new Error(`Эта версия не для загрузчика ${loaderName(target.loader)}.`);
    return { version: v, mismatch: !(v.game_versions || []).includes(target.mcVersion) };
  }
  if (versionId) {
    try {
      const v = await fetchJson(`${MODRINTH}/version/${encodeURIComponent(versionId)}`);
      if ((v.game_versions || []).includes(target.mcVersion) && (!wantLoader || hasLoader(v.loaders, target.loader))) {
        return { version: v, mismatch: false };
      }
    } catch {}
  }
  if (!ref) return null;
  const q = new URLSearchParams({ game_versions: JSON.stringify([target.mcVersion]) });
  if (wantLoader) q.set('loaders', JSON.stringify(modrinthLoaders(target.loader)));
  let list = await fetchJson(`${MODRINTH}/project/${encodeURIComponent(ref)}/version?${q}`);
  if (Array.isArray(list) && list.length) return { version: bestVersion(list), mismatch: false };
  if (allowAnyVersion && !wantLoader) {
    list = await fetchJson(`${MODRINTH}/project/${encodeURIComponent(ref)}/version`);
    if (Array.isArray(list) && list.length) return { version: bestVersion(list), mismatch: true };
  }
  return null;
}

function makeInstallCtx(kind, target, known) {
  return { kind, target, known, manifest: readManifest(kind), installed: [], warnings: [], budget: 25 };
}

// Очередь установки: главный проект + все обязательные зависимости (рекурсивно), без дублей и циклов.
async function runInstallQueue(ctx, queue) {
  const { kind, target } = ctx;
  const dir = kindDir(kind);
  fs.mkdirSync(dir, { recursive: true });
  let first = true;
  while (queue.length && ctx.budget > 0) {
    const item = queue.shift();
    const isMain = first && !item.dep;
    first = false;
    try {
      let ref = item.ref;
      if (!ref && item.versionId) {
        const v = await fetchJson(`${MODRINTH}/version/${encodeURIComponent(item.versionId)}`);
        ref = v.project_id;
      }
      // На Quilt вместо Fabric API нужен Quilted Fabric API (QFAPI).
      if (kind === 'mod' && target.loader === 'quilt' && ref === 'P7dR8mSH') ref = 'qvIfYCYJ';
      if (ref && ctx.known.has(ref)) { if (isMain) return { alreadyInstalled: true }; continue; }
      const resolved = await resolveVersion({ ref, versionId: item.versionId, kind, target, allowAnyVersion: isMain || !!item.allowAnyVersion, force: !!item.force });
      if (!resolved) {
        if (isMain) throw new Error(`Modrinth не нашёл релиз для Minecraft ${target.mcVersion}${kind === 'mod' ? ` и ${loaderName(target.loader)}` : ''}.`);
        ctx.warnings.push(`Нет совместимой версии зависимости «${item.title || ref || item.versionId}» для ${target.mcVersion}.`);
        continue;
      }
      const { version, mismatch } = resolved;
      const projectId = String(version.project_id || ref || '');
      if (ctx.known.has(projectId)) { if (isMain) return { alreadyInstalled: true }; continue; }
      ctx.known.add(projectId);

      const files = Array.isArray(version.files) ? version.files : [];
      const rx = new RegExp(`\\.${KINDS[kind].ext}$`, 'i');
      const file = files.find((f) => f.primary && rx.test(f.filename || '')) || files.find((f) => rx.test(f.filename || ''));
      if (!file || !file.url) throw new Error(`У найденной версии нет файла .${KINDS[kind].ext}.`);
      if (!/^https:\/\//i.test(file.url)) throw new Error('Modrinth вернул небезопасный адрес файла.');

      let title = item.title || '';
      let icon = item.icon || '';
      if (!title) {
        try {
          const p = await fetchJson(`${MODRINTH}/project/${encodeURIComponent(projectId)}`);
          title = String(p.title || ''); icon = String(p.icon_url || '');
        } catch {}
      }
      title = title || String(version.name || file.filename).replace(rx, '');

      const safeName = path.basename(String(file.filename)).replace(/[^A-Za-z0-9._+() -]/g, '_');
      let filename = safeName;
      let destination = path.join(dir, filename);
      if (fs.existsSync(destination)) {
        const stem = safeName.replace(rx, '');
        const suffix = String(version.version_number || 'download').replace(/[^A-Za-z0-9._+-]/g, '_');
        filename = `${stem}-${suffix}.${KINDS[kind].ext}`;
        destination = path.join(dir, filename);
        let n = 2;
        while (fs.existsSync(destination)) { filename = `${stem}-${suffix}-${n}.${KINDS[kind].ext}`; destination = path.join(dir, filename); n += 1; }
      }
      const hashes = file.hashes || {};
      await downloadFile(file.url, destination, {
        label: `${item.dep ? 'Зависимость: ' : ''}${title}`,
        expectedSize: Number(file.size) || 0,
        expectedHash: hashes.sha512 || hashes.sha1 || '',
        hashType: hashes.sha512 ? 'sha512' : hashes.sha1 ? 'sha1' : 'sha256',
        minSize: 1024,
        checkZip: true,
        progressChannel: 'mods:progress',
        timeout: 5 * 60 * 1000,
      });
      ctx.budget -= 1;
      ctx.manifest[filename] = {
        filename, projectId, title,
        version: String(version.version_number || ''),
        icon: /^https:\/\/cdn\.modrinth\.com\//i.test(icon) ? icon : '',
        source: 'Modrinth',
        minecraftVersion: target.mcVersion,
        loader: kind === 'mod' ? target.loader : '',
        dependency: !!item.dep,
        installedAt: new Date().toISOString(),
      };
      writeManifest(kind, ctx.manifest);
      ctx.installed.push({ title, filename, version: ctx.manifest[filename].version, dependency: !!item.dep, mismatch });
      log(`[launcher] Установлено (${kind}${item.dep ? ', зависимость' : ''}): ${title} → ${destination}`);

      if (kind === 'mod') {
        for (const d of Array.isArray(version.dependencies) ? version.dependencies : []) {
          if (!d || (!d.project_id && !d.version_id)) continue;
          if (d.dependency_type === 'required') queue.push({ ref: d.project_id || '', versionId: d.version_id || '', dep: true });
          else if (d.dependency_type === 'incompatible' && d.project_id && ctx.known.has(d.project_id)) {
            ctx.warnings.push(`«${title}» несовместим с одним из установленных модов (${d.project_id}).`);
          }
        }
      }
    } catch (e) {
      if (isMain) throw e;
      ctx.warnings.push(`Зависимость «${item.title || item.ref || item.versionId}» не установилась: ${e.message || e}`);
      log(`[launcher] Ошибка зависимости: ${e.message || e}`);
    }
  }
  if (queue.length) ctx.warnings.push('Слишком много зависимостей — часть пропущена.');
  return {};
}


/* ------------------------------- Модпаки (Modrinth .mrpack) ------------------------------- */
const packSlug = (t) => String(t || 'pack').replace(/[^A-Za-z0-9._+-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'pack';
const insideDir = (root, rel) => {
  const base = path.resolve(root);
  const full = path.resolve(base, String(rel || ''));
  return full.startsWith(base + path.sep) ? full : null;
};
let packBusy = false;

async function packSearch(input) {
  const query = String(input.query || '').trim().slice(0, 120);
  const offset = Math.max(0, Math.min(9000, Number.parseInt(input.offset, 10) || 0));
  const index = ['relevance', 'downloads', 'follows', 'newest', 'updated'].includes(input.sort) ? input.sort : 'relevance';
  const params = new URLSearchParams({ query, facets: JSON.stringify([['project_type:modpack']]), index, limit: '48', offset: String(offset) });
  const r = await fetchJson(`${MODRINTH}/search?${params}`);
  const hits = (r.hits || []).map((m) => ({
    projectId: String(m.project_id || ''), title: String(m.title || m.slug || 'Без названия'), description: String(m.description || ''),
    author: String(m.author || 'Неизвестно'), downloads: Number(m.downloads) || 0, icon: String(m.icon_url || ''), source: 'modrinth',
    categories: Array.isArray(m.display_categories) ? m.display_categories.slice(0, 3) : [],
  }));
  return { hits, total: Number(r.total_hits ?? r.total) || hits.length };
}

async function mrPackPrepare(pid, tmp) {
  if (!/^[A-Za-z0-9]{5,30}$/.test(pid)) throw new Error('Некорректный идентификатор сборки.');
  const list = await fetchJson(`${MODRINTH}/project/${encodeURIComponent(pid)}/version`);
  const v = Array.isArray(list) && bestVersion(list);
  if (!v) throw new Error('У сборки нет доступных версий.');
  const file = (v.files || []).find((f) => f.primary && /\.mrpack$/i.test(f.filename || '')) || (v.files || []).find((f) => /\.mrpack$/i.test(f.filename || ''));
  if (!file || !/^https:\/\//i.test(file.url || '')) throw new Error('У сборки нет файла .mrpack.');
  const h = file.hashes || {};
  await downloadFile(file.url, tmp, { label: 'Скачивание сборки', expectedSize: Number(file.size) || 0, expectedHash: h.sha512 || h.sha1 || '', hashType: h.sha512 ? 'sha512' : 'sha1', minSize: 100, checkZip: true, progressChannel: 'packs:progress' });
  const zip = new AdmZip(tmp);
  const entry = zip.getEntry('modrinth.index.json');
  if (!entry) throw new Error('В архиве нет modrinth.index.json.');
  const idx = JSON.parse(zip.readAsText(entry));
  const dep = idx.dependencies || {};
  const loader = dep['fabric-loader'] ? 'fabric' : dep.forge ? 'forge' : dep.neoforge ? 'neoforge' : dep['quilt-loader'] ? 'quilt' : '';
  const tasks = (idx.files || []).filter((f) => !(f.env && f.env.client === 'unsupported')).map((f) => {
    const hh = f.hashes || {};
    return { rel: String(f.path || ''), url: (f.downloads || [])[0] || '', size: Number(f.fileSize) || 0, hash: hh.sha512 || hh.sha1 || '', hashType: hh.sha512 ? 'sha512' : 'sha1' };
  });
  const loaderVersion = String(dep['fabric-loader'] || dep.forge || dep.neoforge || dep['quilt-loader'] || '');
  return { title: String(idx.name || v.name || 'Modrinth pack'), mc: String(dep.minecraft || ''), loader, loaderVersion, tasks, zip, overrideDirs: ['overrides', 'client-overrides'], modInfo: {} };
}

async function packInstall(input) {
  const source = 'modrinth';
  const pid = String(input.projectId || '');
  const note = (label, pct) => send('packs:progress', { label, pct });
  const tmp = path.join(os.tmpdir(), `mylauncher-pack-${Date.now()}.zip`);
  try {
    note('Получение сборки…', 2);
    const pack = await mrPackPrepare(pid, tmp);
    if (!pack.mc || !safeVersionId(pack.mc)) throw new Error('Не удалось определить версию Minecraft у сборки.');
    if (!LOADERS.includes(pack.loader)) throw new Error(`Загрузчик «${pack.loader || 'нет'}» не поддерживается — нужны сборки на Fabric, Forge, NeoForge или Quilt.`);

    if (!installedIds().includes(pack.mc)) {
      note(`Скачивание Minecraft ${pack.mc}…`, 6);
      const r = await installVanillaVersion(null, pack.mc);
      if (!r.ok) throw new Error(r.error);
    }
    const idsBefore = new Set(installedIds());
    note(`Установка ${loaderName(pack.loader)}…`, 10);
    const prev = cfg.settings.selectedVersion;
    cfg.settings.selectedVersion = pack.mc;
    let lr;
    try { lr = await installLoaderHandler(null, pack.loader, pack.loaderVersion); } finally { cfg.settings.selectedVersion = prev; }
    if (!lr.ok) throw new Error(lr.error);

    const newId = `${packSlug(pack.title)}-${pack.mc}-${pack.loader}`;
    if (!safeVersionId(newId)) throw new Error('Не удалось создать имя профиля.');
    const prof = JSON.parse(fs.readFileSync(versionJsonPath(lr.id), 'utf8'));
    prof.id = newId;
    prof.myLauncher = { ...(prof.myLauncher || {}), packName: pack.title, packSource: source, packProjectId: pid };
    fs.mkdirSync(path.join(cfg.settings.gameDir, 'versions', newId), { recursive: true });
    fs.writeFileSync(versionJsonPath(newId), JSON.stringify(prof, null, 2), 'utf8');
    // промежуточный профиль загрузчика нам больше не нужен — в списке остаётся только сборка
    if (!idsBefore.has(lr.id) && lr.id !== newId) {
      try { fs.rmSync(path.join(cfg.settings.gameDir, 'versions', lr.id), { recursive: true, force: true }); } catch {}
    }
    if (!cfg.settings.isolateBuilds) { cfg.settings.isolateBuilds = true; saveCfg(); }
    const inst = path.join(cfg.settings.gameDir, 'instances', newId);
    fs.mkdirSync(inst, { recursive: true });

    // файлы сборки: 6 потоков
    const queue = pack.tasks.filter((t) => t.url && /^https:\/\//i.test(t.url));
    const total = queue.length;
    const okFiles = new Set();
    const failed = [];
    let done = 0;
    const worker = async () => {
      while (queue.length) {
        const t = queue.shift();
        const dest = insideDir(inst, t.rel);
        try {
          if (!dest) throw new Error('небезопасный путь');
          await downloadFile(t.url, dest, { label: t.rel, expectedSize: t.size, expectedHash: t.hash, hashType: t.hashType, minSize: 0, checkZip: /\.(jar|zip)$/i.test(t.rel), progressChannel: 'packs:file', timeout: 5 * 60 * 1000 });
          okFiles.add(t.rel);
        } catch (e) { failed.push(t.rel); log(`[launcher] Модпак: не скачался ${t.rel}: ${e.message || e}`); }
        done += 1;
        note(`Скачивание файлов ${done}/${total}`, 14 + Math.round((done / Math.max(1, total)) * 80));
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    if (total && failed.length === total) throw new Error('Не удалось скачать ни одного файла сборки.');

    note('Применение настроек сборки…', 96);
    for (const e of pack.zip.getEntries()) {
      if (e.isDirectory) continue;
      for (const pre of pack.overrideDirs) {
        if (!e.entryName.startsWith(pre + '/')) continue;
        const dest = insideDir(inst, e.entryName.slice(pre.length + 1));
        if (dest) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, e.getData()); }
      }
    }
    // имена модов для вкладки «Моды»
    const manPath = path.join(inst, KINDS.mod.manifest);
    const man = {};
    for (const [name, info] of Object.entries(pack.modInfo)) if (okFiles.has(`mods/${name}`)) man[name] = { ...info, installedAt: new Date().toISOString() };
    if (Object.keys(man).length) fs.writeFileSync(manPath, JSON.stringify(man, null, 2));

    cfg.settings.selectedVersion = newId;
    saveCfg();
    note('Готово', 100);
    log(`[launcher] Модпак «${pack.title}» установлен как ${newId} (${total - failed.length}/${total} файлов).`);
    return { ok: true, id: newId, title: pack.title, mc: pack.mc, loader: pack.loader, total, failed: failed.length };
  } catch (e) {
    log(`[launcher] Ошибка установки модпака: ${e && e.stack ? e.stack : e}`);
    return { ok: false, error: `Не удалось установить сборку: ${e.message || e}` };
  } finally {
    try { fs.rmSync(tmp, { force: true }); } catch {}
  }
}

ipcMain.handle('packs:search', async (_e, input = {}) => {
  try { return { ok: true, ...(await packSearch(input || {})) }; }
  catch (e) { return { ok: false, error: `Не удалось загрузить каталог: ${e.message || e}`, hits: [], total: 0 }; }
});
ipcMain.handle('packs:install', async (_e, input = {}) => {
  if (packBusy) return { ok: false, error: 'Другая сборка ещё устанавливается.' };
  packBusy = true;
  try { return await packInstall(input || {}); } finally { packBusy = false; }
});

ipcMain.handle('mods:target', (_e, kindInput) => {
  try { return { ok: true, target: { ...selectedModTarget(normKind(kindInput)), instanceDir: instDir(), isolated: !!cfg.settings.isolateBuilds } }; }
  catch (e) { return { ok: false, error: e.message || String(e) }; }
});

ipcMain.handle('mods:list', (_e, kindInput) => {
  try { return { ok: true, mods: listInstalled(normKind(kindInput)) }; }
  catch (e) { return { ok: false, error: e.message || String(e), mods: [] }; }
});

ipcMain.handle('mods:search', async (_e, input = {}) => {
  try {
    const kind = normKind(input.kind);
    const target = selectedModTarget(kind);
    const query = String(input.query || '').trim().slice(0, 120);
    const offset = Math.max(0, Math.min(9000, Number.parseInt(input.offset, 10) || 0));
    const allowedSort = ['relevance', 'downloads', 'follows', 'newest', 'updated'];
    const index = allowedSort.includes(input.sort) ? input.sort : 'relevance';
    const facets = [[`project_type:${KINDS[kind].projectType}`], [`versions:${target.mcVersion}`]];
    if (kind === 'mod') facets.push(modrinthLoaders(target.loader).map((l) => `categories:${l}`));
    const params = new URLSearchParams({ query, facets: JSON.stringify(facets), index, limit: '18', offset: String(offset) });
    send('mods:progress', { label: 'Поиск на Modrinth…' });
    const result = await fetchJson(`${MODRINTH}/search?${params.toString()}`);
    const hits = (Array.isArray(result.hits) ? result.hits : []).map((item) => ({
      projectId: String(item.project_id || ''),
      slug: String(item.slug || ''),
      title: String(item.title || item.slug || 'Без названия'),
      description: String(item.description || ''),
      author: String(item.author || 'Неизвестно'),
      downloads: Number(item.downloads) || 0,
      follows: Number(item.follows) || 0,
      icon: String(item.icon_url || ''),
      categories: Array.isArray(item.display_categories) ? item.display_categories.slice(0, 4) : [],
      versions: Array.isArray(item.versions) ? item.versions : [],
    }));
    send('mods:progress', { label: '' });
    return { ok: true, kind, target, hits, total: Number(result.total_hits ?? result.total) || hits.length, offset };
  } catch (e) {
    send('mods:progress', { label: '' });
    return { ok: false, error: `Не удалось загрузить каталог: ${e.message || e}`, hits: [], total: 0 };
  }
});

ipcMain.handle('mods:install', async (_e, projectInput = {}) => {
  try {
    const project = typeof projectInput === 'string' ? { projectId: projectInput } : (projectInput || {});
    const kind = normKind(project.kind);
    const projectId = String(project.projectId || '');
    if (!/^[A-Za-z0-9]{5,30}$/.test(projectId)) throw new Error('Некорректный идентификатор проекта Modrinth.');
    const target = selectedModTarget(kind);

    send('mods:progress', { label: `Подбор совместимой версии для Minecraft ${target.mcVersion}…` });
    const known = await knownProjects(kind);
    const wantedVersion = /^[A-Za-z0-9]{5,30}$/.test(String(project.versionId || '')) ? String(project.versionId) : '';
    if (wantedVersion && known.has(projectId)) {
      // смена версии уже установленного проекта: убираем старые файлы этого проекта
      const man = readManifest(kind);
      for (const [name, meta] of Object.entries(man)) {
        if (meta && meta.projectId === projectId) {
          try { fs.rmSync(path.join(kindDir(kind), safeFilename(name, kind)), { force: true }); } catch {}
          delete man[name];
        }
      }
      writeManifest(kind, man);
      known.delete(projectId);
    }
    const ctx = makeInstallCtx(kind, target, known);
    const res = await runInstallQueue(ctx, [{ ref: projectId, versionId: wantedVersion, force: !!wantedVersion, title: String(project.title || ''), icon: String(project.icon || '') }]);
    if (res.alreadyInstalled) { send('mods:progress', { label: '' }); return { ok: true, alreadyInstalled: true, kind, target }; }

    // Шейдеры работают только через Iris (Fabric): ставим его вместе с Sodium, если его ещё нет.
    let extra = [];
    if (kind === 'shader' && ['fabric', 'quilt', 'neoforge'].includes(target.loader)) {
      try {
        const modCtx = makeInstallCtx('mod', target, await knownProjects('mod'));
        await runInstallQueue(modCtx, [{ ref: 'iris', dep: true, title: 'Iris Shaders', allowAnyVersion: false }]);
        extra = modCtx.installed;
        ctx.warnings.push(...modCtx.warnings);
      } catch (e) { ctx.warnings.push(`Не удалось поставить Iris для шейдеров: ${e.message || e}`); }
    }

    send('mods:progress', { label: 'Готово', done: true });
    const main = ctx.installed[0];
    return {
      ok: true, kind, target,
      filename: main ? main.filename : '', title: main ? main.title : '', version: main ? main.version : '',
      mismatch: !!(main && main.mismatch),
      dependencies: [...ctx.installed.slice(1), ...extra].map((d) => d.title),
      warnings: ctx.warnings,
    };
  } catch (e) {
    send('mods:progress', { label: '' });
    log(`[launcher] Ошибка установки: ${e.message || e}`);
    return { ok: false, error: `Не удалось установить: ${e.message || e}` };
  }
});

ipcMain.handle('mods:toggle', (_e, fileInput, kindInput) => {
  try {
    const kind = normKind(kindInput);
    const filename = safeFilename(String(fileInput || ''), kind);
    const dir = kindDir(kind);
    const source = path.join(dir, filename);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) throw new Error('Файл не найден. Обновите список.');
    const enabling = /\.disabled$/i.test(filename);
    const nextName = enabling ? filename.replace(/\.disabled$/i, '') : `${filename}.disabled`;
    const destination = path.join(dir, nextName);
    if (fs.existsSync(destination)) throw new Error(`Файл ${nextName} уже существует. Сначала разрешите конфликт имён вручную.`);
    fs.renameSync(source, destination);
    const manifestMap = readManifest(kind);
    if (manifestMap[filename]) { manifestMap[nextName] = { ...manifestMap[filename], filename: nextName }; delete manifestMap[filename]; writeManifest(kind, manifestMap); }
    log(`[launcher] ${path.basename(nextName)} ${enabling ? 'включён' : 'отключён'}.`);
    return { ok: true, filename: nextName, enabled: enabling, mods: listInstalled(kind) };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});

ipcMain.handle('mods:remove', (_e, fileInput, kindInput) => {
  try {
    const kind = normKind(kindInput);
    const filename = safeFilename(String(fileInput || ''), kind);
    const file = path.join(kindDir(kind), filename);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('Файл не найден. Обновите список.');
    fs.rmSync(file, { force: true });
    const manifestMap = readManifest(kind);
    delete manifestMap[filename];
    writeManifest(kind, manifestMap);
    log(`[launcher] Удалён файл ${filename}`);
    return { ok: true, mods: listInstalled(kind) };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});

/* ---------------------- обновления модов и папки сборок ---------------------- */

const sha1File = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const updateFilters = (kind, target) => ({
  loaders: kind === 'mod' ? modrinthLoaders(target.loader) : kind === 'shader' ? ['iris', 'optifine', 'canvas', 'vanilla'] : ['minecraft'],
  game_versions: [target.mcVersion],
});
const pickFile = (version, kind) => {
  const rx = new RegExp(`\\.${KINDS[kind].ext}$`, 'i');
  const files = Array.isArray(version.files) ? version.files : [];
  return files.find((f) => f.primary && rx.test(f.filename || '')) || files.find((f) => rx.test(f.filename || ''));
};

async function findUpdates(kind) {
  const target = selectedModTarget(kind);
  const dir = kindDir(kind);
  fs.mkdirSync(dir, { recursive: true });
  const byHash = new Map();
  for (const name of fs.readdirSync(dir).filter((n) => extRe(kind).test(n)).slice(0, 400)) {
    try { byHash.set(sha1File(path.join(dir, name)), name); } catch {}
  }
  if (!byHash.size) return [];
  const found = await fetchJson(`${MODRINTH}/version_files/update`, {
    method: 'POST',
    body: JSON.stringify({ hashes: [...byHash.keys()], algorithm: 'sha1', ...updateFilters(kind, target) }),
  });
  const manifest = readManifest(kind);
  const stripExt = new RegExp(`\\.${KINDS[kind].ext}$`, 'i');
  const updates = [];
  const incompatible = [];
  try {
    const current = await fetchJson(`${MODRINTH}/version_files`, { method: 'POST', body: JSON.stringify({ hashes: [...byHash.keys()], algorithm: 'sha1' }) });
    for (const [hash, v] of Object.entries(current || {})) {
      const file = byHash.get(hash);
      if (!file || !v) continue;
      const okGame = (v.game_versions || []).includes(target.mcVersion);
      const okLoader = kind !== 'mod' || hasLoader(v.loaders, target.loader);
      if (!okGame || !okLoader) incompatible.push({ file, supports: (v.game_versions || []).slice(-3).join(', '), wrongLoader: !okLoader });
    }
  } catch {}
  for (const [hash, v] of Object.entries(found || {})) {
    const file = byHash.get(hash);
    if (!file || !v || v.version_type !== 'release') continue; // только стабильные релизы
    if ((v.files || []).some((f) => f.hashes && f.hashes.sha1 === hash)) continue; // уже последняя
    const canonical = file.replace(/\.disabled$/i, '');
    const meta = manifest[file] || manifest[canonical] || {};
    updates.push({
      file,
      title: meta.title || canonical.replace(stripExt, '').replace(/[_.-]+/g, ' '),
      current: meta.version || '',
      latest: String(v.version_number || v.name || ''),
      versionId: String(v.id || ''),
    });
  }
  return { updates, incompatible };
}

ipcMain.handle('app:setIcon', (_e, dataUrl) => {
  try {
    if (typeof dataUrl !== 'string' || !/^data:image\/png;base64,/.test(dataUrl) || dataUrl.length > 2000000) return false;
    const img = nativeImage.createFromDataURL(dataUrl);
    if (!img.isEmpty() && win) { win.setIcon(img); return true; }
  } catch {}
  return false;
});

ipcMain.handle('mods:versions', async (_e, input = {}) => {
  try {
    const kind = normKind(input.kind);
    const projectId = String(input.projectId || '');
    if (!/^[A-Za-z0-9]{5,30}$/.test(projectId)) throw new Error('Некорректный проект.');
    const target = selectedModTarget(kind);
    const list = await fetchJson(`${MODRINTH}/project/${encodeURIComponent(projectId)}/version`);
    const versions = (Array.isArray(list) ? list : [])
      .filter((v) => kind !== 'mod' || hasLoader(v.loaders, target.loader))
      .map((v) => ({
        id: String(v.id), number: String(v.version_number || v.name || ''), type: String(v.version_type || ''),
        date: String(v.date_published || ''), games: (v.game_versions || []).slice(-3).join(', '),
        compatible: (v.game_versions || []).includes(target.mcVersion),
      }));
    versions.sort((a, b) => (b.compatible - a.compatible) || (b.date > a.date ? 1 : -1));
    return { ok: true, versions: versions.slice(0, 40), mcVersion: target.mcVersion };
  } catch (e) { return { ok: false, error: e.message || String(e), versions: [] }; }
});

ipcMain.handle('mods:checkUpdates', async (_e, kindInput) => {
  try { const r = await findUpdates(normKind(kindInput)); return { ok: true, updates: r.updates, incompatible: r.incompatible }; }
  catch (e) { return { ok: false, error: `Не удалось проверить обновления: ${e.message || e}`, updates: [] }; }
});

ipcMain.handle('mods:update', async (_e, input = {}) => {
  const kind = normKind(input.kind);
  const items = (Array.isArray(input.items) ? input.items : []).slice(0, 100);
  const updated = [];
  const failed = [];
  const depQueue = [];
  try {
    const target = selectedModTarget(kind);
    const dir = kindDir(kind);
    for (const item of items) {
      let title = String(item && item.file || '');
      try {
        const oldName = safeFilename(item.file, kind);
        if (!/^[A-Za-z0-9]{5,30}$/.test(String(item.versionId || ''))) throw new Error('Некорректная версия.');
        const oldPath = path.join(dir, oldName);
        if (!fs.existsSync(oldPath)) throw new Error('Файл не найден.');
        const v = await fetchJson(`${MODRINTH}/version/${encodeURIComponent(item.versionId)}`);
        const file = pickFile(v, kind);
        if (!file || !file.url || !/^https:\/\//i.test(file.url)) throw new Error('У новой версии нет безопасного файла.');
        const enabled = !/\.disabled$/i.test(oldName);
        const base = path.basename(String(file.filename)).replace(/[^A-Za-z0-9._+() -]/g, '_');
        let newName = enabled ? base : `${base}.disabled`;
        let n = 2;
        while (newName !== oldName && fs.existsSync(path.join(dir, newName))) {
          newName = `${base.replace(/\.[^.]+$/, '')}-${n++}.${KINDS[kind].ext}${enabled ? '' : '.disabled'}`;
        }
        const manifest = readManifest(kind);
        const meta = manifest[oldName] || manifest[oldName.replace(/\.disabled$/i, '')] || {};
        title = meta.title || title;
        const hashes = file.hashes || {};
        await downloadFile(file.url, path.join(dir, newName), {
          label: `Обновление: ${title}`,
          expectedSize: Number(file.size) || 0,
          expectedHash: hashes.sha512 || hashes.sha1 || '',
          hashType: hashes.sha512 ? 'sha512' : hashes.sha1 ? 'sha1' : 'sha256',
          minSize: 1024, checkZip: true, progressChannel: 'mods:progress', timeout: 5 * 60 * 1000,
        });
        if (newName !== oldName) fs.rmSync(oldPath, { force: true });
        delete manifest[oldName];
        manifest[newName] = {
          ...meta, filename: newName, projectId: meta.projectId || String(v.project_id || ''),
          version: String(v.version_number || ''), source: 'Modrinth',
          minecraftVersion: target.mcVersion, loader: kind === 'mod' ? target.loader : '',
          updatedAt: new Date().toISOString(),
        };
        writeManifest(kind, manifest);
        updated.push(title);
        log(`[launcher] Обновлено (${kind}): ${title} → ${v.version_number}`);
        if (kind === 'mod') {
          for (const d of Array.isArray(v.dependencies) ? v.dependencies : []) {
            if (d && d.dependency_type === 'required' && (d.project_id || d.version_id)) depQueue.push({ ref: d.project_id || '', versionId: d.version_id || '', dep: true });
          }
        }
      } catch (e) {
        failed.push({ title, error: e.message || String(e) });
        log(`[launcher] Не удалось обновить ${title}: ${e.message || e}`);
      }
    }
    let deps = [];
    let warnings = [];
    if (depQueue.length) {
      const ctx = makeInstallCtx(kind, target, await knownProjects(kind));
      await runInstallQueue(ctx, depQueue);
      deps = ctx.installed.map((d) => d.title);
      warnings = ctx.warnings;
    }
    send('mods:progress', { label: '' });
    return { ok: true, updated, failed, dependencies: deps, warnings, mods: listInstalled(kind) };
  } catch (e) {
    send('mods:progress', { label: '' });
    return { ok: false, error: e.message || String(e), updated, failed };
  }
});

const MOD_DIRS = Object.values(KINDS);
const countFiles = (dir) => MOD_DIRS.reduce((n, k) => { try { return n + fs.readdirSync(path.join(dir, k.dir)).length; } catch { return n; } }, 0);

ipcMain.handle('instances:sources', () => {
  try {
    const out = [];
    const cur = path.resolve(instDir());
    const base = cfg.settings.gameDir;
    if (!cfg.settings.isolateBuilds || !cfg.settings.selectedVersion) return { ok: true, sources: out };
    const shared = countFiles(base);
    if (shared) out.push({ id: 'shared', label: 'Общая папка (старые файлы)', count: shared });
    const root = path.join(base, 'instances');
    for (const e of fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }) : []) {
      if (!e.isDirectory() || path.resolve(path.join(root, e.name)) === cur) continue;
      const count = countFiles(path.join(root, e.name));
      if (count) out.push({ id: e.name, label: e.name, count });
    }
    return { ok: true, sources: out };
  } catch (e) { return { ok: false, error: e.message || String(e), sources: [] }; }
});

ipcMain.handle('instances:copyFrom', (_e, sourceId) => {
  try {
    if (!cfg.settings.isolateBuilds) throw new Error('Раздельные папки сборок выключены.');
    const id = String(sourceId || '');
    const src = id === 'shared' ? cfg.settings.gameDir : (safeVersionId(id) ? path.join(cfg.settings.gameDir, 'instances', id) : '');
    const dst = instDir();
    if (!src || !fs.existsSync(src) || path.resolve(src) === path.resolve(dst)) throw new Error('Источник не найден.');
    fs.mkdirSync(dst, { recursive: true });
    for (const k of MOD_DIRS) {
      const from = path.join(src, k.dir);
      if (fs.existsSync(from)) fs.cpSync(from, path.join(dst, k.dir), { recursive: true, force: false, errorOnExist: false });
      const readJ = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch { return {}; } };
      const m = { ...readJ(path.join(src, k.manifest)), ...readJ(path.join(dst, k.manifest)) };
      if (Object.keys(m).length) fs.writeFileSync(path.join(dst, k.manifest), JSON.stringify(m, null, 2));
    }
    log(`[launcher] Файлы скопированы из «${id}» в ${dst}`);
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});

ipcMain.handle('instances:open', () => {
  const dir = instDir();
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return shell.openPath(dir);
});

/* ------------------------------ папки версий --------------------------- */

async function installVanillaVersion(_e, rawId) {
  try {
    const id = String(rawId || '');
    if (!safeVersionId(id)) throw new Error('Некорректная версия.');
    const man = manifest || await fetchJson(MANIFEST_URL);
    const entry = (man.versions || []).find((v) => v.id === id);
    if (!entry || !/^https:\/\//i.test(entry.url || '')) throw new Error('Версия не найдена в манифесте Mojang.');
    const vj = await fetchJson(entry.url);
    const client = vj.downloads && vj.downloads.client;
    if (!client || !client.url) throw new Error('У версии нет клиента для загрузки.');
    const dir = path.join(cfg.settings.gameDir, 'versions', id);
    fs.mkdirSync(dir, { recursive: true });
    await downloadFile(client.url, path.join(dir, `${id}.jar`), {
      label: `Minecraft ${id}`, expectedSize: Number(client.size) || 0, expectedHash: client.sha1 || '', hashType: 'sha1',
      minSize: 100000, checkZip: true, timeout: 10 * 60 * 1000,
    });
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(vj));
    log(`[launcher] Версия ${id} скачана (библиотеки и ресурсы подтянутся при первом запуске).`);
    return { ok: true };
  } catch (e) {
    log(`[launcher] Не удалось скачать версию: ${e.message || e}`);
    return { ok: false, error: `Не удалось скачать: ${e.message || e}` };
  }
}
ipcMain.handle('versions:install', installVanillaVersion);

ipcMain.handle('versions:openFolder', (_e, id) => {
  const dir = path.join(cfg.settings.gameDir, 'versions', String(id));
  return shell.openPath(fs.existsSync(dir) ? dir : cfg.settings.gameDir);
});

ipcMain.handle('versions:delete', (_e, rawId) => {
  const id = String(rawId || '');
  if (!id || id !== path.basename(id) || id === '.' || id === '..') return { ok: false, error: 'Некорректная версия' };
  if (gameProc) return { ok: false, error: 'Сначала остановите игру' };
  const dir = path.join(cfg.settings.gameDir, 'versions', id);
  if (!fs.existsSync(dir)) return { ok: false, error: 'Версия не найдена' };
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    if (cfg.settings.selectedVersion === id) { cfg.settings.selectedVersion = null; saveCfg(); }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Не удалось удалить: ' + (e.message || e) };
  }
});

/* ---------------------- Horizon: Minecraft Java на Rust ---------------------- */
// Неофициальный клиент https://github.com/horizon-rust/horizon (MIT). Файлов Mojang в нём нет:
// ресурсы собираются из твоей копии Minecraft в папке игры лаунчера.

const HZ_REPO = 'horizon-rust/horizon';
const hzRoot = () => path.join(app.getPath('userData'), 'horizon');
const hzAsset = () => (process.platform === 'win32' && process.arch === 'x64' ? 'horizon-windows-x64.zip' : '');
const hzSafeTag = (t) => /^[A-Za-z0-9._+\-]{1,60}$/.test(String(t || ''));
const hzDir = (tag) => path.join(hzRoot(), 'versions', tag);
let hzFromPlaybar = false;
const hzNote = (label, pct) => {
  send('horizon:progress', { label, pct });
  if (hzFromPlaybar) { send('game:progress', { label, pct }); state('launching', { message: label }); }
};
let hzBusy = false;
let hzProc = null;

function hzReadState() {
  try { return JSON.parse(fs.readFileSync(path.join(hzRoot(), 'state.json'), 'utf8')) || {}; } catch { return {}; }
}
function hzWriteState(patch) {
  fs.mkdirSync(hzRoot(), { recursive: true });
  fs.writeFileSync(path.join(hzRoot(), 'state.json'), JSON.stringify({ ...hzReadState(), ...patch }, null, 2));
}
function hzLock(dir) {
  try {
    const l = JSON.parse(fs.readFileSync(path.join(dir, 'research-lock.json'), 'utf8'));
    const pins = [l.minecraft.manifest_sha1, ...(l.minecraft.accepted_manifest_sha1 || [])].filter((h) => /^[0-9a-f]{40}$/.test(h || ''));
    return { mc: String(l.minecraft.version), java: Number(l.minecraft.java_major) || 25, pins };
  } catch { return null; }
}
const hzResources = (dir, mc) => path.join(dir, '.local', 'horizon-client', mc);
const hzPrepared = (dir, mc) => fs.existsSync(path.join(hzResources(dir, mc), 'horizon-resources.json'));

function hzStatus() {
  const st = hzReadState();
  const supported = !!hzAsset();
  let lock = null, prepared = false;
  if (st.tag && hzSafeTag(st.tag) && fs.existsSync(path.join(hzDir(st.tag), '.installed'))) {
    lock = hzLock(hzDir(st.tag));
    prepared = !!(lock && hzPrepared(hzDir(st.tag), lock.mc));
  }
  return { supported, tag: lock ? st.tag : '', mc: lock ? lock.mc : '', prepared, running: !!hzProc, busy: hzBusy };
}

// С 2026-10-28 Horizon выпускает только Nightly: релиз с тегом `nightly`, помеченный pre-release (docs/release-flow.md).
// Раньше лаунчер пропускал все pre-release и поэтому не находил ни одной сборки. Версия Nightly называется так же,
// как в лаунчере Horizon: `nightly-<дата>-<коммит>` (из названия релиза «Nightly 2026-10-28 · 0c02067»).
function hzNightlyVersion(r, asset) {
  const m = /^Nightly\s+(\d{4}-\d{2}-\d{2})(?:\s*·\s*([0-9a-f]{7,40}))?/i.exec(String(r.name || ''));
  const date = (m && m[1]) || String(r.published_at || '').slice(0, 10);
  if (m && m[2]) return `nightly-${date}-${m[2].toLowerCase()}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `nightly-${date}-${asset.id}` : `nightly-${asset.id}`;
}

async function hzLatest() {
  const list = await fetchJson(`https://api.github.com/repos/${HZ_REPO}/releases?per_page=40`);
  const name = hzAsset();
  const pick = (r) => {
    const asset = (r.assets || []).find((a) => a.name === name);
    return asset ? { r, asset } : null;
  };
  const releases = (Array.isArray(list) ? list : []).filter((r) => r && !r.draft && !/^launcher/i.test(String(r.tag_name || '')));
  // 1) текущий Nightly; 2) на крайний случай последний обычный релиз (до перехода на Nightly)
  const found = pick(releases.find((r) => r.tag_name === 'nightly') || {}) || releases.filter((r) => !r.prerelease).map(pick).find(Boolean);
  if (!found) throw new Error('Не нашёл готовую сборку Horizon для Windows на GitHub.');
  const { r, asset } = found;
  const tag = r.tag_name === 'nightly' ? hzNightlyVersion(r, asset) : String(r.tag_name || '');
  if (!hzSafeTag(tag)) throw new Error('У сборки Horizon странное имя версии: ' + tag);
  return { tag, asset, sums: (r.assets || []).find((a) => a.name === 'SHA256SUMS') || null };
}

async function hzInstall() {
  if (!hzAsset()) throw new Error('Horizon в лаунчере пока работает только на Windows x64.');
  hzNote('Поиск последней версии Horizon…', 2);
  const rel = await hzLatest();
  const dir = hzDir(rel.tag);
  if (!fs.existsSync(path.join(dir, '.installed'))) {
    let hash = '';
    if (rel.sums && /^https:\/\//i.test(rel.sums.browser_download_url || '')) {
      try {
        const text = await fetchText(rel.sums.browser_download_url);
        const m = text.split(/\r?\n/).map((l) => /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(l)).find((x) => x && x[2] === rel.asset.name);
        if (m) hash = m[1];
      } catch (e) { log(`[horizon] SHA256SUMS не получен: ${e.message || e}`); }
    }
    const zipPath = path.join(hzRoot(), 'downloads', `${rel.tag}.zip`);
    await downloadFile(rel.asset.browser_download_url, zipPath, {
      label: `Скачивание Horizon ${rel.tag}`, expectedSize: Number(rel.asset.size) || 0, expectedHash: hash, hashType: 'sha256',
      minSize: 100000, checkZip: true, progressChannel: 'horizon:progress', timeout: 20 * 60 * 1000,
    });
    hzNote('Распаковка…', 99);
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries().filter((e) => !e.isDirectory);
    const exe = entries.find((e) => /(^|\/)horizon-client\.exe$/i.test(e.entryName));
    if (!exe) throw new Error('В архиве Horizon нет horizon-client.exe.');
    const prefix = exe.entryName.slice(0, exe.entryName.length - 'horizon-client.exe'.length);
    const stage = dir + '.installing';
    fs.rmSync(stage, { recursive: true, force: true });
    fs.mkdirSync(stage, { recursive: true });
    for (const e of entries) {
      if (!e.entryName.startsWith(prefix)) continue;
      const dest = insideDir(stage, e.entryName.slice(prefix.length));
      if (!dest) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.getData());
    }
    for (const need of ['horizon-client.exe', 'horizon-prepare.exe', 'research-lock.json']) {
      if (!fs.existsSync(path.join(stage, need))) throw new Error(`В архиве Horizon нет ${need}.`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.renameSync(stage, dir);
    fs.writeFileSync(path.join(dir, '.installed'), new Date().toISOString());
    try { fs.rmSync(zipPath, { force: true }); } catch {}
  }
  // старые версии удаляем: они большие, а ресурсы готовятся заново под новую
  try {
    for (const d of fs.readdirSync(path.join(hzRoot(), 'versions'))) {
      if (d !== rel.tag) fs.rmSync(path.join(hzRoot(), 'versions', d), { recursive: true, force: true });
    }
  } catch {}
  hzWriteState({ tag: rel.tag });
  hzNote(`Horizon ${rel.tag} установлен`, 100);
  log(`[horizon] Установлен ${rel.tag}`);
  return { ok: true, status: hzStatus() };
}

async function hzPool(items, size, worker) {
  const queue = items.slice();
  let failed = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (queue.length) {
      const it = queue.shift();
      try { await worker(it); } catch (e) { failed += 1; log(`[horizon] ${e.message || e}`); }
    }
  }));
  return failed;
}

const hzLibAllowed = (lib) => {
  if (!Array.isArray(lib.rules) || !lib.rules.length) return true;
  let ok = false;
  for (const r of lib.rules) {
    const o = r.os;
    const match = !o || ((!o.name || o.name === 'windows') && (!o.arch || (o.arch === 'x86' ? process.arch === 'ia32' : process.arch !== 'ia32')));
    if (match) ok = r.action === 'allow';
  }
  return ok;
};

async function hzEnsureMinecraftFiles(mc, vj) {
  const gameDir = cfg.settings.gameDir;
  // библиотеки
  const libs = [];
  for (const lib of vj.libraries || []) {
    const a = lib.downloads && lib.downloads.artifact;
    if (!a || !a.path || !/^https:\/\//i.test(a.url || '') || !hzLibAllowed(lib)) continue;
    const dest = insideDir(path.join(gameDir, 'libraries'), a.path);
    if (!dest) continue;
    if (fs.existsSync(dest) && (!a.size || fs.statSync(dest).size === a.size)) continue;
    libs.push({ a, dest });
  }
  let done = 0;
  let failed = await hzPool(libs, 8, async ({ a, dest }) => {
    await downloadFile(a.url, dest, { label: path.basename(dest), expectedSize: Number(a.size) || 0, expectedHash: a.sha1 || '', hashType: 'sha1', minSize: 0, progressChannel: 'horizon:file', timeout: 5 * 60 * 1000 });
    done += 1;
    hzNote(`Библиотеки Minecraft ${done}/${libs.length}`, 12 + Math.round((done / Math.max(1, libs.length)) * 10));
  });
  if (failed) throw new Error(`Не скачалось библиотек: ${failed}. Проверьте интернет и повторите.`);

  // ресурсы (assets)
  const ai = vj.assetIndex;
  if (!ai || !ai.id || !/^https:\/\//i.test(ai.url || '')) throw new Error('У версии нет индекса ресурсов.');
  if (!/^[A-Za-z0-9._-]+$/.test(ai.id)) throw new Error('Некорректный индекс ресурсов.');
  const indexPath = path.join(gameDir, 'assets', 'indexes', `${ai.id}.json`);
  let index = null;
  try {
    if (crypto.createHash('sha1').update(fs.readFileSync(indexPath)).digest('hex') === ai.sha1) index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {}
  if (!index || !index.objects) {
    await downloadFile(ai.url, indexPath, { label: 'Индекс ресурсов', expectedHash: ai.sha1 || '', hashType: 'sha1', minSize: 10, progressChannel: 'horizon:file' });
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  }
  const objs = [];
  for (const o of Object.values(index.objects || {})) {
    if (!o || !/^[0-9a-f]{40}$/.test(o.hash || '')) continue;
    const dest = path.join(gameDir, 'assets', 'objects', o.hash.slice(0, 2), o.hash);
    if (fs.existsSync(dest) && fs.statSync(dest).size === o.size) continue;
    objs.push({ o, dest });
  }
  done = 0;
  failed = await hzPool(objs, 16, async ({ o, dest }) => {
    await downloadFile(`https://resources.download.minecraft.net/${o.hash.slice(0, 2)}/${o.hash}`, dest, { label: o.hash, expectedSize: Number(o.size) || 0, expectedHash: o.hash, hashType: 'sha1', minSize: 0, progressChannel: 'horizon:file', timeout: 3 * 60 * 1000 });
    done += 1;
    if (done % 25 === 0 || done === objs.length) hzNote(`Ресурсы Minecraft ${done}/${objs.length}`, 22 + Math.round((done / Math.max(1, objs.length)) * 30));
  });
  if (failed > Math.max(5, Math.floor(objs.length * 0.01))) throw new Error(`Не скачалось ресурсов: ${failed}. Повторите подготовку.`);
}

function hzRun(cmd, args, opts, onLine) {
  return new Promise((resolve, reject) => {
    const proc = cp.spawn(cmd, args, { windowsHide: true, ...opts });
    let tail = '';
    const feed = (d) => {
      for (const line of String(d).split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        tail = (tail + '\n' + t).slice(-1500);
        log('[horizon-prepare] ' + t);
        onLine(t);
      }
    };
    proc.stdout.on('data', feed);
    proc.stderr.on('data', feed);
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Подготовка завершилась с кодом ${code}. ${tail.split('\n').slice(-3).join(' ').slice(0, 300)}`))));
  });
}

async function hzPrepare() {
  const st = hzStatus();
  if (!st.tag) throw new Error('Сначала установите Horizon.');
  const dir = hzDir(st.tag);
  const lock = hzLock(dir);
  const mc = lock.mc;
  if (!safeVersionId(mc)) throw new Error('Некорректная версия Minecraft у Horizon.');
  const gameDir = cfg.settings.gameDir;
  const vjPath = path.join(gameDir, 'versions', mc, `${mc}.json`);
  const jarPath = path.join(gameDir, 'versions', mc, `${mc}.jar`);

  hzNote(`Проверка Minecraft ${mc}…`, 5);
  // Horizon сверяет sha1 файла версии, поэтому нужен ровно тот файл, что отдаёт Mojang (не перезаписанный).
  // Mojang переиздаёт 26.3.json; берём ровно тот файл, который Horizon знает (по sha1 из research-lock.json).
  const sha1Of = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex'); } catch { return ''; } };
  if (!lock.pins.includes(sha1Of(vjPath))) {
    let got = false;
    for (const pin of lock.pins) {
      try {
        await downloadFile(`https://piston-meta.mojang.com/v1/packages/${pin}/${mc}.json`, vjPath, { label: `Minecraft ${mc}`, expectedHash: pin, hashType: 'sha1', minSize: 100, progressChannel: 'horizon:file' });
        got = true;
        break;
      } catch (e) { log(`[horizon] ${pin}: ${e.message || e}`); }
    }
    if (!got) throw new Error(`Не удалось скачать файл версии ${mc}, который знает Horizon. Попробуйте обновить Horizon.`);
  }
  const vj = JSON.parse(fs.readFileSync(vjPath, 'utf8'));
  if (!fs.existsSync(jarPath)) {
    const c = vj.downloads && vj.downloads.client;
    if (!c || !c.url) throw new Error('У версии нет клиента для загрузки.');
    await downloadFile(c.url, jarPath, { label: `Minecraft ${mc}`, expectedSize: Number(c.size) || 0, expectedHash: c.sha1 || '', hashType: 'sha1', minSize: 100000, checkZip: true, progressChannel: 'horizon:progress', timeout: 10 * 60 * 1000 });
  }
  await hzEnsureMinecraftFiles(mc, vj);

  const server = vj.downloads && vj.downloads.server;
  if (!server || !/^https:\/\//i.test(server.url || '')) throw new Error('У версии нет серверного jar.');
  const serverJar = path.join(hzRoot(), 'server-jars', `${mc}.jar`);
  if (!fs.existsSync(serverJar)) {
    await downloadFile(server.url, serverJar, { label: `Сервер Minecraft ${mc}`, expectedSize: Number(server.size) || 0, expectedHash: server.sha1 || '', hashType: 'sha1', minSize: 100000, checkZip: true, progressChannel: 'horizon:progress', timeout: 10 * 60 * 1000 });
  }

  hzNote(`Подбор Java ${lock.java}…`, 55);
  let java = chooseJava(lock.java, await detectJava());
  if (!java || java.major < lock.java) {
    hzNote(`Скачивание Java ${lock.java}…`, 56);
    java = await downloadJava(lock.java);
  }
  const javaHome = path.dirname(path.dirname(java.path));
  const env = { ...process.env, JAVA_HOME: javaHome, PATH: path.join(javaHome, 'bin') + path.delimiter + (process.env.PATH || '') };

  hzNote('Подготовка ресурсов Horizon (несколько минут)…', 58);
  const prep = path.join(dir, 'horizon-prepare.exe');
  const onLine = (t) => hzNote('Подготовка: ' + t.slice(0, 80), 60);
  await hzRun(prep, ['--root', dir, '--prepare', '--server-jar', serverJar, '--minecraft-dir', gameDir], { cwd: dir, env }, onLine);
  try {
    hzNote('Звуки…', 90);
    await hzRun(prep, ['sounds', '--root', dir, '--minecraft-dir', gameDir], { cwd: dir, env }, onLine);
  } catch (e) { log(`[horizon] Звуки не скопировались (игра будет без звука): ${e.message || e}`); }
  if (!hzPrepared(dir, mc)) throw new Error('Подготовка завершилась, но ресурсы не найдены.');
  hzNote('Horizon готов к запуску', 100);
  return { ok: true, status: hzStatus() };
}

async function hzPlay() {
  const st = hzStatus();
  if (!st.tag) throw new Error('Сначала установите Horizon.');
  if (!st.prepared) throw new Error('Сначала подготовьте ресурсы (кнопка «Подготовить»).');
  if (hzProc) throw new Error('Horizon уже запущен.');
  const dir = hzDir(st.tag);
  const home = path.join(hzRoot(), 'game');
  fs.mkdirSync(home, { recursive: true });
  hzmSyncList();
  // Нативные моды работают только в игре, собранной с ними (кнопка «Собрать игру с модами» во вкладке модов).
  const nmods = hznNativeMods();
  const built = nmods.length ? HZN.current(st.tag, nmods) : null;
  // Обычный Horizon понимает --game-dir и --home. Собранная игра с нативными модами (Horizon 0.1.0 из ревизии модов)
  // этих флагов не знает и падает с «unknown option --game-dir». Домашняя папка и так передаётся через cwd и HORIZON_HOME.
  const args = built
    ? ['--resources', hzResources(dir, st.mc)]
    : ['--resources', hzResources(dir, st.mc), '--game-dir', home, '--home', home];
  const acc = cfg.accounts.find((a) => a.id === cfg.settings.activeAccount);
  if (acc && acc.type === 'offline') {
    args.push('--name', acc.name);
  } else if (acc) {
    const auth = await getAuthorization(acc);
    const file = path.join(app.getPath('userData'), `hz-session-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify({
      name: auth.name, uuid: auth.uuid, access_token: auth.access_token, user_type: 'msa',
      ...(auth.meta && auth.meta.xuid ? { xuid: String(auth.meta.xuid) } : {}),
    }), { mode: 0o600 });
    args.push('--session-file', file);
    setTimeout(() => { try { fs.rmSync(file, { force: true }); } catch {} }, 60000);
  }
  if (nmods.length && !built) log('[horizon] Нативные моды установлены, но игра с ними не собрана: запускается обычный Horizon. Нажми «Собрать игру с модами».');
  else if (built) log(`[horizon] Запуск игры, собранной с нативными модами: ${nmods.map((m) => m.id).join(', ')}`);
  const exeDir = built ? built.dir : dir;
  const proc = cp.spawn(path.join(exeDir, 'horizon-client.exe'), args, { cwd: home, env: { ...process.env, HORIZON_HOME: home }, windowsHide: false });
  hzProc = proc;
  send('horizon:state', { running: true });
  if (hzFromPlaybar) state('running', { message: 'Horizon запущен' });
  const feed = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) log('[horizon] ' + l.trim()); };
  proc.stdout.on('data', feed);
  proc.stderr.on('data', feed);
  proc.on('error', (e) => {
    hzProc = null;
    send('horizon:state', { running: false, error: `Не удалось запустить Horizon: ${e.message}` });
    state('idle', { error: `Не удалось запустить Horizon: ${e.message}` });
  });
  proc.on('close', (code) => {
    const wasStopped = stopping;
    hzProc = null;
    stopping = false;
    const error = code && !wasStopped ? `Horizon завершился с кодом ${code}. Подробности в консоли.` : undefined;
    send('horizon:state', { running: false, error });
    state('idle', { code, error });
    hzFromPlaybar = false;
  });
  return { ok: true };
}

function hzGuard(fn) {
  return async () => {
    if (hzBusy) return { ok: false, error: 'Другая операция Horizon ещё выполняется.' };
    hzBusy = true;
    try { return await fn(); }
    catch (e) { log(`[horizon] Ошибка: ${e && e.stack ? e.stack : e}`); return { ok: false, error: String((e && e.message) || e) }; }
    finally { hzBusy = false; }
  };
}
const HZ_VERSION_ID = 'horizon-rust';

// «Играть» на карточке Horizon: сама ставит игру, готовит ресурсы и запускает.
async function launchHorizon() {
  hzFromPlaybar = true;
  try {
    stopping = false;
    state('launching', { message: 'Horizon: проверка' });
    if (!hzStatus().tag) await hzInstall();
    if (!hzStatus().prepared) await hzPrepare();
    await hzPlay();
  } catch (e) {
    log(`[horizon] Ошибка: ${e && e.stack ? e.stack : e}`);
    state('idle', { error: String((e && e.message) || e) });
  } finally {
    hzBusy = false;
    if (!hzProc) hzFromPlaybar = false;
  }
}
ipcMain.handle('horizon:status', () => hzStatus());
ipcMain.handle('horizon:install', hzGuard(hzInstall));
ipcMain.handle('horizon:prepare', hzGuard(hzPrepare));
ipcMain.handle('horizon:play', async () => {
  try { return await hzPlay(); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
ipcMain.handle('horizon:stop', () => { try { if (hzProc) hzProc.kill(); } catch {} return { ok: true }; });
ipcMain.handle('horizon:openFolder', () => { const d = path.join(hzRoot(), 'game'); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); });

/* ------------- Horizon: моды, ресурспаки и шейдеры из реестра horizon-mods ------------- */
// Ставится только то, что Horizon умеет запускать (см. horizon-mods.js). Файлы кладутся в папку игры
// Horizon (hzRoot/game), там же horizon-mods.txt с включением модов. Всё, что поставил лаунчер,
// записано в hzRoot/mods.json; файлы, которых в нём нет, лаунчер не трогает.
const HZM = require('./horizon-mods');
const HZM_INDEX_URL = process.env.HORIZON_MOD_INDEX || HZM.DEFAULT_INDEX_URL;
const HZM_CACHE_MS = 10 * 60 * 1000;
let hzmBusy = false;
const hzmGame = () => path.join(hzRoot(), 'game');
const hzmStatePath = () => path.join(hzRoot(), 'mods.json');
const hzmCachePath = () => path.join(hzRoot(), 'mod-index.json');
const hzmListPath = () => path.join(hzmGame(), 'horizon-mods.txt');
const hzmFilePath = (m) => path.join(hzmGame(), HZM.KINDS[m.kind].dir, m.file);
const hzmProgress = (label, pct) => send('hzm:progress', { label, pct });

function hzmReadState() {
  try {
    const s = JSON.parse(fs.readFileSync(hzmStatePath(), 'utf8'));
    const installed = (Array.isArray(s.installed) ? s.installed : []).filter((m) => m && HZM.isValidId(m.id) && HZM.KINDS[m.kind]
      && typeof m.file === 'string' && path.basename(m.file) === m.file
      && (m.file.endsWith(HZM.KINDS[m.kind].ext) || (m.source === 'modrinth' && m.kind === 'shader' && m.file.endsWith('.zip'))));
    return { installed };
  } catch { return { installed: [] }; }
}
function hzmWriteState(state) {
  fs.mkdirSync(hzRoot(), { recursive: true });
  fs.writeFileSync(hzmStatePath(), JSON.stringify(state, null, 2));
}
const hzmReadList = () => { try { return fs.readFileSync(hzmListPath(), 'utf8'); } catch { return ''; } };
function hzmWriteList(text) {
  fs.mkdirSync(hzmGame(), { recursive: true });
  fs.writeFileSync(hzmListPath(), text);
}

// Реестр из кэша (не старше 10 минут), иначе свежий; без сети отдаём последний сохранённый.
function hzmCached() {
  try {
    const c = JSON.parse(fs.readFileSync(hzmCachePath(), 'utf8'));
    return c && c.url === HZM_INDEX_URL && c.index && typeof c.fetchedAt === 'number' ? c : null;
  } catch { return null; }
}
async function hzmIndex(force = false) {
  const cache = hzmCached();
  if (!force && cache && Date.now() - cache.fetchedAt < HZM_CACHE_MS) return { ...cache, stale: false };
  try {
    const index = /^https:\/\//i.test(HZM_INDEX_URL) ? await fetchJson(HZM_INDEX_URL) : JSON.parse(fs.readFileSync(HZM_INDEX_URL, 'utf8'));
    if (!index || index.schema !== 1) throw new Error('реестр в неизвестном формате, нужна новая версия лаунчера');
    const fresh = { fetchedAt: Date.now(), url: HZM_INDEX_URL, index };
    fs.mkdirSync(hzRoot(), { recursive: true });
    fs.writeFileSync(hzmCachePath(), JSON.stringify(fresh));
    return { ...fresh, stale: false };
  } catch (e) {
    if (cache) {
      log(`[horizon-mods] реестр не загрузился, показываю сохранённый (${e.message || e})`);
      return { ...cache, stale: true, error: String(e.message || e) };
    }
    throw new Error(`Не удалось загрузить реестр модов Horizon: ${e.message || e}`);
  }
}

async function hzmInstall(id) {
  if (!HZM.isValidId(id)) throw new Error('Некорректный id мода.');
  const { index } = await hzmIndex();
  const item = HZM.catalog(index).find((x) => x.id === id);
  if (!item) throw new Error('Его нет в реестре Horizon или Horizon его не запускает.');
  const kind = HZM.KINDS[item.kind];
  const state = hzmReadState();
  const prev = state.installed.find((m) => m.id === id);
  const game = hzmGame();
  const fileName = item.kind === 'mod' || item.kind === 'native-mod' ? `${id}${kind.ext}` : item.file;
  const dest = path.join(game, kind.dir, fileName);
  if (state.installed.some((m) => m.id !== id && m.kind === item.kind && m.file === fileName)) {
    throw new Error(`Файл ${fileName} уже занят другим установленным пакетом.`);
  }
  if (!prev && fs.existsSync(dest)) {
    throw new Error(`В папке игры уже лежит ${fileName}, его поставили не через лаунчер. Уберите его и повторите.`);
  }

  const tmp = path.join(hzRoot(), 'downloads', `${id}-${item.version.replace(/[^A-Za-z0-9._+-]/g, '_')}${kind.ext}`);
  try {
    hzmProgress(`Скачивание ${item.name}…`, 1);
    await downloadFile(item.url, tmp, {
      label: item.name, expectedSize: item.size, expectedHash: item.sha256, hashType: 'sha256', minSize: 1,
      checkZip: kind.zip, progressChannel: 'hzm:progress', timeout: 10 * 60 * 1000,
    });
    const data = fs.readFileSync(tmp);
    if (item.signed) {
      if (!item.signature) throw new Error('автор подписывает свои версии, а подписи у файла нет');
      const bad = HZM.verifySignature(data, item.key, item.signature);
      if (bad) throw new Error(`подпись не проверена: ${bad}`);
    }
    if (item.kind === 'mod') {
      const manifest = HZM.readModManifest(data);
      if (manifest.id !== id) throw new Error('id в horizon-mod.toml не совпадает с реестром');
    }
    if (item.kind === 'resourcepack') HZM.checkResourcePack(data);
    if (item.kind === 'native-mod') {
      const nm = HZM.readNativeManifest(data);
      if (nm.id !== id) throw new Error('id в horizon-native.json не совпадает с реестром');
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(dest, { force: true });
    fs.copyFileSync(tmp, dest);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) throw new Error('файл не записался в папку игры');
    if (prev && prev.file !== fileName) fs.rmSync(path.join(game, kind.dir, prev.file), { force: true });
    // Мод сразу включаем, как в моде-браузере Horizon; ресурспаки и шейдеры включаются в самой игре.
    if (item.kind === 'mod') hzmWriteList(HZM.setModLine(hzmReadList(), id, true));
    const record = {
      id, kind: item.kind, name: item.name, version: item.version, file: fileName, sha256: item.sha256,
      source: item.source, installedAt: new Date().toISOString(), enabled: true,
    };
    hzmWriteState({ installed: [...state.installed.filter((m) => m.id !== id), record] });
    log(`[horizon-mods] установлен ${item.name} ${item.version} (${item.kind})`);
    hzmProgress(`${item.name} установлен`, 100);
    return { ok: true, item: record };
  } catch (e) {
    const msg = String((e && e.message) || e);
    // downloadFile уже подписывает свои ошибки именем файла
    throw new Error(msg.startsWith(item.name) ? msg : `${item.name}: ${msg}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// Список установленного: без сети; мод из отозванного в реестре файла выключается с причиной.
function hzmInstalled() {
  const state = hzmReadState();
  const cached = hzmCached();
  let list = hzmReadList();
  return state.installed.map((m) => {
    let enabled = m.kind === 'mod' ? HZM.isModOn(list, m.id) : (m.kind === 'native-mod' ? !m.nativeOff : null);
    const revoke = cached && (cached.index.revoked || []).find((r) => r && r.id === m.id && (!r.sha256 || r.sha256 === m.sha256));
    if (revoke && enabled) {
      list = HZM.setModLine(list, m.id, false);
      hzmWriteList(list);
      enabled = false;
    }
    return {
      id: m.id, kind: m.kind, name: m.name, version: m.version, file: m.file, source: m.source, origin: m.origin || '',
      present: fs.existsSync(hzmFilePath(m)), enabled,
      revoked: revoke ? (revoke.reason || 'отозван реестром') : '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function hzmToggle(id, on) {
  if (!HZM.isValidId(id)) throw new Error('Некорректный id мода.');
  const m = hzmReadState().installed.find((x) => x.id === id);
  // Нативный мод: «выключить» значит не включать его в сборку игры (файл остаётся, модом можно вернуть).
  if (m && m.kind === 'native-mod') {
    const st0 = hzmReadState();
    hzmWriteState({ installed: st0.installed.map((x) => (x.id === id ? { ...x, nativeOff: !on } : x)) });
    return { ok: true };
  }
  if (!m || m.kind !== 'mod') throw new Error('Этот мод не установлен лаунчером.');
  if (!fs.existsSync(hzmFilePath(m))) throw new Error('Файл мода пропал из папки игры. Установите мод заново.');
  hzmWriteList(HZM.setModLine(hzmReadList(), id, !!on));
  const st = hzmReadState();
  hzmWriteState({ installed: st.installed.map((x) => (x.id === id ? { ...x, enabled: !!on } : x)) });
  return { ok: true };
}

// Перед запуском заново записываем horizon-mods.txt: игра может перезаписать файл (и потерять включённые моды).
function hzmSyncList() {
  try {
    let list = hzmReadList();
    const before = list;
    for (const m of hzmReadState().installed) {
      if (m.kind !== 'mod') continue;
      const present = fs.existsSync(hzmFilePath(m));
      list = present ? HZM.setModLine(list, m.id, m.enabled !== false) : HZM.removeModLine(list, m.id);
    }
    if (list !== before) hzmWriteList(list);
  } catch (e) { log(`[horizon-mods] не удалось обновить horizon-mods.txt: ${e.message || e}`); }
}

function hzmRemove(id) {
  if (!HZM.isValidId(id)) throw new Error('Некорректный id мода.');
  const state = hzmReadState();
  const m = state.installed.find((x) => x.id === id);
  if (!m) throw new Error('Этот пакет не установлен лаунчером.');
  fs.rmSync(hzmFilePath(m), { force: true });
  if (m.kind === 'mod') hzmWriteList(HZM.removeModLine(hzmReadList(), id));
  hzmWriteState({ installed: state.installed.filter((x) => x.id !== id) });
  return { ok: true };
}

function hzmGuard(fn) {
  return async (...args) => {
    if (hzmBusy) return { ok: false, error: 'Другая установка модов Horizon ещё идёт.' };
    hzmBusy = true;
    try { return await fn(...args); }
    catch (e) { log(`[horizon-mods] ${e && e.stack ? e.stack : e}`); return { ok: false, error: String((e && e.message) || e) }; }
    finally { hzmBusy = false; }
  };
}


// Встроенные моды (папка horizon-bundled, собирается build.py) и свои .hmod с диска. Оба пути проходят те же проверки,
// что и моды из реестра: архив, horizon-mod.toml, id, возможности. Без подписи: помечаются как встроенные/свои.
const HZM_BUNDLED_DIR = path.join(__dirname, 'horizon-bundled');
function hzmBundledList() {
  let index = [];
  try { index = JSON.parse(fs.readFileSync(path.join(HZM_BUNDLED_DIR, 'bundled.json'), 'utf8')); } catch { return []; }
  const state = hzmReadState();
  const out = [];
  for (const e of Array.isArray(index) ? index : []) {
    try {
      if (!e || !/^[A-Za-z0-9._+\-]{1,120}\.hmod$/.test(e.file || '') || !/^[0-9a-f]{64}$/.test(e.sha256 || '')) continue;
      const data = fs.readFileSync(path.join(HZM_BUNDLED_DIR, e.file));
      if (crypto.createHash('sha256').update(data).digest('hex') !== e.sha256) throw new Error('контрольная сумма не сходится');
      const m = HZM.readModManifest(data);
      const inst = state.installed.find((x) => x.id === m.id);
      out.push({
        id: m.id, file: e.file, kind: 'mod', name: m.name, version: m.version, summary: m.description.slice(0, 200),
        authors: 'Electron', license: 'MIT', downloads: 0, signed: false, source: 'bundled',
        installed: inst ? (inst.sha256 === e.sha256 ? 'current' : 'update') : '',
      });
    } catch (err) { log(`[horizon-mods] встроенный мод ${e && e.file}: ${err.message || err}`); }
  }
  return out;
}

// data — байты .hmod, origin — 'bundled' или 'local'.
function hzmInstallBuffer(data, origin, fileLabel) {
  if (data.length === 0 || data.length > 64 * 1024 * 1024) throw new Error('файл пустой или больше 64 МБ');
  const manifest = HZM.readModManifest(data);
  const id = manifest.id;
  const kind = HZM.KINDS.mod;
  const state = hzmReadState();
  const prev = state.installed.find((m) => m.id === id);
  if (prev && prev.kind !== 'mod') throw new Error(`id ${id} уже занят другим установленным пакетом.`);
  const fileName = `${id}${kind.ext}`;
  const dest = path.join(hzmGame(), kind.dir, fileName);
  if (!prev && fs.existsSync(dest)) throw new Error(`В папке игры уже лежит ${fileName}, его поставили не через лаунчер. Уберите его и повторите.`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
  hzmWriteList(HZM.setModLine(hzmReadList(), id, true));
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const record = {
    id, kind: 'mod', name: manifest.name, version: manifest.version, file: fileName, sha256,
    source: '', origin, installedAt: new Date().toISOString(), enabled: true,
  };
  hzmWriteState({ installed: [...state.installed.filter((m) => m.id !== id), record] });
  log(`[horizon-mods] установлен ${manifest.name} ${manifest.version} (${origin}: ${fileLabel})`);
  return record;
}

ipcMain.handle('hzm:bundled', () => {
  try { return { ok: true, items: hzmBundledList() }; } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
ipcMain.handle('hzm:installBundled', hzmGuard((_e, file) => {
  const entry = hzmBundledList().find((x) => x.file === file);
  if (!entry) throw new Error('Такого встроенного мода нет.');
  const record = hzmInstallBuffer(fs.readFileSync(path.join(HZM_BUNDLED_DIR, entry.file)), 'bundled', entry.file);
  return { ok: true, item: record, items: hzmInstalled(), bundled: hzmBundledList() };
}));
ipcMain.handle('hzm:installFile', hzmGuard(async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Мод Horizon (.hmod)', properties: ['openFile'], filters: [{ name: 'Мод Horizon', extensions: ['hmod'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, canceled: true, items: hzmInstalled() };
  const record = hzmInstallBuffer(fs.readFileSync(r.filePaths[0]), 'local', path.basename(r.filePaths[0]));
  return { ok: true, item: record, items: hzmInstalled(), bundled: hzmBundledList() };
}));

// Ресурспаки с Modrinth для 26.3: Horizon читает их как обычные ресурспаки (docs/mod-browser.md).
// Java-моды Modrinth сюда не попадают: Horizon их не запускает.
const HZM_MR = 'https://api.modrinth.com/v2';
const hzmMrId = (pid) => `mr_${pid}`;

// Иконки: картинка грузится здесь и отдаётся как data:, потому что CSP интерфейса не пускает к серверам реестра.
const hzmIcons = new Map();
async function hzmIconData(url) {
  if (!url || !/^https:\/\//i.test(url)) return '';
  if (hzmIcons.has(url)) return hzmIcons.get(url);
  let data = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Electron/1.1 (Minecraft desktop launcher)' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (res.ok && /^image\/(png|jpeg|webp|gif)$/.test(type)) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0 && buf.length <= 256 * 1024) data = `data:${type};base64,${buf.toString('base64')}`;
    }
  } catch {}
  hzmIcons.set(url, data);
  return data;
}

// Что можно брать с Modrinth: ресурспаки (фильтр по 26.3) и шейдеры. Шейдерпаки на Modrinth почти никогда не помечены
// версией 26.3, но Horizon читает их из папки shaderpacks как есть (BSL и другие работают), поэтому для шейдеров версию не фильтруем.
const HZM_MR_KINDS = ['resourcepack', 'shader'];
const hzmSafeFile = (name) => {
  const base = String(name || '').replace(/[\\/]/g, '_').replace(/[^A-Za-z0-9._+\-]+/g, '_').replace(/^\.+/, '').slice(-120);
  return /\.zip$/i.test(base) ? base.replace(/\.zip$/i, '.zip') : '';
};

async function hzmModrinthSearch(query, kindName) {
  const type = HZM_MR_KINDS.includes(kindName) ? kindName : 'resourcepack';
  const facets = JSON.stringify(type === 'shader' ? [['project_type:shader']] : [['project_type:resourcepack'], [`versions:${HZM.GAME_VERSION}`]]);
  const q = String(query || '').trim().slice(0, 80);
  const url = `${HZM_MR}/search?query=${encodeURIComponent(q)}&facets=${encodeURIComponent(facets)}&index=${q ? 'relevance' : 'downloads'}&limit=30`;
  const r = await fetchJson(url);
  const state = hzmReadState();
  const hits = (Array.isArray(r.hits) ? r.hits : []).filter((h) => h && typeof h.project_id === 'string' && /^[A-Za-z0-9]{1,40}$/.test(h.project_id));
  return Promise.all(hits.map(async (h) => {
    const id = hzmMrId(h.project_id);
    return {
      id, kind: type, source: 'modrinth', name: String(h.title || h.slug || '').slice(0, 120),
      summary: String(h.description || '').slice(0, 200), authors: String(h.author || ''), license: String(h.license || ''),
      downloads: Number(h.downloads) || 0, version: '', published: String(h.date_modified || ''), signed: false,
      icon: await hzmIconData(h.icon_url), installed: state.installed.some((m) => m.id === id) ? 'current' : '',
    };
  }));
}

async function hzmInstallModrinth(projectId) {
  if (!/^[A-Za-z0-9]{1,40}$/.test(projectId)) throw new Error('Некорректный id проекта Modrinth.');
  const id = hzmMrId(projectId);
  const state = hzmReadState();
  const prev = state.installed.find((m) => m.id === id);
  const project = await fetchJson(`${HZM_MR}/project/${projectId}`);
  const kindName = project && project.project_type;
  if (!HZM_MR_KINDS.includes(kindName)) throw new Error('Horizon ставит с Modrinth только ресурспаки и шейдеры: Java-моды он не запускает.');
  const kind = HZM.KINDS[kindName];
  let versions;
  let v;
  if (kindName === 'shader') {
    versions = await fetchJson(`${HZM_MR}/project/${projectId}/version`);
    const list = (Array.isArray(versions) ? versions : []).filter((x) => x && Array.isArray(x.files) && x.files.length);
    // Сначала версия, помеченная под 26.3, иначе самая новая: шейдерпак не зависит от версии игры так жёстко, как мод.
    v = list.find((x) => Array.isArray(x.game_versions) && x.game_versions.includes(HZM.GAME_VERSION)) || list[0];
    if (!v) throw new Error('У шейдера нет ни одной версии с файлом.');
  } else {
    versions = await fetchJson(`${HZM_MR}/project/${projectId}/version?game_versions=${encodeURIComponent(JSON.stringify([HZM.GAME_VERSION]))}`);
    v = (Array.isArray(versions) ? versions : []).find((x) => x && Array.isArray(x.game_versions) && x.game_versions.includes(HZM.GAME_VERSION));
    if (!v) throw new Error(`Нет версии для Minecraft ${HZM.GAME_VERSION}.`);
  }
  const files = (v.files || []).filter((x) => x && /^https:\/\/cdn\.modrinth\.com\//.test(x.url || '') && /\.zip$/i.test(x.filename || ''));
  const f = files.find((x) => x.primary) || files[0];
  if (!f) throw new Error('У версии нет подходящего .zip файла.');
  const sha512 = f.hashes && f.hashes.sha512;
  if (!/^[0-9a-f]{128}$/.test(sha512 || '')) throw new Error('У файла нет контрольной суммы SHA-512.');
  const fileName = hzmSafeFile(f.filename);
  if (!fileName) throw new Error('У файла странное имя.');
  const dest = path.join(hzmGame(), kind.dir, fileName);
  if (state.installed.some((m) => m.id !== id && m.kind === kindName && m.file === fileName)) {
    throw new Error(`Файл ${fileName} уже занят другим установленным пакетом.`);
  }
  if (!prev && fs.existsSync(dest)) throw new Error(`В папке игры уже лежит ${fileName}, его поставили не через лаунчер. Удали или переименуй его.`);
  const name = String(project.title || fileName).slice(0, 120);
  const tmp = path.join(hzRoot(), 'downloads', `${id}-${String(v.version_number || 'v').replace(/[^A-Za-z0-9._+-]/g, '_')}.zip`);
  try {
    hzmProgress(`Скачивание ${name}…`, 1);
    await downloadFile(f.url, tmp, {
      label: name, expectedSize: Number(f.size) || 0, expectedHash: sha512, hashType: 'sha512', minSize: 1,
      checkZip: true, progressChannel: 'hzm:progress', timeout: 10 * 60 * 1000,
    });
    const data = fs.readFileSync(tmp);
    if (kindName === 'shader') HZM.checkShaderPack(data); else HZM.checkResourcePack(data);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(dest, { force: true });
    fs.copyFileSync(tmp, dest);
    if (prev && prev.file !== fileName) fs.rmSync(path.join(hzmGame(), kind.dir, prev.file), { force: true });
    const record = {
      id, kind: kindName, source: 'modrinth', name, version: String(v.version_number || ''), file: fileName,
      sha256: '', sha512, projectId, installedAt: new Date().toISOString(),
    };
    hzmWriteState({ installed: [...state.installed.filter((m) => m.id !== id), record] });
    log(`[horizon-mods] установлен ${kindName === 'shader' ? 'шейдер' : 'ресурспак'} ${name} с Modrinth (${fileName})`);
    hzmProgress(`${name} установлен`, 100);
    return { ok: true, item: record };
  } catch (e) {
    const msg = String((e && e.message) || e);
    throw new Error(msg.startsWith(name) ? msg : `${name}: ${msg}`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

ipcMain.handle('hzm:catalog', async (_e, force) => {
  try {
    const { index, stale, error, fetchedAt } = await hzmIndex(!!force);
    const state = hzmReadState();
    const items = await Promise.all(HZM.catalog(index).map(async (it) => {
      const inst = state.installed.find((m) => m.id === it.id);
      const { url, signature, key, icon, ...view } = it;
      return { ...view, icon: await hzmIconData(icon), installed: inst ? (inst.sha256 === it.sha256 ? 'current' : 'update') : '' };
    }));
    return { ok: true, items, stale: !!stale, error: error || '', fetchedAt, game: HZM.GAME_VERSION, summary: HZM.summary(index) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});
ipcMain.handle('hzm:installed', () => {
  try { return { ok: true, items: hzmInstalled(), gameDir: hzmGame() }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
});
ipcMain.handle('hzm:install', hzmGuard((_e, id) => {
  const run = id && String(id).startsWith('mr_') ? hzmInstallModrinth(String(id).slice(3)) : hzmInstall(id);
  return run.then((r) => ({ ...r, items: hzmInstalled() }));
}));
ipcMain.handle('hzm:modrinth', async (_e, query, kind) => {
  try { return { ok: true, items: await hzmModrinthSearch(query, kind) }; }
  catch (e) { return { ok: false, error: `Не удалось поискать на Modrinth: ${(e && e.message) || e}` }; }
});
ipcMain.handle('hzm:remove', hzmGuard((_e, id) => ({ ...hzmRemove(id), items: hzmInstalled() })));
ipcMain.handle('hzm:toggle', hzmGuard((_e, id, on) => ({ ...hzmToggle(id, on), items: hzmInstalled() })));

/* ------------- Horizon: сборка игры с нативными модами (.hnmod) ------------- */
// Нативный мод меняет исходники игры, поэтому его нужно скомпилировать вместе с Horizon (horizon-native.js).
// windres/cc1 (сборка horizon-client) ломаются на пробелах в пути: имя пользователя «Vlad Diatlov» режет путь.
// Берём короткое 8.3-имя папки; если его нет, строим сборку в C:\ProgramData\Electron\horizon-native.
function nativeBuildRoot() {
  const base = path.join(hzRoot(), 'native-build');
  if (!/\s/.test(base)) return base;
  try {
    fs.mkdirSync(base, { recursive: true });
    const short = cp.execFileSync('cmd.exe', ['/d', '/c', `for %I in ("${base}") do @echo %~sI`], { encoding: 'utf8', windowsHide: true }).trim();
    if (short && !/\s/.test(short) && fs.existsSync(short)) return short;
  } catch {}
  const fallback = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Electron', 'horizon-native');
  return fallback;
}
const HZN = require('./horizon-native').create({
  root: () => nativeBuildRoot(),
  downloadFile, fetchJson, log, note: (label, pct) => hzmProgress(label, pct),
});
let hznBusy = false;
// Нативные моды, которые идут в сборку: исключённые вручную (nativeOff) и те, что не подошли набору, не считаются.
function hznAllNative() {
  return hzmReadState().installed.filter((m) => m.kind === 'native-mod' && fs.existsSync(hzmFilePath(m)));
}
function hznNativeMods() {
  return hznAllNative().filter((m) => !m.nativeOff)
    .map((m) => ({ id: m.id, file: hzmFilePath(m), sha256: m.sha256 || '' }));
}
function hznStatus() {
  const st = hzStatus();
  const mods = hznNativeMods();
  const off = hznAllNative().filter((m) => m.nativeOff).map((m) => m.id);
  const cur = st.tag && mods.length ? HZN.current(st.tag, mods) : null;
  return { supported: process.platform === 'win32' && process.arch === 'x64', mods: mods.map((m) => m.id), off, built: !!cur, busy: hznBusy, installedGame: !!st.tag, running: st.running };
}
const hznNames = () => Object.fromEntries(hznAllNative().map((m) => [m.id, m.name || m.id]));
ipcMain.handle('hzn:status', () => hznStatus());

// Предпросмотр: можно ли собрать выбранные моды вместе. Если они привязаны к разным коммитам Horizon, вернёт группы.
ipcMain.handle('hzn:plan', async () => {
  const st = hzStatus();
  if (!st.tag) return { ok: false, error: 'Сначала установи Horizon.' };
  const mods = hznNativeMods();
  if (!mods.length) return { ok: false, error: 'Нативные моды не установлены или все выключены.' };
  try {
    const p = await HZN.plan({ tag: st.tag, mods });
    const names = hznNames();
    return { ok: true, conflict: p.conflict, names, groups: p.groups, hooks: p.hooks };
  } catch (e) {
    log(`[horizon-native] Проверка модов: ${e && e.message ? e.message : e}`);
    return { ok: false, error: String((e && e.message) || e).slice(0, 800) };
  }
});
// Какие нативные моды входят в сборку (остальные остаются установленными, но в игру не собираются).
ipcMain.handle('hzn:select', hzmGuard((_e, ids) => {
  const keep = new Set(Array.isArray(ids) ? ids.map(String) : []);
  const st = hzmReadState();
  hzmWriteState({ installed: st.installed.map((m) => (m.kind === 'native-mod' ? { ...m, nativeOff: !keep.has(m.id) } : m)) });
  return { ok: true, items: hzmInstalled(), status: hznStatus() };
}));
ipcMain.handle('hzn:build', async (_e, opts) => {
  const o = opts && typeof opts === 'object' ? opts : { force: !!opts };
  if (hznBusy) return { ok: false, error: 'Сборка уже идёт.' };
  if (hzProc) return { ok: false, error: 'Закрой Horizon: игру нельзя пересобирать, пока она запущена.' };
  const st = hzStatus();
  if (!st.tag) return { ok: false, error: 'Сначала установи Horizon.' };
  const mods = hznNativeMods();
  if (!mods.length) return { ok: false, error: 'Нативные моды не установлены или все выключены.' };
  hznBusy = true;
  try {
    await HZN.build({ tag: st.tag, versionDir: hzDir(st.tag), mods, force: !!o.force, allowMismatch: !!o.allowMismatch });
    log('[horizon-native] Игра собрана с нативными модами');
    return { ok: true, status: hznStatus() };
  } catch (e) {
    log(`[horizon-native] Ошибка: ${e && e.message ? e.message : e}`);
    const conflict = e && e.conflict ? { ...e.conflict, names: hznNames() } : null;
    return { ok: false, error: String((e && e.message) || e).slice(0, 1500), logPath: HZN.logPath(), badMod: (e && e.badMod) || '', conflict };
  } finally { hznBusy = false; }
});
ipcMain.handle('hzn:openLog', () => { const p = HZN.logPath(); return fs.existsSync(p) ? shell.showItemInFolder(p) : { ok: false }; });

/* -------------------------------- старт -------------------------------- */

app.whenReady().then(() => {
  cfg = loadCfg();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
