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
