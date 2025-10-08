/************* CABEÇALHO SEGURO — INÍCIO *************/
const msg = (t) => { const el = document.querySelector('#auth-msg'); if (el) el.textContent = t; };

// 1) Garante que config e lib estão presentes
const APP = (window.APP_CONFIG || {});
if (!APP.SUPABASE_URL || !APP.SUPABASE_ANON_KEY) {
  msg('Config ausente em window.APP_CONFIG.');
  throw new Error('APP_CONFIG ausente');
}
if (!window.supabase || !window.supabase.createClient) {
  msg('Biblioteca @supabase/supabase-js não carregou.');
  throw new Error('Supabase SDK não está disponível no window');
}

// 2) Cria o client e exporta global (window.SB) para evitar “undefined”
const SB = window.supabase.createClient(
  APP.SUPABASE_URL,
  APP.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
);
window.SB = SB; // <— importante pra evitar escopo indefinido

// 3) Listener único de sessão (evite ter outro abaixo)
SB.auth.onAuthStateChange(async (event, session) => {
  console.log('[AUTH CHANGE]', event, session);
  const who = session?.user?.email || '—';
  msg(`Auth: ${event} • user: ${who}`);
  // Troca de telas simples
  const show = (id) => {
    for (const v of ['#view-auth','#view-profile','#view-diary']) {
      const el = document.querySelector(v);
      if (el) el.classList.add('hidden');
    }
    const el = document.querySelector(id); if (el) el.classList.remove('hidden');
  };
  if (session?.user) {
    // Usuário logado
    const nav = document.querySelector('#nav'); if (nav) nav.classList.remove('hidden');
    const span = document.querySelector('#nav-user'); if (span) span.textContent = session.user.email;
    show('#view-profile'); // ou #view-diary, como preferir
  } else {
    // Deslogado
    const nav = document.querySelector('#nav'); if (nav) nav.classList.add('hidden');
    show('#view-auth');
  }
});

// 4) Funções de ação (expostas no window)
window.doLogin = async function doLogin(email, password) {
  msg('Entrando…');
  try {
    const { data, error } = await SB.auth.signInWithPassword({ email, password });
    if (error) { msg('Erro ao entrar: ' + (error.message || error.error_description || '')); return; }
    msg('Login OK!');
  } catch (e) { msg('Falha inesperada no login: ' + (e.message || e)); }
};

window.doSignup = async function doSignup(email, password) {
  msg('Criando conta…');
  try {
    const { data, error } = await SB.auth.signUp({ email, password });
    if (error) { msg('Erro ao criar conta: ' + (error.message || error.error_description || '')); return; }
    msg('Conta criada! Verificando sessão…');
  } catch (e) { msg('Falha inesperada no cadastro: ' + (e.message || e)); }
};

window.doLogout = async function doLogout() {
  try { await SB.auth.signOut(); msg('Saiu.'); } 
  catch (e) { msg('Erro ao sair: ' + (e.message || e)); }
};

// 5) Liga botões (use exatamente os IDs do seu index.html)
const $ = (s) => document.querySelector(s);
$('#btn-login')?.addEventListener('click', () => {
  const email = $('#auth-email')?.value?.trim(); 
  const pass = $('#auth-pass')?.value || '';
  if (!email || !pass) return msg('Informe e-mail e senha.');
  window.doLogin(email, pass);
});
$('#btn-signup')?.addEventListener('click', () => {
  const email = $('#auth-email')?.value?.trim(); 
  const pass = $('#auth-pass')?.value || '';
  if (!email || !pass) return msg('Informe e-mail e senha.');
  window.doSignup(email, pass);
});
$('#btn-logout')?.addEventListener('click', () => window.doLogout());

console.log('SB READY', APP.SUPABASE_URL);
/************* CABEÇALHO SEGURO — FIM *************/
