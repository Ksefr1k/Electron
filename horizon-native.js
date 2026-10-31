'use strict';
// Сборка Horizon с нативными модами (.hnmod), как это делает официальный лаунчер Horizon
// (docs/native-mods.md в репозитории horizon-rust/horizon):
//   1) свой Rust (rustc, cargo, rust-std, rust-mingw) и MinGW-w64 для Windows, каждый файл с проверкой SHA-256;
//   2) инструмент horizon-mixins (cargo install из GitHub);
//   3) исходники Horizon нужной ревизии;
//   4) horizon-mixins apply: моды правят исходники;
//   5) cargo build (с --features horizon-client/mods, если фича есть в Horizon): получается свой horizon-client.exe;
//   6) копия папки версии Horizon с подменённым exe. Ресурсы остаются в оригинальной папке (--resources).
// Работает только на Windows x64. Ничего не ставится в систему, всё лежит в папке лаунчера.

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const RUST_VERSION = '1.99.1';
const RUST_DIST = 'https://static.rust-lang.org/dist/2026-10-15';
const RUST_TARGET = 'x86_64-pc-windows-gnu';
// Контрольные суммы из launcher/src/rust_toolchain.rs репозитория Horizon (<name>-<версия>-<target>.tar.gz).
const RUST_COMPONENTS = [
  ['rustc', '43b17e9a9134ea72562bfbb23728a830f671ea9be1db6a72597a8d240e986b35'],
  ['cargo', '57e54617be4420dbb967ca8293f5ace7168104ac12efa9dc7c5c3bda112f8b36'],
  ['rust-std', '6546651238a3ac092b763511be524ca6eda6103e5d47342416923be1b3ce837c'],
  ['rust-mingw', '30263d7bb4fd0bf63a153afe36d7fc102f929a7d42781651c6b3a03a414ba428'],
];
const MINGW = {
  label: 'MinGW-w64',
  url: 'https://github.com/brechtsanders/winlibs_mingw/releases/download/16.2.0posix-23.1.3-14.0.0-msvcrt-r3/winlibs-x86_64-posix-seh-gcc-16.2.0-mingw-w64msvcrt-14.0.0-r3.zip',
  sha256: '62af32ea58acdea1318ea5dd8eb7017eaee694dd40b269d52a59c769dcfefb82',
};
const HORIZON_REPO = 'horizon-rust/horizon';
const MIXINS_GIT = 'https://github.com/horizon-rust/horizon-mixins';
// horizon-mixins, который берёт официальный лаунчер Horizon (launcher/src/native_mods.rs, MIXINS_REV). Он новее всех ревизий,
// на которых сейчас сделаны моды реестра (0d6b103, 3f99a5c), и является их потомком. Старые ревизии не берём: у разных модов
// они разные, и сборка с «первой попавшейся» ломала остальные моды.
const MIXINS_REV = '4342a0bfbe71d4d14185528d64e496d6022f16a1';
const HOOKS_FILE = 'crates/horizon-client/src/game/native_hooks.rs';
const SHA_RE = /^[0-9a-f]{7,40}$/i;

// Переменные игрока, которые меняют компилятор или флаги сборки: официальный лаунчер их тоже убирает (rust_toolchain.rs).
const SCRUB_EXACT = new Set(['RUSTFLAGS', 'CARGO_ENCODED_RUSTFLAGS', 'RUSTDOCFLAGS', 'CARGO_ENCODED_RUSTDOCFLAGS', 'CARGO_INCREMENTAL',
  'RUSTC', 'RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER', 'CARGO', 'CARGO_HOME']);
function isScrubbed(name) {
  const u = String(name).toUpperCase();
  return SCRUB_EXACT.has(u) || u.startsWith('CARGO_PROFILE_') || u.startsWith('CARGO_TARGET_') || u.startsWith('RUSTUP_')
    || (u.startsWith('CARGO_BUILD_') && u !== 'CARGO_BUILD_JOBS');
}

const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const exists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } };

function run(cmd, args, { cwd, env, onLine } = {}) {
  return new Promise((resolve) => {
    const tail = [];
    let p;
    try { p = cp.spawn(cmd, args, { cwd, env, windowsHide: true }); } catch (e) { resolve({ code: -1, out: String(e.message || e) }); return; }
    const feed = (d) => {
      for (const l of String(d).split(/\r?\n/)) {
        if (!l.trim()) continue;
        tail.push(l);
        if (tail.length > 40) tail.shift();
        if (onLine) onLine(l);
      }
    };
    p.stdout.on('data', feed);
    p.stderr.on('data', feed);
    p.on('error', (e) => resolve({ code: -1, out: String(e.message || e) }));
    p.on('close', (code) => resolve({ code, out: tail.join('\n') }));
  });
}

