'use strict';
// Моды, ресурспаки и шейдеры для Horizon (Rust-клиент Minecraft Java, docs/mods.md в репозитории Horizon).
//
// Что Horizon умеет запускать, решает реестр horizon-rust/horizon-mods: его index.json читает и лаунчер,
// и сайт Horizon. Java-моды (Fabric, Forge, NeoForge) Horizon не запускает, поэтому сюда они не попадают.
// Этот файл содержит только чистые функции: без сети и без записи на диск, их можно проверить отдельно.

const crypto = require('crypto');
const AdmZip = require('adm-zip');

const DEFAULT_INDEX_URL = 'https://horizon-rust.github.io/horizon-mods/index.json';
const GAME_VERSION = '26.3';
const ALLOWED_CAPABILITIES = ['registries'];
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');

// Виды, которые лаунчер ставит. Нативный мод (.hnmod) меняет код игры: он работает только в игре,
// собранной с ним, и при установке требует подтверждения пользователя.
const KINDS = {
  mod: { label: 'Мод', ext: '.hmod', dir: 'horizon-mods', zip: true },
  'native-mod': { label: 'Нативный', ext: '.hnmod', dir: 'horizon-native-mods', zip: true },
  resourcepack: { label: 'Ресурспак', ext: '.zip', dir: 'resourcepacks', zip: true },
  shader: { label: 'Шейдер', ext: '.hshader', dir: 'shaderpacks', zip: false },
};

const ID_RE = /^(?:[a-z0-9_]{1,64}|mr_[A-Za-z0-9]{1,40})$/; // mr_… — ресурспаки с Modrinth
const FILE_RE = /^[A-Za-z0-9._+\-]{1,120}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

// Ссылка на файл: только GitHub, как в описании реестра (docs/api/mod-index.md).
const isAllowedUrl = (url) => typeof url === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\//.test(url);

function isRevoked(index, id, sha256) {
  const list = index && Array.isArray(index.revoked) ? index.revoked : [];
  return list.some((r) => r && r.id === id && (!r.sha256 || r.sha256 === sha256));
}

// Самая новая версия проекта, которую Horizon может поставить и запустить.
function pickVersion(project, game) {
  const ext = KINDS[project.kind].ext;
  for (const v of Array.isArray(project.versions) ? project.versions : []) {
    if (!v || v.game !== game || !v.file) continue;
    const f = v.file;
    if (!FILE_RE.test(f.name || '') || !f.name.endsWith(ext)) continue;
    if (!SHA256_RE.test(f.sha256 || '') || !isAllowedUrl(f.url)) continue;
    if (project.kind === 'mod') {
      if (v.side === 'server') continue;
      const caps = Array.isArray(v.capabilities) ? v.capabilities : [];
      if (caps.some((c) => !ALLOWED_CAPABILITIES.includes(c))) continue;
    }
    return v;
  }
  return null;
}

// Сводка реестра для диагностики: сколько проектов всего, сколько подходят для игры и сколько Horizon умеет поставить.
function summary(index, game = GAME_VERSION) {
  const projects = index && Array.isArray(index.projects) ? index.projects : [];
  const byKind = {};
  for (const p of projects) {
    const k = (p && p.kind) || '?';
    byKind[k] = (byKind[k] || 0) + 1;
  }
  const forGame = projects.filter((p) => p && Array.isArray(p.versions) && p.versions.some((v) => v && v.game === game)).length;
  return { total: projects.length, byKind, forGame, supported: catalog(index, game).length, game };
}

// Всё, что Horizon умеет поставить, самое скачиваемое сверху.
function catalog(index, game = GAME_VERSION) {
  const projects = index && Array.isArray(index.projects) ? index.projects : [];
  const out = [];
  for (const p of projects) {
    if (!p || !isValidId(p.id) || !KINDS[p.kind] || typeof p.name !== 'string') continue;
    const v = pickVersion(p, game);
    if (!v || isRevoked(index, p.id, v.file.sha256)) continue;
    out.push({
      id: p.id,
      kind: p.kind,
      name: p.name.slice(0, 120),
      summary: String(p.summary || '').slice(0, 200),
      authors: (Array.isArray(p.authors) ? p.authors : []).map(String).join(', '),
      license: String(p.license || ''),
      downloads: Number(p.downloads) || 0,
      version: String(v.version || ''),
      published: String(v.published || ''),
      game: v.game,
      size: Number(v.file.size) || 0,
      sha256: v.file.sha256,
      file: v.file.name,
      url: v.file.url,
      icon: typeof p.icon === 'string' && /^https:\/\//.test(p.icon) ? p.icon : '',
      signed: !!p.key,
      key: typeof p.key === 'string' ? p.key : '',
      signature: typeof v.file.signature === 'string' ? v.file.signature : '',
      source: String(p.source || ''),
    });
  }
  return out.sort((a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name, 'ru'));
}

