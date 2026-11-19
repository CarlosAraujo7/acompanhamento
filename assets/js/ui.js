/* Componentes visuais compartilhados: ícones, janelas, avisos, etc. */
(function (SA) {
  'use strict';
  const U = SA.util;
  const html = (SA.html = window.htm.bind(window.preact.h));
  const hooks = window.preactHooks;
  const useEffect = hooks.useEffect, useRef = hooks.useRef, useState = hooks.useState;

  /* ---------- ícones (traço simples, herdam a cor do texto) ---------- */
  const ICONS = {
    plus: ['M12 5v14M5 12h14'],
    x: ['M18 6L6 18M6 6l12 12'],
    check: ['M20 6L9 17l-5-5'],
    trash: ['M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'],
    download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
    upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'],
    paperclip: ['M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
    edit: ['M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'],
    refresh: ['M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
    logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
    calendar: ['M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18'],
    file: ['M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM13 2v7h7'],
    folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'],
    fileText: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8'],
    checkSquare: ['M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
    search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35'],
    chevronLeft: ['M15 18l-6-6 6-6'],
    more: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
    bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0'],
    eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
    eyeOff: ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22'],
    briefcase: ['M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'],
    heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'],
    alert: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01'],
    cloud: ['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z'],
    cloudOff: ['M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3M1 1l22 22'],
    layers: ['M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'],
    columns: ['M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18'],
    list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
    user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
    clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2'],
    sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42'],
    moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'],
    monitor: ['M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8 21h8M12 17v4'],
    inbox: ['M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
  };

  function Icon(props) {
    const d = ICONS[props.name] || [];
    const size = props.size || 18;
    return html`<svg class=${U.cx('icon', props.class)} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d.map(function (p) { return html`<path d=${p} />`; })}</svg>`;
  }

  /* ---------- janela (modal) ---------- */
  let openModals = 0;
  function Modal(props) {
    const ref = useRef(null);
    const onClose = props.onClose;
    useEffect(function () {
      const previous = document.activeElement;
      const el = ref.current;
      openModals++;
      document.body.classList.add('modal-open');
      const auto = el.querySelector('[data-autofocus]') || el.querySelector('input:not([type=hidden]):not([disabled]), textarea, select') || el.querySelector('button');
      (auto || el).focus();
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
        if (e.key !== 'Tab') return;
        const items = Array.prototype.filter.call(
          el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
          function (n) { return n.offsetParent !== null; }
        );
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      document.addEventListener('keydown', onKey);
      return function () {
        document.removeEventListener('keydown', onKey);
        openModals = Math.max(0, openModals - 1);
        if (!openModals) document.body.classList.remove('modal-open');
        if (previous && previous.focus && document.contains(previous)) previous.focus();
      };
    }, []);
    return html`
      <div class="modal-backdrop" onMouseDown=${function (e) { if (e.target === e.currentTarget) onClose(); }}>
        <div class=${U.cx('modal', props.wide && 'wide', props.side && 'side')} role="dialog" aria-modal="true" aria-label=${props.title} ref=${ref} tabindex="-1">
          <div class="modal-head">
            <h2>${props.title}</h2>
            <button type="button" class="icon-btn" onClick=${onClose} aria-label="Fechar"><${Icon} name="x" /></button>
          </div>
          <div class="modal-body">${props.children}</div>
          ${props.footer ? html`<div class="modal-foot">${props.footer}</div>` : null}
        </div>
      </div>`;
  }

  /* ---------- avisos e confirmações ---------- */
  function ToastHost() {
    const s = SA.store.useStore();
    return html`
      <div class="toasts" aria-live="polite">
        ${s.toasts.map(function (t) {
          return html`<div class=${U.cx('toast', t.kind)} key=${t.id} role=${t.kind === 'error' ? 'alert' : 'status'}>
            <span>${t.msg}</span>
            <button type="button" class="icon-btn small" aria-label="Dispensar" onClick=${function () { SA.store.dismissToast(t.id); }}><${Icon} name="x" size=${14} /></button>
          </div>`;
        })}
      </div>`;
  }

  function DialogHost() {
    const s = SA.store.useStore();
    const d = s.dialog;
    if (!d) return null;
    const close = function (v) { SA.store.closeDialog(v); };
    return html`
      <${Modal} title=${d.title || 'Confirmar'} onClose=${function () { close(false); }}
        footer=${html`
          <button type="button" class="btn" onClick=${function () { close(false); }}>${d.cancelLabel || 'Cancelar'}</button>
          <button type="button" class=${U.cx('btn', d.danger ? 'danger' : 'primary')} data-autofocus onClick=${function () { close(true); }}>${d.confirmLabel || 'Confirmar'}</button>`}>
        <p class="dialog-text">${d.message}</p>
      <//>`;
  }

  /* ---------- peças pequenas ---------- */
  function Avatar(props) {
    const name = props.name || '?';
    const size = props.size || 28;
    let hue = 0;
    for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360;
    return html`<span class=${U.cx('avatar', props.class)} title=${name} style=${{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.4) + 'px', '--h': String(hue) }} aria-hidden=${props.title ? 'false' : 'true'}>${U.initials(name)}</span>`;
  }

  function StatusSelect(props) {
    const cfg = SA.ENVS[props.env];
    return html`
      <select class=${U.cx('status-select', 'st-' + props.value, props.compact && 'compact')} value=${props.value} aria-label="Status"
        onClick=${function (e) { e.stopPropagation(); }} onKeyDown=${function (e) { e.stopPropagation(); }}
        onChange=${function (e) { props.onChange(e.target.value); }}>
        ${SA.STATUS_IDS.map(function (id) { return html`<option value=${id}>${cfg.statuses[id]}</option>`; })}
      </select>`;
  }

  function Segmented(props) {
    return html`
      <div class="segmented" role="group" aria-label=${props.label}>
        ${props.options.map(function (o) {
          return html`<button type="button" key=${o.value} class=${U.cx(props.value === o.value && 'on')} aria-pressed=${props.value === o.value} onClick=${function () { props.onChange(o.value); }}>
            ${o.icon ? html`<${Icon} name=${o.icon} size=${15} />` : null}<span>${o.label}</span>
          </button>`;
        })}
      </div>`;
  }

  /* Força uma nova renderização de tempos em tempos (para "há 3 min" se atualizar). */
  function useTick(ms) {
    const pair = useState(0);
    useEffect(function () {
      const t = setInterval(function () { pair[1](function (n) { return n + 1; }); }, ms || 30000);
      return function () { clearInterval(t); };
    }, []);
  }

  /* Fecha um menu ao clicar fora ou apertar Esc. */
  function useDismiss(open, ref, onClose) {
    useEffect(function () {
      if (!open) return undefined;
      function down(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
      function key(e) { if (e.key === 'Escape') onClose(); }
      document.addEventListener('mousedown', down);
      document.addEventListener('keydown', key);
      return function () { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
    }, [open]);
  }

  /* Escolha de aparência: Automático (segue o aparelho), Claro ou Escuro. Fica salva neste aparelho. */
  const THEME_OPTIONS = [
    { id: 'auto', label: 'Automático', hint: 'segue o aparelho', icon: 'monitor' },
    { id: 'light', label: 'Claro', hint: '', icon: 'sun' },
    { id: 'dark', label: 'Escuro', hint: '', icon: 'moon' },
  ];
  function ThemeMenu() {
    const theme = SA.theme || { get: function () { return 'auto'; }, set: function () {} };
    const openPair = useState(false);
    const open = openPair[0], setOpen = openPair[1];
    const modePair = useState(theme.get());
    const mode = modePair[0], setMode = modePair[1];
    const ref = useRef(null);
    useDismiss(open, ref, function () { setOpen(false); });
    // se a escolha mudar em outra aba/janela, o ícone e o menu acompanham
    useEffect(function () {
      const sync = function () { setMode(theme.get()); };
      window.addEventListener('sa-theme', sync);
      return function () { window.removeEventListener('sa-theme', sync); };
    }, []);
    const current = THEME_OPTIONS.filter(function (o) { return o.id === mode; })[0] || THEME_OPTIONS[0];
    return html`
      <div class="menu-wrap" ref=${ref}>
        <button type="button" class="icon-btn" aria-haspopup="menu" aria-expanded=${open ? 'true' : 'false'}
          aria-label=${'Aparência: ' + current.label} title=${'Aparência: ' + current.label} onClick=${function () { setOpen(!open); }}>
          <${Icon} name=${current.icon} />
        </button>
        ${open ? html`<div class="menu" role="menu" aria-label="Aparência">
          ${THEME_OPTIONS.map(function (o) {
            return html`<button type="button" key=${o.id} role="menuitemradio" aria-checked=${mode === o.id ? 'true' : 'false'}
              onClick=${function () { theme.set(o.id); setMode(o.id); setOpen(false); }}>
              <${Icon} name=${o.icon} size=${15} /><span class="opt"><span>${o.label}</span>${o.hint ? html`<small>${o.hint}</small>` : null}</span>${mode === o.id ? html`<${Icon} name="check" size=${15} class="menu-check" />` : null}
            </button>`;
          })}
        </div>` : null}
      </div>`;
  }

  SA.ui = { Icon: Icon, Modal: Modal, ToastHost: ToastHost, DialogHost: DialogHost, Avatar: Avatar, StatusSelect: StatusSelect, Segmented: Segmented, ThemeMenu: ThemeMenu, useTick: useTick, useDismiss: useDismiss };
})((window.SA = window.SA || {}));
