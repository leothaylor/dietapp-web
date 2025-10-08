/************* CABEÇALHO SEGURO — COLE NO TOPO DO app.js *************/
const msg = (t) => { const el = document.querySelector('#auth-msg'); if (el) el.textContent = t; };

// 1) Garante config e SDK
const APP = (window.APP_CONFIG || {});
if (!APP.SUPABASE_URL || !APP.SUPABASE_ANON_KEY) { msg('Config ausente em APP_CONFIG'); throw new Error('APP_CONFIG ausente'); }
if (!window.supabase || !window.supabase.createClient) { msg('SDK Supabase não carregou'); throw new Error('SDK não disponível'); }

// 2) Cria client e disponibiliza globalmente
const SB = window.supabase.createClient(
  APP.SUPABASE_URL,
  APP.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
);
window.SB = SB;
// Alias para código legado que usa `supabase` como client:
const supabase = SB;
window.supabaseClient = SB;

// 3) Listener único de sessão
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[AUTH]', event, session);
  const show = (id) => ['#view-auth','#view-profile','#view-diary'].forEach(sel=>{
    const el = document.querySelector(sel); if (el) el.classList.toggle('hidden', sel!==id);
  });
  if (session?.user) {
    document.querySelector('#nav')?.classList.remove('hidden');
    const u = document.querySelector('#nav-user'); if (u) u.textContent = session.user.email;
    show('#view-profile');
    msg('');
  } else {
    document.querySelector('#nav')?.classList.add('hidden');
    show('#view-auth'); 
  }
});

// 4) Ações básicas
window.doLogin = async (email, password) => {
  msg('Entrando…');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) msg('Erro ao entrar: ' + (error.message || '')); else msg('Login OK!');
};
window.doSignup = async (email, password) => {
  msg('Criando conta…');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) msg('Erro ao criar conta: ' + (error.message || '')); else msg('Conta criada!');
};
window.doLogout = async () => {
  const { error } = await supabase.auth.signOut();
  msg(error ? 'Erro ao sair: ' + error.message : 'Saiu.');
};

// 5) Liga os botões (IDs do seu index)
const $ = (s) => document.querySelector(s);
$('#btn-login')?.addEventListener('click', ()=>{
  const email = $('#auth-email')?.value?.trim(); const pass = $('#auth-pass')?.value || '';
  if (!email || !pass) return msg('Informe e-mail e senha.');
  window.doLogin(email, pass);
});
$('#btn-signup')?.addEventListener('click', ()=>{
  const email = $('#auth-email')?.value?.trim(); const pass = $('#auth-pass')?.value || '';
  if (!email || !pass) return msg('Informe e-mail e senha.');
  window.doSignup(email, pass);
});
$('#btn-logout')?.addEventListener('click', ()=> window.doLogout());

console.log('SB READY', APP.SUPABASE_URL);
/************* CABEÇALHO — FIM *************/
