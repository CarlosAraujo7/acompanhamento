/* Utilidades gerais: datas, dinheiro, tamanhos de arquivo, armazenamento local. */
(function (SA) {
  'use strict';
  SA.config = Object.assign({ API_URL: '', POLL_SECONDS: 15, MAX_UPLOAD_MB: 50 }, window.APP_CONFIG || {});
  const U = (SA.util = {});

  /* ---------- identificadores ---------- */
  U.uid = function (prefix) {
    const rnd = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    return prefix + '_' + Date.now().toString(36) + rnd;
  };

  /* ---------- datas ---------- */
  const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const pad = (n) => String(n).padStart(2, '0');

  U.todayStr = function () {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  U.parseDate = function (s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  U.daysFromToday = function (s) {
    const d = U.parseDate(s);
    if (!d) return null;
    const t = U.parseDate(U.todayStr());
    return Math.round((d - t) / 86400000);
  };
  U.fmtDate = function (s, withWeekday) {
    const d = U.parseDate(s);
    if (!d) return '';
    let out = d.getDate() + ' ' + MONTHS[d.getMonth()];
    if (d.getFullYear() !== new Date().getFullYear()) out += ' ' + d.getFullYear();
    return (withWeekday === false ? '' : WEEK[d.getDay()] + ', ') + out;
  };
  U.relTime = function (iso) {
    const t = Date.parse(iso || '');
    if (!t) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 45) return 'agora';
    const m = Math.round(s / 60);
    if (m < 60) return 'há ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    const d = Math.round(h / 24);
    if (d < 7) return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    const dt = new Date(t);
    return dt.getDate() + ' ' + MONTHS[dt.getMonth()];
  };
  U.fmtTime = function (iso) {
    const t = new Date(Date.parse(iso || ''));
    if (isNaN(t)) return '';
    return pad(t.getHours()) + ':' + pad(t.getMinutes());
  };
  U.dayLabel = function (iso) {
    const t = new Date(Date.parse(iso || ''));
    if (isNaN(t)) return '';
    const key = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    const diff = U.daysFromToday(key);
    if (diff === 0) return 'Hoje';
    if (diff === -1) return 'Ontem';
    return U.fmtDate(key);
  };

  /* Situação do prazo de um item: texto e "tom" (cor suave). */
  U.dueInfo = function (due, status) {
    if (!due) return { label: 'Sem prazo', tone: 'none', days: null };
    const days = U.daysFromToday(due);
    if (status === 'done') return { label: U.fmtDate(due), tone: 'muted', days: days };
    if (days < 0) return { label: 'Atrasada há ' + -days + (days === -1 ? ' dia' : ' dias'), tone: 'danger', days: days };
    if (days === 0) return { label: 'Hoje', tone: 'warn', days: days };
    if (days === 1) return { label: 'Amanhã', tone: 'warn', days: days };
    if (days <= 3) return { label: 'Em ' + days + ' dias', tone: 'warn', days: days };
    return { label: U.fmtDate(due), tone: 'normal', days: days };
  };

  /* ---------- dinheiro e tamanhos ---------- */
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  U.fmtMoney = (n) => brl.format(Number(n) || 0);
  U.parseMoney = function (s) {
    if (typeof s === 'number') return s;
    let t = String(s || '').replace(/[^\d.,-]/g, '');
    if (!t) return null;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,56
    const n = parseFloat(t);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  U.fmtBytes = function (n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0).replace('.', ',') + ' KB';
    return (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',') + ' MB';
  };
  U.fileExt = function (name) {
    const m = /\.([A-Za-z0-9]{1,5})$/.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  };
  U.initials = function (name) {
    const p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };

  /* ---------- funções de apoio ---------- */
  U.debounce = function (fn, ms) {
    let t = null;
    const wrapped = function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(null, args); }, ms);
    };
    wrapped.flush = function () { if (t) { clearTimeout(t); t = null; fn.apply(null, arguments); } };
    wrapped.cancel = function () { clearTimeout(t); t = null; };
    return wrapped;
  };
  U.cx = function () {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  };
  U.norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  U.byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt));

  /* ---------- armazenamento local (nunca quebra se estiver bloqueado) ---------- */
  U.store = {
    get(key, fallback, session) {
      try {
        const raw = (session ? sessionStorage : localStorage).getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value, session) {
      try { (session ? sessionStorage : localStorage).setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    del(key) {
      try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (e) { /* ignora */ }
    },
  };

  /* ---------- arquivos <-> base64 ---------- */
  U.blobToBase64 = function (blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () {
        const s = String(r.result || '');
        resolve(s.slice(s.indexOf(',') + 1));
      };
      r.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
      r.readAsDataURL(blob);
    });
  };
  U.base64ToBytes = function (b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
})((window.SA = window.SA || {}));
