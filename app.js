// app.js
import { $id, setText } from './utils/helpers.js';

// --- Supabase ---
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// --- Views / elementos globais ---
const views = {
  auth: $id('view-auth'),
  profile: $id('view-profile'),
  diary: $id('view-diary'),
};

const nav = {
  bar: $id('nav'),
  btnDiary: $id('nav-diario'),
  btnProfile: $id('nav-perfil'),
  user: $id('nav-user'),
  logout: $id('btn-logout'),
};

const auth = {
  email: $id('auth-email'),
  pass:  $id('auth-pass'),
  login: $id('btn-login'),
  signup:$id('btn-signup'),
  msg:   $id('auth-msg'),
};

// util: troca de telas
function show(view) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
}

// habilita/desabilita botões de auth
function lockAuth(locked) {
  auth.login.disabled  = locked;
  auth.signup.disabled = locked;
  const t = locked ? 'Entrando…' : '';
  setText('auth-msg', t);
}

// atualiza topo
async function renderTopBar() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    nav.bar.classList.remove('hidden');
    nav.user.textContent = user.email ?? '';
  } else {
    nav.bar.classList.add('hidden');
    nav.user.textContent = '';
  }
}

// fluxo pós login
async function afterLogin() {
  await renderTopBar();
  // escolha padrão: abrir Perfil para preencher metas na 1ª vez
  show(views.profile);
}

// --- Auth handlers ---
auth.login.addEventListener('click', async () => {
  lockAuth(true);
  auth.msg.classList.remove('error');
  try {
    const email = auth.email.value.trim();
    const password = auth.pass.value;
    if (!email || !password) {
      setText('auth-msg', 'Informe e-mail e senha.');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setText('auth-msg', error.message);
      auth.msg.classList.add('error');
      return;
    }
    await afterLogin();
  } catch (e) {
    setText('auth-msg', e.message || 'Falha ao entrar.');
    auth.msg.classList.add('error');
  } finally {
    lockAuth(false);
  }
});

auth.signup.addEventListener('click', async () => {
  lockAuth(true);
  auth.msg.classList.remove('error');
  try {
    const email = auth.email.value.trim();
    const password = auth.pass.value;
    if (!email || !password) {
      setText('auth-msg', 'Informe e-mail e senha (mínimo 6).');
      return;
    }
    // cria conta
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setText('auth-msg', error.message);
      auth.msg.classList.add('error');
      return;
    }
    // com “Confirm email: OFF”, normalmente já vem sessão.
    // Se não vier, tenta logar na sequência.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      const r = await supabase.auth.signInWithPassword({ email, password });
      if (r.error) {
        setText('auth-msg', r.error.message);
        auth.msg.classList.add('error');
        return;
      }
    }
    await afterLogin();
  } catch (e) {
    setText('auth-msg', e.message || 'Falha ao criar conta.');
    auth.msg.classList.add('error');
  } finally {
    lockAuth(false);
  }
});

// logout robusto
nav.logout.addEventListener('click', async () => {
  try {
    await supabase.auth.signOut();
  } finally {
    try {
      // limpa qualquer cache local da SDK (chaves começam com 'sb-')
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
    } catch {}
    await renderTopBar();
    show(views.auth);
  }
});

// navegação topo
nav.btnDiary?.addEventListener('click', () => show(views.diary));
nav.btnProfile?.addEventListener('click', () => show(views.profile));

// troca de auth state → decide tela
supabase.auth.onAuthStateChange(async (_evt, session) => {
  await renderTopBar();
  if (session) {
    // se já logado, mantemos a tela atual; se estiver no auth, pula pro perfil
    if (!views.profile.classList.contains('hidden') || !views.diary.classList.contains('hidden')) {
      return;
    }
    show(views.profile);
  } else {
    show(views.auth);
  }
});

// boot
(async function start() {
  await renderTopBar();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    show(views.profile);
  } else {
    show(views.auth);
  }
})();
