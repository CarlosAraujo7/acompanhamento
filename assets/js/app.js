/* Raiz do aplicativo: escolhe a tela e liga tudo. */
(function (SA) {
  'use strict';
  const html = SA.html, store = SA.store, views = SA.views;
  const hooks = window.preactHooks;
  const useState = hooks.useState, useEffect = hooks.useEffect;

  function App() {
    const s = store.useStore();
    const pair = useState(false);
    const activity = pair[0], setActivity = pair[1];

    // Mantém o endereço (#/ambiente/...) coerente com os ambientes que a pessoa pode acessar.
    useEffect(function () {
      if (!s.session || !s.env) return;
      const allowed = s.session.user.envs;
      if (!s.route.env || allowed.indexOf(s.route.env) < 0) store.navigate(s.env);
    }, [s.session, s.route.env, s.env]);

    useEffect(function () {
      document.documentElement.dataset.signedIn = s.session ? 'yes' : 'no';
    }, [!!s.session]);

    if (!s.session) {
      return html`<${views.Login} /><${SA.ui.ToastHost} />`;
    }
    const showItem = s.route.itemId && s.route.env === s.env;
    return html`
      <div class="shell">
        <${views.Header} onActivity=${function () { setActivity(true); }} />
        <main id="main">
          ${s.env ? (showItem ? html`<${views.ItemPage} key=${s.route.itemId} itemId=${s.route.itemId} tabId=${s.route.tabId} />` : html`<${views.EnvHome} key=${s.env} />`) : html`<div class="loading-block"><span class="spinner"></span> Carregando…</div>`}
        </main>
        ${activity ? html`<${views.ActivityPanel} onClose=${function () { setActivity(false); }} />` : null}
        <${SA.ui.DialogHost} />
        <${SA.ui.ToastHost} />
      </div>`;
  }

  window.preact.render(html`<${App} />`, document.getElementById('app'));
  store.init();
})((window.SA = window.SA || {}));
