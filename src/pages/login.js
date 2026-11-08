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

document.addEventListener("DOMContentLoaded", () => {
  const linkEsqueci =
    document.getElementById("forgotPassword") ||
    [...document.querySelectorAll("a, button, span")].find(el =>
      el.textContent.trim().toLowerCase().includes("esqueci minha senha")
    );

  if (!linkEsqueci) return;
  linkEsqueci.style.cursor = "pointer";

  linkEsqueci.addEventListener("click", (event) => {
    event.preventDefault();
    if (document.getElementById("modalRecuperarSenhaLogin")) return;

    const emailPreenchido = document.querySelector("input[type='email'], #email")?.value.trim() || "";

    const overlay = document.createElement("div");
    overlay.id = "modalRecuperarSenhaLogin";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.6);display:grid;place-items:center;z-index:3000;padding:16px;";

    overlay.innerHTML = `
          <div style="background:#ffffff;width:min(440px,100%);border-radius:12px;padding:24px;box-shadow:0 20px 45px rgba(0,0,0,0.25);font-family:inherit;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                  <div>
                      <h3 style="margin:0 0 4px;color:#101d4d;font-size:18px;">Recuperação de Acesso</h3>
                      <p style="margin:0;color:#64748b;font-size:12.5px;">Informe os dados de segurança para solicitar a redefinição de senha à Administração RBS.</p>
                  </div>
                  <button type="button" id="fecharModalRecuperacao" style="border:0;background:transparent;font-size:20px;color:#64748b;cursor:pointer;line-height:1;">×</button>
              </div>
              <form id="formRecuperarSenhaSegura" style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
                  <div style="display:flex;flex-direction:column;gap:4px;">
                      <label style="font-size:12px;font-weight:600;color:#1e293b;">E-mail corporativo cadastrado</label>
                      <input type="email" id="recEmailInput" required value="${emailPreenchido}" placeholder="seu.email@empresa.com"
                          style="height:38px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                  </div>
                  <div style="display:flex;flex-direction:column;gap:4px;">
                      <label style="font-size:12px;font-weight:600;color:#1e293b;">CNPJ da empresa</label>
                      <input type="text" id="recDocumentoInput" required minlength="5" placeholder="00.000.000/0000-00"
                          style="height:38px;padding:0 12px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                  </div>
                  <p id="msgFeedbackRecuperacao" style="margin:0;font-size:12px;font-weight:600;min-height:16px;"></p>
                  <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:6px;">
                        <button type="button" id="cancelarModalRecuperacao"
                            style="margin:0 !important;width:auto !important;height:38px !important;min-height:38px !important;padding:0 16px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;border-radius:6px;border:1px solid #b42318;background:#b42318;color:#fff;font-size:12px;font-weight:700;line-height:1;cursor:pointer;box-sizing:border-box;">
                            Cancelar
                        </button>
                        <button type="submit" id="btnEnviarRecuperacao"
                            style="margin:0 !important;width:auto !important;height:38px !important;min-height:38px !important;padding:0 16px !important;display:inline-flex !important;align-items:center !important;justify-content:center !important;border-radius:6px;border:1px solid #d95d0b;background:#f47b20;color:#fff;font-size:12px;font-weight:700;line-height:1;cursor:pointer;box-sizing:border-box;">
                            Solicitar Redefinição
                        </button>
                    </div>
              </form>
          </div>
      `;

    document.body.appendChild(overlay);

    const fechar = () => overlay.remove();
    overlay.querySelector("#fecharModalRecuperacao").addEventListener("click", fechar);
    overlay.querySelector("#cancelarModalRecuperacao").addEventListener("click", fechar);

    overlay.querySelector("#formRecuperarSenhaSegura").addEventListener("submit", (e) => {
      e.preventDefault();
      const email = overlay.querySelector("#recEmailInput").value.trim().toLowerCase();
      const doc = overlay.querySelector("#recDocumentoInput").value.trim();
      const msg = overlay.querySelector("#msgFeedbackRecuperacao");
      const btn = overlay.querySelector("#btnEnviarRecuperacao");

      const solicitacoes = JSON.parse(localStorage.getItem("rbs_solicitacoes_senha") || "[]");
      solicitacoes.unshift({
        id: `rec_${Date.now()}`,
        email,
        documento: doc,
        data: new Date().toLocaleString("pt-BR")
      });
      localStorage.setItem("rbs_solicitacoes_senha", JSON.stringify(solicitacoes.slice(0, 20)));

      btn.disabled = true;
      btn.textContent = "Solicitação Registrada";
      msg.style.color = "#15803d";
      msg.textContent = `Protocolo de segurança registrado para ${email}. A Administração RBS foi notificada para liberar sua senha padrão temporária.`;

      setTimeout(fechar, 2800);
    });
  });
});

