import { show, hide } from "../utils/helpers.js";

export function mountAuth({ supabase }) {
  const form = $("#form-auth");
  const msg = $("#auth-msg");

  function ui(msgText="") { msg.textContent = msgText; }

  async function goHome() {
    hide("view-auth"); show("nav"); show("view-diary");
    const { data: { user } } = await supabase.auth.getUser();
    $("#nav-user").textContent = user?.email ?? "";
  }

  // Se já está logado, entra direto
  supabase.auth.getSession().then(({ data }) => { if (data.session) goHome(); });

  // Também reage a mudanças de sessão (signup/login/logoff)
  supabase.auth.onAuthStateChange((_evt, sess) => { if (sess) goHome(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    const password = $("#auth-pass").value.trim();
    ui("Autenticando...");

    // 1) tenta login
    const { data: sIn, error: eIn } = await supabase.auth.signInWithPassword({ email, password });
    if (!eIn && sIn?.session) { ui(""); return goHome(); }

    // 2) se falhou, tenta criar conta
    const { data: sUp, error: eUp } = await supabase.auth.signUp({ email, password });
    if (eUp) { ui("Erro no cadastro: " + eUp.message); return; }

    // 3) se o projeto NÃO exige confirmação, já teremos sessão; se exigir, não teremos
    if (sUp?.session) { ui(""); return goHome(); }

    // 4) fallback: tenta logar de novo (cobre casos em que o painel já desativou confirmação)
    const { data: sIn2, error: eIn2 } = await supabase.auth.signInWithPassword({ email, password });
    if (!eIn2 && sIn2?.session) { ui(""); return goHome(); }

    // 5) última mensagem (quando email confirmation ainda está ATIVA)
    ui("Conta criada. Se a confirmação de e-mail estiver ligada, verifique seu e-mail e tente entrar.");
  });

  $("#btn-logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    hide("view-diary"); hide("view-profile"); hide("nav"); show("view-auth");
  });

  $("#nav-diario").addEventListener("click", () => { hide("view-profile"); show("view-diary"); });
  $("#nav-perfil").addEventListener("click", () => { hide("view-diary"); show("view-profile"); });
}
