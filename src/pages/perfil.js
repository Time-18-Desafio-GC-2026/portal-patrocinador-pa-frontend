var EMAIL_SESSION_KEY = "rbs_usuario_email";
var SESSION_KEY = "rbs_sessao";

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("rbs_token");
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!token || !session) {
        window.location.replace("indexLogin.html");
        return;
    }

    const profileEmail = document.getElementById("profileEmail");
    const profileUsername = document.getElementById("profileUsername");
    const usernameForm = document.getElementById("usernameForm");
    const usernameMessage = document.getElementById("usernameMessage");
    const profileForm = document.getElementById("profileForm");
    const profileMessage = document.getElementById("profileMessage");
    const currentPasswordInput = document.getElementById("currentPassword");
    const newPasswordInput = document.getElementById("newPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const toggleAllBtn = document.getElementById("toggleAllPasswordsBtn");


    toggleAllBtn?.addEventListener("click", () => {
        const campos = [currentPasswordInput, newPasswordInput, confirmPasswordInput].filter(Boolean);
        const mostrar = campos[0]?.type === "password";
        campos.forEach(input => {
            input.type = mostrar ? "text" : "password";
        });
        toggleAllBtn.textContent = mostrar ? "Ocultar senhas" : "Mostrar senhas";
        toggleAllBtn.setAttribute("aria-pressed", String(mostrar));
    });

    try {
        const meuUsuario = await apiRequest("/auth/eu", "GET");
        if (meuUsuario) {
            session.nome = meuUsuario.nome || meuUsuario.email;
            session.email = meuUsuario.email;
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        }
    } catch {

    }

    const email = session.email || sessionStorage.getItem(EMAIL_SESSION_KEY) || "";
    const displayName = session.nome || email || "Conta";

    if (profileEmail) profileEmail.value = email;
    if (profileUsername) profileUsername.value = displayName;

    function atualizarCabecalhoNome(novoNome) {
        document.querySelectorAll("[data-account-name]").forEach(el => {
            el.textContent = novoNome;
        });
    }

    usernameForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        usernameMessage.textContent = "";
        const newName = profileUsername.value.trim();
        if (!newName) {
            usernameMessage.textContent = "Informe um nome de usuário.";
            return;
        }
        try {
            const usuarioAtualizado = await apiRequest("/auth/eu/nome", "PATCH", {
                nome: newName
            });
            const updatedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
            if (updatedSession) {
                updatedSession.nome = usuarioAtualizado.nome;
                localStorage.setItem(SESSION_KEY, JSON.stringify(updatedSession));
            }
            atualizarCabecalhoNome(usuarioAtualizado.nome);
            usernameMessage.textContent = "Nome atualizado com sucesso!";
        } catch (error) {
            usernameMessage.textContent = error.message || "Não foi possível salvar o nome.";
        }
    });

    profileForm?.addEventListener("submit", async function (event) {
        event.preventDefault();
        profileMessage.textContent = "";
        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (newPassword.length < 8) {
            profileMessage.textContent = "A nova senha deve ter pelo menos 8 caracteres (letras e números).";
            return;
        }
        if (newPassword !== confirmPassword) {
            profileMessage.textContent = "A nova senha e a confirmação não coincidem.";
            return;
        }
        try {
            const sessaoNova = await apiRequest("/auth/alterar-senha", "POST", {
                senhaAtual: currentPassword,
                novaSenha: newPassword
            });
            if (sessaoNova && sessaoNova.tokenJwt) {
                localStorage.setItem("rbs_token", sessaoNova.tokenJwt);
            }
            profileForm.reset();
            if (toggleAllBtn) {
                toggleAllBtn.textContent = "Mostrar senhas";
                toggleAllBtn.setAttribute("aria-pressed", "false");
            }
            [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(inp => {
                if (inp) inp.type = "password";
            });
            profileMessage.textContent = "Senha atualizada com sucesso!";
        } catch (error) {
            profileMessage.textContent = error.message || "Não foi possível atualizar a senha.";
        }
    });
});