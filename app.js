async function doLogin(email, password) {
  setText('#auth-msg', 'Entrando...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('LOGIN RESULT:', { data, error });
    if (error) {
      setText('#auth-msg', `Erro ao entrar: ${error.message || error.description || error}`);
      return;
    }
    // sucesso
    setText('#auth-msg', '');
    await onAuthChanged(data.session); // navega para o app
  } catch (e) {
    console.error('LOGIN EXCEPTION:', e);
    setText('#auth-msg', `Falha inesperada no login: ${e.message || e}`);
  }
}

async function doSignup(email, password) {
  setText('#auth-msg', 'Criando conta...');
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    console.log('SIGNUP RESULT:', { data, error });
    if (error) {
      setText('#auth-msg', `Erro ao criar conta: ${error.message || error.description || error}`);
      return;
    }
    // sucesso (com confirm email OFF, já volta logado)
    setText('#auth-msg', '');
    await onAuthChanged(data.session);
  } catch (e) {
    console.error('SIGNUP EXCEPTION:', e);
    setText('#auth-msg', `Falha inesperada no cadastro: ${e.message || e}`);
  }
}
// ---- DEBUG VISÍVEL (ajuda sem DevTools) ----
(function debugAuth() {
  const m = (txt) => {
    const el = document.querySelector('#auth-msg');
    if (el) el.textContent = txt;
  };

  // Mostra Config carregada
  try {
    const c = window.APP_CONFIG || {};
    m(`Config OK. URL: ${c.SUPABASE_URL?.slice(0, 35)}…  — Clique em Entrar/Criar conta.`);
  } catch(e) {}

  // Loga qualquer mudança de sessão na tela
  try {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH CHANGE]', event, session);
      const who = session?.user?.email || '—';
      m(`Auth: ${event}  •  user: ${who}`);
    });
  } catch(e) {
    m('Erro inicializando listener de auth: ' + (e.message || e));
  }

  // Se clicar em Entrar ou Criar conta e der erro, vamos imprimir detalhado
  const showError = (lbl, err) => {
    console.error(lbl, err);
    const msg = err?.message || err?.error_description || JSON.stringify(err);
    m(`${lbl}: ${msg}`);
  };

  // “monkey patch” leve nas funções se existirem
  if (typeof doLogin === 'function') {
    const _old = doLogin;
    window.doLogin = async function(email, pass) {
      m('Entrando…'); 
      try {
        const r = await supabase.auth.signInWithPassword({ email, password: pass });
        if (r.error) return showError('Erro ao entrar', r.error);
        m('Login OK! Redirecionando…');
        return onAuthChanged(r.data.session);
      } catch (e) {
        return showError('Falha inesperada no login', e);
      }
    };
  }
  if (typeof doSignup === 'function') {
    const _oldS = doSignup;
    window.doSignup = async function(email, pass) {
      m('Criando conta…');
      try {
        const r = await supabase.auth.signUp({ email, password: pass });
        if (r.error) return showError('Erro ao criar conta', r.error);
        m('Conta criada! Entrando…');
        return onAuthChanged(r.data.session);
      } catch (e) {
        return showError('Falha inesperada no cadastro', e);
      }
    };
  }
})();