// Проверка подписи minisign (https://jedisct1.github.io/minisign/), как её требует реестр.
// Возвращает null, если подпись верна, иначе причину по-русски.
function verifySignature(data, pubkeyB64, sigText) {
  const pk = Buffer.from(String(pubkeyB64 || ''), 'base64');
  if (pk.length !== 42 || pk.toString('latin1', 0, 2) !== 'Ed') return 'ключ автора не в формате minisign';
  const lines = String(sigText || '').split(/\r?\n/).map((s) => s.trim());
  if (lines.length < 4 || !lines[2].startsWith('trusted comment: ')) return 'файл подписи повреждён';
  const sig = Buffer.from(lines[1], 'base64');
  const global = Buffer.from(lines[3], 'base64');
  if (sig.length !== 74 || global.length !== 64) return 'файл подписи повреждён';
  const alg = sig.toString('latin1', 0, 2);
  if (alg !== 'Ed' && alg !== 'ED') return 'неизвестный алгоритм подписи';
  if (!sig.subarray(2, 10).equals(pk.subarray(2, 10))) return 'подписано другим ключом';
  const key = crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519, pk.subarray(10)]), format: 'der', type: 'spki' });
  // ED — подпись хеша BLAKE2b-512 файла, Ed — подпись самого файла.
  const msg = alg === 'ED' ? crypto.createHash('blake2b512').update(data).digest() : data;
  const sigBytes = sig.subarray(10);
  if (!crypto.verify(null, msg, key, sigBytes)) return 'подпись файла не сходится';
  const trusted = Buffer.from(lines[2].slice('trusted comment: '.length), 'utf8');
  if (!crypto.verify(null, Buffer.concat([sigBytes, trusted]), key, global)) return 'доверенный комментарий подписи не сходится';
  return null;
}

// Манифест .hmod (zip с horizon-mod.toml): id, возможности и сторона должны подходить для клиента.
function readModManifest(buf) {
  let zip;
  try { zip = new AdmZip(buf); } catch { throw new Error('файл не похож на мод Horizon (не архив)'); }
  const entry = zip.getEntry('horizon-mod.toml');
  if (!entry) throw new Error('в файле нет horizon-mod.toml');
  const text = entry.getData().toString('utf8');
  const id = (/^\s*id\s*=\s*"([^"]*)"/m.exec(text) || [])[1] || '';
  const side = (/^\s*side\s*=\s*"([^"]*)"/m.exec(text) || [])[1] || 'both';
  const capsText = (/^\s*capabilities\s*=\s*\[([^\]]*)\]/m.exec(text) || [])[1] || '';
  const capabilities = [...capsText.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  if (!isValidId(id) || id.startsWith('mr_')) throw new Error('в horizon-mod.toml неверный id');
  if (side === 'server') throw new Error('это серверный мод, на клиент он не ставится');
  const extra = capabilities.filter((c) => !ALLOWED_CAPABILITIES.includes(c));
  if (extra.length) throw new Error(`мод просит возможности, которых лаунчер не разрешает: ${extra.join(', ')}`);
  if (!capabilities.includes('registries')) throw new Error('у мода нет возможности registries: Horizon не загрузит его содержимое');
  const str = (key) => (new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm').exec(text) || [])[1] || '';
  return { id, side, capabilities, name: str('name') || id, version: str('version') || '0.0.0', description: str('description') };
}

// Нативный мод (zip) по docs/native-mods.md и crates/horizon-mods/src/index/native.rs:
// horizon-native.json в корне, а исходники в mixins/<id>/ (там же horizon-mixin.toml).
function readNativeManifest(buf) {
  let zip;
  try { zip = new AdmZip(buf); } catch { throw new Error('файл не похож на нативный мод (не архив)'); }
  const json = zip.getEntry('horizon-native.json');
  if (!json) throw new Error('в файле нет horizon-native.json');
  let meta;
  try { meta = JSON.parse(json.getData().toString('utf8')); } catch { throw new Error('horizon-native.json повреждён'); }
  if (!meta || !isValidId(meta.id)) throw new Error('в horizon-native.json неверный id');
  if (!zip.getEntry(`mixins/${meta.id}/horizon-mixin.toml`)) throw new Error(`в файле нет mixins/${meta.id}/horizon-mixin.toml`);
  return { id: meta.id };
}

// Ресурспак (zip) обязан содержать pack.mcmeta в корне.
function checkResourcePack(buf) {
  let zip;
  try { zip = new AdmZip(buf); } catch { throw new Error('файл не похож на ресурспак (не архив)'); }
  if (!zip.getEntry('pack.mcmeta')) throw new Error('в архиве нет pack.mcmeta');
}

// Шейдерпак (zip, формат Iris/OptiFine): внутри должна быть папка shaders/ (в корне или в одной вложенной папке).
function checkShaderPack(buf) {
  let zip;
  try { zip = new AdmZip(buf); } catch { throw new Error('файл не похож на шейдерпак (не архив)'); }
  const has = zip.getEntries().some((e) => /^(?:[^/]+\/)?shaders\//.test(e.entryName));
  if (!has) throw new Error('в архиве нет папки shaders: это не шейдерпак');
}

// Строки mod.<id>:true|false в horizon-mods.txt, остальные строки (ключи модов и т.д.) не трогаем.
function modLines(text) {
  return String(text || '').split(/\r?\n/).filter((l) => l.trim() !== '');
}
function setModLine(text, id, on) {
  const kept = modLines(text).filter((l) => !l.trim().startsWith(`mod.${id}:`));
  kept.push(`mod.${id}:${on ? 'true' : 'false'}`);
  return kept.join('\n') + '\n';
}
function removeModLine(text, id) {
  const kept = modLines(text).filter((l) => !l.trim().startsWith(`mod.${id}:`));
  return kept.length ? kept.join('\n') + '\n' : '';
}
function isModOn(text, id) {
  return modLines(text).some((l) => l.trim() === `mod.${id}:true`);
}

module.exports = {
  DEFAULT_INDEX_URL,
  GAME_VERSION,
  KINDS,
  isValidId,
  isRevoked,
  pickVersion,
  catalog,
  summary,
  verifySignature,
  readModManifest,
  readNativeManifest,
  checkResourcePack,
  checkShaderPack,
  setModLine,
  removeModLine,
  isModOn,
};
