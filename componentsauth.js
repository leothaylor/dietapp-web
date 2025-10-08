import { show, hide, setText } from "../utils/helpers.js";

export function mountAuth({ supabase }) {
  const form = $("#form-auth");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#auth-email").value.trim();
    const password = $("#auth-pass").value.trim();
    $("#auth-msg").textContent = "Autenticando...";
    const { data: signIn, error: errIn } = await supabase.auth.signInWithPassword({ email, password });
    if (errIn) {
      // tenta signup
      const { data: signUp, error: errUp } = await supabase.auth.signUp({ email, password });
      if (errUp) { $("#auth-msg").textContent = "Erro: " + errUp.message; return; }
      $("#auth-msg").textContent = "Conta criada. Verifique seu e-mail (se exigido) e faça login.";
    } else {
      $("#auth-msg").textContent = "";
      hide("view-auth");
      show("nav"); show("view-diary"); // abre diário como home
    }
  });

  $("#btn-logout").addEventListener("click", async () => {
    await supabase.auth.signOut();
    hide("view-diary"); hide("view-profile"); hide("nav");
    show("view-auth");
  });

  $("#nav-diario").addEventListener("click", () => { hide("view-profile"); show("view-diary"); });
  $("#nav-perfil").addEventListener("click", () => { hide("view-diary"); show("view-profile"); });
}
