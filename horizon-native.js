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
const SHA_RE = /^[0-9a-f]{7,40}$/i;

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

  function tcEnv(tc, extra = []) {
    const env = { ...process.env };
    const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = [path.join(tc, 'bin'), path.join(tc, 'mingw64', 'bin'), ...extra, env[pathKey] || ''].join(path.delimiter);
    env.RUSTC = path.join(tc, 'bin', 'rustc.exe');
    env.CARGO = path.join(tc, 'bin', 'cargo.exe');
    env.RUST_BACKTRACE = '1';
    env.CARGO_HOME = path.join(R(), 'cargo');
    for (const k of ['RUSTUP_TOOLCHAIN', 'RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER', 'CARGO_BUILD_RUSTC_WRAPPER', 'CARGO_TARGET_DIR']) delete env[k];
    return env;
  }

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
    const toolsDir = path.join(R(), 'tools', rev || 'head');
    const bin = path.join(toolsDir, 'bin', 'horizon-mixins.exe');
    if (exists(bin)) return bin;
    note('Сборка horizon-mixins (один раз, пара минут)…', 22);
    const args = ['install', '--locked', '--git', MIXINS_GIT, ...(rev ? ['--rev', rev] : []), '--root', toolsDir, 'horizon-mixins-cli'];
    const r = await run(path.join(tc, 'bin', 'cargo.exe'), args, { env: tcEnv(tc), cwd: R(), onLine: (l) => { fs.appendFileSync(buildLog(), l + '\n'); } });
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

  async function resolveCommit(tag, metas) {
    const api = (ref) => fetchJson(`https://api.github.com/repos/${HORIZON_REPO}/commits/${encodeURIComponent(ref)}`);
    // Пин ревизии берём у всех модов, у которых он есть (и у хук-точечных тоже): мод тестировался на этом коммите.
    const pins = [...new Set(metas.filter((m) => m.horizon).map((m) => m.horizon))];
    if (pins.length) {
      let best = null;
      for (const p of pins) {
        const c = await api(p);
        const when = Date.parse(c && c.commit && c.commit.committer && c.commit.committer.date) || 0;
        if (!c || !/^[0-9a-f]{40}$/.test(c.sha || '')) throw new Error(`на GitHub нет ревизии Horizon ${p}`);
        if (!best || when > best.when) best = { sha: c.sha, when };
      }
      return best.sha;
    }
    // Моды на хук-точках собираются на ревизии установленной версии игры.
    // Nightly называется `nightly-<дата>-<коммит>`: коммит и есть ревизия игры.
    const nightly = /^nightly-\d{4}-\d{2}-\d{2}-([0-9a-f]{7,40})$/.exec(String(tag));
    const c = await api(nightly ? nightly[1] : tag).catch(() => null);
    if (c && /^[0-9a-f]{40}$/.test(c.sha || '')) return c.sha;
    const hint = metas.find((m) => m.horizon);
    if (hint) {
      const h = await api(hint.horizon);
      if (h && /^[0-9a-f]{40}$/.test(h.sha || '')) return h.sha;
    }
    throw new Error(`не нашёл ревизию Horizon для версии ${tag}`);
  }

  // mods: [{ id, file, sha256 }], versionDir — папка установленной версии Horizon.
  async function build({ tag, versionDir, mods, force = false }) {
    if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Сборка нативных модов в лаунчере работает только на Windows x64.');
    if (!mods.length) throw new Error('Нет установленных нативных модов.');
    fs.mkdirSync(R(), { recursive: true });
    fs.appendFileSync(buildLog(), `\n=== ${new Date().toISOString()} сборка с модами: ${mods.map((m) => m.id).join(', ')} ===\n`);
    note('Проверка модов…', 1);
    const metas = mods.map((m) => ({ ...m, ...readBundleMeta(m.file) }));
    const commit = await resolveCommit(tag, metas);
    fs.appendFileSync(buildLog(), `[сборка] ревизия Horizon: ${commit} (пины модов: ${metas.map((m) => `${m.id}=${m.horizon || '-'}`).join(', ')})\n`);
    const mixRev = (metas.find((m) => m.mixins) || {}).mixins || '';
    const key = crypto.createHash('sha256')
      .update([commit, mixRev, RUST_VERSION, ...metas.map((m) => `${m.id}:${sha256File(m.file)}`).sort()].join('|'))
      .digest('hex').slice(0, 16);
    const buildDir = path.join(R(), 'builds', key);
    const gameDir = path.join(buildDir, 'game');
    const sig = modsSig(mods);
    const finish = () => {
      fs.writeFileSync(statePath(), JSON.stringify({ key, tag, commit, sig, dir: gameDir, mods: mods.map((m) => m.id), builtAt: new Date().toISOString() }, null, 2));
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
    const fr = await run(path.join(tc, 'bin', 'cargo.exe'), ['fetch', '--locked'], { env, cwd: src, onLine: logLine });
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
    const target = path.join(R(), 'target', commit.slice(0, 12));
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
    const cargoArgs = ['build', '--locked', '--profile', 'release'];
    if (hasModsFeature) cargoArgs.push('--features', 'horizon-client/mods');
    cargoArgs.push('-p', 'horizon-client');
    logLine(`[сборка] фича horizon-client/mods ${hasModsFeature ? 'есть, включаю' : 'не объявлена в Horizon, собираю без неё'}`);
    const cr = await run(path.join(tc, 'bin', 'cargo.exe'), cargoArgs,
      {
        env: { ...env, CARGO_TARGET_DIR: target }, cwd: stage,
        onLine: (l) => {
          logLine(l);
          const m = /^\s*(Compiling|Downloaded|Downloading)\s+(\S+)/.exec(l);
          if (!m) return;
          if (m[1] === 'Compiling') compiled += 1;
          note(`${m[1] === 'Compiling' ? 'Компиляция' : 'Загрузка крейтов'}: ${m[2]} (${compiled})`, Math.min(95, 36 + Math.floor(compiled / 8)));
        },
      });
    const exe = path.join(target, 'release', 'horizon-client.exe');
    if (cr.code !== 0 || !exists(exe)) {
      const out = String(cr.out || '');
      const firstErr = (out.match(/^error(\[E\d+\])?: .*$/m) || ['сбой компиляции'])[0];
      const culprit = findCulpritMod(out, modsDir, src);
      const hint = culprit
        ? `\nВиноват мод «${culprit}»: его код не совпадает с этой версией Horizon. Его можно убрать и собрать игру снова.`
        : `\nОшибка в коде Horizon с модами. Проверь моды в сборке: ${mods.map((m) => m.id).join(', ')}.`;
      const err = new Error(`сборка не удалась (подробности в ${buildLog()}):\n${firstErr}${hint}\n\n${out}`);
      if (culprit) err.badMod = culprit;
      throw err;
    }

    note('Установка собранной игры…', 96);
    fs.rmSync(gameDir, { recursive: true, force: true });
    fs.cpSync(versionDir, gameDir, { recursive: true, filter: (p) => !path.relative(versionDir, p).split(path.sep).includes('.local') });
    fs.copyFileSync(exe, path.join(gameDir, 'horizon-client.exe'));
    fs.rmSync(modsDir, { recursive: true, force: true });
    // Старые сборки не нужны: игра играет только последнюю.
    try {
      for (const d of fs.readdirSync(path.join(R(), 'builds'))) if (d !== key) fs.rmSync(path.join(R(), 'builds', d), { recursive: true, force: true });
    } catch {}
    return finish();
  }

  return { build, current, readState, modsSig, logPath: buildLog };
}

module.exports = { create, explainApplyError, readBundleMeta, extractBundle, syncTree, setRevision, RUST_VERSION };
