/* Tela de uma demanda/atividade: cabeçalho, abas, arquivos, texto e checklist. */
(function (SA) {
  'use strict';
  const U = SA.util, html = SA.html, store = SA.store, sel = store.sel;
  const ui = SA.ui;
  const Icon = ui.Icon, Modal = ui.Modal, Avatar = ui.Avatar, StatusSelect = ui.StatusSelect;
  const hooks = window.preactHooks;
  const useState = hooks.useState, useEffect = hooks.useEffect, useRef = hooks.useRef, useMemo = hooks.useMemo;
  const NOTE_LIMIT = 45000;

  function who(id) { return store.userName(id) || 'alguém'; }

  /* ======================= arquivos ======================= */
  const BADGE = { pdf: 'red', doc: 'blue', docx: 'blue', odt: 'blue', rtf: 'blue', txt: 'gray', xls: 'green', xlsx: 'green', csv: 'green', ppt: 'amber', pptx: 'amber',
    png: 'violet', jpg: 'violet', jpeg: 'violet', gif: 'violet', webp: 'violet', zip: 'gray', rar: 'gray', '7z': 'gray' };
  function FileBadge(props) {
    const ext = U.fileExt(props.name);
    return html`<span class=${U.cx('file-badge', 'b-' + (BADGE[ext] || 'gray'))} aria-hidden="true">${(ext || 'arq').slice(0, 4)}</span>`;
  }

  async function askDeleteFile(file) {
    const ok = await store.confirm({ title: 'Excluir arquivo', message: 'Excluir "' + file.name + '"? Ele sai do sistema para todos e vai para a lixeira do Google Drive.', confirmLabel: 'Excluir', danger: true });
    if (ok) store.deleteFile(file.id);
  }

  function FileRow(props) {
    const s = store.useStore();
    const file = props.file;
    const dl = s.downloads[file.id];
    return html`
      <li class=${U.cx('file-row', props.compact && 'compact')}>
        <${FileBadge} name=${file.name} />
        <div class="file-info">
          <span class="file-name" title=${file.name}>${file.name}</span>
          <span class="file-meta">${U.fmtBytes(file.size)} · ${who(file.createdBy)} · ${U.relTime(file.createdAt)}</span>
        </div>
        <div class="file-actions">
          <button type="button" class="btn small" disabled=${!!dl} onClick=${function () { store.downloadFile(file); }}>
            ${dl ? html`<span class="spinner small"></span>${dl.n > 1 ? dl.i + '/' + dl.n : 'Baixando'}` : html`<${Icon} name="download" size=${15} />Baixar`}
          </button>
          <button type="button" class="icon-btn danger" aria-label=${'Excluir ' + file.name} title="Excluir" onClick=${function () { askDeleteFile(file); }}><${Icon} name="trash" size=${16} /></button>
        </div>
      </li>`;
  }

  function UploadRow(props) {
    const u = props.upload;
    const pct = u.size ? Math.min(100, Math.round((u.loaded / u.size) * 100)) : 0;
    const label = 'Enviando ' + U.fmtBytes(u.size) + (u.parts > 1 ? ' · parte ' + u.part + ' de ' + u.parts : '') + '…';
    return html`
      <li class=${U.cx('file-row', 'uploading', u.status === 'error' && 'failed')}>
        <${FileBadge} name=${u.name} />
        <div class="file-info">
          <span class="file-name" title=${u.name}>${u.name}</span>
          ${u.status === 'error'
            ? html`<span class="file-meta error">Falhou: ${u.error}</span>`
            : html`<span class="file-meta">${label}</span><span class=${U.cx('bar', pct === 0 && 'indeterminate')}><span style=${pct ? { width: pct + '%' } : null}></span></span>`}
        </div>
      </li>`;
  }

  function Dropzone(props) {
    const pair = useState(false);
    const over = pair[0], setOver = pair[1];
    const maxMb = SA.config.MAX_UPLOAD_MB;
    function pick(list) {
      const files = Array.prototype.slice.call(list || []);
      if (files.length) props.onFiles(files);
    }
    return html`
      <label class=${U.cx('dropzone', over && 'over')}
        onDragOver=${function (e) { e.preventDefault(); setOver(true); }}
        onDragLeave=${function () { setOver(false); }}
        onDrop=${function (e) { e.preventDefault(); setOver(false); pick(e.dataTransfer && e.dataTransfer.files); }}>
        <input type="file" multiple class="sr-only" onChange=${function (e) { const files = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; if (files.length) props.onFiles(files); }} />
        <${Icon} name="upload" size=${22} />
        <span><strong>Arraste arquivos até aqui</strong> ou clique para escolher</span>
        <small>Até ${maxMb} MB por arquivo · ${props.hint || 'a outra pessoa poderá baixar'}</small>
      </label>`;
  }

  function FilesPanel(props) {
    const s = store.useStore();
    const tab = props.tab, item = props.item;
    const files = sel.files(tab.id);
    const ups = s.uploads.filter(function (u) { return u.tabId === tab.id && !u.checkId; });
    return html`
      <div class="panel-body">
        <${Dropzone} onFiles=${function (list) { store.uploadFiles(list, { itemId: item.id, tabId: tab.id }); }} />
        ${ups.length || files.length ? html`<ul class="file-list">
          ${ups.map(function (u) { return html`<${UploadRow} key=${u.uid} upload=${u} />`; })}
          ${files.slice().reverse().map(function (f) { return html`<${FileRow} key=${f.id} file=${f} />`; })}
        </ul>` : html`<p class="muted center pad">Nenhum arquivo nesta aba ainda.</p>`}
      </div>`;
  }

  /* ======================= texto ======================= */
  function NotesPanel(props) {
    const s = store.useStore();
    const tab = props.tab;
    const [text, setText] = useState(tab.content || '');
    const textRef = useRef(tab.content || '');
    const syncedRef = useRef(tab.content || ''); // último texto que sei estar aceito pelo servidor
    const baseRef = useRef(tab.version || 1);    // versão do servidor em que meu texto se baseia
    const timerRef = useRef(null);
    const taRef = useRef(null);
    const conflict = s.conflicts[tab.id];
    const pending = store.isPending('tabs', tab.id);
    const dirty = text !== syncedRef.current;

    function flushNow() {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (store.getState().conflicts[tab.id]) return;
      if (textRef.current !== syncedRef.current) {
        store.saveNote(tab.id, textRef.current, baseRef.current);
        syncedRef.current = textRef.current;
        baseRef.current = baseRef.current + 1;
      }
    }

    function onInput(e) {
      const v = e.target.value;
      textRef.current = v;
      setText(v);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushNow, 1200);
    }

    // mudanças que chegam do servidor (a outra pessoa escreveu)
    useEffect(function () {
      if (conflict) return;
      const remote = tab.content || '';
      if (remote === textRef.current) { syncedRef.current = remote; baseRef.current = tab.version || 1; return; }
      if (textRef.current === syncedRef.current) {
        textRef.current = remote; syncedRef.current = remote; baseRef.current = tab.version || 1;
        setText(remote);
      }
    }, [tab.content, tab.version, !!conflict]);

    // salva ao sair da aba / fechar a página
    useEffect(function () {
      function beforeUnload(e) {
        if (textRef.current !== syncedRef.current) { flushNow(); e.preventDefault(); e.returnValue = ''; }
      }
      window.addEventListener('beforeunload', beforeUnload);
      return function () { window.removeEventListener('beforeunload', beforeUnload); flushNow(); };
    }, []);

    // altura do campo acompanha o texto
    useEffect(function () {
      const ta = taRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = Math.max(260, ta.scrollHeight + 2) + 'px';
    }, [text]);

    function resolve(choice) {
      const r = store.resolveConflict(tab.id, choice, textRef.current);
      if (!r) return;
      textRef.current = r.text; setText(r.text);
      syncedRef.current = r.text; baseRef.current = r.version;
    }

    let status;
    if (conflict) status = html`<span class="save-state bad">Conflito: resolva acima</span>`;
    else if (dirty) status = html`<span class="save-state">Editando…</span>`;
    else if (pending) status = html`<span class="save-state busy">${s.sync.status === 'offline' ? 'Sem conexão — guardado neste aparelho, será enviado assim que voltar' : 'Salvando…'}</span>`;
    else status = html`<span class="save-state ok"><${Icon} name="check" size=${13} />Salvo${tab.updatedBy ? ' · ' + who(tab.updatedBy) + ', ' + U.relTime(tab.updatedAt) : ''}</span>`;

    const staleRemote = !conflict && dirty && (tab.version || 1) !== baseRef.current;

    return html`
      <div class="panel-body">
        ${conflict ? html`
          <div class="alert warn conflict" role="alert">
            <strong>${who(conflict.theirs.updatedBy)} salvou uma versão diferente deste texto enquanto você escrevia.</strong>
            <span>O que você escreveu continua na tela. Escolha o que fazer:</span>
            <div class="row-actions">
              <button type="button" class="btn small" onClick=${function () { resolve('both'); }}>Juntar as duas</button>
              <button type="button" class="btn small" onClick=${function () { resolve('mine'); }}>Manter a minha</button>
              <button type="button" class="btn small" onClick=${function () { resolve('theirs'); }}>Usar a de ${who(conflict.theirs.updatedBy)}</button>
            </div>
          </div>` : null}
        ${staleRemote ? html`<div class="alert info" role="status">${who(tab.updatedBy)} também alterou este texto. Se os dois salvarem, o sistema vai pedir para você escolher.</div>` : null}
        <textarea ref=${taRef} class="notes" value=${text} maxlength=${NOTE_LIMIT} onInput=${onInput}
          placeholder="Escreva aqui o que precisa ser feito ou entregue. Salva sozinho enquanto você digita." aria-label=${tab.name}></textarea>
        <div class="notes-foot">${status}<span class="muted small">${text.length.toLocaleString('pt-BR')} / ${NOTE_LIMIT.toLocaleString('pt-BR')}</span></div>
      </div>`;
  }

  /* ======================= checklist ======================= */
  function CheckRow(props) {
    const s = store.useStore();
    const c = props.check, item = props.item;
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(c.text);
    const [over, setOver] = useState(false);
    const files = sel.checkFiles(c.id);
    const ups = s.uploads.filter(function (u) { return u.checkId === c.id; });
    const target = { itemId: item.id, tabId: c.tabId, checkId: c.id };

    function saveEdit() {
      const t = val.trim();
      setEditing(false);
      if (t && t !== c.text) store.editCheck(c.id, t); else setVal(c.text);
    }
    async function remove() {
      const extra = files.length ? ' Os ' + files.length + ' arquivo(s) anexado(s) também serão excluídos.' : '';
      const ok = await store.confirm({ title: 'Remover item', message: 'Remover "' + c.text + '" do checklist?' + extra, confirmLabel: 'Remover', danger: true });
      if (ok) store.deleteCheck(c.id);
    }
    function pick(list) {
      const arr = Array.prototype.slice.call(list || []);
      if (arr.length) store.uploadFiles(arr, target);
    }

    return html`
      <li class=${U.cx('check-row', c.done && 'done', over && 'over')}
        onDragOver=${function (e) { e.preventDefault(); setOver(true); }} onDragLeave=${function () { setOver(false); }}
        onDrop=${function (e) { e.preventDefault(); setOver(false); pick(e.dataTransfer && e.dataTransfer.files); }}>
        <div class="check-main">
          <button type="button" class=${U.cx('box', c.done && 'on')} role="checkbox" aria-checked=${c.done ? 'true' : 'false'} aria-label=${(c.done ? 'Reabrir: ' : 'Marcar como pronto: ') + c.text}
            onClick=${function () { store.setCheckDone(c.id, !c.done); }}>${c.done ? html`<${Icon} name="check" size=${14} />` : null}</button>
          <div class="check-text">
            ${editing
              ? html`<input type="text" class="inline-edit" value=${val} maxlength="500" data-autofocus ref=${function (el) { if (el && !el.dataset.f) { el.dataset.f = '1'; el.focus(); el.select(); } }}
                  onInput=${function (e) { setVal(e.target.value); }} onBlur=${saveEdit}
                  onKeyDown=${function (e) { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } else if (e.key === 'Escape') { setVal(c.text); setEditing(false); } }} />`
              : html`<button type="button" class="check-label" onClick=${function () { setVal(c.text); setEditing(true); }} title="Clique para editar">${c.text}</button>`}
            ${c.done && c.doneBy ? html`<span class="check-meta">Pronto · ${who(c.doneBy)}, ${U.relTime(c.doneAt)}</span>` : null}
          </div>
          <div class="check-actions">
            <label class="icon-btn" title="Anexar arquivo a este item" aria-label=${'Anexar arquivo a ' + c.text}>
              <input type="file" multiple class="sr-only" onChange=${function (e) { const arr = Array.prototype.slice.call(e.target.files || []); e.target.value = ''; pick(arr); }} />
              <${Icon} name="paperclip" size=${16} />${files.length ? html`<span class="mini-count">${files.length}</span>` : null}
            </label>
            <button type="button" class="icon-btn danger" onClick=${remove} aria-label=${'Remover ' + c.text} title="Remover"><${Icon} name="trash" size=${16} /></button>
          </div>
        </div>
        ${files.length || ups.length ? html`<ul class="file-list nested">
          ${ups.map(function (u) { return html`<${UploadRow} key=${u.uid} upload=${u} />`; })}
          ${files.map(function (f) { return html`<${FileRow} key=${f.id} file=${f} compact=${true} />`; })}
        </ul>` : null}
      </li>`;
  }

  function ChecklistPanel(props) {
    const s = store.useStore();
    const tab = props.tab, item = props.item;
    const checks = sel.checks(tab.id);
    const [draft, setDraft] = useState('');
    const done = checks.filter(function (c) { return c.done; }).length;
    const pct = checks.length ? Math.round((done / checks.length) * 100) : 0;
    function add(e) {
      e.preventDefault();
      const t = draft.trim();
      if (!t) return;
      store.addCheck(item.id, tab.id, t);
      setDraft('');
    }
    return html`
      <div class="panel-body">
        <div class="progress-line" aria-label=${done + ' de ' + checks.length + ' prontos'}>
          <span class="bar big"><span style=${{ width: pct + '%' }}></span></span>
          <strong>${checks.length ? done + ' de ' + checks.length + ' prontos' : 'Sem itens ainda'}</strong>
        </div>
        <form class="add-row" onSubmit=${add}>
          <input type="text" value=${draft} maxlength="500" placeholder="Adicionar o que precisa ficar pronto (Enter para incluir)" onInput=${function (e) { setDraft(e.target.value); }} aria-label="Novo item do checklist" />
          <button type="submit" class="btn primary" disabled=${!draft.trim()}><${Icon} name="plus" size=${16} />Adicionar</button>
        </form>
        ${checks.length ? html`<ul class="checks">${checks.map(function (c) { return html`<${CheckRow} key=${c.id} check=${c} item=${item} />`; })}</ul>`
          : html`<p class="muted center pad">Liste aqui o que vai ficando pronto. Em cada item dá para anexar o arquivo final.</p>`}
      </div>`;
  }

  /* ======================= abas ======================= */
  function guessType(name) {
    const n = U.norm(name);
    if (/entregas|checklist|pronto|pendencias/.test(n)) return 'checklist';
    if (/entregar|fazer|escopo|anota|texto|observa/.test(n)) return 'notes';
    return 'files';
  }

  function NewTabModal(props) {
    const s = store.useStore();
    const cfg = SA.ENVS[s.env];
    const item = props.item;
    const [name, setName] = useState('');
    const [type, setType] = useState('files');
    const [touchedType, setTouchedType] = useState(false);
    const [err, setErr] = useState('');
    const taken = sel.tabs(item.id).map(function (t) { return U.norm(t.name); });
    const suggestions = cfg.tabSuggestions.filter(function (n) { return taken.indexOf(U.norm(n)) < 0; });
    function pickName(n) { setName(n); if (!touchedType) setType(guessType(n)); }
    function submit(e) {
      e.preventDefault();
      const n = name.trim();
      if (!n) { setErr('Dê um nome para a aba.'); return; }
      const id = store.addTab(item.id, n, type);
      props.onClose();
      store.navigate(s.env, item.id, id);
    }
    return html`
      <${Modal} title="Nova aba" onClose=${props.onClose}
        footer=${html`<button type="button" class="btn" onClick=${props.onClose}>Cancelar</button><button type="submit" form="tab-form" class="btn primary">Criar aba</button>`}>
        <form id="tab-form" onSubmit=${submit} noValidate>
          <label class="field">
            <span>Nome da aba</span>
            <input type="text" value=${name} maxlength="80" placeholder="Ex.: Manuais de normalização" data-autofocus aria-invalid=${err ? 'true' : 'false'}
              onInput=${function (e) { setErr(''); pickName(e.target.value); }} />
            ${err ? html`<span class="field-error" role="alert">${err}</span>` : null}
          </label>
          ${suggestions.length ? html`<div class="suggest"><span class="muted small">Sugestões:</span>${suggestions.map(function (n) { return html`<button type="button" key=${n} class="chip-btn" onClick=${function () { setErr(''); pickName(n); }}>${n}</button>`; })}</div>` : null}
          <fieldset class="type-picker">
            <legend>O que vai nesta aba?</legend>
            ${Object.keys(SA.TAB_TYPES).map(function (k) {
              const t = SA.TAB_TYPES[k];
              return html`<label key=${k} class=${U.cx('type-card', type === k && 'on')}>
                <input type="radio" name="tabtype" value=${k} checked=${type === k} onChange=${function () { setType(k); setTouchedType(true); }} />
                <${Icon} name=${t.icon} size=${20} /><strong>${t.label}</strong><span>${t.hint}</span>
              </label>`;
            })}
          </fieldset>
        </form>
      <//>`;
  }

  function RenameTabModal(props) {
    const [name, setName] = useState(props.tab.name);
    function submit(e) {
      e.preventDefault();
      const n = name.trim();
      if (n) store.renameTab(props.tab.id, n);
      props.onClose();
    }
    return html`
      <${Modal} title="Renomear aba" onClose=${props.onClose}
        footer=${html`<button type="button" class="btn" onClick=${props.onClose}>Cancelar</button><button type="submit" form="rename-form" class="btn primary">Salvar</button>`}>
        <form id="rename-form" onSubmit=${submit}>
          <label class="field"><span>Nome</span><input type="text" value=${name} maxlength="80" data-autofocus onInput=${function (e) { setName(e.target.value); }} /></label>
        </form>
      <//>`;
  }

  function TabMenu(props) {
    const s = store.useStore();
    const pair = useState(false);
    const open = pair[0], setOpen = pair[1];
    const [renaming, setRenaming] = useState(false);
    const ref = useRef(null);
    ui.useDismiss(open, ref, function () { setOpen(false); });
    const tab = props.tab;
    async function remove() {
      setOpen(false);
      const n = (sel.checks(tab.id).length) + (tab.type === 'files' ? sel.files(tab.id).length : 0);
      const extra = tab.type === 'files' && n ? ' Os ' + n + ' arquivo(s) dela serão excluídos (vão para a lixeira do Drive).' : (tab.type === 'checklist' && n ? ' Os itens e os arquivos anexados também serão excluídos.' : '');
      const ok = await store.confirm({ title: 'Excluir aba', message: 'Excluir a aba "' + tab.name + '"?' + extra, confirmLabel: 'Excluir aba', danger: true });
      if (ok) {
        store.deleteTab(tab.id);
        store.navigate(s.env, props.item.id);
      }
    }
    return html`
      <div class="menu-wrap" ref=${ref}>
        <button type="button" class="icon-btn" aria-haspopup="menu" aria-expanded=${open ? 'true' : 'false'} aria-label="Opções da aba" onClick=${function () { setOpen(!open); }}><${Icon} name="more" /></button>
        ${open ? html`<div class="menu" role="menu">
          <button type="button" role="menuitem" onClick=${function () { setOpen(false); setRenaming(true); }}><${Icon} name="edit" size=${15} />Renomear aba</button>
          <button type="button" role="menuitem" class="danger" onClick=${remove}><${Icon} name="trash" size=${15} />Excluir aba</button>
        </div>` : null}
        ${renaming ? html`<${RenameTabModal} tab=${tab} onClose=${function () { setRenaming(false); }} />` : null}
      </div>`;
  }

  /* ======================= cabeçalho da demanda ======================= */
  function ItemHeader(props) {
    const s = store.useStore();
    const item = props.item;
    const cfg = SA.ENVS[s.env];
    const due = U.dueInfo(item.due, item.status);
    const [editing, setEditing] = useState(false);
    ui.useTick(30000);
    async function remove() {
      const ok = await store.confirm({
        title: 'Excluir ' + cfg.itemSingular,
        message: 'Excluir "' + item.title + '"? As abas, o checklist e os arquivos também saem do sistema (os arquivos vão para a lixeira do Google Drive).',
        confirmLabel: 'Excluir ' + cfg.itemSingular, danger: true,
      });
      if (ok) { store.deleteItem(item.id); store.navigate(s.env); }
    }
    return html`
      <header class="item-head">
        <div class="item-head-main">
          <h1>${item.title}</h1>
          <div class="chips">
            ${item.party ? html`<span class="chip"><${Icon} name="user" size=${14} />${item.party}</span>` : null}
            ${item.kind ? html`<span class="chip kind">${item.kind}</span>` : null}
            <span class=${U.cx('chip', 'due', 'tone-' + due.tone)}><${Icon} name="calendar" size=${14} />${due.label}${item.due && (due.tone === 'danger' || due.tone === 'warn') ? ' · ' + U.fmtDate(item.due, false) : ''}</span>
            ${cfg.hasValue && item.value != null ? html`<span class=${U.cx('chip', 'money', item.paid && 'paid')}>${U.fmtMoney(item.value)}
              <button type="button" class="mini" onClick=${function () { store.updateItem(item.id, { paid: !item.paid }); }}>${item.paid ? 'Pago ✓' : 'Marcar como pago'}</button></span>` : null}
            ${item.assignee ? html`<span class="chip"><${Avatar} name=${store.userName(item.assignee)} size=${18} />${store.userName(item.assignee)}</span>` : null}
          </div>
          ${item.description ? html`<p class="desc">${item.description}</p>` : null}
          <p class="muted small">Criada por ${who(item.createdBy)} · atualizada por ${who(item.updatedBy)} ${U.relTime(item.updatedAt)}</p>
        </div>
        <div class="item-head-side">
          <${StatusSelect} value=${item.status} env=${s.env} onChange=${function (v) { store.updateItem(item.id, { status: v }); }} />
          <button type="button" class="btn" onClick=${function () { setEditing(true); }}><${Icon} name="edit" size=${15} />Editar</button>
          <button type="button" class="btn ghost-danger" onClick=${remove}><${Icon} name="trash" size=${15} />Excluir</button>
        </div>
        ${editing ? html`<${SA.views.ItemForm} item=${item} onClose=${function () { setEditing(false); }} />` : null}
      </header>`;
  }

  /* ======================= página ======================= */
  function tabBadge(tab) {
    if (tab.type === 'files') { const n = sel.files(tab.id).length; return n ? String(n) : ''; }
    if (tab.type === 'checklist') { const l = sel.checks(tab.id); return l.length ? l.filter(function (c) { return c.done; }).length + '/' + l.length : ''; }
    return '';
  }

  function ItemPage(props) {
    const s = store.useStore();
    const cfg = SA.ENVS[s.env];
    const item = sel.item(props.itemId);
    const tabs = item ? sel.tabs(item.id) : [];
    const active = tabs.filter(function (t) { return t.id === props.tabId; })[0] || tabs[0];
    const [adding, setAdding] = useState(false);
    useEffect(function () {
      document.title = (item ? item.title + ' · ' : '') + 'Acompanhamento';
      return function () { document.title = 'Acompanhamento'; };
    }, [item && item.title]);
    useEffect(function () { window.scrollTo(0, 0); }, [props.itemId]);
    // em telas estreitas, deixa a aba ativa visível na barra de abas
    useEffect(function () {
      const el = document.querySelector('.tabbar .tab.on');
      if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'center', block: 'nearest' });
    }, [active && active.id]);

    const back = html`<button type="button" class="back" onClick=${function () { store.navigate(s.env); }}><${Icon} name="chevronLeft" size=${16} />${cfg.itemPlural}</button>`;
    if (!item) {
      return html`<div class="page">${back}${!s.loaded
        ? html`<div class="loading-block"><span class="spinner"></span> Carregando…</div>`
        : html`<div class="empty"><${Icon} name="search" size=${32} /><h3>Não encontramos este item</h3><p>Ele pode ter sido excluído por outra pessoa.</p><button type="button" class="btn" onClick=${function () { store.navigate(s.env); }}>Voltar para a lista</button></div>`}</div>`;
    }

    let panel = null;
    if (active) {
      const P = active.type === 'notes' ? NotesPanel : active.type === 'checklist' ? ChecklistPanel : FilesPanel;
      panel = html`<section class="panel" role="tabpanel" aria-label=${active.name}>
        <div class="panel-head">
          <h2><${Icon} name=${SA.TAB_TYPES[active.type].icon} size=${18} />${active.name}</h2>
          <${TabMenu} tab=${active} item=${item} />
        </div>
        <${P} key=${active.id} item=${item} tab=${active} />
      </section>`;
    }

    return html`
      <div class="page item-page">
        ${back}
        <${ItemHeader} item=${item} />
        <div class="tabbar" role="tablist" aria-label="Abas">
          ${tabs.map(function (t) {
            const b = tabBadge(t);
            return html`<button type="button" key=${t.id} role="tab" aria-selected=${active && active.id === t.id ? 'true' : 'false'} class=${U.cx('tab', active && active.id === t.id && 'on')}
              onClick=${function () { store.navigate(s.env, item.id, t.id); }}><${Icon} name=${SA.TAB_TYPES[t.type].icon} size=${16} /><span>${t.name}</span>${b ? html`<span class="tab-badge">${b}</span>` : null}</button>`;
          })}
          <button type="button" class="tab add" onClick=${function () { setAdding(true); }}><${Icon} name="plus" size=${16} /><span>Nova aba</span></button>
        </div>
        ${panel || html`<div class="empty"><h3>Esta ${cfg.itemSingular} não tem abas</h3><p>Crie uma aba para guardar arquivos, escrever o que entregar ou montar o checklist.</p><button type="button" class="btn primary" onClick=${function () { setAdding(true); }}><${Icon} name="plus" size=${16} />Nova aba</button></div>`}
        ${adding ? html`<${NewTabModal} item=${item} onClose=${function () { setAdding(false); }} />` : null}
      </div>`;
  }

  SA.views = SA.views || {};
  SA.views.ItemPage = ItemPage;
})((window.SA = window.SA || {}));
