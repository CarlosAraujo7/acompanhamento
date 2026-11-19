/* Comunicação com o servidor (Google Apps Script). */
(function (SA) {
  'use strict';

  class ApiError extends Error {
    constructor(code, message, extra) {
      super(message);
      this.code = code;
      this.extra = extra || null;
    }
  }

  function endpoint() {
    return String(SA.config.API_URL || '').trim();
  }

  const HINT_BAD_RESPONSE =
    'O servidor respondeu algo inesperado. Confira se a implantação do Apps Script está como ' +
    '"Executar como: Eu" e "Quem tem acesso: Qualquer pessoa", e se a URL em config.js termina com /exec.';

  function parse(text) {
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = null; }
    if (!json || typeof json !== 'object') throw new ApiError('bad_response', HINT_BAD_RESPONSE);
    if (!json.ok) throw new ApiError(json.error || 'server', json.message || 'Erro no servidor.', json);
    return json;
  }

  /* Pedido comum. O corpo vai como texto simples (sem cabeçalhos extras) para o navegador
     não fazer a checagem prévia (preflight), que o Apps Script não responde. */
  async function call(payload, opts) {
    const url = endpoint();
    if (!url) throw new ApiError('no_config', 'O servidor ainda não foi configurado (veja config.js).');
    const timeout = (opts && opts.timeout) || 60000;
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, timeout);
    let res;
    try {
      res = await fetch(url, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow', credentials: 'omit', signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      throw new ApiError('network', e && e.name === 'AbortError' ? 'O servidor demorou demais para responder.' : 'Sem conexão com o servidor.');
    }
    let text;
    try { text = await res.text(); } catch (e) { clearTimeout(timer); throw new ApiError('network', 'A conexão caiu durante a resposta.'); }
    clearTimeout(timer);
    return parse(text);
  }

  /* ATENÇÃO: não use XMLHttpRequest com "upload.onprogress" aqui. Quando o navegador vê esse
     acompanhamento de envio, ele faz uma checagem prévia (preflight) que o Apps Script não
     responde, e o pedido falha. Por isso o progresso é por parte enviada (veja store.js). */
  SA.api = { call: call, ApiError: ApiError };
})((window.SA = window.SA || {}));