// Файлы, которые отличаются, копируются; одинаковые не трогаются, чтобы cargo не пересобирал лишнее.
function syncTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name === '.git') continue;
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) syncTree(a, b);
    else if (e.isFile()) {
      let same = false;
      try {
        const sa = fs.statSync(a), sb = fs.statSync(b);
        same = sa.size === sb.size && fs.readFileSync(a).equals(fs.readFileSync(b));
      } catch {}
      if (!same) fs.copyFileSync(a, b);
    }
  }
}

// horizon-native.json внутри .hnmod: id, horizon (ревизия игры), mixins (ревизия horizon-mixins), hooks (версия API хуков).
function readBundleMeta(file) {
  let zip;
  try { zip = new AdmZip(file); } catch { throw new Error(`${path.basename(file)}: не архив`); }
  const e = zip.getEntry('horizon-native.json');
  if (!e) throw new Error(`${path.basename(file)}: нет horizon-native.json`);
  let j;
  try { j = JSON.parse(e.getData().toString('utf8')); } catch { throw new Error(`${path.basename(file)}: horizon-native.json повреждён`); }
  const rev = (v) => (typeof v === 'string' && SHA_RE.test(v.trim()) ? v.trim().toLowerCase() : '');
  return { horizon: rev(j.horizon), mixins: rev(j.mixins), hooks: Number(j.hooks) || 0 };
}

// horizon-mixins требует, чтобы в horizon-mixin.toml была ревизия игры: ставим ревизию, на которой идёт сборка
// (у модов на хук-точках её может не быть вовсе, а у остальных она заменяется на общую).
function setRevision(text, commit) {
  const line = `horizon_revision = "${commit}"`;
  if (/^\s*horizon_revision\s*=/m.test(text)) return text.replace(/^(\s*)horizon_revision\s*=.*$/m, `$1${line}`);
  if (/^\[compatibility\][ \t]*\r?$/m.test(text)) return text.replace(/^(\[compatibility\][ \t]*)(\r?)$/m, `$1$2\n${line}$2`);
  return `${text.replace(/\s*$/, '')}\n\n[compatibility]\n${line}\n`;
}

// Кладёт mixins/<id>/… из .hnmod в <modsDir>/<id>/…; у модов на хук-точках horizon_revision ставится на ревизию сборки.
function extractBundle(file, id, modsDir, commit, hooksOnly) {
  const zip = new AdmZip(file);
  const prefix = `mixins/${id}/`;
  const base = path.resolve(modsDir, id);
  let n = 0;
  for (const e of zip.getEntries()) {
    if (e.isDirectory || !e.entryName.startsWith(prefix)) continue;
    const dest = path.resolve(modsDir, e.entryName.slice('mixins/'.length));
    if (!dest.startsWith(base + path.sep)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    let data = e.getData();
    if (e.entryName === `${prefix}horizon-mixin.toml`) data = Buffer.from(setRevision(data.toString('utf8'), commit), 'utf8');
    fs.writeFileSync(dest, data);
    n += 1;
  }
  if (!n) throw new Error(`в ${path.basename(file)} нет папки ${prefix}`);
}


// horizon-mixins печатает ошибку JSON-ом ({"code": "E_...", "mod_id": ...}). Переводим её на человеческий язык и
// запоминаем мод-виновник (err.badMod), чтобы интерфейс мог предложить его убрать.
function explainApplyError(out, diagText) {
  let j = null;
  const blocks = String(out || '').match(/\{[^{}]*\}/g) || [];
  for (const b of blocks.reverse()) { try { const o = JSON.parse(b); if (o && o.code) { j = o; break; } } catch {} }
  const fromPath = /mods[\\/]([a-z0-9_]+)[\\/]/.exec(String((j && j.file) || ''));
  const bad = (j && j.mod_id) || (fromPath && fromPath[1]) || '';
  const noGit = /git:\s*НЕ НАЙДЕН/.test(diagText || '');
  let msg;
  if (j && j.code === 'E_UNSUPPORTED_MACRO') {
    msg = `Мод «${bad}» не подходит к этой версии Horizon: его точка вмешательства (${j.injection_id || '?'}) попадает в код с макросом, который horizon-mixins не умеет править. Удали этот мод и собери игру снова, либо дождись его обновления.`;
  } else if (j && j.code === 'E_REVISION') {
    msg = `Мод «${bad || '?'}» не привязан к версии Horizon, и лаунчер не смог её определить.${noGit ? ' Не найден Git: поставь Git for Windows (git-scm.com) и повтори.' : ''} Если не поможет, удали этот мод.`;
  } else if (j && j.code === 'E_IO' && /program not found/i.test(j.message || '')) {
    msg = `Не хватает программы для сборки (${noGit ? 'Git не найден — поставь Git for Windows с git-scm.com' : 'см. диагностику в логе'}).`;
  } else {
    msg = `horizon-mixins не применил моды:\n${String(out || '').slice(-1200)}`;
  }
  const err = new Error(`${msg}\n[диагностика] ${diagText}`);
  if (bad) err.badMod = bad;
  return err;
}


// Ищем мод, чей код вызвал ошибку компиляции: берём идентификаторы из строки кода в ошибке rustc
// (например ITEM_NAME) и смотрим, в каком моде они определены, а в исходниках Horizon их нет.
function findCulpritMod(errText, modsDir, srcDir) {
  const snippet = [...String(errText || '').matchAll(/^\s*\d+\s*\|\s*(.*)$/gm)].map((m) => m[1]).join(' ');
  const idents = [...new Set(snippet.match(/[A-Za-z_][A-Za-z0-9_]{3,}/g) || [])];
  if (!idents.length) return '';
  const walk = (dir, exts, cb) => {
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, exts, cb);
      else if (e.isFile() && exts.some((x) => e.name.endsWith(x))) cb(p);
    }
  };
  // идентификаторы, которых нет в исходниках Horizon
  const inHorizon = new Set();
  walk(srcDir, ['.rs'], (f) => {
    let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { return; }
    for (const id of idents) if (!inHorizon.has(id) && t.includes(id)) inHorizon.add(id);
  });
  const scores = {};
  let modIds = [];
  try { modIds = fs.readdirSync(modsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return ''; }
  for (const modId of modIds) {
    const found = new Set();
    walk(path.join(modsDir, modId), ['.rs', '.toml', '.json'], (f) => {
      let t = ''; try { t = fs.readFileSync(f, 'utf8'); } catch { return; }
      for (const id of idents) if (t.includes(id)) found.add(id);
    });
    // свои (не из Horizon) идентификаторы весят больше
    scores[modId] = [...found].reduce((n, id) => n + (inHorizon.has(id) ? 0 : (/[A-Z_]/.test(id) ? 3 : 1)), 0);
  }
  const ranked = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return '';
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return '';
  return ranked[0][0];
}

