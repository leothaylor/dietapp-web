// app.js
import { mountProfile } from "./components/profile.js";
import { mountDiary }   from "./components/diary.js";

// 1) Supabase client único, exposto em window para os componentes
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  alert("Configuração Supabase ausente. Verifique config.js");
}
export const supabase = window.supabase = window.supabase ??
  window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY) ??
  window.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY) ??
  (window.supabase = window.Supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY));

// 2) atalhos DOM
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 3) navegação simples
function show(viewId) {
  ["#view-auth", "#view-profile", "#view-diary"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    if (id === viewId) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
  $("#nav")?.classList.toggle("hidden", viewId === "#view-auth");
}

// 4) auth UI
async function doLogin() {
  const email = $("#auth-email").value.trim();
  const pass  = $("#auth-pass").value.trim();
  if (!email || !pass) return msgAuth("Informe e-mail e senha.");
  msgAuth("Entrando...");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) return msgAuth("Erro ao entrar: " + error.message);
  msgAuth("");
}

async function doSignup() {
  const email = $("#auth-email").value.trim();
  const pass  = $("#auth-pass").value.trim();
  if (!email || !pass) return msgAuth("Informe e-mail e senha.");
  msgAuth("Criando conta...");
  const { error } = await supabase.auth.signUp({ email, password: pass });
  if (error) return msgAuth("Erro ao criar conta: " + error.message);
  msgAuth("Conta criada. Agora clique em Entrar.");
}

function msgAuth(t) { $("#auth-msg").textContent = t || ""; }

// 5) logout sólido
async function doLogout() {
  try { await supabase.auth.signOut(); } catch {}
  // limpa cache local do Supabase do domínio GitHub Pages
  Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
  location.replace(location.origin + location.pathname); // reload "limpo"
}

// 6) listeners básicos
$("#btn-login") ?.addEventListener("click", (e)=>{ e.preventDefault(); doLogin(); });
$("#btn-signup")?.addEventListener("click", (e)=>{ e.preventDefault(); doSignup(); });
$("#btn-logout")?.addEventListener("click", (e)=>{ e.preventDefault(); doLogout(); });

$("#nav-diario") ?.addEventListener("click", ()=>show("#view-diary"));
$("#nav-perfil") ?.addEventListener("click", ()=>show("#view-profile"));

// 7) quando o estado de auth muda, (re)monta as telas
supabase.auth.onAuthStateChange(async (_evt, session) => {
  if (!session) {
    $("#nav-user").textContent = "";
    show("#view-auth");
    return;
  }
  $("#nav-user").textContent = session.user.email || "";
  show("#view-diary");

  // monta componentes com o client e a sessão
  await mountProfile({ supabase, session });
  await mountDiary({ supabase, session });
});

// 8) inicializa: tenta restaurar sessão
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) show("#view-auth");
})();
