const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
const EVENTS = ['game:state', 'game:progress', 'game:log', 'loader:progress', 'mods:progress', 'packs:progress', 'horizon:progress', 'horizon:state', 'hzm:progress'];

contextBridge.exposeInMainWorld('api', {
  win: {
    minimize: () => invoke('win:min'),
    close: () => invoke('win:close'),
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', patch),
  },
  sys: {
    info: () => invoke('sys:info'),
    pickFolder: () => invoke('sys:pickFolder'),
    pickJava: () => invoke('sys:pickJava'),
    openFolder: (p) => invoke('sys:openFolder', p),
  },
  java: {
    detect: (force) => invoke('java:detect', force),
  },
  packs: {
    search: (options) => invoke('packs:search', options),
    install: (options) => invoke('packs:install', options),
  },
  mods: {
    target: (kind) => invoke('mods:target', kind),
    list: (kind) => invoke('mods:list', kind),
    search: (options) => invoke('mods:search', options),
    install: (project) => invoke('mods:install', project),
    toggle: (filename, kind) => invoke('mods:toggle', filename, kind),
    remove: (filename, kind) => invoke('mods:remove', filename, kind),
    checkUpdates: (kind) => invoke('mods:checkUpdates', kind),
    versions: (payload) => invoke('mods:versions', payload),
    update: (payload) => invoke('mods:update', payload),
  },
  horizon: {
    status: () => invoke('horizon:status'),
    install: () => invoke('horizon:install'),
    prepare: () => invoke('horizon:prepare'),
    play: () => invoke('horizon:play'),
    stop: () => invoke('horizon:stop'),
    openFolder: () => invoke('horizon:openFolder'),
    mods: {
      catalog: (force) => invoke('hzm:catalog', force),
      installed: () => invoke('hzm:installed'),
      install: (id) => invoke('hzm:install', id),
      remove: (id) => invoke('hzm:remove', id),
      toggle: (id, on) => invoke('hzm:toggle', id, on),
      modrinth: (query, kind) => invoke('hzm:modrinth', query, kind),
      bundled: () => invoke('hzm:bundled'),
      installBundled: (file) => invoke('hzm:installBundled', file),
      installFile: () => invoke('hzm:installFile'),
    },
    native: {
      status: () => invoke('hzn:status'),
      plan: () => invoke('hzn:plan'),
      select: (ids) => invoke('hzn:select', ids),
      build: (opts) => invoke('hzn:build', opts),
      openLog: () => invoke('hzn:openLog'),
    },
  },
  appIcon: (dataUrl) => invoke('app:setIcon', dataUrl),
  instances: {
    sources: () => invoke('instances:sources'),
    copyFrom: (id) => invoke('instances:copyFrom', id),
    open: () => invoke('instances:open'),
  },
  versions: {
    list: () => invoke('versions:list'),
    installed: () => invoke('versions:installed'),
    openFolder: (id) => invoke('versions:openFolder', id),
    delete: (id) => invoke('versions:delete', id),
    install: (id) => invoke('versions:install', id),
    installLoader: (loader) => invoke('loaders:install', loader),
  },
  skin: {
    get: (id) => invoke('skin:get', id),
    pick: () => invoke('skin:pick'),
    upload: (id, filePath, variant) => invoke('skin:upload', { id, filePath, variant }),
    reset: (id) => invoke('skin:reset', id),
    installSupport: (id) => invoke('skin:installSupport', id),
  },
  accounts: {
    list: () => invoke('accounts:list'),
    addOffline: (name) => invoke('accounts:addOffline', name),
    addMicrosoft: () => invoke('accounts:addMicrosoft'),
    select: (id) => invoke('accounts:select', id),
    remove: (id) => invoke('accounts:remove', id),
  },
  game: {
    launch: () => invoke('game:launch'),
    stop: () => invoke('game:stop'),
  },
  on: (ch, cb) => {
    if (!EVENTS.includes(ch)) return () => {};
    const h = (_e, d) => cb(d);
    ipcRenderer.on(ch, h);
    return () => ipcRenderer.removeListener(ch, h);
  },
});
