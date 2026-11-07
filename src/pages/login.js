document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("toggle-password");
  const submitButton = form.querySelector("button[type='submit']");


  togglePassword.addEventListener("change", () => {
    passwordInput.type = togglePassword.checked ? "text" : "password";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const senha = passwordInput.value;


    const textoOriginal = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = "Autenticando...";

    try {

      const sessaoApi = await apiRequest("/auth/login", "POST", { email, senha });
      const usuario = sessaoApi.usuario;


      localStorage.setItem("rbs_token", sessaoApi.tokenJwt);
      sessionStorage.setItem("rbs_usuario_email", usuario.email);


      const ehEquipeRbs = usuario.perfil === "SUPERADMIN" || usuario.perfil === "ADMIN";
      const perfilFront = ehEquipeRbs ? "funcionario" : "patrocinador";


      localStorage.setItem("rbs_sessao", JSON.stringify({
        usuarioId: usuario.id,
        nome: usuario.nome || usuario.email,
        email: usuario.email,
        perfil: perfilFront,
        perfilApi: usuario.perfil,
        patrocinadorId: usuario.marcaId || null,
        marcaNome: usuario.marcaNome || null,
        marcaCota: usuario.marcaCota || null,
        precisaTrocarSenha: usuario.precisaTrocarSenha
      }));


      if (ehEquipeRbs) {
        window.location.href = "indexAdministrador.html";
        return;
      }

      window.location.href = "indexPatrocinador.html";

    } catch (erro) {
      alert(erro.message || "E-mail ou senha inválidos.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = textoOriginal;
    }
  });
});