function create({ root, downloadFile, fetchJson, log, note }) {
  const R = () => root();
  const statePath = () => path.join(R(), 'state.json');
  const buildLog = () => path.join(R(), 'build.log');

  function readState() {
    try { return JSON.parse(fs.readFileSync(statePath(), 'utf8')) || null; } catch { return null; }
  }
  const modsSig = (mods) => mods.map((m) => `${m.id}:${m.sha256}`).sort().join(',');

  // Сборка с текущим набором модов на этой версии Horizon, если она есть и файл на месте.
  function current(tag, mods) {
    const st = readState();
    if (!st || !tag || st.tag !== tag || !mods.length) return null;
    if (st.sig !== modsSig(mods)) return null;
    const exe = path.join(st.dir || '', 'horizon-client.exe');
    return exists(exe) ? { dir: st.dir, key: st.key } : null;
  }

  // Окружение сборки как у официального лаунчера: свой Rust и MinGW, свой CARGO_HOME, без настроек Rust игрока
  // и со своей временной папкой. Временная папка игрока (C:\\Users\\Имя Фамилия\\AppData\\Local\\Temp) часто с пробелом или
  // кириллицей, а gcc/as/ld из MinGW-w64 такие пути не открывают: сборка падала на ровном месте.
  function tcEnv(tc, extra = []) {
    const env = {};
    for (const [k, v] of Object.entries(process.env)) if (!isScrubbed(k)) env[k] = v;
    const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = [path.join(tc, 'bin'), path.join(tc, 'mingw64', 'bin'), ...extra, env[pathKey] || ''].join(path.delimiter);
    env.RUSTC = path.join(tc, 'bin', 'rustc.exe');
    env.CARGO = path.join(tc, 'bin', 'cargo.exe');
    env.RUST_BACKTRACE = '1';
    env.CARGO_HOME = path.join(R(), 'cargo');
    env.CARGO_TERM_COLOR = 'never';
    const tmp = path.join(R(), 'tmp');
    try { fs.mkdirSync(tmp, { recursive: true }); env.TMP = tmp; env.TEMP = tmp; env.TMPDIR = tmp; } catch {}
    return env;
  }
  // Cargo читает .cargo/config.toml из папки запуска и всех папок выше: стартуем с корня диска, а проект указываем через --manifest-path.
  const cargoCwd = () => path.parse(R()).root || R();

  async function fetchArchive(url, name, sha, label, pct) {
    const file = path.join(R(), '.dl', name);
    note(`Скачивание: ${label}`, pct);
    await downloadFile(url, file, {
      label, expectedHash: sha, hashType: 'sha256', minSize: 1000, checkZip: false,
      progressChannel: 'hzm:progress', timeout: 40 * 60 * 1000,
    });
    return file;
  }

  async function unpack(file, dest, extra = []) {
    fs.mkdirSync(dest, { recursive: true });
    const r = await run('tar', ['-xf', file, '-C', dest, ...extra]);
    return r;
  }

  async function ensureToolchain() {
    const dir = path.join(R(), 'rust', `${RUST_VERSION}-${RUST_TARGET}`);
    if (exists(path.join(dir, '.installed')) && exists(path.join(dir, 'mingw64', 'bin', 'gcc.exe'))) return dir;
    const partial = `${dir}.partial`;
    fs.rmSync(partial, { recursive: true, force: true });
    fs.mkdirSync(partial, { recursive: true });
    const total = RUST_COMPONENTS.length + 1;
    for (let i = 0; i < RUST_COMPONENTS.length; i++) {
      const [name, sha] = RUST_COMPONENTS[i];
      const fileName = `${name}-${RUST_VERSION}-${RUST_TARGET}.tar.gz`;
      const file = await fetchArchive(`${RUST_DIST}/${fileName}`, fileName, sha, `Rust ${RUST_VERSION} (${name})`, 2 + Math.round((i / total) * 18));
      note(`Распаковка: Rust (${name})`, 2 + Math.round(((i + 0.8) / total) * 18));
      const r = await unpack(file, partial, ['--strip-components=2']);
      fs.rmSync(file, { force: true });
      if (r.code !== 0) throw new Error(`не распаковался ${name}: ${r.out || 'tar вернул ' + r.code}`);
    }
    const mfile = await fetchArchive(MINGW.url, 'mingw.zip', MINGW.sha256, MINGW.label, 16);
    note('Распаковка: MinGW-w64 (может занять пару минут)', 19);
    const mr = await unpack(mfile, partial, ['--exclude', 'mingw64/share/*']);
    fs.rmSync(mfile, { force: true });
    if (!exists(path.join(partial, 'mingw64', 'bin', 'gcc.exe'))) throw new Error(`не распаковался MinGW-w64: ${mr.out || 'нет gcc.exe'}`);
    if (!exists(path.join(partial, 'bin', 'cargo.exe')) || !exists(path.join(partial, 'bin', 'rustc.exe'))) throw new Error('после распаковки в Rust нет cargo.exe или rustc.exe');
    fs.writeFileSync(path.join(partial, '.installed'), RUST_VERSION);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(partial, dir);
    return dir;
  }

  // rustfmt нужен части инструментов; официальный набор в лаунчере его не качает, докачиваем по требованию.
  // Контрольная сумма берётся из файла .sha256 рядом с архивом на static.rust-lang.org.
  async function ensureRustfmt(tc) {
    if (exists(path.join(tc, 'bin', 'rustfmt.exe'))) return false;
    const name = `rustfmt-${RUST_VERSION}-${RUST_TARGET}.tar.gz`;
    const res = await fetch(`${RUST_DIST}/${name}.sha256`, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`rustfmt: нет файла контрольной суммы (HTTP ${res.status})`);
    const sha = (await res.text()).trim().split(/\s+/)[0].toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error('rustfmt: странная контрольная сумма');
    const file = await fetchArchive(`${RUST_DIST}/${name}`, name, sha, 'Rust (rustfmt)', 30);
    const r = await unpack(file, tc, ['--strip-components=2']);
    fs.rmSync(file, { force: true });
    if (r.code !== 0 || !exists(path.join(tc, 'bin', 'rustfmt.exe'))) throw new Error(`rustfmt не распаковался: ${r.out}`);
    return true;
  }

  // Некоторым шагам horizon-mixins нужен git. Если его нет в системе, качаем портативный MinGit
  // с github.com/git-for-windows/git (SHA-256 берётся из данных релиза GitHub).
  async function ensureGit() {
    const dir = path.join(R(), 'git');
    if (exists(path.join(dir, 'cmd', 'git.exe'))) return dir;
    note('Скачивание портативного Git…', 31);
    const rel = await fetchJson('https://api.github.com/repos/git-for-windows/git/releases/latest');
    const asset = (rel.assets || []).find((a) => /^MinGit-[\d.]+-64-bit\.zip$/.test(a.name || ''));
    if (!asset) throw new Error('в последнем релизе Git for Windows нет MinGit 64-bit');
    let sha = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
    sha = sha ? sha[1].toLowerCase() : ((new RegExp(`${asset.name.replace(/\./g, '\\.')}[^0-9a-f]{0,40}([0-9a-f]{64})`, 'i').exec(rel.body || '') || [])[1] || '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error('не нашёл контрольную сумму MinGit');
    const file = path.join(R(), '.dl', asset.name);
    await downloadFile(asset.browser_download_url, file, {
      label: 'Git (MinGit)', expectedSize: Number(asset.size) || 0, expectedHash: sha, hashType: 'sha256',
      minSize: 100000, checkZip: false, progressChannel: 'hzm:progress', timeout: 15 * 60 * 1000,
    });
    const partial = `${dir}.partial`;
    fs.rmSync(partial, { recursive: true, force: true });
    const r = await unpack(file, partial);
    fs.rmSync(file, { force: true });
    if (!exists(path.join(partial, 'cmd', 'git.exe'))) throw new Error(`MinGit не распаковался: ${r.out}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(partial, dir);
    return dir;
  }

  async function diag(env) {
    const lines = [];
    for (const [cmd, args] of [['git', ['--version']], ['cargo', ['--version']], ['rustc', ['--version']], ['rustfmt', ['--version']]]) {
      const r = await run(cmd, args, { env });
      lines.push(`${cmd}: ${r.code === 0 ? r.out.split('\n').pop() : 'НЕ НАЙДЕН'}`);
    }
    return lines.join('; ');
  }

  async function ensureMixins(tc, rev) {
    rev = rev || MIXINS_REV;
    const toolsDir = path.join(R(), 'tools', rev);
    const bin = path.join(toolsDir, 'bin', 'horizon-mixins.exe');
    if (exists(bin)) return bin;
    note('Сборка horizon-mixins (один раз, пара минут)…', 22);
    const args = ['install', '--locked', '--git', MIXINS_GIT, '--rev', rev, '--root', toolsDir, 'horizon-mixins-cli'];
    const r = await run(path.join(tc, 'bin', 'cargo.exe'), args, { env: tcEnv(tc), cwd: cargoCwd(), onLine: (l) => { fs.appendFileSync(buildLog(), l + '\n'); } });
    if (r.code !== 0 || !exists(bin)) throw new Error(`horizon-mixins не собрался:\n${r.out}`);
    return bin;
  }

  async function ensureSource(commit) {
    const dir = path.join(R(), 'source', commit);
    if (exists(path.join(dir, '.complete'))) { fs.writeFileSync(path.join(dir, '.horizon-revision'), commit + '\n'); return dir; }
    const file = path.join(R(), '.dl', `horizon-${commit}.zip`);
    note('Скачивание исходников Horizon…', 26);
    await downloadFile(`https://github.com/${HORIZON_REPO}/archive/${commit}.zip`, file, {
      label: 'Исходники Horizon', minSize: 100000, checkZip: true, progressChannel: 'hzm:progress', timeout: 20 * 60 * 1000,
    });
    note('Распаковка исходников Horizon…', 29);
    fs.rmSync(dir, { recursive: true, force: true });
    const r = await unpack(file, dir, ['--strip-components=1']);
    fs.rmSync(file, { force: true });
    // tar может ругаться на символьные ссылки; для сборки важен сам код.
    if (!exists(path.join(dir, 'Cargo.toml'))) throw new Error(`исходники не распаковались: ${r.out || 'нет Cargo.toml'}`);
    if (r.code !== 0) log(`[horizon-native] tar при распаковке исходников: ${r.out}`);
    fs.writeFileSync(path.join(dir, '.horizon-revision'), commit + '\n');
    fs.writeFileSync(path.join(dir, '.complete'), commit);
    return dir;
  }

  // ---- ревизии Horizon ----
  // Полный SHA коммита по короткому или по тегу. Ответы GitHub кэшируются на диске (коммиты не меняются),
  // а если лимит API исчерпан, SHA берётся с github.com (там лимита нет).
  const commitsFile = () => path.join(R(), 'commits.json');
  const readCommits = () => { try { return JSON.parse(fs.readFileSync(commitsFile(), 'utf8')) || {}; } catch { return {}; } };
  async function shaFromWeb(ref) {
    const res = await fetch(`https://github.com/${HORIZON_REPO}/commit/${encodeURIComponent(ref)}.patch`, { signal: AbortSignal.timeout(30000), redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const { value } = await reader.read();
    try { await reader.cancel(); } catch {}
    const m = /^From ([0-9a-f]{40}) /.exec(Buffer.from(value || []).toString('utf8', 0, 200));
    if (!m) throw new Error('в ответе нет SHA');
    return m[1];
  }
  async function apiCommit(ref) {
    const key = String(ref).toLowerCase();
    const cache = readCommits();
    if (cache[key]) return cache[key];
    let rec = null;
    try {
      const c = await fetchJson(`https://api.github.com/repos/${HORIZON_REPO}/commits/${encodeURIComponent(ref)}`);
      if (c && /^[0-9a-f]{40}$/.test(c.sha || '')) rec = { sha: c.sha, when: Date.parse(c.commit && c.commit.committer && c.commit.committer.date) || 0 };
    } catch (e) { log(`[horizon-native] GitHub API: ${ref}: ${e.message || e}`); }
    if (!rec) {
      try { rec = { sha: /^[0-9a-f]{40}$/.test(key) ? key : await shaFromWeb(ref), when: 0 }; }
      catch (e) { throw new Error(`на GitHub нет ревизии Horizon ${ref} (${e.message || e})`); }
    }
    cache[key] = rec; cache[rec.sha] = rec;
    try { fs.mkdirSync(R(), { recursive: true }); fs.writeFileSync(commitsFile(), JSON.stringify(cache)); } catch {}
    return rec;
  }
  // NATIVE_HOOKS_API ревизии: моды на хук-точках собираются на любой ревизии, где он не меньше нужного (docs/native-mods.md).
  const hooksCache = new Map();
  async function hooksApiAt(commit) {
    if (hooksCache.has(commit)) return hooksCache.get(commit);
    let v = null;
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${HORIZON_REPO}/${commit}/${HOOKS_FILE}`, { signal: AbortSignal.timeout(45000) });
      if (res.ok) { const m = /NATIVE_HOOKS_API\s*:\s*u32\s*=\s*(\d+)/.exec(await res.text()); if (m) v = Number(m[1]); }
    } catch (e) { log(`[horizon-native] NATIVE_HOOKS_API ${commit.slice(0, 7)}: ${e.message || e}`); }
    hooksCache.set(commit, v);
    return v;
  }
  // Ревизия установленной версии Horizon: у Nightly она в названии (`nightly-<дата>-<коммит>`), у релиза это тег.
  async function installedCommit(tag) {
    const nightly = /^nightly-\d{4}-\d{2}-\d{2}-([0-9a-f]{7,40})$/.exec(String(tag));
    return (await apiCommit(nightly ? nightly[1] : tag)).sha;
  }
  const short = (sha) => String(sha || '').slice(0, 7);

  // Разбор набора модов: к каким ревизиям привязан каждый и можно ли собрать всё вместе (docs/native-mods.md, «Pinned to a Nightly»).
  // Мод на хук-точках (`hooks` > 0) не привязывает сборку: он едет на ревизии остальных модов или установленной версии.
  async function analyze({ tag, mods, only }) {
    const picked = Array.isArray(only) && only.length ? mods.filter((m) => only.includes(m.id)) : mods;
    const metas = picked.map((m) => ({ ...m, ...readBundleMeta(m.file) }));
    const hooked = metas.filter((m) => m.hooks > 0);
    const pinned = metas.filter((m) => !m.hooks && m.horizon);
    const loose = metas.filter((m) => !m.hooks && !m.horizon);
    const byCommit = new Map();
    for (const m of pinned) {
      const c = await apiCommit(m.horizon);
      if (!byCommit.has(c.sha)) byCommit.set(c.sha, { commit: c.sha, short: short(c.sha), when: c.when, mods: [] });
      byCommit.get(c.sha).mods.push(m.id);
      m.pinSha = c.sha;
    }
    const groups = [...byCommit.values()].sort((a, b) => b.mods.length - a.mods.length || b.when - a.when);
    return { metas, hooked, loose, groups };
  }

  // Для каждой группы: какие моды на хук-точках в неё входят (их NATIVE_HOOKS_API на этой ревизии достаточен), а какие нет.
  async function withHooks(an) {
    const out = [];
    for (const g of an.groups) {
      const api = await hooksApiAt(g.commit);
      const fit = an.hooked.filter((m) => api === null || api >= m.hooks).map((m) => m.id);
      const skip = an.hooked.filter((m) => api !== null && api < m.hooks).map((m) => m.id);
      out.push({ ...g, hookMods: fit, tooNew: skip, hooksApi: api, all: [...g.mods, ...fit, ...an.loose.map((m) => m.id)] });
    }
    return out;
  }

  // Предпросмотр сборки для окна: есть ли конфликт ревизий и какие наборы можно собрать.
  async function plan({ tag, mods }) {
    const an = await analyze({ tag, mods });
    const groups = await withHooks(an);
    return {
      conflict: groups.length > 1,
      groups: groups.map((g) => ({ commit: g.commit, short: g.short, mods: g.all, tooNew: g.tooNew })),
      hooks: an.hooked.map((m) => ({ id: m.id, need: m.hooks })),
    };
  }

  // Ревизия, на которой собирается набор. Разные привязки без allowMismatch — ошибка с описанием групп (err.conflict).
  async function resolveCommit(tag, an, allowMismatch) {
    const need = an.hooked.reduce((n, m) => Math.max(n, m.hooks), 0);
    let commit = '';
    if (an.groups.length > 1) {
      const groups = await withHooks(an);
      if (!allowMismatch) {
        const err = new Error('Выбранные нативные моды сделаны под разные версии Horizon и в одну игру не собираются:\n'
          + groups.map((g) => `• ${g.short}: ${g.mods.join(', ')}`).join('\n')
          + '\nВыбери набор, который собрать, или собери всё на самой новой ревизии (может не получиться).');
        err.conflict = { groups: groups.map((g) => ({ commit: g.commit, short: g.short, mods: g.all, tooNew: g.tooNew })) };
        throw err;
      }
      commit = [...an.groups].sort((a, b) => b.when - a.when)[0].commit;
    } else if (an.groups.length === 1) {
      commit = an.groups[0].commit;
    } else {
      commit = await installedCommit(tag);
      if (need) {
        const api = await hooksApiAt(commit);
        if (api !== null && api < need) {
          // Установленная версия старее нужного моду API хуков: берём ревизию, на которой его проверяли.
          const tested = an.hooked.filter((m) => m.horizon);
          if (!tested.length) throw new Error(`Моды требуют API хуков ${need}, а в установленном Horizon он ${api}. Обнови Horizon («Установить / обновить»).`);
          let best = null;
          for (const m of tested) { const c = await apiCommit(m.horizon); if (!best || c.when > best.when) best = c; }
          commit = best.sha;
        }
      }
    }
    if (need) {
      const api = await hooksApiAt(commit);
      if (api !== null && api < need) {
        const bad = an.hooked.filter((m) => m.hooks > api).map((m) => m.id);
        const err = new Error(`Моды ${bad.join(', ')} используют более новые хук-точки (API ${need}), чем есть в Horizon ${short(commit)} (API ${api}). Убери их из сборки или выбери другой набор.`);
        if (bad.length === 1) err.badMod = bad[0];
        throw err;
      }
    }
    return commit;
  }

  // mods: [{ id, file, sha256 }], versionDir — папка установленной версии Horizon.
  async function build({ tag, versionDir, mods, force = false, allowMismatch = false }) {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Сборка нативных модов в лаунчере работает только на Windows x64.');
    if (!mods.length) throw new Error('Нет установленных нативных модов.');
    fs.mkdirSync(R(), { recursive: true });
    fs.appendFileSync(buildLog(), `\n=== ${new Date().toISOString()} сборка с модами: ${mods.map((m) => m.id).join(', ')} ===\n`);
    note('Проверка модов…', 1);
    const an = await analyze({ tag, mods });
    const metas = an.metas;
    const commit = await resolveCommit(tag, an, allowMismatch);
    const mixRev = MIXINS_REV;
    fs.appendFileSync(buildLog(), `[сборка] ревизия Horizon: ${commit}; horizon-mixins: ${mixRev}; Rust ${RUST_VERSION}\n`
      + `[сборка] моды: ${metas.map((m) => `${m.id}(пин ${m.horizon ? short(m.horizon) : '-'}${m.hooks ? `, hooks ${m.hooks}` : ''})`).join(', ')}${allowMismatch ? ' [собираем несмотря на разные пины]' : ''}\n`);
    const key = crypto.createHash('sha256')
      .update([commit, mixRev, RUST_VERSION, 'v2', ...metas.map((m) => `${m.id}:${sha256File(m.file)}`).sort()].join('|'))
      .digest('hex').slice(0, 16);
    const buildDir = path.join(R(), 'builds', key);
    const gameDir = path.join(buildDir, 'game');
    const sig = modsSig(mods);
    const finish = () => {
      fs.writeFileSync(statePath(), JSON.stringify({ key, tag, commit, sig, dir: gameDir, mods: metas.map((m) => m.id), builtAt: new Date().toISOString() }, null, 2));
      note('Игра собрана с нативными модами', 100);
      return { key, dir: gameDir };
    };
    if (!force && exists(path.join(gameDir, 'horizon-client.exe'))) return finish();

    const tc = await ensureToolchain();
    const mixTool = await ensureMixins(tc, mixRev);
    const src = await ensureSource(commit);

    note('Применение модов к исходникам…', 32);
    const modsDir = path.join(buildDir, 'mods');
    const outDir = path.join(buildDir, 'out');
    fs.rmSync(modsDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
    for (const m of metas) extractBundle(m.file, m.id, modsDir, commit, !!m.hooks);
    let env = tcEnv(tc);
    const logLine = (l) => { try { fs.appendFileSync(buildLog(), l + '\n'); } catch {} };
    // horizon-mixins читает cargo metadata без сети (--offline --locked), поэтому зависимости игры нужны заранее.
    note('Загрузка зависимостей Horizon (cargo fetch)…', 33);
    const fr = await run(path.join(tc, 'bin', 'cargo.exe'), ['fetch', '--locked', '--manifest-path', path.join(src, 'Cargo.toml')], { env, cwd: cargoCwd(), onLine: logLine });
    if (fr.code !== 0) throw new Error(`cargo fetch не удался:\n${fr.out}`);
    note('Применение модов к исходникам…', 35);
    const applyArgs = ['apply', '--workspace', src, '--mods', modsDir, '--out', outDir];
    const tryApply = async () => {
      let r = await run(mixTool, applyArgs, { env, cwd: src, onLine: logLine });
      if (r.code !== 0 && /trust/i.test(r.out)) r = await run(mixTool, [...applyArgs, '--trust-native-mods'], { env, cwd: src, onLine: logLine });
      return r;
    };
    let ap = await tryApply();
    if (ap.code !== 0 && /program not found/i.test(ap.out)) {
      logLine(`[диагностика] ${await diag(env)}`);
      let changed = false;
      try { changed = (await ensureRustfmt(tc)) || changed; } catch (e) { logLine(`[rustfmt] ${e.message || e}`); }
      try {
        const g = await ensureGit();
        env = tcEnv(tc, [path.join(g, 'cmd')]);
        changed = true;
      } catch (e) { logLine(`[git] ${e.message || e}`); }
      if (changed) {
        fs.rmSync(outDir, { recursive: true, force: true });
        ap = await tryApply();
      }
    }
    if (ap.code !== 0) throw explainApplyError(ap.out, await diag(env));

    const stage = path.join(R(), 'stage', commit);
    syncTree(src, stage);
    syncTree(outDir, stage);
    fs.rmSync(outDir, { recursive: true, force: true });

    note('Компиляция Horizon с модами (10–30 минут, окно можно не трогать)…', 36);
    // Профиль `fast` (как в официальном лаунчере): те же оптимизации без LTO, сборка и пересборка в разы быстрее.
    // Если в этой ревизии его нет, собираем `release`.
    let profile = 'release';
    try { if (/^\[profile\.fast\]/m.test(fs.readFileSync(path.join(stage, 'Cargo.toml'), 'utf8'))) profile = 'fast'; } catch {}
    const target = path.join(R(), 'target', `${profile}-${commit.slice(0, 12)}`);
    let compiled = 0;
    // Фича `mods` нужна только если Horizon её объявляет: иначе cargo падает с «does not contain this feature».
    // Вставки horizon-mixins уже применены к исходникам, поэтому без фичи моды всё равно попадают в сборку.
    const clientToml = path.join(stage, 'crates', 'horizon-client', 'Cargo.toml');
    let hasModsFeature = false;
    try {
      let section = '';
      for (const raw of fs.readFileSync(clientToml, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        const h = /^\[(.+)\]$/.exec(line);
        if (h) { section = h[1].trim(); continue; }
        if (section === 'features' && /^mods\s*=/.test(line)) hasModsFeature = true;
      }
    } catch {}
    const cargoArgs = ['build', '--manifest-path', path.join(stage, 'Cargo.toml'), '--locked', '--profile', profile];
    const srcConfig = path.join(stage, '.cargo', 'config.toml');
    if (exists(srcConfig)) cargoArgs.push('--config', srcConfig);
    if (hasModsFeature) cargoArgs.push('--features', 'horizon-client/mods');
    cargoArgs.push('-p', 'horizon-client');
    logLine(`[сборка] профиль ${profile}; фича horizon-client/mods ${hasModsFeature ? 'есть, включаю' : 'не объявлена в Horizon, собираю без неё'}`);
    const cr = await run(path.join(tc, 'bin', 'cargo.exe'), cargoArgs,
      {
        env: { ...env, CARGO_TARGET_DIR: target }, cwd: cargoCwd(),
        onLine: (l) => {
          logLine(l);
          const m = /^\s*(Compiling|Downloaded|Downloading)\s+(\S+)/.exec(l);
          if (!m) return;
          if (m[1] === 'Compiling') compiled += 1;
          note(`${m[1] === 'Compiling' ? 'Компиляция' : 'Загрузка крейтов'}: ${m[2]} (${compiled})`, Math.min(95, 36 + Math.floor(compiled / 8)));
        },
      });
    const exe = path.join(target, profile, 'horizon-client.exe');
    if (cr.code !== 0 || !exists(exe)) {
      const out = String(cr.out || '');
      const firstErr = (out.match(/^error(\[E\d+\])?: .*$/m) || ['сбой компиляции'])[0];
      const culprit = findCulpritMod(out, modsDir, src);
      const hint = culprit
        ? `\nВиноват мод «${culprit}»: его код не совпадает с этой версией Horizon. Его можно убрать и собрать игру снова.`
        : `\nОшибка в коде Horizon с модами. Моды в сборке: ${metas.map((m) => m.id).join(', ')}. Если среди них есть привязанные к разным версиям Horizon, оставь только один набор.`;
      const err = new Error(`сборка не удалась (подробности в ${buildLog()}):\n${firstErr}${hint}\n\n${out}`);
      if (culprit) err.badMod = culprit;
      throw err;
    }

    note('Установка собранной игры…', 96);
    fs.rmSync(gameDir, { recursive: true, force: true });
    fs.cpSync(versionDir, gameDir, { recursive: true, filter: (p) => !path.relative(versionDir, p).split(path.sep).includes('.local') });
    fs.copyFileSync(exe, path.join(gameDir, 'horizon-client.exe'));
    fs.rmSync(modsDir, { recursive: true, force: true });
    // Старые сборки не нужны: игра играет только последнюю. Старые папки target (по 2 ГБ каждая) тоже убираем.
    try {
      for (const d of fs.readdirSync(path.join(R(), 'builds'))) if (d !== key) fs.rmSync(path.join(R(), 'builds', d), { recursive: true, force: true });
    } catch {}
    try {
      for (const d of fs.readdirSync(path.join(R(), 'target'))) if (d !== path.basename(target)) fs.rmSync(path.join(R(), 'target', d), { recursive: true, force: true });
    } catch {}
    return finish();
  }

  return { build, plan, current, readState, modsSig, logPath: buildLog };
}

module.exports = { create, MIXINS_REV, isScrubbed, explainApplyError, readBundleMeta, extractBundle, syncTree, setRevision, RUST_VERSION };
