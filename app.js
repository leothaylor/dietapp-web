// app.js — handler do botão Sair
$("#btn-logout").addEventListener("click", async () => {
  try {
    // encerra sessão nesta origem
    await supabase.auth.signOut({ scope: "local" });
  } catch (e) {
    console.warn("signOut falhou, limpando storage assim mesmo", e);
  }
  // limpa caches locais
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  // força recarregar a app (GitHub Pages costuma ficar com SPA em cache)
  location.reload();
});
