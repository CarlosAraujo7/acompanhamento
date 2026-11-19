/* Estado do aplicativo + motor de sincronização.
 *
 * Ideia central:
 *   base  = o que o servidor disse por último (a "verdade")
 *   data  = base + alterações minhas ainda não confirmadas (é o que a tela mostra)
 * Assim, quando chegam mudanças da outra pessoa, nada do que eu acabei de fazer se perde.
 */
(function (SA) {
  'use strict';
  const U = SA.util;
  const api = SA.api;
  const hooks = window.preactHooks;

  const PART_BYTES = 4 * 1024 * 1024; // igual ao PART_BYTES do Code.gs
  const TABLES = ['items', 'tabs', 'checks', 'files'];
  const SESSION_KEY = 'sa.session';
  const CREATE_ONLY = { tabs: ['itemId', 'type'], checks: ['itemId', 'tabId'] };
  const DEFAULTS = {
    items: { status: 'todo', due: '', kind: '', party: '', value: null, paid: false, assignee: '', description: '' },
    tabs: { name: '', order: 0, content: '', version: 1 },
    checks: { text: '', done: false, doneBy: '', doneAt: '', order: 0 },
    files: {},
  };

  const emptyData = () => ({ items: [], tabs: [], checks: [], files: [], log: [] });

  /* ======================= índices (consultas rápidas) ======================= */
  function group(list, key) {
    const m = new Map();
    list.forEach(function (r) {
      const k = r[key];
      if (!k) return;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    });
    return m;
  }
  function byId(list) {
    const m = new Map();
    list.forEach(function (r) { m.set(r.id, r); });
    return m;
  }
  function buildIndex(d) {
    const tabsByItem = group(d.tabs, 'itemId');
    tabsByItem.forEach(function (l) { l.sort(U.byOrder); });
    const checksByTab = group(d.checks, 'tabId');
    checksByTab.forEach(function (l) { l.sort(U.byOrder); });
    const filesByTab = group(d.files, 'tabId');
    const filesByCheck = group(d.files, 'checkId');
    [filesByTab, filesByCheck].forEach(function (m) {
      m.forEach(function (l) { l.sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); }); });
    });
    return {
      item: byId(d.items), tab: byId(d.tabs), check: byId(d.checks), file: byId(d.files),
      tabsByItem: tabsByItem, checksByTab: checksByTab, checksByItem: group(d.checks, 'itemId'),
      filesByTab: filesByTab, filesByCheck: filesByCheck, filesByItem: group(d.files, 'itemId'),
    };
  }

  /* ======================= aplicar alterações localmente ===================== */
  function cascade(d, table, id) {
    let items = d.items, tabs = d.tabs, checks = d.checks, files = d.files;
    if (table === 'items') {
      items = items.filter(function (r) { return r.id !== id; });
      tabs = tabs.filter(function (r) { return r.itemId !== id; });
      checks = checks.filter(function (r) { return r.itemId !== id; });
      files = files.filter(function (r) { return r.itemId !== id; });
    } else if (table === 'tabs') {
      tabs = tabs.filter(function (r) { return r.id !== id; });
      checks = checks.filter(function (r) { return r.tabId !== id; });
      files = files.filter(function (r) { return r.tabId !== id; });
    } else if (table === 'checks') {
      checks = checks.filter(function (r) { return r.id !== id; });
      files = files.filter(function (r) { return r.checkId !== id; });
    } else if (table === 'files') {
      files = files.filter(function (r) { return r.id !== id; });
    }
    return { items: items, tabs: tabs, checks: checks, files: files, log: d.log };
  }

  function applyOpLocal(d, op, uid, at, env) {
    const t = op.table;
    if (TABLES.indexOf(t) < 0) return d;
    if (op.op === 'del') return cascade(d, t, op.id);
    const list = d[t];
    const f = op.f || {};
    const idx = list.findIndex(function (r) { return r.id === op.id; });
    let next;
    if (idx >= 0) {
      const old = list[idx];
      const rec = Object.assign({}, old);
      Object.keys(f).forEach(function (k) {
        if (CREATE_ONLY[t] && CREATE_ONLY[t].indexOf(k) >= 0) return;
        rec[k] = f[k];
      });
      if (t === 'tabs' && 'content' in f) rec.version = (old.version || 1) + 1;
      if (t === 'checks' && 'done' in f && !!f.done !== !!old.done) {
        rec.doneBy = f.done ? uid : '';
        rec.doneAt = f.done ? at : '';
      }
      rec.updatedBy = uid;
      rec.updatedAt = at;
      next = list.map(function (r, i) { return i === idx ? rec : r; });
    } else {
      const rec = Object.assign({ id: op.id, env: env, createdBy: uid, createdAt: at }, DEFAULTS[t], f, { updatedBy: uid, updatedAt: at });
      if (t === 'tabs' && rec.type !== 'notes') rec.content = '';
      if (t === 'checks' && rec.done) { rec.doneBy = uid; rec.doneAt = at; }
      next = list.concat([rec]);
    }
    const out = Object.assign({}, d);
    out[t] = next;
    return out;
  }

  function upsertRec(d, table, rec) {
    const list = d[table];
    const i = list.findIndex(function (r) { return r.id === rec.id; });
    const out = Object.assign({}, d);
    out[table] = i >= 0 ? list.map(function (r, k) { return k === i ? rec : r; }) : list.concat([rec]);
    return out;
  }

  function normalize(data) {
    const d = emptyData();
    Object.keys(d).forEach(function (k) { d[k] = Array.isArray(data && data[k]) ? data[k] : []; });
    return d;
  }

  /* ======================= estado ======================= */
  function parseHash() {
    const parts = String(location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map(function (x) {
      try { return decodeURIComponent(x); } catch (e) { return x; }
    });
    return { env: parts[0] || '', itemId: parts[1] || '', tabId: parts[2] || '' };
  }

  let outbox = [];
  let state = {
    session: null,
    users: [],
    env: null,
    base: emptyData(),
    data: emptyData(),
    ix: buildIndex(emptyData()),
    rev: -1,
    loaded: false,
    sync: { status: 'idle', lastOkAt: 0, error: '' },
    pending: 0,
    uploads: [],
    downloads: {},
    conflicts: {},
    toasts: [],
    dialog: null,
    route: parseHash(),
    notice: '',
    seenTs: '',
  };
  const listeners = new Set();
  function set(patch) {
    state = Object.assign({}, state, patch);
    listeners.forEach(function (fn) { fn(); });
  }
  function useStore() {
    const pair = hooks.useState(0);
    const bump = pair[1];
    hooks.useEffect(function () {
      const fn = function () { bump(function (n) { return n + 1; }); };
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    }, []);
    return state;
  }
  const getState = () => state;

  function recompute() {
    let d = state.base;
    const uid = state.session ? state.session.user.id : '';
    outbox.forEach(function (o) { d = applyOpLocal(d, o.op, uid, o.at, state.env); });
    set({ data: d, ix: buildIndex(d), pending: outbox.length });
    persistOutbox();
  }

  /* A fila de alterações não enviadas fica guardada no aparelho: se a internet cair e a aba for
     fechada, o que foi feito ainda é enviado na próxima vez que o sistema abrir. */
  function outboxKey(uid, env) { return 'sa.outbox.' + uid + '.' + env; }
  function persistOutbox() {
    if (!state.session || !state.env) return;
    const key = outboxKey(state.session.user.id, state.env);
    if (!outbox.length) U.store.del(key);
    else U.store.set(key, outbox.map(function (o) { return { op: o.op, at: o.at, notes: o.notes || null }; }));
  }
  function loadOutbox(uid, env) {
    const saved = U.store.get(outboxKey(uid, env), []);
    return (Array.isArray(saved) ? saved : []).filter(function (o) { return o && o.op && o.op.table; })
      .map(function (o) { return { op: o.op, at: o.at, notes: o.notes || null, sent: false }; });
  }

  /* ======================= avisos e diálogos ======================= */
  let toastSeq = 0;
  function toast(msg, kind) {
    const id = ++toastSeq;
    set({ toasts: state.toasts.concat([{ id: id, msg: msg, kind: kind || 'info' }]) });
    setTimeout(function () { dismissToast(id); }, kind === 'error' ? 8000 : 4500);
  }
  function dismissToast(id) {
    set({ toasts: state.toasts.filter(function (t) { return t.id !== id; }) });
  }
  function confirmDialog(opts) {
    return new Promise(function (resolve) { set({ dialog: Object.assign({}, opts, { resolve: resolve }) }); });
  }
  function closeDialog(result) {
    const d = state.dialog;
    set({ dialog: null });
    if (d && d.resolve) d.resolve(result);
  }

  /* ======================= sessão ======================= */
  function loadSession() {
    const s = U.store.get(SESSION_KEY, null) || U.store.get(SESSION_KEY, null, true);
    return s && s.exp && s.exp > Date.now() && s.token && s.user ? s : null;
  }
  function saveSession(s) {
    U.store.del(SESSION_KEY);
    U.store.set(SESSION_KEY, s, !s.remember);
  }
  function cacheKey(uid, env) { return 'sa.cache.' + uid + '.' + env; }
  function seenKey() { return 'sa.seen.' + state.session.user.id + '.' + state.env; }

  async function login(username, password, remember) {
    const res = await api.call({ a: 'login', u: username, p: password, remember: !!remember }, { timeout: 60000 });
    const session = { token: res.token, exp: res.exp, user: res.user, users: res.users || [], remember: !!remember };
    saveSession(session);
    set({ session: session, users: session.users, notice: '' });
    const last = U.store.get('sa.lastEnv.' + session.user.id, '');
    const want = [state.route.env, last].concat(session.user.envs).filter(function (e) { return e && session.user.envs.indexOf(e) >= 0; })[0];
    await enterEnv(want, true);
  }

  /* "discard": quem clicou em Sair abre mão do que ainda não foi enviado. Quando a sessão apenas
     expira, as alterações pendentes ficam guardadas para a próxima entrada. */
  function logout(notice, discard) {
    stopPolling();
    const uid = state.session && state.session.user.id;
    U.store.del(SESSION_KEY);
    if (uid) Object.keys(SA.ENVS).forEach(function (e) {
      U.store.del(cacheKey(uid, e));
      if (discard) U.store.del(outboxKey(uid, e));
    });
    outbox = [];
    running = false; again = false; wantPoll = false;
    set({
      session: null, users: [], env: null, base: emptyData(), data: emptyData(), ix: buildIndex(emptyData()),
      rev: -1, loaded: false, pending: 0, uploads: [], conflicts: {}, dialog: null,
      sync: { status: 'idle', lastOkAt: 0, error: '' }, notice: notice || '',
    });
    if (location.hash !== '#/') location.hash = '#/';
  }

  /* ======================= entrar em um ambiente ======================= */
  function waitIdle(ms) {
    return new Promise(function (resolve) {
      const t0 = Date.now();
      (function check() {
        if ((!running && !outbox.length) || Date.now() - t0 > ms) resolve();
        else setTimeout(check, 100);
      })();
    });
  }

  async function enterEnv(env, force) {
    const s = state.session;
    if (!s || !env || s.user.envs.indexOf(env) < 0) return false;
    if (state.env === env && !force) return true;
    if (state.env && (outbox.length || running)) {
      requestSync();
      await waitIdle(12000);
      if (outbox.length) { toast('Ainda há alterações sendo enviadas. Aguarde um instante e tente de novo.', 'error'); return false; }
    }
    stopPolling();
    outbox = loadOutbox(s.user.id, env);
    const cached = U.store.get(cacheKey(s.user.id, env), null);
    const base = cached && cached.data ? normalize(cached.data) : emptyData();
    set({ env: env, base: base, rev: cached && typeof cached.rev === 'number' ? cached.rev : -1, loaded: !!cached, conflicts: {}, uploads: [] });
    set({ seenTs: U.store.get(seenKey(), '') });
    recompute();
    U.store.set('sa.lastEnv.' + s.user.id, env);
    startPolling();
    requestSync({ poll: true });
    return true;
  }

  /* ======================= motor de sincronização ======================= */
  let running = false, again = false, wantPoll = false, retryTimer = null, retryDelay = 3000, pollTimer = null;

  function startPolling() {
    stopPolling();
    const ms = Math.max(5, Number(SA.config.POLL_SECONDS) || 15) * 1000;
    pollTimer = setInterval(function () {
      if (document.visibilityState === 'visible') requestSync({ poll: true });
    }, ms);
  }
  function stopPolling() {
    clearInterval(pollTimer);
    clearTimeout(retryTimer);
    pollTimer = null;
  }

  function requestSync(opts) {
    if (opts && opts.poll) wantPoll = true;
    if (!state.session || !state.env) return;
    if (running) { again = true; return; }
    cycle();
  }

  async function cycle() {
    running = true;
    try {
      do {
        again = false;
        if (outbox.some(function (o) { return !o.sent; })) await flushOnce();
        else if (wantPoll) { wantPoll = false; await pollOnce(); }
      } while (state.session && (again || wantPoll || outbox.some(function (o) { return !o.sent; })));
      retryDelay = 3000;
      if (state.session) set({ sync: { status: 'ok', lastOkAt: Date.now(), error: '' } });
    } catch (e) {
      handleSyncError(e);
    } finally {
      running = false;
    }
  }

  function handleSyncError(e) {
    outbox.forEach(function (o) { o.sent = false; });
    if (e && e.code === 'auth') { logout((e && e.message) || 'Sua sessão expirou. Entre novamente.'); return; }
    if (!state.session) return;
    const offline = !!(e && e.code === 'network');
    set({ sync: { status: offline ? 'offline' : 'error', lastOkAt: state.sync.lastOkAt, error: (e && e.message) || 'Falha ao sincronizar.' } });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(function () { requestSync({ poll: true }); }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }

  async function flushOnce() {
    const batch = outbox.filter(function (o) { return !o.sent; }).slice(0, 40);
    if (!batch.length) return;
    batch.forEach(function (o) { o.sent = true; });
    set({ sync: Object.assign({}, state.sync, { status: 'syncing' }) });
    const env = state.env;
    let notes = [];
    batch.forEach(function (b) { if (b.notes) notes = notes.concat(b.notes); });
    let res;
    try {
      res = await api.call({ a: 'save', t: state.session.token, env: env, ops: batch.map(function (b) { return b.op; }), notes: notes });
    } catch (e) {
      batch.forEach(function (o) { o.sent = false; });
      if (e.code === 'bad_request' || e.code === 'forbidden') {
        outbox = outbox.filter(function (o) { return batch.indexOf(o) < 0; });
        wantPoll = true;
        recompute();
        toast(e.message, 'error');
        return;
      }
      throw e;
    }
    if (state.env !== env) return;
    let base = state.base;
    const errors = [];
    const conflicts = Object.assign({}, state.conflicts);
    batch.forEach(function (b, i) {
      const r = (res.results || [])[i] || {};
      if (r.ok) {
        if (r.rec) base = upsertRec(base, r.table, r.rec);
        else if (r.gone) base = cascade(base, r.table, r.id);
      } else if (r.error === 'conflict' && r.current) {
        base = upsertRec(base, 'tabs', r.current);
        const mine = b.op.f && b.op.f.content;
        if (mine !== r.current.content) conflicts[r.id] = { mine: mine, theirs: r.current };
        // descarta outros envios pendentes do mesmo texto
        outbox.forEach(function (o) {
          if (!o.sent && o.op.table === 'tabs' && o.op.id === r.id && o.op.f && 'content' in o.op.f) o.drop = true;
        });
      } else {
        errors.push(r.message || 'Não foi possível salvar uma alteração.');
      }
    });
    outbox = outbox.filter(function (o) { return batch.indexOf(o) < 0 && !o.drop; });
    let rev = state.rev;
    if (res.bumped ? res.rev === rev + 1 : res.rev === rev) rev = res.rev;
    else wantPoll = true;
    set({ base: base, rev: rev, conflicts: conflicts });
    recompute();
    persistCache();
    if (errors.length) {
      wantPoll = true;
      toast(errors[0] + (errors.length > 1 ? ' (+' + (errors.length - 1) + ' alterações)' : ''), 'error');
    }
  }

  async function pollOnce() {
    const env = state.env;
    const res = await api.call({ a: 'poll', t: state.session.token, env: env, rev: state.rev }, { timeout: 45000 });
    if (state.env !== env) return;
    if (res.users && JSON.stringify(res.users) !== JSON.stringify(state.users)) {
      const session = Object.assign({}, state.session, { users: res.users });
      saveSession(session);
      set({ users: res.users, session: session });
    }
    if (res.changed) applySnapshot(res.data, res.rev);
    else if (res.rev !== state.rev) set({ rev: res.rev });
    if (!state.loaded) set({ loaded: true });
  }

  function applySnapshot(data, rev) {
    const wasLoaded = state.loaded;
    const prevLog = state.base.log;
    const prevNewest = prevLog.length ? prevLog[prevLog.length - 1].ts : '';
    const base = normalize(data);
    set({ base: base, rev: rev, loaded: true });
    recompute();
    persistCache();
    if (!state.seenTs) markActivitySeen(); // primeira visita: o que já existe não é "novidade"
    if (!wasLoaded) return;
    const me = state.session.user.id;
    const fresh = base.log.filter(function (l) { return l.user !== me && l.ts > prevNewest; });
    if (fresh.length) {
      const last = fresh[fresh.length - 1];
      toast(fresh.length === 1 ? userName(last.user) + ' ' + last.text : fresh.length + ' novidades de ' + fresh.map(function (l) { return userName(l.user); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' e '), 'info');
    }
  }

  function persistCache() {
    if (!state.session || !state.env || !state.loaded) return;
    U.store.set(cacheKey(state.session.user.id, state.env), { rev: state.rev, data: state.base });
  }

  function mutate(ops, notes) {
    const at = new Date().toISOString();
    ops.forEach(function (op, i) { outbox.push({ op: op, at: at, sent: false, notes: i === 0 ? notes || null : null }); });
    recompute();
    requestSync();
  }

  /* ======================= nomes e consultas ======================= */
  function userName(id) {
    if (!id) return '';
    const u = state.users.filter(function (x) { return x.id === id; })[0];
    return u ? u.name : id;
  }
  const sel = {
    item: (id) => state.ix.item.get(id) || null,
    tab: (id) => state.ix.tab.get(id) || null,
    tabs: (itemId) => state.ix.tabsByItem.get(itemId) || [],
    checks: (tabId) => state.ix.checksByTab.get(tabId) || [],
    files: (tabId) => (state.ix.filesByTab.get(tabId) || []).filter(function (f) { return !f.checkId; }),
    checkFiles: (checkId) => state.ix.filesByCheck.get(checkId) || [],
    fileCount: (itemId) => (state.ix.filesByItem.get(itemId) || []).length,
    progress: function (itemId) {
      const list = state.ix.checksByItem.get(itemId) || [];
      return { done: list.filter(function (c) { return c.done; }).length, total: list.length };
    },
  };
  function isPending(table, id) {
    return outbox.some(function (o) { return o.op.table === table && o.op.id === id; });
  }
  function itemTitle(id) { const it = sel.item(id); return it ? it.title : ''; }
  function nextOrder(list) { return list.reduce(function (m, r) { return Math.max(m, r.order || 0); }, 0) + 1; }

  /* ======================= ações: demandas / atividades ======================= */
  function createItem(fields) {
    const cfg = SA.ENVS[state.env];
    const id = U.uid('i');
    const ops = [{ op: 'put', table: 'items', id: id, f: fields }];
    cfg.defaultTabs.forEach(function (t, k) {
      ops.push({ op: 'put', table: 'tabs', id: U.uid('t'), f: { itemId: id, type: t.type, name: t.name, order: k + 1 } });
    });
    mutate(ops, [{ item: id, text: 'criou ' + (cfg.itemSingular === 'demanda' ? 'a demanda' : 'a atividade') + ' "' + fields.title + '"' }]);
    return id;
  }

  function updateItem(id, patch) {
    const cfg = SA.ENVS[state.env];
    const it = sel.item(id);
    if (!it) return;
    const f = {};
    Object.keys(patch).forEach(function (k) { if (patch[k] !== it[k] && !(patch[k] == null && it[k] == null)) f[k] = patch[k]; });
    const keys = Object.keys(f);
    if (!keys.length) return;
    let text;
    if (keys.length === 1 && keys[0] === 'status') text = 'mudou "' + it.title + '" para ' + cfg.statuses[f.status];
    else if (keys.length === 1 && keys[0] === 'paid') text = 'marcou "' + it.title + '" como ' + (f.paid ? 'pago' : 'não pago');
    else text = 'editou "' + it.title + '"';
    mutate([{ op: 'put', table: 'items', id: id, f: f }], [{ item: id, text: text }]);
  }

  function deleteItem(id) {
    const cfg = SA.ENVS[state.env];
    const title = itemTitle(id);
    mutate([{ op: 'del', table: 'items', id: id }], [{ item: id, text: 'excluiu ' + (cfg.itemSingular === 'demanda' ? 'a demanda' : 'a atividade') + ' "' + title + '"' }]);
  }

  /* ======================= ações: abas ======================= */
  function addTab(itemId, name, type) {
    const id = U.uid('t');
    mutate([{ op: 'put', table: 'tabs', id: id, f: { itemId: itemId, type: type, name: name, order: nextOrder(sel.tabs(itemId)) } }],
      [{ item: itemId, text: 'criou a aba "' + name + '" em "' + itemTitle(itemId) + '"' }]);
    return id;
  }
  function renameTab(tabId, name) {
    const tab = sel.tab(tabId);
    if (!tab || tab.name === name) return;
    mutate([{ op: 'put', table: 'tabs', id: tabId, f: { name: name } }], [{ item: tab.itemId, text: 'renomeou a aba "' + tab.name + '" para "' + name + '"' }]);
  }
  function deleteTab(tabId) {
    const tab = sel.tab(tabId);
    if (!tab) return;
    mutate([{ op: 'del', table: 'tabs', id: tabId }], [{ item: tab.itemId, text: 'excluiu a aba "' + tab.name + '" de "' + itemTitle(tab.itemId) + '"' }]);
  }

  /* ======================= ações: checklist ======================= */
  function addCheck(itemId, tabId, text) {
    const id = U.uid('c');
    mutate([{ op: 'put', table: 'checks', id: id, f: { itemId: itemId, tabId: tabId, text: text, order: nextOrder(sel.checks(tabId)) } }],
      [{ item: itemId, text: 'adicionou "' + text + '" ao checklist de "' + itemTitle(itemId) + '"' }]);
    return id;
  }
  function setCheckDone(id, done) {
    const c = state.ix.check.get(id);
    if (!c) return;
    mutate([{ op: 'put', table: 'checks', id: id, f: { done: !!done } }],
      [{ item: c.itemId, text: (done ? 'marcou como pronto' : 'reabriu') + ' "' + c.text + '" (' + itemTitle(c.itemId) + ')' }]);
  }
  function editCheck(id, text) {
    const c = state.ix.check.get(id);
    if (!c || c.text === text) return;
    mutate([{ op: 'put', table: 'checks', id: id, f: { text: text } }], [{ item: c.itemId, text: 'editou o item "' + text + '" (' + itemTitle(c.itemId) + ')' }]);
  }
  function deleteCheck(id) {
    const c = state.ix.check.get(id);
    if (!c) return;
    mutate([{ op: 'del', table: 'checks', id: id }], [{ item: c.itemId, text: 'removeu o item "' + c.text + '" (' + itemTitle(c.itemId) + ')' }]);
  }

  /* ======================= ações: texto (com controle de versão) ======================= */
  function saveNote(tabId, content, baseVersion) {
    const tab = sel.tab(tabId);
    if (!tab) return;
    const pend = outbox.filter(function (o) {
      return !o.sent && o.op.table === 'tabs' && o.op.id === tabId && o.op.f && 'content' in o.op.f;
    })[0];
    if (pend) { pend.op.f.content = content; recompute(); requestSync(); return; }
    mutate([{ op: 'put', table: 'tabs', id: tabId, base: baseVersion, f: { content: content } }],
      [{ item: tab.itemId, text: 'atualizou o texto "' + tab.name + '" em "' + itemTitle(tab.itemId) + '"' }]);
  }

  /* Resolve um conflito de texto. "mineText" é o que está na tela agora (pode ser mais novo que
     o que foi enviado). Devolve o que o editor deve mostrar. */
  function resolveConflict(tabId, choice, mineText) {
    const c = state.conflicts[tabId];
    if (!c) return null;
    const rest = Object.assign({}, state.conflicts);
    delete rest[tabId];
    set({ conflicts: rest });
    if (choice === 'theirs') return { text: c.theirs.content, version: c.theirs.version };
    const mine = typeof mineText === 'string' ? mineText : c.mine;
    const text = choice === 'both' ? c.theirs.content + '\n\n——— versão que eu estava escrevendo ———\n' + mine : mine;
    saveNote(tabId, text, c.theirs.version);
    return { text: text, version: c.theirs.version + 1 };
  }

  /* ======================= ações: arquivos ======================= */
  function deleteFile(id) {
    const f = state.ix.file.get(id);
    if (!f) return;
    mutate([{ op: 'del', table: 'files', id: id }], [{ item: f.itemId, text: 'removeu o arquivo "' + f.name + '" (' + itemTitle(f.itemId) + ')' }]);
  }

  function patchUpload(uid, patch) {
    set({ uploads: state.uploads.map(function (u) { return u.uid === uid ? Object.assign({}, u, patch) : u; }) });
  }
  function dropUpload(uid) {
    set({ uploads: state.uploads.filter(function (u) { return u.uid !== uid; }) });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function sendPart(payload) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await api.call(payload, { timeout: 180000 }); } catch (e) {
        lastErr = e;
        if (e.code !== 'network') break; // erro do servidor: repetir não adianta
        await sleep(1500 * (attempt + 1));
      }
    }
    throw lastErr;
  }

  async function uploadOne(file, target) {
    const maxMb = Number(SA.config.MAX_UPLOAD_MB) || 50;
    if (file.size > maxMb * 1024 * 1024) {
      toast('"' + file.name + '" tem ' + U.fmtBytes(file.size) + ' e passa do limite de ' + maxMb + ' MB.', 'error');
      return;
    }
    const env = state.env;
    const token = state.session.token;
    const uid = U.uid('u');
    const n = Math.max(1, Math.ceil(file.size / PART_BYTES));
    set({ uploads: state.uploads.concat([{ uid: uid, name: file.name, size: file.size, loaded: 0, part: 1, parts: n, status: 'uploading', itemId: target.itemId, tabId: target.tabId, checkId: target.checkId || '', error: '' }]) });
    try {
      const parts = [];
      for (let i = 0; i < n; i++) {
        patchUpload(uid, { part: i + 1 });
        const blob = file.slice(i * PART_BYTES, Math.min(file.size, (i + 1) * PART_BYTES));
        const data = await U.blobToBase64(blob);
        const res = await sendPart({ a: 'putpart', t: token, env: env, itemId: target.itemId, name: file.name, mime: file.type || '', i: i, n: n, data: data });
        parts.push(res.driveId);
        patchUpload(uid, { loaded: Math.min(file.size, (i + 1) * PART_BYTES) });
      }
      const where = itemTitle(target.itemId);
      const res = await api.call({
        a: 'addfile', t: token, env: env, id: U.uid('f'), itemId: target.itemId, tabId: target.tabId, checkId: target.checkId || '',
        name: file.name, mime: file.type || '', parts: parts, notes: [{ item: target.itemId, text: 'enviou o arquivo "' + file.name + '"' + (where ? ' em "' + where + '"' : '') }],
      });
      if (state.env === env) {
        set({ base: upsertRec(state.base, 'files', res.rec) });
        recompute();
        wantPoll = true;
        requestSync();
      }
      dropUpload(uid);
    } catch (e) {
      if (e && e.code === 'auth') { logout(e.message); return; }
      patchUpload(uid, { status: 'error', error: (e && e.message) || 'Falha no envio.' });
      toast('Não foi possível enviar "' + file.name + '": ' + ((e && e.message) || 'erro desconhecido'), 'error');
      setTimeout(function () { dropUpload(uid); }, 12000);
    }
  }

  async function uploadFiles(fileList, target) {
    const files = Array.prototype.slice.call(fileList || []);
    for (let i = 0; i < files.length; i++) await uploadOne(files[i], target);
  }

  async function downloadFile(file) {
    const env = state.env;
    const token = state.session.token;
    set({ downloads: Object.assign({}, state.downloads, { [file.id]: { i: 0, n: 1 } }) });
    try {
      const chunks = [];
      let n = 1;
      for (let i = 0; i < n; i++) {
        const res = await api.call({ a: 'getpart', t: token, env: env, id: file.id, i: i }, { timeout: 120000 });
        n = res.n;
        chunks.push(U.base64ToBytes(res.data));
        set({ downloads: Object.assign({}, state.downloads, { [file.id]: { i: i + 1, n: n } }) });
      }
      const blob = new Blob(chunks, { type: file.mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    } catch (e) {
      if (e && e.code === 'auth') logout(e.message);
      else toast('Não foi possível baixar "' + file.name + '": ' + ((e && e.message) || 'erro desconhecido'), 'error');
    } finally {
      const rest = Object.assign({}, state.downloads);
      delete rest[file.id];
      set({ downloads: rest });
    }
  }

  /* ======================= atividade recente ======================= */
  function unreadCount() {
    if (!state.session) return 0;
    const me = state.session.user.id;
    return state.data.log.filter(function (l) { return l.user !== me && l.ts > state.seenTs; }).length;
  }
  function markActivitySeen() {
    const log = state.data.log;
    if (!log.length || !state.session) return;
    const newest = log[log.length - 1].ts;
    if (newest > state.seenTs) {
      set({ seenTs: newest });
      U.store.set(seenKey(), newest);
    }
  }

  /* ======================= rotas ======================= */
  function navigate(env, itemId, tabId) {
    const h = '#/' + [env, itemId, tabId].filter(Boolean).map(encodeURIComponent).join('/');
    if (location.hash === h) onHashChange(); else location.hash = h;
  }
  function onHashChange() {
    const route = parseHash();
    set({ route: route });
    if (state.session && route.env && route.env !== state.env && state.session.user.envs.indexOf(route.env) >= 0) {
      enterEnv(route.env).then(function (ok) {
        if (!ok && state.env) navigate(state.env);
      });
    }
  }

  function init() {
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') requestSync({ poll: true });
    });
    window.addEventListener('online', function () { retryDelay = 3000; requestSync({ poll: true }); });
    window.addEventListener('beforeunload', function (e) {
      if (outbox.length || state.uploads.some(function (u) { return u.status === 'uploading'; })) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    const s = loadSession();
    if (s) {
      set({ session: s, users: s.users || [] });
      const last = U.store.get('sa.lastEnv.' + s.user.id, '');
      const want = [state.route.env, last].concat(s.user.envs).filter(function (e) { return e && s.user.envs.indexOf(e) >= 0; })[0];
      enterEnv(want, true).then(function () {
        if (!state.route.env || state.route.env !== state.env) navigate(state.env);
      });
    }
  }

  SA.store = {
    useStore: useStore, getState: getState, set: set, init: init,
    login: login, logout: logout, enterEnv: enterEnv, navigate: navigate, requestSync: requestSync,
    createItem: createItem, updateItem: updateItem, deleteItem: deleteItem,
    addTab: addTab, renameTab: renameTab, deleteTab: deleteTab,
    addCheck: addCheck, setCheckDone: setCheckDone, editCheck: editCheck, deleteCheck: deleteCheck,
    saveNote: saveNote, resolveConflict: resolveConflict,
    deleteFile: deleteFile, uploadFiles: uploadFiles, downloadFile: downloadFile,
    userName: userName, unreadCount: unreadCount, markActivitySeen: markActivitySeen,
    toast: toast, dismissToast: dismissToast, confirm: confirmDialog, closeDialog: closeDialog,
    isPending: isPending, sel: sel,
  };
})((window.SA = window.SA || {}));
