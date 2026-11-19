/* Telas: login, cabeçalho, lista (quadro/agenda), formulário e atividade recente. */
(function (SA) {
  'use strict';
  const U = SA.util, html = SA.html, store = SA.store, sel = store.sel;
  const ui = SA.ui;
  const Icon = ui.Icon, Modal = ui.Modal, Avatar = ui.Avatar, StatusSelect = ui.StatusSelect, Segmented = ui.Segmented;
  const hooks = window.preactHooks;
  const useState = hooks.useState, useEffect = hooks.useEffect, useMemo = hooks.useMemo, useRef = hooks.useRef;

  /* ======================= login ======================= */
  function Login() {
    const s = store.useStore();
    const [user, setUser] = useState(U.store.get('sa.lastUser', ''));
    const [pass, setPass] = useState('');
    const [show, setShow] = useState(false);
    const [remember, setRemember] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const configured = !!String(SA.config.API_URL || '').trim();

    async function submit(e) {
      e.preventDefault();
      if (busy) return;
      if (!user.trim() || !pass) { setError('Informe o usuário e a senha.'); return; }
      setBusy(true);
      setError('');
      try {
        U.store.set('sa.lastUser', user.trim());
        await store.login(user.trim(), pass, remember);
      } catch (err) {
        setError((err && err.message) || 'Não foi possível entrar.');
        setBusy(false);
      }
    }

    return html`
      <main class="login">
        <form class="login-card" onSubmit=${submit} noValidate>
          <div class="brand big"><span class="brand-mark"><${Icon} name="layers" size=${22} /></span><h1>Acompanhamento</h1></div>
          <p class="muted">Entre para ver suas demandas e atividades.</p>
          ${s.notice ? html`<div class="alert warn" role="status">${s.notice}</div>` : null}
          ${!configured ? html`<div class="alert danger" role="alert"><strong>Servidor não configurado.</strong> Abra o arquivo <code>config.js</code>, cole a URL do Google Apps Script em <code>API_URL</code> e publique de novo. O passo a passo está no README.</div>` : null}
          <label class="field">
            <span>Usuário</span>
            <input type="text" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" value=${user} onInput=${function (e) { setUser(e.target.value); }} data-autofocus />
          </label>
          <label class="field">
            <span>Senha</span>
            <div class="input-row">
              <input type=${show ? 'text' : 'password'} name="password" autocomplete="current-password" value=${pass} onInput=${function (e) { setPass(e.target.value); }} />
              <button type="button" class="icon-btn" onClick=${function () { setShow(!show); }} aria-label=${show ? 'Ocultar senha' : 'Mostrar senha'}><${Icon} name=${show ? 'eyeOff' : 'eye'} /></button>
            </div>
          </label>
          <label class="check-line"><input type="checkbox" checked=${remember} onChange=${function (e) { setRemember(e.target.checked); }} /> Manter conectado neste aparelho</label>
          ${error ? html`<div class="alert danger" role="alert">${error}</div>` : null}
          <button class="btn primary block" type="submit" disabled=${busy || !configured}>${busy ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </main>`;
  }

  /* ======================= cabeçalho ======================= */
  function SyncBadge() {
    const s = store.useStore();
    ui.useTick(20000);
    const st = s.sync.status;
    let icon = 'cloud', text = '', cls = '';
    if (st === 'offline') {
      text = s.pending ? 'Sem conexão · ' + (s.pending === 1 ? '1 alteração aguardando' : s.pending + ' alterações aguardando') : 'Sem conexão · tentando de novo';
      icon = 'cloudOff'; cls = 'bad';
    }
    else if (st === 'error') { text = s.sync.error || 'Erro ao sincronizar'; icon = 'alert'; cls = 'bad'; }
    else if (s.pending > 0 || st === 'syncing') { text = 'Salvando…'; icon = 'refresh'; cls = 'busy'; }
    else if (s.sync.lastOkAt) { text = 'Sincronizado ' + U.relTime(new Date(s.sync.lastOkAt).toISOString()); }
    else { text = 'Conectando…'; icon = 'refresh'; cls = 'busy'; }
    return html`<button type="button" class=${U.cx('sync', cls)} onClick=${function () { store.requestSync({ poll: true }); }} title="Buscar atualizações agora"><${Icon} name=${icon} size=${15} class=${cls === 'busy' ? 'spin' : ''} /><span>${text}</span></button>`;
  }

  function Header(props) {
    const s = store.useStore();
    const user = s.session.user;
    const unread = store.unreadCount();
    return html`
      <header class="topbar">
        <div class="topbar-in">
          <a class="brand" href=${'#/' + (s.env || '')} aria-label="Início"><span class="brand-mark"><${Icon} name="layers" size=${18} /></span><span class="brand-name">Acompanhamento</span></a>
          ${user.envs.length > 1 ? html`
            <nav class="env-tabs" aria-label="Ambientes">
              ${user.envs.map(function (id) {
                const cfg = SA.ENVS[id];
                return html`<button type="button" key=${id} class=${U.cx('env-tab', s.env === id && 'on')} aria-current=${s.env === id ? 'page' : 'false'} onClick=${function () { store.navigate(id); }}><${Icon} name=${cfg.icon} size=${16} /><span>${cfg.label}</span></button>`;
              })}
            </nav>` : html`<span class="env-label"><${Icon} name=${SA.ENVS[s.env] ? SA.ENVS[s.env].icon : 'layers'} size=${16} />${SA.ENVS[s.env] ? SA.ENVS[s.env].label : ''}</span>`}
          <div class="spacer"></div>
          <${SyncBadge} />
          <button type="button" class="icon-btn bell" onClick=${props.onActivity} aria-label=${'Atividade recente' + (unread ? ' (' + unread + ' novas)' : '')} title="Atividade recente">
            <${Icon} name="bell" />${unread ? html`<span class="dot">${unread > 9 ? '9+' : unread}</span>` : null}
          </button>
          <span class="who" title=${user.name}><${Avatar} name=${user.name} size=${28} /><span class="who-name">${user.name}</span></span>
          <button type="button" class="icon-btn" onClick=${async function () {
            const busy = s.pending > 0 || s.uploads.some(function (u) { return u.status === 'uploading'; });
            if (busy) {
              const ok = await store.confirm({ title: 'Sair agora?', message: 'Ainda há alterações ou arquivos sendo enviados. Se você sair agora, eles serão perdidos.', confirmLabel: 'Sair mesmo assim', danger: true });
              if (!ok) return;
            }
            store.logout('', true);
          }} aria-label="Sair" title="Sair"><${Icon} name="logout" /></button>
        </div>
      </header>`;
  }

  /* ======================= atividade recente ======================= */
  function ActivityPanel(props) {
    const s = store.useStore();
    useEffect(function () { store.markActivitySeen(); }, [s.data.log.length]);
    const entries = s.data.log.slice().reverse();
    const days = [];
    entries.forEach(function (l) {
      const label = U.dayLabel(l.ts);
      let g = days[days.length - 1];
      if (!g || g.label !== label) { g = { label: label, items: [] }; days.push(g); }
      g.items.push(l);
    });
    return html`
      <${Modal} title="Atividade recente" onClose=${props.onClose} side=${true}>
        ${!entries.length ? html`<p class="muted">Nada por aqui ainda. Quando você ou a outra pessoa mexerem em algo, aparece nesta lista.</p>` : days.map(function (g) {
          return html`<section class="act-day" key=${g.label}>
            <h3>${g.label}</h3>
            <ul class="act-list">
              ${g.items.map(function (l, i) {
                const exists = l.itemId && sel.item(l.itemId);
                const name = store.userName(l.user);
                const body = html`<${Avatar} name=${name} size=${26} /><span class="act-text"><strong>${name}</strong> ${l.text}</span><time>${U.fmtTime(l.ts)}</time>`;
                return html`<li key=${l.ts + i}>${exists
                  ? html`<button type="button" class="act-row link" onClick=${function () { props.onClose(); store.navigate(s.env, l.itemId); }}>${body}</button>`
                  : html`<div class="act-row">${body}</div>`}</li>`;
              })}
            </ul>
          </section>`;
        })}
      <//>`;
  }

  /* ======================= formulário de demanda/atividade ======================= */
  function ItemForm(props) {
    const s = store.useStore();
    const cfg = SA.ENVS[s.env];
    const item = props.item;
    const editing = !!item;
    const [f, setF] = useState(function () {
      return {
        title: item ? item.title : '',
        party: item ? item.party : '',
        kind: item ? item.kind : (cfg.kindFree ? '' : cfg.kindOptions[0]),
        value: item && item.value != null ? String(item.value).replace('.', ',') : '',
        paid: item ? !!item.paid : false,
        due: item ? item.due : '',
        status: item ? item.status : 'todo',
        assignee: item ? item.assignee : '',
        description: item ? item.description : '',
      };
    });
    const [err, setErr] = useState({});
    const formRef = useRef(null);
    const upd = function (k, v) { setF(function (p) { return Object.assign({}, p, { [k]: v }); }); };
    const people = s.users.filter(function (u) { return u.envs.indexOf(s.env) >= 0; });
    const parties = useMemo(function () {
      return Array.from(new Set(s.data.items.map(function (i) { return i.party; }).filter(Boolean))).sort();
    }, [s.data.items]);
    const kinds = useMemo(function () {
      return Array.from(new Set(cfg.kindOptions.concat(s.data.items.map(function (i) { return i.kind; }).filter(Boolean))));
    }, [s.data.items, s.env]);
    const noun = cfg.itemSingular === 'demanda' ? 'a demanda' : 'a atividade';

    function submit(e) {
      e.preventDefault();
      const errors = {};
      const title = f.title.trim();
      if (!title) errors.title = 'Dê um nome para ' + noun + '.';
      if (cfg.partyRequired && !f.party.trim()) errors.party = 'Informe para quem é.';
      if (!f.kind.trim()) errors.kind = 'Preencha este campo.';
      const value = cfg.hasValue ? U.parseMoney(f.value) : null;
      if (cfg.hasValue && f.value.trim() && value === null) errors.value = 'Valor inválido. Exemplo: 350,00';
      if (Object.keys(errors).length) {
        setErr(errors);
        setTimeout(function () { const el = formRef.current && formRef.current.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }, 0);
        return;
      }
      const fields = { title: title, party: f.party.trim(), kind: f.kind.trim(), due: f.due, status: f.status, assignee: f.assignee, description: f.description.trim() };
      if (cfg.hasValue) { fields.value = value; fields.paid = f.paid; }
      if (editing) {
        store.updateItem(item.id, fields);
        props.onClose();
      } else {
        const id = store.createItem(fields);
        props.onClose();
        store.navigate(s.env, id);
      }
    }

    function Err(p) { return p.msg ? html`<span class="field-error" role="alert">${p.msg}</span>` : null; }

    return html`
      <${Modal} title=${editing ? 'Editar ' + cfg.itemSingular : cfg.newItem} onClose=${props.onClose} wide=${true}
        footer=${html`
          <button type="button" class="btn" onClick=${props.onClose}>Cancelar</button>
          <button type="submit" form="item-form" class="btn primary">${editing ? 'Salvar' : 'Criar ' + cfg.itemSingular}</button>`}>
        <form id="item-form" class="form-grid" onSubmit=${submit} ref=${formRef} noValidate>
          <label class="field span2">
            <span>Título</span>
            <input type="text" value=${f.title} maxlength="200" placeholder=${cfg.titlePlaceholder} onInput=${function (e) { upd('title', e.target.value); }} aria-invalid=${err.title ? 'true' : 'false'} data-autofocus />
            <${Err} msg=${err.title} />
          </label>
          <label class="field">
            <span>${cfg.partyLabel}</span>
            <input type="text" list="dl-parties" value=${f.party} maxlength="120" placeholder=${cfg.partyPlaceholder} onInput=${function (e) { upd('party', e.target.value); }} aria-invalid=${err.party ? 'true' : 'false'} />
            <datalist id="dl-parties">${parties.map(function (p) { return html`<option value=${p}></option>`; })}</datalist>
            <${Err} msg=${err.party} />
          </label>
          <label class="field">
            <span>${cfg.kindLabel}</span>
            ${cfg.kindFree
              ? html`<input type="text" list="dl-kinds" value=${f.kind} maxlength="80" placeholder=${cfg.kindPlaceholder} onInput=${function (e) { upd('kind', e.target.value); }} aria-invalid=${err.kind ? 'true' : 'false'} />
                     <datalist id="dl-kinds">${kinds.map(function (k) { return html`<option value=${k}></option>`; })}</datalist>`
              : html`<select value=${f.kind} onChange=${function (e) { upd('kind', e.target.value); }}>${kinds.map(function (k) { return html`<option value=${k}>${k}</option>`; })}</select>`}
            <${Err} msg=${err.kind} />
          </label>
          ${cfg.hasValue ? html`
            <label class="field">
              <span>Valor cobrado (R$)</span>
              <input type="text" inputmode="decimal" value=${f.value} placeholder="0,00" onInput=${function (e) { upd('value', e.target.value); }} aria-invalid=${err.value ? 'true' : 'false'} />
              <${Err} msg=${err.value} />
            </label>
            <label class="field check-field">
              <span>Pagamento</span>
              <span class="check-line"><input type="checkbox" checked=${f.paid} onChange=${function (e) { upd('paid', e.target.checked); }} /> Já foi pago</span>
            </label>` : null}
          <label class="field">
            <span>${cfg.dueLabel}</span>
            <input type="date" value=${f.due} onInput=${function (e) { upd('due', e.target.value); }} />
          </label>
          <label class="field">
            <span>Status</span>
            <select value=${f.status} onChange=${function (e) { upd('status', e.target.value); }}>
              ${SA.STATUS_IDS.map(function (id) { return html`<option value=${id}>${cfg.statuses[id]}</option>`; })}
            </select>
          </label>
          ${people.length > 1 ? html`
            <label class="field">
              <span>Responsável</span>
              <select value=${f.assignee} onChange=${function (e) { upd('assignee', e.target.value); }}>
                <option value="">Ninguém definido</option>
                ${people.map(function (u) { return html`<option value=${u.id}>${u.name}</option>`; })}
              </select>
            </label>` : null}
          <label class="field span2">
            <span>Observações <em>(opcional)</em></span>
            <textarea rows="3" maxlength="5000" value=${f.description} onInput=${function (e) { upd('description', e.target.value); }}></textarea>
          </label>
        </form>
      <//>`;
  }

  /* ======================= cartão ======================= */
  function ItemCard(props) {
    const s = store.useStore();
    const it = props.item;
    const cfg = SA.ENVS[s.env];
    const due = U.dueInfo(it.due, it.status);
    const prog = sel.progress(it.id);
    const files = sel.fileCount(it.id);
    const sub = [it.party, it.kind].filter(Boolean).join(' · ');
    const href = '#/' + encodeURIComponent(s.env) + '/' + encodeURIComponent(it.id);
    const byOther = it.updatedBy && it.updatedBy !== s.session.user.id;
    // O título é um link de verdade (teclado, leitor de tela, abrir em outra aba); o cartão todo também abre ao clicar.
    return html`
      <article class=${U.cx('card', 'st-' + it.status, props.row && 'row')}
        onClick=${function (e) { if (!e.target.closest('a, select, button, input')) store.navigate(s.env, it.id); }}>
        <div class="card-main">
          <h3 class="card-title"><a class="card-link" href=${href}>${it.title}</a></h3>
          ${sub ? html`<p class="card-sub">${sub}</p>` : null}
        </div>
        <div class="card-meta">
          <span class=${U.cx('due', 'tone-' + due.tone)}><${Icon} name="calendar" size=${14} />${due.label}</span>
          ${cfg.hasValue && it.value ? html`<span class=${U.cx('money', it.paid && 'paid')}>${U.fmtMoney(it.value)}${it.paid ? html` <em>pago</em>` : null}</span>` : null}
        </div>
        <div class="card-foot">
          <${StatusSelect} value=${it.status} env=${s.env} compact=${true} onChange=${function (v) { store.updateItem(it.id, { status: v }); }} />
          ${prog.total ? html`<span class="prog" title=${prog.done + ' de ' + prog.total + ' itens prontos'}><span class="prog-bar"><span style=${{ width: Math.round((prog.done / prog.total) * 100) + '%' }}></span></span>${prog.done}/${prog.total}</span>` : null}
          ${files ? html`<span class="muted-chip" title=${files + ' arquivo(s)'}><${Icon} name="paperclip" size=${13} />${files}</span>` : null}
          ${it.assignee ? html`<${Avatar} name=${store.userName(it.assignee)} size=${22} />` : null}
        </div>
        ${byOther ? html`<p class="card-by">Atualizado por ${store.userName(it.updatedBy)} · ${U.relTime(it.updatedAt)}</p>` : null}
      </article>`;
  }

  /* ======================= lista: resumo, filtros, quadro, agenda ======================= */
  function Summary(props) {
    const items = props.items;
    const cfg = props.cfg;
    const open = items.filter(function (i) { return i.status !== 'done'; });
    let tiles;
    if (cfg.hasValue) {
      const toReceive = items.filter(function (i) { return !i.paid; }).reduce(function (m, i) { return m + (Number(i.value) || 0); }, 0);
      const received = items.filter(function (i) { return i.paid; }).reduce(function (m, i) { return m + (Number(i.value) || 0); }, 0);
      tiles = [
        { label: 'Em aberto', value: String(open.length), hint: open.length === 1 ? 'demanda' : 'demandas' },
        { label: 'A receber', value: U.fmtMoney(toReceive), hint: 'ainda não pago' },
        { label: 'Recebido', value: U.fmtMoney(received), hint: 'já pago' },
      ];
    } else {
      const overdue = open.filter(function (i) { const d = U.daysFromToday(i.due); return d !== null && d < 0; }).length;
      const soon = open.filter(function (i) { const d = U.daysFromToday(i.due); return d !== null && d >= 0 && d <= 7; }).length;
      const doing = items.filter(function (i) { return i.status === 'doing'; }).length;
      tiles = [
        { label: 'Atrasadas', value: String(overdue), hint: 'precisam de atenção', tone: overdue ? 'danger' : '' },
        { label: 'Próximos 7 dias', value: String(soon), hint: 'com data marcada' },
        { label: 'Em andamento', value: String(doing), hint: 'sendo feitas agora' },
      ];
    }
    return html`<div class="summary">${tiles.map(function (t) {
      return html`<div class=${U.cx('tile', t.tone && 'tone-' + t.tone)} key=${t.label}><span class="tile-label">${t.label}</span><strong>${t.value}</strong><span class="tile-hint">${t.hint}</span></div>`;
    })}</div>`;
  }

  function byDue(a, b) {
    const da = a.due || '9999-99-99', db = b.due || '9999-99-99';
    return da.localeCompare(db) || String(a.title).localeCompare(String(b.title), 'pt-BR');
  }
  function bucketOf(item) {
    if (item.status === 'done') return 'done';
    const d = U.daysFromToday(item.due);
    if (d === null) return 'none';
    if (d < 0) return 'overdue';
    if (d === 0) return 'today';
    if (d <= 7) return 'week';
    return 'later';
  }
  const BUCKETS = [
    { id: 'overdue', label: 'Atrasadas', tone: 'danger' },
    { id: 'today', label: 'Hoje', tone: 'warn' },
    { id: 'week', label: 'Próximos 7 dias', tone: '' },
    { id: 'later', label: 'Mais para frente', tone: '' },
    { id: 'none', label: 'Sem data', tone: '' },
    { id: 'done', label: 'Concluídas', tone: 'muted' },
  ];

  function Board(props) {
    const cfg = props.cfg;
    const cols = SA.STATUS_IDS.filter(function (id) {
      if (props.scope === 'open') return id !== 'done';
      if (props.scope === 'done') return id === 'done';
      return true;
    });
    return html`<div class=${U.cx('board', 'cols-' + cols.length)}>${cols.map(function (id) {
      const list = props.items.filter(function (i) { return i.status === id; }).sort(id === 'done' ? function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); } : byDue);
      return html`<section class=${U.cx('col', 'st-' + id)} key=${id} aria-label=${cfg.statuses[id]}>
        <header class="col-head"><span class="col-dot"></span><h3>${cfg.statuses[id]}</h3><span class="count">${list.length}</span></header>
        <div class="col-body">${list.length ? list.map(function (it) { return html`<${ItemCard} key=${it.id} item=${it} />`; }) : html`<p class="col-empty">Nada aqui</p>`}</div>
      </section>`;
    })}</div>`;
  }

  function Agenda(props) {
    const groups = BUCKETS.map(function (b) {
      const list = props.items.filter(function (i) { return bucketOf(i) === b.id; }).sort(b.id === 'done' ? function (x, y) { return String(y.updatedAt).localeCompare(String(x.updatedAt)); } : byDue);
      return { b: b, list: list };
    }).filter(function (g) { return g.list.length; });
    return html`<div class="agenda">${groups.map(function (g) {
      return html`<section class=${U.cx('bucket', g.b.tone && 'bk-' + g.b.tone)} key=${g.b.id}>
        <h3><span>${g.b.label}</span><span class="count">${g.list.length}</span></h3>
        <div class="bucket-list">${g.list.map(function (it) { return html`<${ItemCard} key=${it.id} item=${it} row=${true} />`; })}</div>
      </section>`;
    })}</div>`;
  }

  function EnvHome() {
    const s = store.useStore();
    const cfg = SA.ENVS[s.env];
    const [q, setQ] = useState('');
    const [scope, setScope] = useState('open');
    const [kind, setKind] = useState('');
    const [party, setParty] = useState('');
    const [view, setViewState] = useState(function () { return U.store.get('sa.view.' + s.env, cfg.defaultView); });
    const [creating, setCreating] = useState(false);
    useEffect(function () {
      setViewState(U.store.get('sa.view.' + s.env, cfg.defaultView));
      setQ(''); setKind(''); setParty(''); setScope('open');
    }, [s.env]);
    const setView = function (v) { setViewState(v); U.store.set('sa.view.' + s.env, v); };

    const all = s.data.items;
    const kinds = useMemo(function () { return Array.from(new Set(all.map(function (i) { return i.kind; }).filter(Boolean))).sort(); }, [all]);
    const parties = useMemo(function () { return Array.from(new Set(all.map(function (i) { return i.party; }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); }); }, [all]);
    const nq = U.norm(q.trim());
    const items = all.filter(function (it) {
      if (scope === 'open' && it.status === 'done') return false;
      if (scope === 'done' && it.status !== 'done') return false;
      if (kind && it.kind !== kind) return false;
      if (party && it.party !== party) return false;
      if (nq && U.norm([it.title, it.party, it.kind, it.description].join(' ')).indexOf(nq) < 0) return false;
      return true;
    });
    const filtering = !!(nq || kind || party || scope !== 'open');

    let body;
    if (!s.loaded) {
      body = html`<div class="loading-block"><span class="spinner"></span> Carregando…</div>`;
    } else if (!all.length) {
      body = html`<div class="empty"><${Icon} name="inbox" size=${36} /><h3>${cfg.emptyTitle}</h3><p>${cfg.emptyText}</p><button type="button" class="btn primary" onClick=${function () { setCreating(true); }}><${Icon} name="plus" size=${16} />${cfg.newItem}</button></div>`;
    } else if (!items.length) {
      body = html`<div class="empty"><${Icon} name="search" size=${32} /><h3>Nada encontrado</h3><p>Nenhum item combina com os filtros escolhidos.</p><button type="button" class="btn" onClick=${function () { setQ(''); setKind(''); setParty(''); setScope('open'); }}>Limpar filtros</button></div>`;
    } else {
      body = view === 'board' ? html`<${Board} items=${items} cfg=${cfg} scope=${scope} />` : html`<${Agenda} items=${items} />`;
    }

    return html`
      <div class="page">
        <div class="page-head">
          <div><h1>${cfg.itemPlural}</h1><p class="muted">${cfg.tagline}</p></div>
          <button type="button" class="btn primary" onClick=${function () { setCreating(true); }}><${Icon} name="plus" size=${16} />${cfg.newItem}</button>
        </div>
        ${s.loaded && all.length ? html`<${Summary} items=${all} cfg=${cfg} />` : null}
        ${all.length ? html`
          <div class="filters">
            <label class="search"><${Icon} name="search" size=${16} /><input type="search" placeholder=${'Buscar ' + cfg.itemPlural.toLowerCase() + '…'} value=${q} onInput=${function (e) { setQ(e.target.value); }} aria-label="Buscar" /></label>
            <select value=${kind} onChange=${function (e) { setKind(e.target.value); }} aria-label=${cfg.kindLabel}>
              <option value="">${cfg.kindLabel}: todos</option>
              ${kinds.map(function (k) { return html`<option value=${k}>${k}</option>`; })}
            </select>
            <select value=${party} onChange=${function (e) { setParty(e.target.value); }} aria-label=${cfg.partyLabel}>
              <option value="">${cfg.hasValue ? 'Cliente' : 'Disciplina / local'}: todos</option>
              ${parties.map(function (p) { return html`<option value=${p}>${p}</option>`; })}
            </select>
            <${Segmented} label="Mostrar" value=${scope} onChange=${setScope} options=${[{ value: 'open', label: 'Em aberto' }, { value: 'done', label: cfg.statuses.done + 's' }, { value: 'all', label: 'Tudo' }]} />
            <${Segmented} label="Visualização" value=${view} onChange=${setView} options=${[{ value: 'board', label: 'Quadro', icon: 'columns' }, { value: 'agenda', label: 'Agenda', icon: 'list' }]} />
          </div>` : null}
        ${body}
        ${creating ? html`<${ItemForm} onClose=${function () { setCreating(false); }} />` : null}
      </div>`;
  }

  SA.views = SA.views || {};
  Object.assign(SA.views, { Login: Login, Header: Header, ActivityPanel: ActivityPanel, ItemForm: ItemForm, EnvHome: EnvHome });
})((window.SA = window.SA || {}));
