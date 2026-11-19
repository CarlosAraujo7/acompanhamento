/* Aparência (tema): Automático (segue o aparelho), Claro ou Escuro.
   Este arquivo roda no <head>, antes da página aparecer, para não "piscar" no tema errado.
   A escolha fica guardada só neste aparelho/navegador. */
(function (SA) {
  'use strict';
  var KEY = 'sa.theme';
  var COLORS = { light: '#f3f0e9', dark: '#181a1d' }; // cor da barra do navegador no celular

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch (e) { return 'auto'; }
  }

  function apply(mode) {
    var root = document.documentElement;
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else root.removeAttribute('data-theme');
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      if (!m.getAttribute('data-orig')) m.setAttribute('data-orig', m.getAttribute('content') || '');
      m.setAttribute('content', mode === 'auto' ? m.getAttribute('data-orig') : COLORS[mode]);
    }
    try { window.dispatchEvent(new Event('sa-theme')); } catch (e) { /* navegador muito antigo */ }
  }

  // se a pessoa mudar a aparência em outra aba, esta aba acompanha
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) apply(read());
  });

  SA.theme = {
    get: read,
    set: function (mode) {
      try {
        if (mode === 'light' || mode === 'dark') localStorage.setItem(KEY, mode);
        else localStorage.removeItem(KEY);
      } catch (e) { /* sem armazenamento: vale só até recarregar */ }
      apply(mode === 'light' || mode === 'dark' ? mode : 'auto');
    },
  };

  apply(read());
})((window.SA = window.SA || {}));
