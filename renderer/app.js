(() => {
  const api = window.api;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------ иконки ------------------------------ */
  const ICONS = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/></svg>',
    cube: '<svg viewBox="0 0 24 24"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .6 3.2 2.3 3.5 5.2"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    'chevron-right': '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    'chevron-down': '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
    terminal: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="m7 10 3 2.5L7 15M12.5 15H17"/></svg>',
    folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    microsoft: '<svg viewBox="0 0 24 24" style="fill:currentColor;stroke:none"><path d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/></svg>',
    cpu: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
    coffee: '<svg viewBox="0 0 24 24"><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2.5 2.5 0 0 1 0 5h-2M7 3v2M11 3v2"/></svg>',
    shirt: '<svg viewBox="0 0 24 24"><path d="M8.5 3 3 6l2 4.5 3-1V20h8V9.5l3 1L21 6l-5.5-3a3.6 3.6 0 0 1-7 0z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    puzzle: '<svg viewBox="0 0 24 24"><path d="M8 4.5A2.5 2.5 0 1 1 13 4.5V7h4a2 2 0 0 1 2 2v3h-2.5a2.5 2.5 0 1 0 0 5H19v1a2 2 0 0 1-2 2h-4v-2.5a2.5 2.5 0 1 0-5 0V20H7a2 2 0 0 1-2-2v-4H2.5a2.5 2.5 0 1 1 0-5H5V7a2 2 0 0 1 2-2h1z"/></svg>',
    palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.6-3.9 1.8 1.8 0 0 1 1.3-3.1H18a3 3 0 0 0 3-3C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10.5" cy="6.8" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
    layers: '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>',
  };
  const icon = (n) => ICONS[n] || '';
  const paintIcons = (root = document) => $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

  /* ------------------------------ состояние --------------------------- */
  const S = {
    page: 'home',
    settings: {},
    accounts: [],
    versions: [],
    latest: {},
    versionsLoaded: false,
    versionsError: '',
    installed: new Set(),
    filter: 'release',
    query: '',
    limit: 60,
    javas: [],
    javasLoaded: false,
    sys: { totalMemMB: 8192 },
    game: 'idle',
    progress: { label: '', pct: 0 },
    msBusy: false,
    loaderBusy: false,
    modTargetResult: null,
    modHits: [],
    installedMods: [],
    modUpdates: {},
    dl: new Set(),
    modView: 'catalog',
    modFilter: '',
    modIncompat: {},
    verPick: null,
    updBusy: false,
    modOffset: 0,
    modTotal: 0,
    modsLoading: false,
    modBusy: '',
    modQuery: '',
    modSort: 'relevance',
    packHits: [], packTotal: 0, packsLoading: false, packBusy: '',
    modKind: 'mod',
  };

  const TYPE_LABEL = { release: 'Релиз', snapshot: 'Снапшот', old_beta: 'Beta', old_alpha: 'Alpha' };
  const PAGE_TITLES = { home: 'ГЛАВНАЯ', builds: 'СБОРКИ', packs: 'СБОРКИ МОДОВ', mods: 'МОДЫ', horizon: 'RUST MINECRAFT', accounts: 'АККАУНТЫ', settings: 'НАСТРОЙКИ' };
  const THEMES = [
    { id: 'green', name: 'Emerald', label: 'Зелёная', swatch: 'theme-green' },
    { id: 'dark', name: 'Midnight', label: 'Тёмная', swatch: 'theme-dark' },
    { id: 'light', name: 'Daylight', label: 'Светлая', swatch: 'theme-light' },
    { id: 'oled', name: 'OLED Black', label: 'OLED чёрная', swatch: 'theme-oled' },
    { id: 'purple', name: 'Violet', label: 'Фиолетовая', swatch: 'theme-purple' },
    { id: 'ocean', name: 'Ocean', label: 'Океан', swatch: 'theme-ocean' },
    { id: 'sunset', name: 'Sunset', label: 'Закат', swatch: 'theme-sunset' },
  ];

  const activeAccount = () => S.accounts.find((a) => a.id === S.settings.activeAccount) || null;
  const versionInfo = (id) => S.versions.find((v) => v.id === id) || null;

  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  async function setSetting(patch) {
    Object.assign(S.settings, patch);
    await api.settings.set(patch);
  }

  /* ---------------------- красивое окно подтверждения ------------------ */
  function uiConfirm(message, opts = {}) {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'cfm-overlay';
      ov.innerHTML = `<div class="cfm" role="alertdialog" aria-modal="true">
        <div class="cfm-icon ${opts.danger ? 'danger' : ''}">${icon(opts.danger ? 'trash' : 'info')}</div>
        <h3>${esc(opts.title || 'Подтверждение')}</h3>
        <p>${esc(message)}</p>
        <div class="cfm-actions"><button class="btn ghost" data-cfm="0">Отмена</button><button class="btn ${opts.danger ? 'danger' : 'primary'}" data-cfm="1">${esc(opts.ok || 'Подтвердить')}</button></div>
      </div>`;
      const done = (v) => { document.removeEventListener('keydown', onKey, true); ov.classList.add('out'); setTimeout(() => ov.remove(), 180); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } else if (e.key === 'Enter') { e.preventDefault(); done(true); } };
      ov.addEventListener('click', (e) => { if (e.target === ov) done(false); const b = e.target.closest('[data-cfm]'); if (b) done(b.dataset.cfm === '1'); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(ov);
      ov.querySelector('[data-cfm="1"]').focus();
    });
  }

  // Окно с несколькими вариантами. options: [{ value, title, text, primary }]; возвращает value или null (отмена).
  function uiChoose(title, message, options, cancelLabel = 'Отмена') {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'cfm-overlay';
      ov.innerHTML = `<div class="cfm cfm-wide" role="dialog" aria-modal="true">
        <div class="cfm-icon">${icon('info')}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(message)}</p>
        <div class="cfm-options">${options.map((o, i) => `<button class="btn ${o.primary ? 'primary' : 'ghost'} cfm-option" data-i="${i}"><b>${esc(o.title)}</b><small>${esc(o.text || '')}</small></button>`).join('')}</div>
        <div class="cfm-actions"><button class="btn ghost" data-i="-1">${esc(cancelLabel)}</button></div>
      </div>`;
      const done = (v) => { document.removeEventListener('keydown', onKey, true); ov.classList.add('out'); setTimeout(() => ov.remove(), 180); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
      ov.addEventListener('click', (e) => {
        if (e.target === ov) return done(null);
        const b = e.target.closest('[data-i]');
        if (b) { const i = Number(b.dataset.i); done(i >= 0 ? options[i].value : null); }
      });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(ov);
    });
  }

  /* --------------------- язык и режим панели -------------------- */
  const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  // Плавная смена: новый вид проявляется поверх старого (View Transitions). Без поддержки или при reduce-motion меняется сразу.
  function animated(fn) {
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduce) document.startViewTransition(() => { fn(); syncSegs(); });
    else fn();
  }
  // Ползунок под выбранным пунктом переключателя скользит к новой кнопке.
  function syncSegs() {
    $$('.seg').forEach((seg) => {
      let ind = seg.querySelector(':scope > .seg-ind');
      const fresh = !ind;
      if (fresh) { ind = document.createElement('span'); ind.className = 'seg-ind no-anim'; seg.prepend(ind); }
      seg.classList.add('has-ind');
      const btn = seg.querySelector(':scope > button.active');
      if (!btn) { ind.style.width = '0px'; return; }
      ind.style.width = btn.offsetWidth + 'px';
      ind.style.transform = `translateX(${btn.offsetLeft}px)`;
      if (fresh) { void ind.offsetWidth; ind.classList.remove('no-anim'); }
    });
  }
  function applyNav(mode) {
    mode = ['rail', 'wide', 'top', 'pill', 'dock', 'right'].includes(mode) ? mode : 'rail';
    document.body.dataset.nav = mode;
    lsSet('navMode', mode);
    if (S.settings && S.settings.navMode !== mode && S.settingsLoaded) setSetting({ navMode: mode });
    const rt = $('#railToggle');
    if (rt) { const t = mode === 'wide' ? 'Свернуть панель' : 'Показать подписи'; rt.title = t; rt.setAttribute('aria-label', t); }
    $$('[data-nav-choice]').forEach((b) => b.classList.toggle('active', b.dataset.navChoice === mode));
    syncSegs();
  }
  function applyLang(l) {
    window.I18N.setLang(l);
    const lb = $('#langLabel'); if (lb) lb.textContent = window.I18N.lang.toUpperCase();
    $$('[data-lang-choice]').forEach((b) => b.classList.toggle('active', b.dataset.langChoice === window.I18N.lang));
    PAGE_TITLES_SYNC();
    syncSegs();
  }
  function PAGE_TITLES_SYNC() { const t = $('#pageTitle'); if (t && PAGE_TITLES[S.page]) t.textContent = PAGE_TITLES[S.page]; }

  /* ------------------------------ навигация --------------------------- */
  const PAGES = ['home', 'builds', 'packs', 'mods', 'horizon', 'accounts', 'settings'];
  function go(page, opts = {}) {
    if (!PAGES.includes(page)) page = 'home';
    S.page = page;
    // Запоминаем, где ты был: при следующем запуске лаунчер откроется на этой же странице.
    if (opts.remember !== false) { lsSet('lastPage', page); if (S.settingsLoaded) setSetting({ lastPage: page }); }
    document.body.dataset.page = page;
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + page));
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    $('#pageTitle').textContent = PAGE_TITLES[page];
    $('#accMenu').hidden = true;
    if (page === 'builds') renderBuilds();
    if (page === 'mods') loadModsPage();
    if (page === 'packs' && !S.packHits.length && !S.packsLoading) searchPacks(1);
    if (page === 'horizon') refreshHorizon();
    if (page === 'accounts') renderAccounts();
    if (page === 'settings') renderSettings();
    syncSegs();
  }

  /* ------------------------------ аватары ----------------------------- */
  function avatarHTML(acc) {
    if (!acc) return '?';
    const letter = esc(acc.name.slice(0, 1).toUpperCase());
    if (acc.type === 'microsoft') {
      return `<img src="https://minotar.net/helm/${encodeURIComponent(acc.name)}/64.png" alt="" data-letter="${letter}" />`;
    }
    return letter;
  }
  document.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.letter) { const s = document.createElement('span'); s.className = 'icon-letter'; s.textContent = t.dataset.letter.toUpperCase(); t.replaceWith(s); }
  }, true);

  /* ----------------------- единые выпадающие списки -------------------- */
  const CHEVRON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  const closeSelects = (except) => $$('.cs.open').forEach((w) => { if (w !== except) { w.classList.remove('open'); w.querySelector('.cs-menu').hidden = true; } });
  function enhanceSelects(root = document) {
    $$('select', root).forEach((sel) => {
      if (sel.dataset.cs) return;
      sel.dataset.cs = '1';
      const wrap = document.createElement('div'); wrap.className = 'cs';
      sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel); sel.classList.add('cs-native'); sel.tabIndex = -1;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'cs-btn';
      const menu = document.createElement('div'); menu.className = 'cs-menu'; menu.hidden = true;
      wrap.append(btn, menu);
      const sync = () => {
        const cur = sel.selectedOptions[0];
        btn.innerHTML = `<span>${esc(cur ? cur.textContent : '')}</span>${CHEVRON}`;
        btn.disabled = sel.disabled;
        menu.innerHTML = [...sel.options].map((o) => `<button type="button" class="cs-item ${o.value === sel.value ? 'active' : ''}" data-val="${esc(o.value)}">${esc(o.textContent)}</button>`).join('');
      };
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !wrap.classList.contains('open');
        closeSelects(wrap); wrap.classList.toggle('open', open); menu.hidden = !open;
      });
      menu.addEventListener('click', (e) => {
        const it = e.target.closest('.cs-item'); if (!it) return;
        e.stopPropagation();
        sel.value = it.dataset.val;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        closeSelects(); sync();
      });
      new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true });
      sel.addEventListener('change', sync);
      sync();
    });
  }
  document.addEventListener('click', () => closeSelects());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSelects(); });

  /* --------------------------- темы оформления ------------------------ */
  function syncAppIcon() {
    try {
      const cs = getComputedStyle(document.body);
      const c1 = cs.getPropertyValue('--accent').trim() || '#86e8bb';
      const c2 = cs.getPropertyValue('--accent-2').trim() || '#46c490';
      const ink = cs.getPropertyValue('--accent-ink').trim() || '#06150f';
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      const x = cv.getContext('2d');
      const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, c1); g.addColorStop(1, c2);
      x.fillStyle = '#0d1512'; x.beginPath(); x.roundRect(8, 8, 240, 240, 56); x.fill();
      x.lineWidth = 7; x.strokeStyle = g; x.beginPath(); x.roundRect(11, 11, 234, 234, 53); x.globalAlpha = .55; x.stroke(); x.globalAlpha = 1;
      const rx = 104, ry = 40, dots = [];
      [0, 60, 120].forEach((deg) => {
        const f = deg * Math.PI / 180;
        x.lineWidth = 8; x.strokeStyle = g; x.beginPath(); x.ellipse(128, 128, rx, ry, f, 0, Math.PI * 2); x.stroke();
        dots.push([128 + rx * Math.cos(f), 128 + rx * Math.sin(f)]);
      });
      x.fillStyle = g;
      [[128, 128, 19], ...dots.map(([px, py]) => [px, py, 12])].forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); });
      api.appIcon(cv.toDataURL('image/png'));
    } catch {}
  }

  function applyTheme(themeId) {
    const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
    document.body.dataset.theme = theme.id;
    S.settings.theme = theme.id;
    setTimeout(syncAppIcon, 40);
    const options = $('#themeOptions');
    if (options) {
      options.innerHTML = THEMES.map((item) => `<button class="theme-option ${item.id === theme.id ? 'active' : ''}" data-theme-choice="${item.id}">
        <span class="theme-swatch ${item.swatch}"><i></i><i></i><i></i></span>
        <span class="theme-option-copy"><b>${item.label}</b><small>${item.name}</small></span>
        <span class="theme-selected">${icon(item.id === theme.id ? 'check' : '')}</span>
      </button>`).join('');
    }
    const trigger = $('#themeBtn');
    if (trigger) trigger.title = `Текущая тема: ${theme.label}`;
  }

  async function chooseTheme(themeId) {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return;
    applyTheme(theme.id);
    $('#themeMenu').hidden = true;
    await setSetting({ theme: theme.id });
    toast(`Тема «${theme.label}» применена`);
  }

  /* --------------------------- верхняя панель ------------------------- */
  function renderTop() {
    const acc = activeAccount();
    $('#pillAvatar').innerHTML = avatarHTML(acc);
    $('#pillName').textContent = acc ? acc.name : 'Нет аккаунта';
    const menu = $('#accMenu');
    menu.innerHTML =
      S.accounts
        .map(
          (a) => `<button class="menu-item ${a.id === S.settings.activeAccount ? 'active' : ''}" data-acc="${esc(a.id)}">
            <span class="avatar">${avatarHTML(a)}</span>
            <span><b>${esc(a.name)}</b><small>${a.type === 'microsoft' ? 'Microsoft' : 'Офлайн'}</small></span>
          </button>`
        )
        .join('') +
      (S.accounts.length ? '<hr />' : '') +
      '<button class="menu-item" data-manage="1"><span class="avatar" style="background:rgba(255,255,255,.08);color:#cfe0d8">' + icon('plus') + '</span><span><b>Управление аккаунтами</b></span></button>';
  }

  /* ----------------------------- нижняя панель ------------------------ */
  /* ------------------------------ Horizon (Rust) ---------------------- */
  const HZ = { busy: false, running: false, status: null };
  async function refreshHorizon() {
    const st = await api.horizon.status();
    HZ.status = st;
    HZ.running = st.running;
    $('#hzTag').textContent = !st.supported ? 'только Windows x64' : st.tag || 'не установлен';
    $('#hzMc').textContent = st.mc || '—';
    $('#hzPrep').textContent = st.prepared ? 'готовы' : 'не подготовлены';
    renderHorizonButtons();
    hzmOpen();
  }
  function renderHorizonButtons() {
    const st = HZ.status || {};
    $('#hzInstall').disabled = HZ.busy || !st.supported;
    $('#hzPrepare').disabled = HZ.busy || !st.tag;
    const play = $('#hzPlay');
    play.disabled = HZ.busy || !st.supported;
    const label = HZ.running ? 'Остановить' : !st.tag ? 'Установить и играть' : !st.prepared ? 'Подготовить и играть' : 'Играть';
    play.innerHTML = icon(HZ.running ? 'stop' : 'play') + `<span>${label}</span>`;
    const cur = !st.tag ? 'install' : !st.prepared ? 'prepare' : 'play';
    $$('#hzSteps li').forEach((li) => {
      const k = li.dataset.step, order = ['install', 'prepare', 'play'];
      const done = order.indexOf(k) < order.indexOf(cur) || (k === 'play' && HZ.running);
      li.className = done ? 'done' : k === cur ? 'current' : '';
      li.querySelector('.hz-dot').innerHTML = done ? icon('check') : order.indexOf(k) + 1;
    });
  }
  async function hzSmartPlay() {
    if (HZ.running) { await api.horizon.stop(); return; }
    if (HZ.busy) return;
    if (!(HZ.status || {}).tag) await hzRun(() => api.horizon.install(), 'Установка Horizon…', true);
    if (!(HZ.status || {}).tag) return;
    if (!HZ.status.prepared) await hzRun(() => api.horizon.prepare(), 'Подготовка…', true);
    if (!HZ.status.prepared) return;
    const r = await api.horizon.play();
    if (!r.ok) toast(r.error, 'error');
  }
  async function hzRun(fn, startText, quiet) {
    if (HZ.busy) return;
    HZ.busy = true;
    $('#hzBarWrap').hidden = false;
    $('#hzBar').style.width = '2%';
    $('#hzStatus').textContent = startText;
    renderHorizonButtons();
    try {
      const r = await fn();
      if (!r.ok) toast(r.error, 'error');
      else if (!quiet) toast('Готово');
    } catch (e) { toast('Ошибка: ' + (e.message || e), 'error'); }
    HZ.busy = false;
    $('#hzBarWrap').hidden = true;
    $('#hzStatus').textContent = '';
    await refreshHorizon();
  }

  /* ---------------------- Horizon: моды, ресурспаки, шейдеры ------------------ */
  const HZM = { kind: 'mod', view: 'catalog', src: 'horizon', query: '', sort: 'downloads', items: [], installed: [], busy: '', loaded: false, stale: false, staleReason: '', error: '', game: '26.3', summary: null, mr: [], mrError: '', mrLoading: false, mrTimer: 0, bundled: [], bundledLoaded: false };
  const HZM_KIND = {
    mod: { label: 'Мод', note: 'Моды Horizon ставятся в папку игры и сразу включаются. Заработают после перезапуска игры. Включать и выключать их можно во вкладке «Установлено».' },
    resourcepack: { label: 'Ресурспак', note: 'Ресурспак ставится в папку игры. Чтобы он работал, включи его в игре на экране ресурспаков.' },
    shader: { label: 'Шейдер', note: 'Шейдер ставится в папку игры. Выбери его в игре на странице шейдеров.' },
    'native-mod': { label: 'Нативный', note: 'Нативный мод меняет код игры и выполняется с твоими правами. Чтобы он заработал, лаунчер соберёт Horizon вместе с ним (кнопка «Собрать игру с модами», первый раз 10–30 минут).' },
  };
  const HZM_HINT = { mod: 'включён, перезапусти игру', resourcepack: 'включи его в игре на экране ресурспаков', shader: 'выбери его в игре на странице шейдеров', 'native-mod': 'теперь нажми «Собрать игру с модами» ниже' };
  const HZM_EMPTY = {
    mod: 'В реестре Horizon пока нет модов, которые он умеет запускать.',
    resourcepack: 'Ресурспаков для Horizon пока нет в реестре.',
    shader: 'В реестре Horizon шейдеров пока нет. Переключи источник на Modrinth: шейдерпаки (BSL, Complementary и другие) ставятся оттуда в папку shaderpacks.',
    'native-mod': 'Нативных модов в реестре пока нет.',
  };

  const HZN_STATE = { built: false };
  async function hznRender() {
    const el = $('#hznPanel');
    if (!el) return;
    let r;
    try { r = await api.horizon.native.status(); } catch { return; }
    HZN_STATE.built = !!(r && r.built);
    if (!r || !r.supported || !r.mods || !r.mods.length) { el.hidden = true; renderHzmInstalled(); return; }
    const busy = !!HZM.busy || r.busy;
    el.hidden = false;
    const offNote = r.off && r.off.length ? ` Не входят в сборку: ${esc(r.off.join(', '))}.` : '';
    el.innerHTML = r.built
      ? `<span class="hzn-text">${icon('check')}<span>Игра собрана с нативными модами: ${esc(r.mods.join(', '))}. Они работают при запуске Horizon.${offNote}</span></span><button class="btn ghost sm" data-hzn-build="1" ${busy ? 'disabled' : ''}>${icon('refresh')}Пересобрать</button>`
      : `<span class="hzn-text">${icon('info')}<span>Нативные моды (${esc(r.mods.join(', '))}) пока не в игре. Лаунчер соберёт Horizon вместе с ними: скачается Rust (около 2 ГБ), первая сборка займёт 10–30 минут.${offNote}</span></span><button class="btn primary sm" data-hzn-build="0" ${busy || !r.installedGame ? 'disabled' : ''}>${icon('play')}Собрать игру с модами</button>`;
    renderHzmInstalled();
  }

  // Сборка игры с нативными модами. Сначала проверяем, можно ли собрать выбранные моды вместе: у каждого нативного
  // мода своя «привязка» к версии Horizon, и моды с разными привязками в одну игру не собираются.
  async function hznBuild(force) {
    if (HZM.busy) return;
    HZM.busy = 'native-plan';
    hznRender();
    let plan;
    try { plan = await api.horizon.native.plan(); } catch (e) { plan = { ok: false, error: String((e && e.message) || e) }; }
    HZM.busy = '';
    hznRender();
    if (!plan.ok) { toast(plan.error || 'Не удалось проверить моды', 'error'); return; }
    let allowMismatch = false;
    if (plan.conflict) {
      const nm = (id) => plan.names[id] || id;
      const opts = plan.groups.map((g, i) => ({
        value: { ids: g.mods }, primary: i === 0,
        title: `${g.mods.length} ${g.mods.length === 1 ? 'мод' : 'мод(ов)'} · Horizon ${g.short}${i === 0 ? ' · рекомендуется' : ''}`,
        text: g.mods.map(nm).join(', ') + (g.tooNew && g.tooNew.length ? `. Не подойдут: ${g.tooNew.map(nm).join(', ')}` : ''),
      }));
      opts.push({ value: { all: true }, title: 'Собрать все моды на самой новой версии', text: 'Старые моды могут не примениться или не скомпилироваться. Если сборка упадёт, выбери один из наборов выше.' });
      const pick = await uiChoose('Эти моды не собираются вместе',
        `Нативные моды привязаны к разным версиям Horizon (${plan.groups.map((g) => g.short).join(', ')}). В одну игру собираются только моды одной версии. Остальные останутся установленными, но в игру не войдут: вернуть их можно во вкладке «Установлено».`, opts);
      if (!pick) return;
      if (pick.all) allowMismatch = true;
      else {
        const sel = await api.horizon.native.select(pick.ids);
        if (!sel.ok) { toast(sel.error, 'error'); return; }
        HZM.installed = sel.items;
        renderHzmInstalled();
        hznRender();
      }
    }
    const ok = await uiConfirm('Нативные моды — это код, который встраивается в игру и работает с твоими правами на компьютере (не в песочнице). Ставь только моды, которым доверяешь.\n\nЛаунчер скачает Rust и исходники Horizon и соберёт игру с твоими модами. Первый раз это 10–30 минут и несколько ГБ места. Продолжить?', { danger: true, title: 'Собрать игру с нативными модами', ok: 'Доверяю, собрать' });
    if (!ok) return;
    HZM.busy = 'native-build';
    $('#hzmBarWrap').hidden = false;
    $('#hzmBar').style.width = '2%';
    $('#hzmStatus').textContent = 'Подготовка сборки…';
    hznRender();
    try {
      const r = await api.horizon.native.build({ force: !!force, allowMismatch });
      if (!r.ok) {
        toast(`Сборка не удалась: ${r.error}`, 'error');
        const bad = r.badMod && HZM.installed.find((x) => x.id === r.badMod && x.kind === 'native-mod');
        if (r.conflict) {
          HZM.busy = ''; $('#hzmBarWrap').hidden = true; $('#hzmStatus').textContent = '';
          hznRender();
          return hznBuild(!!force);
        }
        if (bad && await uiConfirm(`Мод «${bad.name}» не подходит к этой версии Horizon и ломает сборку. Убрать его из сборки (он останется установленным) и собрать игру без него?`, { danger: true, title: 'Несовместимый мод', ok: 'Убрать и собрать' })) {
          const rm = await api.horizon.mods.toggle(bad.id, false);
          if (rm.ok) { HZM.installed = rm.items; HZM.busy = ''; $('#hzmBarWrap').hidden = true; $('#hzmStatus').textContent = ''; renderHzmInstalled(); hznRender(); return hznBuild(!!force); }
          toast(rm.error, 'error');
        } else if (r.logPath) api.horizon.native.openLog();
      } else toast('Готово: Horizon собран с нативными модами. Запускай игру как обычно.');
    } catch (e) { toast('Ошибка: ' + (e.message || e), 'error'); }
    HZM.busy = '';
    $('#hzmBarWrap').hidden = true;
    $('#hzmStatus').textContent = '';
    renderHzmCatalog();
    hznRender();
  }

  function hzmVisible() {
    const q = HZM.query.trim().toLowerCase();
    const sorters = {
      downloads: (a, b) => b.downloads - a.downloads || a.name.localeCompare(b.name, 'ru'),
      updated: (a, b) => String(b.published).localeCompare(String(a.published)),
      name: (a, b) => a.name.localeCompare(b.name, 'ru'),
    };
    return HZM.items
      .filter(hzmInKind)
      .filter((m) => !q || `${m.name} ${m.id} ${m.summary} ${m.authors}`.toLowerCase().includes(q))
      .sort(sorters[HZM.sort] || sorters.downloads);
  }

  const hzmMrKind = () => HZM.kind === 'resourcepack' || HZM.kind === 'shader';
  const hzmMrMode = () => hzmMrKind() && HZM.src === 'modrinth';
  const hzmMrPlaceholder = () => (HZM.kind === 'shader' ? 'Поиск шейдеров на Modrinth…' : 'Поиск ресурспаков на Modrinth…');
  const hzmAll = () => HZM.items.concat(HZM.mr);
  // Нативные моды живут во вкладке «Моды» вместе с обычными (у них своя метка «Нативный»).
  const hzmInKind = (m) => (HZM.kind === 'mod' ? (m.kind === 'mod' || m.kind === 'native-mod') : m.kind === HZM.kind);

  function hzmSummaryText() {
    const sm = HZM.summary;
    if (!sm) return '';
    const kinds = Object.entries(sm.byKind || {}).map(([k, n]) => `${HZM_KIND[k] ? HZM_KIND[k].label.toLowerCase() : k}: ${n}`).join(', ');
    return `В реестре Horizon ${sm.total} проектов (${kinds || 'нет'}). Для Minecraft ${sm.game} подходят ${sm.forGame}, из них Horizon умеет поставить ${sm.supported}.`;
  }

  function hzmCardHtml(m, attr = 'data-hzm-install') {
    const busy = HZM.busy === m.id;
    const disabled = HZM.busy ? 'disabled' : '';
    let action;
    if (m.installed === 'current') action = `<button class="btn ghost sm hzm-done" disabled>${icon('check')}Установлен</button>`;
    else if (m.installed === 'update') action = `<button class="btn primary sm" ${attr}="${esc(attr === 'data-hzm-install' ? m.id : m.file)}" ${disabled}>${busy ? icon('coffee') + 'Обновление…' : icon('download') + 'Обновить'}</button>`;
    else action = `<button class="btn primary sm" ${attr}="${esc(attr === 'data-hzm-install' ? m.id : m.file)}" ${disabled}>${busy ? icon('coffee') + 'Установка…' : icon('download') + 'Установить'}</button>`;
    return `<article class="mod-card hzm-card">
      <div class="mod-card-top">
        <div class="mod-icon">${m.icon ? `<img src="${esc(m.icon)}" alt="" />` : `<span>${esc((m.name || '?').trim().charAt(0).toUpperCase())}</span>`}</div>
        <div class="mod-card-heading"><h4 title="${esc(m.name)}">${esc(m.name)}</h4><span>${m.authors ? 'от ' + esc(m.authors) : esc(m.id)}</span></div>
        <span class="hzm-kind">${esc(m.source === 'bundled' ? 'Встроенный' : HZM_KIND[m.kind].label)}</span>
      </div>
      <p class="hzm-summary">${esc(m.summary || 'Без описания')}</p>
      <div class="hzm-meta">${m.version ? `<span>v${esc(m.version)}</span>` : ''}<span>${esc(m.license || 'лицензия не указана')}</span>${m.source === 'bundled' ? '<span>без подписи, проверено лаунчером</span>' : ''}${m.source === 'modrinth' ? '<span>Modrinth</span>' : ''}${m.signed ? '<span class="hzm-sign" title="Автор подписывает файлы, лаунчер проверяет подпись">подписан</span>' : ''}</div>
      <div class="mod-card-foot"><span class="mod-downloads">${icon('download')} ${fmtNum(m.downloads)}</span>${action}</div>
    </article>`;
  }

  function renderHzmBundled(grid, notice) {
    notice.classList.toggle('hzm-warn', false);
    notice.innerHTML = `${icon('info')}<span>Готовые моды, которые лежат внутри лаунчера: ставятся без интернета и сразу включаются. Заработают после перезапуска игры. Можно добавить и свой .hmod.</span>`;
    const q = HZM.query.trim().toLowerCase();
    const list = HZM.bundled.filter((m) => !q || `${m.name} ${m.id} ${m.summary}`.toLowerCase().includes(q));
    const local = `<div class="hzm-local" style="grid-column:1/-1;display:flex;justify-content:flex-end"><button class="btn ghost sm" data-hzm-local="1" ${HZM.busy ? 'disabled' : ''}>${icon('plus')}Добавить свой .hmod…</button></div>`;
    if (!HZM.bundledLoaded) { grid.innerHTML = local + `<div class="mod-empty"><span class="mod-empty-icon">${icon('coffee')}</span><b>Загрузка…</b></div>`; return; }
    if (!list.length) { grid.innerHTML = local + `<div class="mod-empty"><span class="mod-empty-icon">${icon('layers')}</span><b>${q ? 'Ничего не найдено' : 'Встроенных модов нет'}</b></div>`; return; }
    grid.innerHTML = local + list.map((m) => hzmCardHtml(m, 'data-hzm-bundled')).join('');
  }

  async function hzmLoadBundled() {
    const r = await api.horizon.mods.bundled();
    HZM.bundledLoaded = true;
    HZM.bundled = r && r.ok ? r.items : [];
    if (r && !r.ok) toast(r.error, 'error');
    renderHzmCatalog();
  }

  async function hzmInstallBundled(file) {
    if (HZM.busy) return;
    const item = HZM.bundled.find((x) => x.file === file);
    HZM.busy = item ? item.id : file;
    renderHzmCatalog();
    try {
      const r = await api.horizon.mods.installBundled(file);
      if (!r.ok) toast(r.error, 'error');
      else { toast(`${r.item.name} установлен: ${HZM_HINT.mod}`); if (r.bundled) HZM.bundled = r.bundled; }
      if (r.items) HZM.installed = r.items;
    } catch (e) { toast('Ошибка: ' + (e.message || e), 'error'); }
    HZM.busy = '';
    renderHzmCatalog();
    renderHzmInstalled();
  }

  async function hzmInstallLocal() {
    if (HZM.busy) return;
    HZM.busy = 'local';
    renderHzmCatalog();
    try {
      const r = await api.horizon.mods.installFile();
      if (r && r.ok) { toast(`${r.item.name} установлен: ${HZM_HINT.mod}`); if (r.bundled) HZM.bundled = r.bundled; }
      else if (r && !r.canceled) toast(r.error, 'error');
      if (r && r.items) HZM.installed = r.items;
    } catch (e) { toast('Ошибка: ' + (e.message || e), 'error'); }
    HZM.busy = '';
    renderHzmCatalog();
    renderHzmInstalled();
  }

  function renderHzmCatalog() {
    const grid = $('#hzmGrid');
    const notice = $('#hzmNotice');
    if (!grid) return;
    if (HZM.kind === 'bundled') { renderHzmBundled(grid, notice); return; }
    const search = $('#hzmSearch');
    if (search) search.placeholder = hzmMrMode() ? hzmMrPlaceholder() : 'Название, автор или описание…';
    if (hzmMrMode()) {
      notice.classList.toggle('hzm-warn', false);
      notice.innerHTML = HZM.kind === 'shader'
        ? `${icon('info')}<span>Шейдеры с Modrinth (Iris/OptiFine .zip): BSL, Complementary, Photon и другие. Ставятся в папку shaderpacks, выбери шейдер в игре на странице шейдеров. Не все паки поддерживает рендер Horizon: если что-то не заработало, попробуй другой.</span>`
        : `${icon('info')}<span>Ресурспаки с Modrinth, сделанные для Minecraft ${esc(HZM.game)}. Ставятся в папку игры, включи их в игре на экране ресурспаков. Старые паки могут работать не полностью.</span>`;
      if (HZM.mrLoading) { grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('coffee')}</span><b>Ищу на Modrinth…</b></div>`; return; }
      if (HZM.mrError) { grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('info')}</span><b>Modrinth не ответил</b><p>${esc(HZM.mrError)}</p><button class="btn primary" data-hzm-retry="mr">${icon('refresh')}Повторить</button></div>`; return; }
      if (!HZM.mr.length) { grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('search')}</span><b>Ничего не найдено</b><p>Попробуй другое название.</p></div>`; return; }
      grid.innerHTML = HZM.mr.map((m) => hzmCardHtml(m)).join('');
      return;
    }
    notice.innerHTML = `${icon('info')}<span>${esc(HZM.stale ? `Нет связи с реестром Horizon, показан сохранённый список (${HZM.staleReason || 'офлайн'}).` : HZM_KIND[HZM.kind].note)}</span>`;
    notice.classList.toggle('hzm-warn', HZM.stale);
    if (HZM.error) {
      grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('info')}</span><b>Список не загрузился</b><p>${esc(HZM.error)}</p><button class="btn primary" data-hzm-retry="1">${icon('refresh')}Повторить</button></div>`;
      return;
    }
    const list = hzmVisible();
    if (!list.length) {
      const searching = HZM.query.trim() !== '';
      const diag = hzmSummaryText();
      grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon(searching ? 'search' : 'layers')}</span><b>${searching ? 'Ничего не найдено' : 'Пусто'}</b><p>${esc(searching ? 'Попробуй другое название или автора.' : HZM_EMPTY[HZM.kind])}</p>${!searching && diag ? `<p class="hzm-diag">${esc(diag)}</p>` : ''}</div>`;
      return;
    }
    grid.innerHTML = list.map((m) => hzmCardHtml(m)).join('');
  }

  function renderHzmInstalled() {
    const root = $('#hzmInstalled');
    if (!root) return;
    const count = $('#hzmInstCount');
    if (count) count.textContent = String(HZM.installed.length);
    if (!HZM.installed.length) {
      root.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('layers')}</span><b>Пока ничего не установлено</b><p>Выбери мод, ресурспак или шейдер в каталоге. Они появятся здесь.</p></div>`;
      return;
    }
    const q = HZM.query.trim().toLowerCase();
    const shown = HZM.installed.filter((m) => !q || `${m.name} ${m.id} ${m.version}`.toLowerCase().includes(q));
    if (!shown.length) {
      root.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('search')}</span><b>Ничего не найдено</b><p>Попробуй другое название.</p></div>`;
      return;
    }
    root.innerHTML = shown.map((m) => {
      const isMod = m.kind === 'mod';
      let state;
      if (m.revoked) state = `Отозван реестром: ${m.revoked}`;
      else if (!m.present) state = 'Файл пропал из папки игры';
      else if (isMod) state = m.enabled ? 'Включён' : 'Выключен';
      else if (m.kind === 'native-mod') state = !m.enabled ? 'Не входит в сборку игры' : (HZN_STATE.built ? 'Собран в игру' : 'Установлен · ждёт сборки игры');
      else state = `${HZM_KIND[m.kind].label} · включи в игре`;
      const switchable = (isMod || m.kind === 'native-mod') && m.present && !m.revoked;
      const toggleTitle = m.kind === 'native-mod' ? (m.enabled ? 'Не включать в сборку игры' : 'Включить в сборку игры') : (m.enabled ? 'Выключить' : 'Включить');
      const toggle = switchable
        ? `<button class="mini-action" data-hzm-toggle="${esc(m.id)}" data-on="${m.enabled ? '0' : '1'}" title="${toggleTitle}">${icon(m.enabled ? 'check' : 'play')}</button>`
        : '';
      return `<div class="installed-mod ${switchable && !m.enabled ? 'disabled' : ''}">
        <span class="installed-mod-icon">${icon('puzzle')}</span>
        <div class="installed-mod-copy"><b title="${esc(m.name)}">${esc(m.name)}</b><small>v${esc(m.version)} · ${esc(HZM_KIND[m.kind].label)}${m.origin === 'bundled' ? ' · встроенный' : m.origin === 'local' ? ' · свой файл' : ''}</small><span class="installed-state ${m.revoked || !m.present ? 'warn' : ''}">${esc(state)}</span></div>
        ${toggle}
        <button class="mini-action remove" data-hzm-remove="${esc(m.id)}" title="Удалить">${icon('trash')}</button>
      </div>`;
    }).join('');
  }

  async function hzmLoadCatalog(force = false) {
    const r = await api.horizon.mods.catalog(force);
    HZM.loaded = true;
    if (!r.ok) { HZM.error = r.error; HZM.items = []; HZM.stale = false; }
    else {
      HZM.error = '';
      HZM.items = r.items;
      HZM.summary = r.summary || null;
      HZM.stale = !!r.stale;
      HZM.staleReason = r.error || '';
      HZM.game = r.game || HZM.game;
    }
    renderHzmCatalog();
  }

  let hzmMrSeq = 0;
  async function hzmLoadModrinth(query, quiet = false) {
    const kind = HZM.kind;
    const seq = ++hzmMrSeq;
    HZM.mrLoading = !quiet;
    HZM.mrError = '';
    renderHzmCatalog();
    const r = await api.horizon.mods.modrinth(query, kind);
    if (seq !== hzmMrSeq) return; // пока шёл запрос, выбрали другую вкладку или ввели другой текст
    HZM.mrLoading = false;
    if (!r.ok) HZM.mrError = r.error;
    else HZM.mr = r.items;
    renderHzmCatalog();
  }

  function hzmSetSource(src) {
    HZM.src = src;
    HZM.shaderSrcPicked = true;
    setSetting({ hzSrc: src });
    $$('#hzmSource [data-hzm-src]').forEach((b) => b.classList.toggle('active', b.dataset.hzmSrc === src));
    if (hzmMrMode()) hzmLoadModrinth(HZM.query);
    else renderHzmCatalog();
  }

  async function hzmLoadInstalled() {
    const r = await api.horizon.mods.installed();
    if (!r.ok) { toast(r.error, 'error'); return; }
    HZM.installed = r.items;
    renderHzmInstalled();
  }

  // Открытие страницы Horizon: список установленного читается сразу, реестр — один раз (потом по кнопке).
  function hzmOpen() {
    if (!$('#hzmGrid')) return;
    hzmLoadInstalled();
    hznRender();
    if (!HZM.loaded) hzmLoadCatalog();
  }

  async function hzmInstall(id) {
    if (HZM.busy) return;
    const item = hzmAll().find((x) => x.id === id);
    HZM.busy = id;
    $('#hzmBarWrap').hidden = false;
    $('#hzmBar').style.width = '2%';
    $('#hzmStatus').textContent = `Установка ${item ? item.name : id}…`;
    renderHzmCatalog();
    try {
      const r = await api.horizon.mods.install(id);
      if (!r.ok) toast(r.error, 'error');
      else toast(`${r.item.name} установлен: ${HZM_HINT[r.item.kind]}`);
      if (r.items) HZM.installed = r.items;
    } catch (e) { toast('Ошибка: ' + (e.message || e), 'error'); }
    HZM.busy = '';
    $('#hzmBarWrap').hidden = true;
    $('#hzmStatus').textContent = '';
    await hzmLoadCatalog();
    if (hzmMrMode()) await hzmLoadModrinth(HZM.query, true);
    renderHzmInstalled();
    hznRender();
  }

  async function hzmToggle(id, on) {
    const r = await api.horizon.mods.toggle(id, on);
    if (!r.ok) { toast(r.error, 'error'); return; }
    HZM.installed = r.items;
    renderHzmInstalled();
    const m = r.items.find((x) => x.id === id);
    if (m && m.kind === 'native-mod') {
      hznRender();
      toast(on ? 'Мод снова входит в сборку. Нажми «Собрать игру с модами», чтобы он заработал.' : 'Мод убран из сборки (он остаётся установленным). Пересобери игру, чтобы изменения вступили в силу.');
      return;
    }
    toast(on ? 'Мод включён. Перезапусти игру, чтобы он заработал.' : 'Мод выключен. Перезапусти игру.');
  }

  async function hzmRemove(id) {
    const m = HZM.installed.find((x) => x.id === id);
    if (!(await uiConfirm(`Удалить «${m ? m.name : id}» из папки игры Horizon?`, { danger: true, ok: 'Удалить' }))) return;
    const r = await api.horizon.mods.remove(id);
    if (!r.ok) { toast(r.error, 'error'); return; }
    HZM.installed = r.items;
    renderHzmInstalled();
    await hzmLoadCatalog();
    if (HZM.bundledLoaded) await hzmLoadBundled();
    hznRender();
  }

  function hzmSetView(view) {
    HZM.view = view;
    const root = $('#hzm');
    root.dataset.view = view;
    $$('#hzmViews [data-hzm-view]').forEach((b) => b.classList.toggle('active', b.dataset.hzmView === view));
    const catalog = view === 'catalog';
    $('#hzmGrid').hidden = !catalog;
    $('#hzmNotice').hidden = !catalog;
    $('#hzmKinds').hidden = !catalog;
    $('#hzmSource').hidden = !catalog || !hzmMrKind();
    $('#hzmSort').hidden = !catalog;
    $('#hzmSearch').placeholder = catalog ? (hzmMrMode() ? hzmMrPlaceholder() : 'Название, автор или описание…') : 'Поиск в установленных…';
    setSetting({ hzView: view });
    $('#hzmInstalled').hidden = catalog;
    if (!catalog) hzmLoadInstalled();
  }

  // Вернуть выбранную вкладку каталога Horizon (моды / встроенные / ресурспаки / шейдеры), источник и вид.
  function hzmRestore() {
    if (!$('#hzmGrid')) return;
    const st = S.settings || {};
    if (['mod', 'bundled', 'resourcepack', 'shader'].includes(st.hzKind)) HZM.kind = st.hzKind;
    if (['horizon', 'modrinth'].includes(st.hzSrc)) { HZM.src = st.hzSrc; HZM.shaderSrcPicked = true; }
    $$('#hzmKinds [data-hzm-kind]').forEach((x) => x.classList.toggle('active', x.dataset.hzmKind === HZM.kind));
    $$('#hzmSource [data-hzm-src]').forEach((x) => x.classList.toggle('active', x.dataset.hzmSrc === HZM.src));
    hzmSetView(st.hzView === 'installed' ? 'installed' : 'catalog');
    if (HZM.kind === 'bundled' && !HZM.bundledLoaded) hzmLoadBundled();
    else if (hzmMrMode()) hzmLoadModrinth(HZM.query);
  }

  function hzmWire() {
    if (!$('#hzmGrid')) return;
    $('#hzmRefresh').addEventListener('click', async () => {
      $('#hzmRefresh').disabled = true;
      try { await hzmLoadCatalog(true); } finally { $('#hzmRefresh').disabled = false; }
    });
    $('#hzmKinds').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hzm-kind]');
      if (!b) return;
      HZM.kind = b.dataset.hzmKind;
      $$('#hzmKinds [data-hzm-kind]').forEach((x) => x.classList.toggle('active', x === b));
      $('#hzmSource').hidden = !hzmMrKind();
      // В реестре Horizon шейдеров пока нет, поэтому при первом заходе во вкладку сразу показываем Modrinth.
      if (HZM.kind === 'shader' && !HZM.shaderSrcPicked) { HZM.src = 'modrinth'; HZM.shaderSrcPicked = true; }
      $$('#hzmSource [data-hzm-src]').forEach((x) => x.classList.toggle('active', x.dataset.hzmSrc === HZM.src));
      HZM.mr = [];
      setSetting({ hzKind: HZM.kind, hzSrc: HZM.src });
      if (HZM.kind === 'bundled' && !HZM.bundledLoaded) hzmLoadBundled();
      else if (hzmMrMode()) hzmLoadModrinth(HZM.query);
      else renderHzmCatalog();
    });
    $('#hzmViews').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hzm-view]');
      if (b) hzmSetView(b.dataset.hzmView);
    });
    $('#hzmSource').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hzm-src]');
      if (b) hzmSetSource(b.dataset.hzmSrc);
    });
    $('#hzmSearch').addEventListener('input', (e) => {
      HZM.query = e.target.value;
      if (HZM.view === 'installed') { renderHzmInstalled(); return; }
      if (!hzmMrMode()) { renderHzmCatalog(); return; }
      clearTimeout(HZM.mrTimer);
      HZM.mrTimer = setTimeout(() => hzmLoadModrinth(HZM.query), 350);
    });
    $('#hzmSort').addEventListener('change', (e) => { HZM.sort = e.target.value; renderHzmCatalog(); });
    $('#hzmGrid').addEventListener('click', (e) => {
      const inst = e.target.closest('[data-hzm-install]');
      const retry = e.target.closest('[data-hzm-retry]');
      const bund = e.target.closest('[data-hzm-bundled]');
      const loc = e.target.closest('[data-hzm-local]');
      if (bund) { hzmInstallBundled(bund.dataset.hzmBundled); return; }
      if (loc) { hzmInstallLocal(); return; }
      if (inst) hzmInstall(inst.dataset.hzmInstall);
      if (retry && retry.dataset.hzmRetry === 'mr') hzmLoadModrinth(HZM.query);
      else if (retry) hzmLoadCatalog(true);
    });
    $('#hznPanel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hzn-build]');
      if (b) hznBuild(b.dataset.hznBuild === '1');
    });
    $('#hzmInstalled').addEventListener('click', (e) => {
      const t = e.target.closest('[data-hzm-toggle]');
      const r = e.target.closest('[data-hzm-remove]');
      if (t) hzmToggle(t.dataset.hzmToggle, t.dataset.on === '1');
      if (r) hzmRemove(r.dataset.hzmRemove);
    });
    api.on('hzm:progress', (p) => {
      if (!HZM.busy || !$('#hzmBar')) return;
      if (p.label) $('#hzmStatus').textContent = p.label;
      if (typeof p.pct === 'number' && p.pct > 0) $('#hzmBar').style.width = Math.min(100, p.pct) + '%';
    });
    hzmSetView('catalog');
  }

  const LOADER_NAMES = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', horizon: 'Horizon (Rust)' };
  const loaderLabel = (l) => LOADER_NAMES[l] || String(l || '');

  function renderPlaybar() {
    const id = S.settings.selectedVersion;
    const acc = activeAccount();
    const v = id && versionInfo(id);
    const isInstalled = id && S.installed.has(id);
    const displayVersion = v && v.loader
      ? `${loaderLabel(v.loader)} • ${v.baseVersion || id}`
      : id;
    $('#pbTitle').textContent = id ? `Minecraft ${displayVersion}` : 'Сборка не выбрана';
    $('#pbSub').textContent = id
      ? `${v && v.loader ? `${loaderLabel(v.loader)} ${v.loaderVersion || ''} • ` : `${TYPE_LABEL[(v && v.type) || 'release'] || 'Версия'} • `}${isInstalled ? 'установлена' : 'скачается при первом запуске'}`
      : 'Откройте вкладку «Сборки», чтобы выбрать версию';

    const dot = $('#pbDot');
    const st = $('#pbStatus');
    const play = $('#btnPlay');
    const prog = $('#pbProgress');
    dot.className = 'dot';
    play.classList.remove('stop');
    prog.classList.remove('on');

    if (S.game === 'launching') {
      dot.classList.add('busy');
      st.textContent = S.progress.label || 'Подготовка к запуску';
      play.disabled = true;
      play.innerHTML = icon('play') + '<span>Запуск…</span>';
      prog.classList.add('on');
      $('#pbBar').style.width = (S.progress.pct || 0) + '%';
    } else if (S.game === 'running') {
      dot.classList.add('ready');
      st.textContent = S.progress.label === 'Запуск игры' ? 'Игра запускается' : 'Игра запущена';
      play.disabled = false;
      play.classList.add('stop');
      play.innerHTML = icon('stop') + '<span>Остановить</span>';
    } else {
      play.innerHTML = icon('play') + '<span>Играть</span>';
      if (!id) {
        st.textContent = 'Ожидание выбора сборки';
        play.disabled = true;
      } else if (!acc) {
        st.textContent = 'Добавьте аккаунт во вкладке «Аккаунты»';
        play.disabled = true;
      } else {
        dot.classList.add('ready');
        st.textContent = `Готово к запуску • ${acc.name}`;
        play.disabled = false;
      }
    }
  }

  /* -------------------------------- сборки ---------------------------- */
  const FILTERS = [
    ['release', 'Релизы'],
    ['snapshot', 'Снапшоты'],
    ['old', 'Старые'],
    ['installed', 'Установленные'],
    ['all', 'Все'],
  ];

  function matches(v) {
    const f = S.filter;
    if (f === 'release' && v.type !== 'release') return false;
    if (f === 'snapshot' && v.type !== 'snapshot') return false;
    if (f === 'old' && v.type !== 'old_beta' && v.type !== 'old_alpha') return false;
    if (f === 'installed' && !S.installed.has(v.id)) return false;
    if (S.query && !v.id.toLowerCase().includes(S.query)) return false;
    return true;
  }

  function hueOf(id) {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return 135 + (h % 95);
  }

  function dateStr(t) {
    if (!t) return '';
    const d = new Date(t);
    return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'short' }).replace(/\s*г\.$/, '');
  }

  function cardHTML(v) {
    const h = hueOf(v.id);
    const latest = !v.loader && (v.id === S.latest.release || v.id === S.latest.snapshot);
    const inst = S.installed.has(v.id);
    const badge = v.packName ? `СБОРКА · ${loaderLabel(v.loader).toUpperCase()}` : v.loader
      ? loaderLabel(v.loader).toUpperCase()
      : (latest ? 'Последняя' : TYPE_LABEL[v.type] || v.type);
    const title = v.packName ? (v.packName.length > 22 ? v.packName.slice(0, 21) + '…' : v.packName) : v.loader
      ? `${v.baseVersion || 'Minecraft'} · ${loaderLabel(v.loader)}${v.loaderVersion ? ` ${v.loaderVersion}` : ''}`
      : v.id;
    return `<button class="vcard ${v.id === S.settings.selectedVersion ? 'sel' : ''}" data-v="${esc(v.id)}">
      <div class="vcover" style="--h:${h};background:linear-gradient(135deg,hsl(${h} 52% 30%),hsl(${h + 34} 58% 13%))">
        <span class="badge ${latest ? 'latest' : ''}">${esc(badge)}</span>
        <span class="vnum">${esc(title)}</span>
      </div>
      <span class="tick">${icon('check')}</span>
      <div class="vbody"><span>${esc(dateStr(v.releaseTime))}</span>${inst ? `<span class="vright"><span class="inst">${icon('check')}Установлена</span><span class="vfolder" data-open="${esc(v.id)}" title="Открыть папку версии">${icon('folder')}</span><span class="vfolder vdel" data-delv="${esc(v.id)}" title="Удалить версию">${icon('trash')}</span></span>` : `<span class="vdl ${S.dl.has(v.id) ? 'busy' : ''}" data-dl="${esc(v.id)}" role="button">${S.dl.has(v.id) ? 'Скачивание…' : icon('download') + 'Скачать'}</span>`}</div>
    </button>`;
  }

  function renderLoaderPanel() {
    const select = $('#loaderType');
    const button = $('#btnInstallLoader');
    if (!select || !button) return;
    const id = S.settings.selectedVersion;
    const v = id && versionInfo(id);
    const base = (v && v.baseVersion) || id;
    select.value = LOADER_NAMES[S.settings.preferredLoader] ? S.settings.preferredLoader : 'fabric';
    if (!base) {
      $('#loaderTarget').textContent = 'Выберите версию Minecraft ниже, чтобы установить Fabric, Forge, NeoForge или Quilt.';
    } else if (v && v.loader) {
      $('#loaderTarget').textContent = `Выбрано: ${loaderLabel(v.loader)} для Minecraft ${base}. Можно установить другой загрузчик для той же версии.`;
    } else {
      $('#loaderTarget').textContent = `Загрузчик будет установлен для Minecraft ${base}. Убедитесь, что выбрана нужная версия.`;
    }
    button.disabled = !base || !S.versionsLoaded || S.loaderBusy;
    button.innerHTML = icon(S.loaderBusy ? 'coffee' : 'plus') + `<span>${S.loaderBusy ? 'Установка…' : 'Установить'}</span>`;
  }


  /* ------------------------------- сборки модов ----------------------- */
  const fmtNum = (n) => new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

  function renderPackCards() {
    const grid = $('#packGrid');
    if (!grid) return;
    if (S.packsLoading && !S.packHits.length) { grid.innerHTML = Array.from({ length: 6 }, () => '<div class="mod-skeleton"></div>').join(''); $('#packsCount').textContent = 'Поиск…'; renderPager(); return; }
    if (!S.packHits.length) { grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('search')}</span><b>Ничего не найдено</b><p>Попробуй другое название.</p></div>`; $('#packsCount').textContent = '0 результатов'; renderPager(); return; }
    grid.innerHTML = S.packHits.map((m) => {
      const safeIcon = /^https:\/\/cdn\.modrinth\.com\//i.test(m.icon || '') ? m.icon : '';
      const cats = (m.categories || []).map((c) => `<span>${esc(String(c).replace(/[-_]/g, ' '))}</span>`).join('');
      const busy = S.packBusy === m.projectId;
      return `<article class="mod-card">
        <div class="mod-card-top"><div class="mod-icon">${safeIcon ? `<img src="${esc(safeIcon)}" alt="" data-letter="${esc((m.title || '?').slice(0, 1))}" />` : `<span>${esc((m.title || '?').slice(0, 1).toUpperCase())}</span>`}</div>
          <div class="mod-card-heading"><h4>${esc(m.title)}</h4><span>от ${esc(m.author)}</span></div><span class="mod-provider-mark">M</span></div>
        <p class="mod-description">${esc(m.description || 'Нет описания.')}</p>
        <div class="mod-tags">${cats || '<span>modpack</span>'}</div>
        <div class="mod-card-foot"><span class="mod-downloads">${icon('download')} ${fmtNum(m.downloads)}</span><button class="btn primary sm" data-install-pack="${esc(m.projectId)}" ${S.packBusy ? 'disabled' : ''}>${busy ? icon('coffee') + 'Установка…' : icon('download') + 'Установить'}</button></div>
      </article>`;
    }).join('');
    $('#packsCount').textContent = `${new Intl.NumberFormat('ru-RU').format(S.packTotal)} найдено`;
    renderPager();
  }

  const PACK_PAGE = 48;
  function pagerHtml(cur, pages, attr) {
    const nums = [];
    for (let i = Math.max(1, cur - 2); i <= Math.min(pages, cur + 2); i++) nums.push(i);
    if (nums[0] > 1) nums.unshift(1, ...(nums[0] > 2 ? [0] : []));
    if (nums[nums.length - 1] < pages) nums.push(...(nums[nums.length - 1] < pages - 1 ? [0] : []), pages);
    return `<button class="btn ghost sm" ${attr}="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>← Назад</button>`
      + nums.map((n) => n ? `<button class="btn ${n === cur ? 'primary' : 'ghost'} sm pg" ${attr}="${n}">${n}</button>` : '<span class="pg-gap">…</span>').join('')
      + `<button class="btn ghost sm" ${attr}="${cur + 1}" ${cur >= pages ? 'disabled' : ''}>Вперёд →</button>`;
  }
  function renderPager() {
    const box = $('#packsPager');
    if (!box) return;
    const pages = Math.min(Math.ceil((S.packTotal || 0) / PACK_PAGE), 400);
    if (pages <= 1 || S.packsLoading) { box.innerHTML = ''; return; }
    box.innerHTML = pagerHtml(S.packPage || 1, pages, 'data-pack-page');
  }
  const MOD_PAGE = 18;
  function renderModsPager() {
    const box = $('#modsPager');
    if (!box) return;
    const pages = Math.min(Math.ceil((S.modTotal || 0) / MOD_PAGE), 500);
    if (pages <= 1 || S.modsLoading) { box.innerHTML = ''; return; }
    box.innerHTML = pagerHtml(S.modPage || 1, pages, 'data-mod-page');
  }

  async function searchPacks(page = 1) {
    if (S.packsLoading) return;
    page = Math.max(1, Number(page) || 1);
    S.packPage = page;
    S.packHits = [];
    S.packsLoading = true;
    renderPackCards();
    try {
      const r = await api.packs.search({ query: $('#packsSearch').value.trim(), sort: $('#packsSort').value, offset: (page - 1) * PACK_PAGE });
      if (!r.ok) { toast(r.error || 'Не удалось выполнить поиск', 'error'); S.packTotal = 0; }
      else { S.packHits = r.hits; S.packTotal = r.total; }
    } catch (e) { toast('Ошибка каталога: ' + (e.message || e), 'error'); }
    finally { S.packsLoading = false; renderPackCards(); const pg = $('#page-packs'); if (pg && pg.scrollTo) pg.scrollTo({ top: 0 }); }
  }

  async function installPack(projectId) {
    if (S.packBusy || !projectId) return;
    const hit = S.packHits.find((m) => m.projectId === projectId) || {};
    S.packBusy = projectId;
    renderPackCards();
    try {
      const r = await api.packs.install({ source: 'modrinth', projectId, title: hit.title });
      if (!r.ok) { toast(r.error || 'Не удалось установить сборку', 'error'); return; }
      toast(`Сборка «${r.title}» установлена и выбрана. Ищи её в «Сборках» среди установленных.`);
      if (r.failed) toast(`Не скачалось файлов: ${r.failed} из ${r.total}. Подробности в консоли.`, 'error');
      await loadVersions(true);
      await refreshInstalled();
    } catch (e) { toast('Ошибка установки сборки: ' + (e.message || e), 'error'); }
    finally { S.packBusy = ''; renderPackCards(); const n = $('#packsNotice'); if (n) n.innerHTML = `${icon('info')}<span>Поддерживаются сборки на Fabric, Forge, NeoForge и Quilt. Майнкрафт и загрузчик скачаются сами.</span>`; }
  }

  /* ------------------------------- каталог модов ---------------------- */
  const KIND_UI = {
    mod: { noun: 'мод', gen: 'модов', heading: 'Моды <span class="accent">для твоей игры</span>', sub: 'Ищи, устанавливай и управляй модами прямо из Electron. Нужные для мода зависимости ставятся сами.', placeholder: 'Например: Sodium, Iris, map, minimap…', folder: 'mods', installedSub: 'Моды в папке игры', emptyList: 'Пока нет JAR-модов. Найди мод в каталоге и нажми «Установить».', tag: 'mod' },
    shader: { noun: 'шейдер', gen: 'шейдеров', heading: 'Шейдеры <span class="accent">для картинки</span>', sub: 'Каталог шейдер-паков Modrinth. На Fabric, Quilt и NeoForge вместе с первым шейдером автоматически ставится Iris (и Sodium).', placeholder: 'Например: Complementary, BSL, Photon…', folder: 'shaderpacks', installedSub: 'Шейдеры в папке игры', emptyList: 'Пока нет шейдеров. Найди пак в каталоге и нажми «Установить».', tag: 'shader' },
    resourcepack: { noun: 'ресурспак', gen: 'ресурспаков', heading: 'Ресурспаки <span class="accent">для стиля</span>', sub: 'Текстуры, звуки и интерфейс. После установки включи пак в игре: Настройки → Ресурспаки.', placeholder: 'Например: Faithful, Fresh Animations…', folder: 'resourcepacks', installedSub: 'Ресурспаки в папке игры', emptyList: 'Пока нет ресурспаков. Найди пак в каталоге и нажми «Установить».', tag: 'pack' },
  };
  const kindUi = () => KIND_UI[S.modKind] || KIND_UI.mod;

  function applyModKindUi() {
    const u = kindUi();
    $('#modsHeading').innerHTML = u.heading;
    $('#modsSubheading').textContent = u.sub;
    $('#modsSearch').placeholder = u.placeholder;
    $('#modsSearchLabel').textContent = `Найти ${u.gen}`;
    $('#modsInstalledSub').textContent = u.installedSub;
    $('#modsSharedNote').textContent = S.settings && S.settings.isolateBuilds === false
      ? `Папка ${u.folder} общая для всех профилей. Используй только совместимые с выбранной версией файлы.`
      : `У каждой сборки своя папка ${u.folder}: сейчас открыта «${S.settings && S.settings.selectedVersion || '—'}». Другие сборки не затрагиваются.`;
    document.querySelectorAll('[data-mod-kind]').forEach((b) => b.classList.toggle('active', b.dataset.modKind === S.modKind));
  }

  async function setModKind(kind) {
    if (!KIND_UI[kind] || kind === S.modKind) return;
    S.modKind = kind;
    S.modHits = []; S.modTotal = 0; S.modOffset = 0; S.installedMods = []; S.modUpdates = {}; S.modIncompat = {}; S.verPick = null; S.modsLoading = false;
    $('#modsSearch').value = '';
    applyModKindUi();
    renderInstalledMods();
    await loadModsPage();
  }

  function renderModTarget() {
    const result = S.modTargetResult;
    const card = $('#modTargetCard');
    if (!card) return;
    card.classList.toggle('invalid', !result || !result.ok);
    if (!result || !result.ok) {
      $('#modTargetTitle').textContent = 'Сборка не готова';
      $('#modTargetMeta').textContent = result && result.error ? result.error : S.modKind === 'mod' ? 'Выберите профиль с загрузчиком' : 'Выберите установленную версию Minecraft';
      $('#modsNotice').hidden = false;
      $('#modsNotice').innerHTML = `${icon('info')}<span>${esc((result && result.error) || 'Выбери установленный профиль с загрузчиком (Fabric, Forge, NeoForge, Quilt), чтобы искать совместимые моды.')}</span>`;
      return;
    }
    const t = result.target;
    $('#modTargetTitle').textContent = t.loader ? `${t.mcVersion} · ${loaderLabel(t.loader)}` : t.mcVersion;
    $('#modTargetMeta').textContent = `Профиль: ${t.profileId}`;
    $('#modsNotice').hidden = false;
    $('#modsNotice').innerHTML = S.modKind === 'mod'
      ? `${icon('info')}<span>Фильтр по Minecraft ${esc(t.mcVersion)} и ${esc(t.loader)}. Обязательные зависимости скачаются автоматически. Файлы попадут в папку <b>mods</b>.</span>`
      : `${icon('info')}<span>Фильтр по Minecraft ${esc(t.mcVersion)}. Файлы попадут в папку <b>${esc(kindUi().folder)}</b>.</span>`;
  }

  function renderModCards() {
    const grid = $('#modGrid');
    if (!grid) return;
    if (!S.modTargetResult || !S.modTargetResult.ok) {
      grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('layers')}</span><b>${S.modKind === 'mod' ? 'Нужна сборка с загрузчиком' : 'Нужна выбранная сборка'}</b><p>${S.modKind === 'mod' ? 'Открой «Сборки», установи Fabric, Forge, NeoForge или Quilt и выбери профиль в панели запуска.' : 'Открой «Сборки», установи версию Minecraft и выбери её в панели запуска.'}</p><button class="btn primary" data-mods-builds="1">Открыть сборки</button></div>`;
      $('#modsCount').textContent = '—';
      $('#modsMore').hidden = true;
      return;
    }
    if (S.modsLoading && !S.modHits.length) {
      grid.innerHTML = Array.from({ length: 6 }, () => '<div class="mod-skeleton"></div>').join('');
      $('#modsCount').textContent = 'Поиск…';
      $('#modsMore').hidden = true;
      return;
    }
    if (!S.modHits.length) {
      grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('search')}</span><b>Ничего не найдено</b><p>Попробуй другое название или проверь, есть ли версия для этой сборки.</p></div>`;
      $('#modsCount').textContent = '0 результатов';
      $('#modsMore').hidden = true;
      return;
    }
    if (!S.modHits.length && !S.modsLoading) {
      const t = S.modTargetResult.target || {};
      grid.innerHTML = `<div class="mod-empty"><span class="mod-empty-icon">${icon('layers')}</span><b>Ничего не найдено для Minecraft ${esc(t.mcVersion || '')}${S.modKind === 'mod' && t.loader ? ' · ' + esc(t.loader) : ''}</b><p>Возможно, такие ${kindUi().noun === 'мод' ? 'моды' : 'файлы'} ещё не поддерживают эту версию игры. Измени запрос или выбери другую сборку.</p></div>`;
      $('#modsCount').textContent = '0 найдено';
      $('#modsMore').hidden = true;
      return;
    }
    const installedIds = new Set(S.installedMods.map((m) => m.projectId).filter(Boolean));
    grid.innerHTML = S.modHits.map((m) => {
      const installed = installedIds.has(m.projectId);
      const safeIcon = /^https:\/\/cdn\.modrinth\.com\//i.test(m.icon || '') ? m.icon : '';
      const cats = m.categories.slice(0, 3).map((c) => `<span>${esc(c.replace(/[-_]/g, ' '))}</span>`).join('');
      const downloads = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(m.downloads || 0);
      return `<article class="mod-card" data-project="${esc(m.projectId)}">
        <div class="mod-card-top"><div class="mod-icon">${safeIcon ? `<img src="${esc(safeIcon)}" alt="" data-letter="${esc((m.title || '?').slice(0,1))}" />` : `<span>${esc((m.title || '?').slice(0,1).toUpperCase())}</span>`}</div>
          <div class="mod-card-heading"><h4>${esc(m.title)}</h4><span>от ${esc(m.author)}</span></div><span class="mod-provider-mark">M</span></div>
        <p class="mod-description">${esc(m.description || 'Нет описания проекта.')}</p>
        <div class="mod-tags">${cats || `<span>${kindUi().tag}</span>`}</div>
        <div class="mod-card-foot"><span class="mod-downloads">${icon('download')} ${downloads}</span><button class="btn ghost sm" data-pick-version="${esc(m.projectId)}" title="Выбрать версию" ${S.modBusy ? 'disabled' : ''}>Версии</button><button class="btn ${installed ? 'mod-installed-btn' : 'primary'} sm" data-install-mod="${esc(m.projectId)}" ${installed || S.modBusy || S.modsLoading ? 'disabled' : ''}>${installed ? icon('check') + 'Установлен' : (S.modBusy === m.projectId ? icon('coffee') + 'Скачивание…' : icon('download') + 'Установить')}</button></div>
        ${S.verPick && S.verPick.projectId === m.projectId ? renderVerPop() : ''}
      </article>`;
    }).join('');
    $('#modsCount').textContent = `${new Intl.NumberFormat('ru-RU').format(S.modTotal)} найдено`;
    $('#modsMore').hidden = true;
    renderModsPager();
  }

  function renderModCounts() {
    const c = $('#modsInstCount'); if (!c) return;
    c.textContent = S.installedMods.length;
    const n = Object.keys(S.modUpdates).length;
    const d = $('#modsUpdDot');
    d.hidden = !n; d.textContent = n ? `↑${n}` : '';
  }

  function setModView(v) {
    S.modView = v;
    $('#page-mods').dataset.mview = v;
    $$('#modsViewTabs button').forEach((b) => b.classList.toggle('active', b.dataset.mview === v));
  }

  function renderInstalledMods() {
    const root = $('#installedMods');
    if (!root) return;
    renderModCounts();
    if (!S.installedMods.length) {
      root.innerHTML = `<div class="installed-empty">${esc(kindUi().emptyList)}</div>`;
      return;
    }
    const q = S.modFilter.trim().toLowerCase();
    const shown = S.installedMods.filter((m) => !q || `${m.title || ''} ${m.file}`.toLowerCase().includes(q));
    if (!shown.length) { root.innerHTML = '<div class="installed-empty">Ничего не найдено по фильтру.</div>'; return; }
    root.innerHTML = shown.map((m) => `<div class="installed-mod ${m.enabled ? '' : 'disabled'}">
      <span class="installed-mod-icon">${/^https:\/\/cdn\.modrinth\.com\//i.test(m.icon || '') ? `<img src="${esc(m.icon)}" alt="" data-letter="${esc((m.title || '?').slice(0,1))}" />` : icon('puzzle')}</span>
      <div class="installed-mod-copy"><b title="${esc(m.title)}">${esc(m.title)}</b><small>${esc(m.version || m.file)}${m.source ? ` · ${esc(m.source)}` : ''}${m.dependency ? ' · зависимость' : ''}</small><span class="installed-state">${m.enabled ? 'Включён' : 'Отключён'}</span>${S.modIncompat[m.file] ? `<span class="inc-badge" title="Файл собран для: ${esc(S.modIncompat[m.file].supports)}">⚠ ${S.modIncompat[m.file].wrongLoader ? 'другой загрузчик' : 'не для этой версии'}</span>` : ''}${S.modUpdates[m.file] ? `<span class="upd-badge">↑ ${esc(S.modUpdates[m.file].latest)}</span>` : ''}</div>
      ${S.modUpdates[m.file] ? `<button class="mini-action update" data-update-mod="${esc(m.file)}" title="Обновить до ${esc(S.modUpdates[m.file].latest)}">${icon('download')}</button>` : ''}
      <button class="mini-action" data-toggle-mod="${esc(m.file)}" title="${m.enabled ? 'Отключить' : 'Включить'}">${icon(m.enabled ? 'check' : 'play')}</button>
      <button class="mini-action remove" data-remove-mod="${esc(m.file)}" title="Удалить">${icon('trash')}</button>
    </div>`).join('');
  }

  async function refreshInstalledMods() {
    const kind = S.modKind;
    const r = await api.mods.list(kind);
    if (kind !== S.modKind) return;
    if (!r.ok) { toast(r.error || 'Не удалось прочитать папку', 'error'); return; }
    S.installedMods = r.mods || [];
    renderInstalledMods();
    renderModCards();
  }

  async function searchMods(reset = true) {
    if (S.modsLoading) return;
    const kind = S.modKind;
    const targetResult = await api.mods.target(kind);
    S.modTargetResult = targetResult;
    renderModTarget();
    if (!targetResult.ok) { S.modHits = []; S.modTotal = 0; renderModCards(); return; }
    if (reset === true || reset === undefined) S.modPage = 1;
    S.modOffset = ((S.modPage || 1) - 1) * MOD_PAGE; S.modHits = [];
    S.modsLoading = true;
    renderModCards();
    try {
      const r = await api.mods.search({ kind, query: $('#modsSearch').value.trim(), sort: $('#modsSort').value, offset: S.modOffset });
      if (kind !== S.modKind) return;
      if (!r.ok) { toast(r.error || 'Не удалось выполнить поиск', 'error'); S.modHits = []; S.modTotal = 0; }
      else {
        S.modTargetResult = { ok: true, target: r.target };
        S.modHits = r.hits;
        S.modTotal = r.total;
      }
    } catch (e) {
      toast('Ошибка каталога: ' + (e.message || e), 'error');
      S.modHits = [];
    } finally {
      S.modsLoading = false;
      renderModTarget();
      renderModCards();
    }
  }

  async function loadModsPage() {
    S.modsLoading = true;
    S.modUpdates = {};
    applyModKindUi();
    renderModCards();
    try {
      const kind = S.modKind;
      const [target, installed] = await Promise.all([api.mods.target(kind), api.mods.list(kind)]);
      if (kind !== S.modKind) { S.modsLoading = false; return; }
      S.modTargetResult = target;
      S.installedMods = installed && installed.ok && Array.isArray(installed.mods) ? installed.mods : [];
      renderModTarget();
      renderInstalledMods();
      S.modsLoading = false;
      renderUpdateButtons();
      refreshCopySources();
      if (target.ok) { checkModUpdates(true); await searchMods(true); }
      else { S.modHits = []; S.modTotal = 0; renderModCards(); }
    } catch (e) {
      S.modsLoading = false;
      S.modTargetResult = { ok: false, error: e.message || String(e) };
      renderModTarget(); renderModCards(); renderInstalledMods();
    }
  }

  async function installMod(projectId, versionId = '') {
    if (S.modBusy || !projectId) return;
    S.modBusy = projectId;
    renderModCards();
    try {
      const selected = S.modHits.find((m) => m.projectId === projectId) || { projectId };
      const r = await api.mods.install({ kind: S.modKind, projectId, versionId, title: selected.title, icon: selected.icon });
      if (!r.ok) { toast(r.error || 'Не удалось установить', 'error'); return; }
      const noun = kindUi().noun;
      if (r.alreadyInstalled) toast(`Этот ${noun} уже установлен`);
      else {
        const deps = r.dependencies && r.dependencies.length ? ` + ${r.dependencies.length} ${S.modKind === 'shader' ? 'мод(а) для работы' : 'зависимост.'}: ${r.dependencies.join(', ')}` : '';
        toast(`«${r.title || noun}» установлен${deps}. Перезапусти игру, если она открыта.`);
        if (r.mismatch) toast('Для твоей версии Minecraft точной сборки нет — поставлена ближайшая, может не заработать.', 'error');
        (r.warnings || []).slice(0, 3).forEach((w) => toast(w, 'error'));
      }
      await refreshInstalledMods();
    } catch (e) {
      toast('Ошибка установки мода: ' + (e.message || e), 'error');
    } finally {
      S.modBusy = '';
      renderModCards();
    }
  }

  function renderVerPop() {
    const v = S.verPick;
    if (v.loading) return '<div class="ver-pop"><span class="ver-row">Загружаю версии…</span></div>';
    if (!v.list.length) return '<div class="ver-pop"><span class="ver-row">Версий для этого загрузчика нет.</span></div>';
    return `<div class="ver-pop">${v.list.map((x) => `<button class="ver-row ${x.compatible ? '' : 'bad'}" data-ver="${esc(x.id)}" data-compat="${x.compatible ? 1 : 0}"><span>${esc(x.number)} <small>${esc(x.type)}</small></span><span class="${x.compatible ? '' : 'warn'}">${x.compatible ? '✓ ' + esc(v.mc) : '⚠ ' + esc(x.games)}</span></button>`).join('')}</div>`;
  }

  async function pickVersion(projectId) {
    if (S.verPick && S.verPick.projectId === projectId) { S.verPick = null; renderModCards(); return; }
    S.verPick = { projectId, loading: true, list: [], mc: '' };
    renderModCards();
    const r = await api.mods.versions({ kind: S.modKind, projectId });
    if (!S.verPick || S.verPick.projectId !== projectId) return;
    if (!r.ok) { S.verPick = null; toast(r.error || 'Не удалось получить версии', 'error'); renderModCards(); return; }
    S.verPick = { projectId, loading: false, list: r.versions, mc: r.mcVersion };
    renderModCards();
  }

  async function installPicked(projectId, versionId, compat) {
    if (!compat && !(await uiConfirm('Эта версия не заявлена для твоей версии Minecraft и может не заработать. Всё равно поставить?', { ok: 'Всё равно поставить' }))) return;
    S.verPick = null;
    return installMod(projectId, versionId);
  }

  async function downloadVersion(id) {
    if (!id || S.dl.has(id)) return;
    S.dl.add(id); renderBuilds();
    try {
      const r = await api.versions.install(id);
      if (!r.ok) { toast(r.error || 'Не удалось скачать', 'error'); return; }
      toast(`Версия ${id} скачана. Остальное подтянется при первом запуске.`);
      await refreshInstalled();
      await selectVersion(id);
    } catch (e) {
      toast('Ошибка загрузки: ' + (e.message || e), 'error');
    } finally {
      S.dl.delete(id); renderBuilds();
    }
  }

  function renderUpdateButtons() {
    const n = Object.keys(S.modUpdates).length;
    const all = $('#modsUpdAll');
    all.hidden = !n;
    all.disabled = S.updBusy;
    all.querySelector('span').textContent = `Обновить все (${n})`;
    renderModCounts();
    $('#modsCheckUpd').disabled = S.updBusy;
  }

  async function checkModUpdates(silent = false) {
    if (S.updBusy) return;
    const kind = S.modKind;
    S.updBusy = true; renderUpdateButtons();
    if (!silent) $('#modsCheckUpd').querySelector('span').textContent = 'Проверяю…';
    try {
      const r = await api.mods.checkUpdates(kind);
      if (kind !== S.modKind) return;
      if (!r.ok) { if (!silent) toast(r.error, 'error'); return; }
      S.modUpdates = Object.fromEntries(r.updates.map((u) => [u.file, u]));
      S.modIncompat = Object.fromEntries((r.incompatible || []).map((i) => [i.file, i]));
      const bad = (r.incompatible || []).length;
      if (!silent) toast((r.updates.length ? `Доступно обновлений: ${r.updates.length}` : 'Всё актуально') + (bad ? `. Не подходят этой версии игры: ${bad}` : ''), bad ? 'error' : '');
      else if (bad) toast(`${bad} файл(ов) не поддерживают эту версию Minecraft (⚠ в списке)`, 'error');
    } finally {
      S.updBusy = false;
      $('#modsCheckUpd').querySelector('span').textContent = 'Обновления';
      renderUpdateButtons(); renderInstalledMods();
    }
  }

  async function updateMods(files) {
    if (S.updBusy) return;
    const items = files.map((f) => S.modUpdates[f]).filter(Boolean).map((u) => ({ file: u.file, versionId: u.versionId }));
    if (!items.length) return;
    S.updBusy = true; renderUpdateButtons();
    try {
      const r = await api.mods.update({ kind: S.modKind, items });
      if (!r.ok) { toast(r.error || 'Не удалось обновить', 'error'); return; }
      if (r.updated.length) toast(`Обновлено: ${r.updated.length}. Перезапусти игру, если она открыта.`);
      (r.failed || []).slice(0, 3).forEach((f) => toast(`${f.title}: ${f.error}`, 'error'));
      (r.warnings || []).slice(0, 2).forEach((w) => toast(w, 'error'));
      S.installedMods = r.mods || S.installedMods;
    } finally {
      S.updBusy = false;
      S.modUpdates = {};
      renderUpdateButtons(); renderInstalledMods(); renderModCards();
      checkModUpdates(true);
    }
  }

  async function refreshCopySources() {
    const box = $('#modsCopy');
    const r = await api.instances.sources();
    const list = r.ok ? r.sources : [];
    box.hidden = !list.length;
    $('#modsCopySrc').innerHTML = list.map((s) => `<option value="${esc(s.id)}">${esc(s.label)} · ${s.count} файл.</option>`).join('');
  }

  async function copyFromBuild() {
    const id = $('#modsCopySrc').value;
    if (!id) return;
    if (!(await uiConfirm('Скопировать моды, шейдеры и ресурспаки в эту сборку? Копируй только из сборок с той же версией Minecraft и загрузчиком, иначе моды могут не заработать.', { ok: 'Скопировать' }))) return;
    const r = await api.instances.copyFrom(id);
    if (!r.ok) { toast(r.error || 'Не удалось скопировать', 'error'); return; }
    toast('Файлы скопированы');
    await refreshInstalledMods();
    refreshCopySources();
  }

  async function toggleMod(filename) {
    const r = await api.mods.toggle(filename, S.modKind);
    if (!r.ok) { toast(r.error || 'Не удалось изменить состояние', 'error'); return; }
    S.installedMods = r.mods || [];
    if (S.modUpdates[filename]) { S.modUpdates[r.filename] = { ...S.modUpdates[filename], file: r.filename }; delete S.modUpdates[filename]; }
    renderInstalledMods(); renderModCards();
    toast(r.mods.find((m) => m.file === r.filename)?.enabled ? 'Включено' : 'Отключено');
  }

  async function removeMod(filename) {
    const item = S.installedMods.find((m) => m.file === filename);
    if (!(await uiConfirm(`Удалить ${kindUi().noun} «${item ? item.title : filename}» из папки игры?`, { danger: true, ok: 'Удалить' }))) return;
    const r = await api.mods.remove(filename, S.modKind);
    if (!r.ok) { toast(r.error || 'Не удалось удалить', 'error'); return; }
    S.installedMods = r.mods || [];
    renderInstalledMods(); renderModCards();
    toast('Удалено из папки игры');
  }

  function renderBuilds() {
    renderLoaderPanel();
    $('#chips').innerHTML = FILTERS.map(([k, t]) => `<button class="chip ${S.filter === k ? 'active' : ''}" data-filter="${k}">${t}</button>`).join('');
    const grid = $('#vgrid');
    $('#buildsSub').textContent = S.versionsError || 'Выберите версию Minecraft для запуска';
    if (!S.versionsLoaded) {
      grid.innerHTML = Array.from({ length: 12 }, () => '<div class="skeleton"></div>').join('');
      $('#btnMore').hidden = true;
      return;
    }
    // Чистая версия, на которой уже стоит загрузчик или сборка, не дублируется отдельной карточкой.
    const usedBases = new Set(S.versions.filter((v) => v.loader && v.loader !== 'horizon' && v.baseVersion && S.installed.has(v.id)).map((v) => v.baseVersion));
    const list = S.versions.filter(matches).filter((v) => v.loader || !(S.installed.has(v.id) && usedBases.has(v.id)));
    if (!list.length) {
      grid.innerHTML = '<div class="empty">Ничего не найдено</div>';
      $('#btnMore').hidden = true;
      return;
    }
    // Установленные версии — сверху и крупнее, остальные ниже обычными карточками.
    const mine = list.filter((v) => S.installed.has(v.id));
    const others = list.filter((v) => !S.installed.has(v.id));
    const shown = others.slice(0, S.limit);
    let html = '';
    if (mine.length) {
      if (others.length) html += `<div class="vsection">Установленные <b>${mine.length}</b></div>`;
      html += mine.map((v) => cardHTML(v).replace('class="vcard ', 'class="vcard big ')).join('');
      if (others.length) html += '<div class="vsection">Доступные для скачивания</div>';
    }
    grid.innerHTML = html + shown.map(cardHTML).join('');
    $('#btnMore').hidden = others.length <= S.limit;
    $('#btnMore').textContent = `Показать ещё (${others.length - S.limit})`;
  }

  async function selectVersion(id) {
    await setSetting({ selectedVersion: id });
    $$('.vcard').forEach((c) => c.classList.toggle('sel', c.dataset.v === id));
    renderPlaybar();
    renderLoaderPanel();
  }

  /* ------------------------------- аккаунты --------------------------- */
  function renderAccounts() {
    const grid = $('#accGrid');
    if (!S.accounts.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Пока нет аккаунтов. Войдите через Microsoft или добавьте офлайн-ник.</div>';
      return;
    }
    grid.innerHTML = S.accounts
      .map(
        (a) => `<div class="acc ${a.id === S.settings.activeAccount ? 'active' : ''}" data-acc="${esc(a.id)}">
          <span class="avatar">${avatarHTML(a)}</span>
          <div class="acc-info">
            <div class="acc-name">${esc(a.name)}</div>
            <div class="acc-type"><span class="tag ${a.type === 'microsoft' ? 'ms' : 'off'}">${a.type === 'microsoft' ? 'MICROSOFT' : 'ОФЛАЙН'}</span>${a.id === S.settings.activeAccount ? '<span class="accent">• выбран</span>' : ''}</div>
          </div>
          <div class="acc-actions">
            <button class="icon-btn" data-skin="${esc(a.id)}" title="Скин">${icon('shirt')}</button>
            ${a.id === S.settings.activeAccount ? '' : `<button class="icon-btn" data-use="${esc(a.id)}" title="Выбрать">${icon('check')}</button>`}
            <button class="icon-btn del" data-del="${esc(a.id)}" title="Удалить">${icon('trash')}</button>
          </div>
        </div>`
      )
      .join('');
  }

  function applyAccountsState(r) {
    S.accounts = r.accounts;
    S.settings.activeAccount = r.activeAccount;
    renderTop();
    renderAccounts();
    renderPlaybar();
  }

  /* ------------------------------- настройки -------------------------- */
  const fmtGB = (mb) => (mb / 1024).toFixed(mb % 1024 ? 1 : 0).replace('.', ',') + ' ГБ';
  const AIKAR = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15';

  function javaOptions() {
    const cur = S.settings.javaPath;
    let html = `<option value="auto" ${cur === 'auto' ? 'selected' : ''}>Автоматически (подберётся под версию игры)</option>`;
    let found = cur === 'auto';
    for (const j of S.javas) {
      const sel = j.path === cur;
      if (sel) found = true;
      html += `<option value="${esc(j.path)}" ${sel ? 'selected' : ''}>Java ${j.major} • ${esc(j.vendor)} (${esc(j.version)})${j.fromPath ? ' • из PATH' : ''}</option>`;
    }
    if (!found) html += `<option value="${esc(cur)}" selected>Вручную: ${esc(cur)}</option>`;
    html += '<option value="__browse">Указать вручную…</option>';
    return html;
  }

  function renderSettings() {
    const s = S.settings;
    const total = Math.max(2048, Math.floor(S.sys.totalMemMB / 256) * 256);
    const presets = [2048, 4096, 6144, 8192, 12288, 16384].filter((v) => v <= total);
    const pct = (v, min, max) => ((v - min) / (max - min)) * 100;
    const maxPct = pct(s.ramMax, 512, total);
    const minPct = pct(Math.min(s.ramMin, s.ramMax), 512, Math.max(s.ramMax, 768));
    const warn = s.ramMax > S.sys.totalMemMB * 0.75;

    $('#settingsBody').innerHTML = `
      <div class="card">
        <h3>${icon('palette')}Интерфейс</h3>
        <div class="field">
          <label>Язык интерфейса</label>
          <div class="seg" id="langSeg"><button data-lang-choice="ru" class="${window.I18N.lang === 'ru' ? 'active' : ''}">Русский</button><button data-lang-choice="en" class="${window.I18N.lang === 'en' ? 'active' : ''}">English</button></div>
        </div>
        <div class="field">
          <label>Панель навигации</label>
          <div class="seg" id="navSeg">${[['rail', 'Компактная (значки)'], ['wide', 'С подписями'], ['top', 'Сверху (вкладки)'], ['pill', 'Капсула сверху'], ['dock', 'Док снизу'], ['right', 'Справа']].map(([v, t]) => `<button data-nav-choice="${v}" class="${(document.body.dataset.nav || 'rail') === v ? 'active' : ''}">${t}</button>`).join('')}</div>
          <div class="hint">Как выглядит левая панель: значки, значки с подписями или вкладки сверху</div>
        </div>
      </div>

      <div class="card">
        <h3>${icon('coffee')}Java</h3>
        <p class="desc">Для разных версий Minecraft нужна разная Java: 8 — до 1.16, 17 — для 1.17–1.20.4, 21 — для 1.20.5–1.21.x, 25 — для версий 26.x. Если выбранная Java не подходит, лаунчер подберёт или скачает нужную сам.</p>
        <div class="field">
          <label>Установка Java</label>
          <select id="javaSel">${javaOptions()}</select>
          <div class="hint">${S.javasLoaded ? (S.javas.length ? `Найдено установок: ${S.javas.length}` : 'Java не найдена на компьютере — установите её (например, Temurin) или укажите путь вручную.') : 'Поиск установленных Java…'}</div>
        </div>
        <div class="row gap" style="margin-top:12px"><button class="btn ghost sm" id="javaRescan">Обновить список</button></div>
      </div>

      <div class="card">
        <h3>${icon('cpu')}Оперативная память</h3>
        <p class="desc">Всего в системе: ${fmtGB(S.sys.totalMemMB)}. Не выделяйте больше 70–75% — Windows тоже нужна память.</p>
        <div class="field">
          <div class="ram-head"><label>Максимум</label><span class="ram-val" id="ramMaxVal">${fmtGB(s.ramMax)}</span></div>
          <input type="range" id="ramMax" min="512" max="${total}" step="256" value="${s.ramMax}" style="--p:${maxPct}%" />
          <div class="presets">${presets.map((v) => `<button class="chip ${v === s.ramMax ? 'active' : ''}" data-ram="${v}">${fmtGB(v)}</button>`).join('')}</div>
          <div class="hint warn" id="ramWarn" ${warn ? '' : 'hidden'}>Слишком много: игра и система могут тормозить.</div>
        </div>
        <div class="field">
          <div class="ram-head"><label>Минимум (при старте)</label><span class="ram-val" id="ramMinVal">${fmtGB(Math.min(s.ramMin, s.ramMax))}</span></div>
          <input type="range" id="ramMin" min="512" max="${Math.max(s.ramMax, 768)}" step="256" value="${Math.min(s.ramMin, s.ramMax)}" style="--p:${minPct}%" />
        </div>
      </div>

      <div class="card">
        <h3>${icon('folder')}Игра</h3>
        <div class="field">
          <label>Папка игры</label>
          <div class="path-row">
            <input type="text" id="gameDir" value="${esc(s.gameDir)}" spellcheck="false" />
            <button class="btn ghost" id="dirBrowse">Обзор</button>
            <button class="btn ghost" id="dirOpen">Открыть</button>
          </div>
        </div>
        <div class="toggle-row"><div><b>Отдельная папка для каждой сборки</b><span>У каждой сборки свои моды, шейдеры, ресурспаки, конфиги и миры (папка instances)</span></div><label class="switch"><input type="checkbox" id="isolateToggle" ${s.isolateBuilds !== false ? 'checked' : ''} /><i></i></label></div>
        <div class="grid2 field">
          <div><label>Ширина окна</label><input type="text" id="winW" value="${s.width}" /></div>
          <div><label>Высота окна</label><input type="text" id="winH" value="${s.height}" /></div>
        </div>
      </div>

      <div class="card">
        <h3>${icon('sliders')}Параметры запуска</h3>
        <div class="field">
          <label>Дополнительные JVM-аргументы</label>
          <input type="text" id="jvmArgs" value="${esc(s.jvmArgs)}" placeholder="например: -XX:+UseG1GC" spellcheck="false" />
          <div class="presets"><button class="chip" id="jvmPreset">Оптимизация G1GC</button><button class="chip" id="jvmClear">Очистить</button></div>
        </div>
        <div style="margin-top:18px">
          <div class="toggle-row"><div><b>Полноэкранный режим</b><span>Запускать игру на весь экран</span></div><label class="switch"><input type="checkbox" id="fsToggle" ${s.fullscreen ? 'checked' : ''} /><i></i></label></div>
          <div class="toggle-row"><div><b>Закрывать лаунчер после запуска</b><span>Лаунчер закроется, когда игра начнёт загружаться</span></div><label class="switch"><input type="checkbox" id="closeToggle" ${s.closeOnLaunch ? 'checked' : ''} /><i></i></label></div>
          <div class="toggle-row"><div><b>Показывать консоль при запуске</b><span>Открывать логи игры автоматически</span></div><label class="switch"><input type="checkbox" id="consoleToggle" ${s.showConsole ? 'checked' : ''} /><i></i></label></div>
        </div>
      </div>`;
  }

  function bindSettings() {
    const body = $('#settingsBody');
    const setRange = (el) => {
      const min = +el.min, max = +el.max;
      el.style.setProperty('--p', ((el.value - min) / (max - min)) * 100 + '%');
    };

    body.addEventListener('input', (e) => {
      const t = e.target;
      if (t.id === 'ramMax') {
        const v = +t.value;
        S.settings.ramMax = v;
        setRange(t);
        $('#ramMaxVal').textContent = fmtGB(v);
        $('#ramWarn').hidden = !(v > S.sys.totalMemMB * 0.75);
        const minEl = $('#ramMin');
        minEl.max = Math.max(v, 768);
        if (+minEl.value > v) minEl.value = v;
        S.settings.ramMin = +minEl.value;
        setRange(minEl);
        $('#ramMinVal').textContent = fmtGB(+minEl.value);
        $$('[data-ram]', body).forEach((c) => c.classList.toggle('active', +c.dataset.ram === v));
      } else if (t.id === 'ramMin') {
        S.settings.ramMin = +t.value;
        setRange(t);
        $('#ramMinVal').textContent = fmtGB(+t.value);
      }
    });

    body.addEventListener('change', async (e) => {
      const t = e.target;
      switch (t.id) {
        case 'ramMax':
        case 'ramMin':
          await setSetting({ ramMax: S.settings.ramMax, ramMin: S.settings.ramMin });
          break;
        case 'javaSel':
          if (t.value === '__browse') {
            const r = await api.sys.pickJava();
            if (!r) return renderSettings();
            if (r.error) { toast(r.error, 'error'); return renderSettings(); }
            if (!S.javas.some((j) => j.path === r.path)) S.javas.push(r);
            await setSetting({ javaPath: r.path });
            renderSettings();
          } else {
            await setSetting({ javaPath: t.value });
          }
          break;
        case 'gameDir':
          await setSetting({ gameDir: t.value.trim() || S.settings.gameDir });
          await refreshInstalled();
          break;
        case 'winW':
        case 'winH': {
          const n = parseInt(t.value, 10);
          const key = t.id === 'winW' ? 'width' : 'height';
          const val = Number.isFinite(n) ? Math.min(Math.max(n, 320), 7680) : S.settings[key];
          t.value = val;
          await setSetting({ [key]: val });
          break;
        }
        case 'jvmArgs':
          await setSetting({ jvmArgs: t.value.trim() });
          break;
        case 'fsToggle':
          await setSetting({ fullscreen: t.checked });
          break;
        case 'isolateToggle':
          await setSetting({ isolateBuilds: t.checked });
          break;
        case 'closeToggle':
          await setSetting({ closeOnLaunch: t.checked });
          break;
        case 'consoleToggle':
          await setSetting({ showConsole: t.checked });
          break;
      }
    });

    body.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.ram) {
        const v = +t.dataset.ram;
        const min = Math.min(S.settings.ramMin, v);
        await setSetting({ ramMax: v, ramMin: min });
        renderSettings();
      } else if (t.id === 'javaRescan') {
        t.textContent = 'Поиск…';
        S.javas = await api.java.detect(true);
        S.javasLoaded = true;
        renderSettings();
      } else if (t.id === 'dirBrowse') {
        const p = await api.sys.pickFolder();
        if (p) { await setSetting({ gameDir: p }); await refreshInstalled(); renderSettings(); }
      } else if (t.id === 'dirOpen') {
        api.sys.openFolder(S.settings.gameDir);
      } else if (t.id === 'jvmPreset') {
        await setSetting({ jvmArgs: AIKAR });
        $('#jvmArgs').value = AIKAR;
      } else if (t.id === 'jvmClear') {
        await setSetting({ jvmArgs: '' });
        $('#jvmArgs').value = '';
      }
    });
  }

  /* --------------------------------- скины ---------------------------- */
  const SK = { id: null, variant: 'classic', pending: null, currentVariant: 'classic', dataUrl: null };

  // рисует вид спереди (голова, тело, руки, ноги + второй слой) из текстуры скина
  function drawSkin(dataUrl, variant) {
    const cv = $('#skinCanvas');
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const k = 8;
      const modern = img.height >= 64;
      const aw = variant === 'slim' ? 3 : 4;
      const part = (sx, sy, sw, sh, dx, dy, mirror) => {
        ctx.save();
        if (mirror) { ctx.translate((dx + sw) * k, dy * k); ctx.scale(-1, 1); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * k, sh * k); }
        else ctx.drawImage(img, sx, sy, sw, sh, dx * k, dy * k, sw * k, sh * k);
        ctx.restore();
      };
      // базовый слой
      part(8, 8, 8, 8, 4, 0);                      // голова
      part(20, 20, 8, 12, 4, 8);                   // тело
      part(44, 20, aw, 12, 4 - aw, 8);             // правая рука
      part(4, 20, 4, 12, 4, 20);                   // правая нога
      if (modern) {
        part(36, 52, aw, 12, 12, 8);               // левая рука
        part(20, 52, 4, 12, 8, 20);                // левая нога
      } else {
        part(44, 20, aw, 12, 12, 8, true);         // левая рука (зеркало)
        part(4, 20, 4, 12, 8, 20, true);           // левая нога (зеркало)
      }
      // верхний слой
      part(40, 8, 8, 8, 4, 0);                     // шапка
      if (modern) {
        part(20, 36, 8, 12, 4, 8);                 // куртка
        part(44, 36, aw, 12, 4 - aw, 8);           // рукав правый
        part(4, 36, 4, 12, 4, 20);                 // штанина правая
        part(52, 52, aw, 12, 12, 8);               // рукав левый
        part(4, 52, 4, 12, 8, 20);                 // штанина левая
      }
    };
    img.src = dataUrl;
  }

  function setVariant(v) {
    SK.variant = v;
    $$('#skinVariant button').forEach((b) => b.classList.toggle('active', b.dataset.variant === v));
    drawSkin(SK.pending ? SK.pending.dataUrl : SK.dataUrl, v);
  }

  async function openSkin(id) {
    const acc = S.accounts.find((a) => a.id === id);
    if (!acc) return;
    Object.assign(SK, { id, pending: null, dataUrl: null, variant: 'classic' });
    $('#skinWho').textContent = `${acc.name} • ${acc.type === 'microsoft' ? 'Microsoft' : 'офлайн'}`;
    $('#skinErr').textContent = '';
    $('#skinFile').textContent = 'Файл не выбран. Подойдёт скин 64×64.';
    $('#skinApply').disabled = true;
    drawSkin(null);
    $('#modalSkin').hidden = false;

    const offline = acc.type !== 'microsoft';
    $('#skinCtl').hidden = false;
    $('#skinNote').hidden = !offline;
    $('#skinSupport').hidden = !offline;
    if (offline) {
      $('#skinNoteText').textContent = 'Офлайн-скин сохраняется локально. Чтобы он отображался в игре, нужна поддержка скинов в сборке (клиентский мод CustomSkinLoader). Другие игроки этот локальный скин не увидят, если у них нет совместимой системы скинов.';
    }
    $('#skinFile').textContent = 'Загружаю текущий скин…';
    const r = await api.skin.get(id);
    if (SK.id !== id) return;
    $('#skinFile').textContent = 'Файл не выбран. Подойдёт PNG 64×64 (старый формат 64×32 тоже поддерживается).';
    if (!r.ok) { $('#skinErr').textContent = r.error; return; }
    if (r.skin) {
      SK.dataUrl = r.skin.dataUrl;
      setVariant(r.skin.variant === 'slim' ? 'slim' : 'classic');
      $('#skinFile').textContent = offline ? 'Локальный скин уже сохранён.' : 'Текущий скин аккаунта загружен.';
    }
  }

  function bindSkin() {
    const close = () => { $('#modalSkin').hidden = true; SK.id = null; };
    $('#skinClose').addEventListener('click', close);
    $('#modalSkin').addEventListener('mousedown', (e) => { if (e.target.id === 'modalSkin') close(); });
    $('#skinVariant').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) setVariant(b.dataset.variant);
    });
    $('#skinPick').addEventListener('click', async () => {
      $('#skinErr').textContent = '';
      const r = await api.skin.pick();
      if (r.canceled) return;
      if (!r.ok) { $('#skinErr').textContent = r.error; return; }
      SK.pending = r;
      $('#skinFile').textContent = r.path.split(/[\\/]/).pop() + ` (${r.width}×${r.height})`;
      $('#skinApply').disabled = false;
      drawSkin(r.dataUrl, SK.variant);
    });
    $('#skinApply').addEventListener('click', async () => {
      if (!SK.pending) return;
      const btn = $('#skinApply');
      btn.disabled = true; btn.textContent = 'Применяю…';
      const r = await api.skin.upload(SK.id, SK.pending.path, SK.variant);
      btn.textContent = 'Применить скин';
      if (!r.ok) { $('#skinErr').textContent = r.error; btn.disabled = false; return; }
      SK.pending = null;
      SK.dataUrl = r.skin ? r.skin.dataUrl : null;
      $('#skinFile').textContent = r.local ? 'Локальный скин сохранён.' : 'Готово — скин обновлён.';
      drawSkin(SK.dataUrl, SK.variant);
      toast(r.local
        ? 'Локальный скин сохранён. Для отображения в игре установи поддержку скинов в этой сборке.'
        : 'Скин обновлён. В игре он появится после перезахода.');
    });
    $('#skinReset').addEventListener('click', async () => {
      $('#skinErr').textContent = '';
      const r = await api.skin.reset(SK.id);
      if (!r.ok) { $('#skinErr').textContent = r.error; return; }
      SK.pending = null;
      SK.dataUrl = r.skin ? r.skin.dataUrl : null;
      $('#skinApply').disabled = true;
      $('#skinFile').textContent = 'Скин сброшен на стандартный.';
      drawSkin(SK.dataUrl, SK.variant);
      toast(r.local ? 'Локальный скин удалён.' : 'Скин сброшен');
    });
    $('#skinSupport').addEventListener('click', async () => {
      if (!SK.id) return;
      const btn = $('#skinSupport');
      const old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = icon('coffee') + '<span>Устанавливаю…</span>';
      $('#skinErr').textContent = '';
      try {
        const r = await api.skin.installSupport(SK.id);
        if (!r.ok) { $('#skinErr').textContent = r.error; return; }
        toast(r.alreadyInstalled
          ? 'CustomSkinLoader уже есть в папке mods. Перезапусти игру.'
          : `Поддержка офлайн-скина установлена (${r.loader}, Minecraft ${r.mcVersion}). Перезапусти игру.`);
      } catch (e) {
        $('#skinErr').textContent = 'Не удалось установить поддержку скинов: ' + (e.message || e);
      } finally {
        btn.disabled = false;
        btn.innerHTML = old;
      }
    });
  }

  /* -------------------------------- консоль --------------------------- */
  let logLines = 0;
  function appendLog(text) {
    const body = $('#consoleBody');
    const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 30;
    body.appendChild(document.createTextNode(text + '\n'));
    logLines++;
    if (logLines > 1500) {
      while (logLines > 1000 && body.firstChild) { body.removeChild(body.firstChild); logLines--; }
    }
    if (atBottom) body.scrollTop = body.scrollHeight;
  }

  /* ------------------------------- загрузка --------------------------- */
  async function refreshInstalled() {
    S.installed = new Set(await api.versions.installed());
    if (S.page === 'builds') renderBuilds();
    renderPlaybar();
    renderLoaderPanel();
  }

  async function loadVersions(quiet = false) {
    const r = await api.versions.list();
    if (quiet && !r.ok) return;
    try {
      const prev = JSON.parse(localStorage.getItem('mc.latest') || 'null');
      const cur = { release: (r.latest || {}).release || '', snapshot: (r.latest || {}).snapshot || '' };
      if (r.ok && cur.release) {
        if (prev && prev.release && prev.release !== cur.release) toast(`Вышла новая версия Minecraft ${cur.release}`);
        else if (prev && prev.snapshot && cur.snapshot && prev.snapshot !== cur.snapshot) toast(`Новый снапшот ${cur.snapshot}`);
        localStorage.setItem('mc.latest', JSON.stringify(cur));
      }
    } catch {}
    S.versions = r.versions;
    S.latest = r.latest || {};
    S.versionsError = r.ok ? '' : r.error;
    S.versionsLoaded = true;
    if (S.page === 'builds') renderBuilds();
    renderPlaybar();
    renderLoaderPanel();
  }

  /* -------------------------------- события --------------------------- */
  function bindUI() {
    $$('.nav-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));
    $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
    $('#btnPick').addEventListener('click', () => go('builds'));
    $('#btnMin').addEventListener('click', () => api.win.minimize());
    $('#btnClose').addEventListener('click', () => api.win.close());
    $('#langBtn').addEventListener('click', () => animated(() => applyLang(window.I18N.lang === 'ru' ? 'en' : 'ru')));
    $('#railToggle').addEventListener('click', () => animated(() => applyNav(document.body.dataset.nav === 'wide' ? 'rail' : 'wide')));
    window.addEventListener('resize', syncSegs);
    document.addEventListener('click', (e) => {
      const l = e.target.closest('[data-lang-choice]'); if (l) animated(() => applyLang(l.dataset.langChoice));
      const n = e.target.closest('[data-nav-choice]'); if (n) animated(() => applyNav(n.dataset.navChoice));
    });
    $('#themeBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#themeMenu').hidden = !$('#themeMenu').hidden; $('#accMenu').hidden = true; });
    $('#themeOptions').addEventListener('click', async (e) => { const b = e.target.closest('[data-theme-choice]'); if (b) await chooseTheme(b.dataset.themeChoice); });

    // меню аккаунта
    $('#accPill').addEventListener('click', (e) => { e.stopPropagation(); $('#accMenu').hidden = !$('#accMenu').hidden; });
    document.addEventListener('click', (e) => { if (!e.target.closest('.pill-wrap')) $('#accMenu').hidden = true; if (!e.target.closest('.theme-wrap')) $('#themeMenu').hidden = true; });
    $('#accMenu').addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.manage) return go('accounts');
      applyAccountsState(await api.accounts.select(b.dataset.acc));
      $('#accMenu').hidden = true;
    });

    // сборки
    $('#chips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      S.filter = b.dataset.filter; S.limit = 60; renderBuilds();
    });
    $('#vgrid').addEventListener('click', async (e) => {
      const delv = e.target.closest('[data-delv]');
      if (delv) {
        const id = delv.dataset.delv;
        if (!(await uiConfirm(`Удалить версию ${id} с диска? Миры и моды не будут затронуты.`, { danger: true, ok: 'Удалить' }))) return;
        api.versions.delete(id).then(async (r) => {
          if (!r || !r.ok) { toast((r && r.error) || 'Не удалось удалить версию', 'error'); return; }
          if (S.settings.selectedVersion === id) S.settings.selectedVersion = null;
          await refreshInstalled();
          toast(`Версия ${id} удалена`);
        });
        return;
      }
      const open = e.target.closest('[data-open]');
      if (open) { api.versions.openFolder(open.dataset.open); return; }
      const dl = e.target.closest('[data-dl]');
      if (dl) { downloadVersion(dl.dataset.dl); return; }
      const c = e.target.closest('.vcard');
      if (c) selectVersion(c.dataset.v);
    });
    $('#btnFolder').addEventListener('click', () => api.sys.openFolder(S.settings.gameDir));
    $('#search').addEventListener('input', (e) => { S.query = e.target.value.trim().toLowerCase(); S.limit = 60; renderBuilds(); });
    $('#btnMore').addEventListener('click', () => { S.limit += 60; renderBuilds(); });
    $('#loaderType').addEventListener('change', async (e) => {
      await setSetting({ preferredLoader: e.target.value });
    });
    $('#btnInstallLoader').addEventListener('click', async () => {
      if (S.loaderBusy) return;
      const button = $('#btnInstallLoader');
      S.loaderBusy = true;
      $('#loaderStatus').textContent = 'Подготовка загрузчика…';
      renderLoaderPanel();
      try {
        const loader = $('#loaderType').value;
        const r = await api.versions.installLoader(loader);
        if (!r.ok) {
          $('#loaderStatus').textContent = '';
          toast(r.error, 'error');
          return;
        }
        await setSetting({ selectedVersion: r.id, preferredLoader: loader });
        await loadVersions();
        await refreshInstalled();
        $('#loaderStatus').textContent = `${loaderLabel(loader)} ${r.loaderVersion} установлен для Minecraft ${r.baseVersion}. Профиль выбран автоматически.`;
        toast(`${loaderLabel(loader)} установлен для Minecraft ${r.baseVersion}.`);
      } catch (e) {
        $('#loaderStatus').textContent = '';
        toast('Не удалось установить загрузчик: ' + (e.message || e), 'error');
      } finally {
        S.loaderBusy = false;
        renderLoaderPanel();
      }
    });
    api.on('loader:progress', (p) => {
      if ($('#loaderStatus')) $('#loaderStatus').textContent = p.label || '';
    });

    // каталог модов
    $('#modsChooseBuild').addEventListener('click', () => go('builds'));
    $('#modKindTabs').addEventListener('click', (e) => {
      const b = e.target.closest('[data-mod-kind]');
      if (b) setModKind(b.dataset.modKind);
    });
    $('#packsSearchBtn').addEventListener('click', () => searchPacks(1));
    $('#packsSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchPacks(1); });
    $('#packsSort').addEventListener('change', () => searchPacks(1));
    $('#packsPager').addEventListener('click', (e) => { const b = e.target.closest('[data-pack-page]'); if (b && !b.disabled) searchPacks(Number(b.dataset.packPage)); });
    $('#packGrid').addEventListener('click', (e) => { const b = e.target.closest('[data-install-pack]'); if (b) installPack(b.dataset.installPack); });
    api.on('packs:progress', (p) => {
      if (!p.label || p.done) return;
      const n = $('#packsNotice');
      if (n && S.page === 'packs') n.innerHTML = `${icon('download')}<span>${esc(p.label)}${p.pct ? ` · ${p.pct}%` : ''}</span>`;
    });
    $('#modsSearchBtn').addEventListener('click', () => searchMods(true));
    $('#modsSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchMods(true); });
    $('#modsSort').addEventListener('change', () => searchMods(true));
    $('#modsPager').addEventListener('click', (e) => { const b = e.target.closest('[data-mod-page]'); if (b && !b.disabled) { S.modPage = Number(b.dataset.modPage); searchMods(false); const pg = $('.pages'); if (pg) pg.scrollTo({ top: 0, behavior: 'smooth' }); } });
    $('#modsViewTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-mview]'); if (b) setModView(b.dataset.mview); });
    $('#modsFilter').addEventListener('input', (e) => { S.modFilter = e.target.value; renderInstalledMods(); });
    $('#modsCheckUpd').addEventListener('click', () => checkModUpdates(false));
    $('#modsUpdAll').addEventListener('click', () => updateMods(Object.keys(S.modUpdates)));
    $('#modsOpenDir').addEventListener('click', () => api.instances.open());
    $('#modsCopyBtn').addEventListener('click', copyFromBuild);
    $('#modsRefresh').addEventListener('click', () => { refreshInstalledMods(); if (S.page === 'mods') searchMods(true); });
    $('#modGrid').addEventListener('click', (e) => {
      const install = e.target.closest('[data-install-mod]');
      const builds = e.target.closest('[data-mods-builds]');
      const pickBtn = e.target.closest('[data-pick-version]');
      const verRow = e.target.closest('[data-ver]');
      if (pickBtn && !pickBtn.disabled) pickVersion(pickBtn.dataset.pickVersion);
      if (verRow && S.verPick) installPicked(S.verPick.projectId, verRow.dataset.ver, verRow.dataset.compat === '1');
      if (install && !install.disabled) installMod(install.dataset.installMod);
      if (builds) go('builds');
    });
    $('#installedMods').addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle-mod]');
      const remove = e.target.closest('[data-remove-mod]');
      const upd = e.target.closest('[data-update-mod]');
      if (upd) updateMods([upd.dataset.updateMod]);
      if (toggle) toggleMod(toggle.dataset.toggleMod);
      if (remove) removeMod(remove.dataset.removeMod);
    });
    api.on('mods:progress', (p) => {
      if (!p.label || p.done) return;
      const notice = $('#modsNotice');
      if (notice && S.page === 'mods') notice.innerHTML = `${icon('download')}<span>${esc(p.label)}</span>`;
    });

    // аккаунты
    $('#btnMicrosoft').addEventListener('click', async () => {
      if (S.msBusy) return;
      S.msBusy = true;
      const btn = $('#btnMicrosoft');
      btn.disabled = true;
      btn.lastElementChild.textContent = 'Ждём вход…';
      const r = await api.accounts.addMicrosoft();
      S.msBusy = false;
      btn.disabled = false;
      btn.lastElementChild.textContent = 'Войти через Microsoft';
      if (r.ok) { applyAccountsState(r); toast('Аккаунт Microsoft добавлен'); }
      else toast(r.error, 'error');
    });
    $('#hzInstall').addEventListener('click', () => hzRun(() => api.horizon.install(), 'Установка Horizon…'));
    $('#hzPrepare').addEventListener('click', () => hzRun(() => api.horizon.prepare(), 'Подготовка…'));
    $('#hzFolder').addEventListener('click', () => api.horizon.openFolder());
    hzmWire();
    $('#hzPlay').addEventListener('click', hzSmartPlay);
    api.on('horizon:progress', (p) => {
      if (!$('#hzStatus')) return;
      if (p.label) $('#hzStatus').textContent = p.label;
      if (typeof p.pct === 'number' && p.pct > 0) $('#hzBar').style.width = Math.min(100, p.pct) + '%';
    });
    api.on('horizon:state', (e) => {
      HZ.running = !!e.running;
      renderHorizonButtons();
      if (e.error) toast(e.error, 'error');
    });
    $('#btnOffline').addEventListener('click', () => {
      $('#offlineName').value = ''; $('#offlineErr').textContent = '';
      $('#modalOffline').hidden = false; $('#offlineName').focus();
    });
    const closeOffline = () => { $('#modalOffline').hidden = true; };
    $('#offlineCancel').addEventListener('click', closeOffline);
    $('#modalOffline').addEventListener('mousedown', (e) => { if (e.target.id === 'modalOffline') closeOffline(); });
    const submitOffline = async () => {
      const r = await api.accounts.addOffline($('#offlineName').value);
      if (!r.ok) { $('#offlineErr').textContent = r.error; return; }
      closeOffline(); applyAccountsState(r);
    };
    $('#offlineOk').addEventListener('click', submitOffline);
    $('#offlineName').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitOffline(); if (e.key === 'Escape') closeOffline(); });
    $('#accGrid').addEventListener('click', async (e) => {
      const skin = e.target.closest('[data-skin]');
      if (skin) return openSkin(skin.dataset.skin);
      const use = e.target.closest('[data-use]');
      const del = e.target.closest('[data-del]');
      if (use) applyAccountsState(await api.accounts.select(use.dataset.use));
      if (del) applyAccountsState(await api.accounts.remove(del.dataset.del));
    });

    // запуск
    $('#btnPlay').addEventListener('click', async () => {
      if (S.game === 'running') return api.game.stop();
      S.progress = { label: 'Подготовка к запуску', pct: 0 };
      S.game = 'launching';
      renderPlaybar();
      if (S.settings.showConsole) $('#console').hidden = false;
      const r = await api.game.launch();
      if (!r.ok) { S.game = 'idle'; renderPlaybar(); toast(r.error, 'error'); }
    });

    // консоль
    $('#btnConsole').addEventListener('click', () => { $('#console').hidden = !$('#console').hidden; });
    $('#btnCloseLog').addEventListener('click', () => { $('#console').hidden = true; });
    $('#btnClearLog').addEventListener('click', () => { $('#consoleBody').textContent = ''; logLines = 0; });

    api.on('game:progress', (p) => { S.progress = p; if (S.game === 'launching') renderPlaybar(); });
    api.on('game:log', appendLog);
    api.on('game:state', (e) => {
      S.game = e.state;
      if (e.state === 'idle') {
        S.progress = { label: '', pct: 0 };
        refreshInstalled();
        if (e.error) {
          toast(e.error, 'error');
          $('#console').hidden = false; // сразу показываем логи, чтобы было видно причину
        }
      }
      renderPlaybar();
    });

    bindSettings();
    bindSkin();
    applyNav(document.body.dataset.nav);
  }

  /* ------------------------------- старт ------------------------------ */
  async function init() {
    paintIcons();
    bindUI();
    applyNav(lsGet('navMode', 'rail'));
    applyLang(window.I18N.lang);
    const [settings, sys, accs] = await Promise.all([api.settings.get(), api.sys.info(), api.accounts.list()]);
    S.settings = settings;
    S.settingsLoaded = true;
    applyTheme(S.settings.theme || 'green');
    // Режим панели: настройки лаунчера главнее, localStorage остаётся запасным (старые версии хранили только его).
    if (S.settings.navMode) applyNav(S.settings.navMode); else setSetting({ navMode: lsGet('navMode', 'rail') });
    hzmRestore();
    enhanceSelects();
    S.sys = sys;
    S.accounts = accs.accounts;
    S.settings.activeAccount = accs.activeAccount;
    renderTop();
    renderPlaybar();
    renderBuilds();
    refreshInstalled();
    loadVersions();
    setInterval(() => loadVersions(true), 30 * 60 * 1000);
    api.java.detect(false).then((list) => { S.javas = list; S.javasLoaded = true; if (S.page === 'settings') renderSettings(); });
    // Открываем ту страницу, на которой лаунчер закрыли в прошлый раз.
    const last = S.settings.lastPage || lsGet('lastPage', 'home');
    if (PAGES.includes(last)) go(last, { remember: false });
  }

  init();
})();
