const SENHA_PADRAO_ADMINS_KEY = "rbs_senha_padrao_admins";

document.addEventListener("DOMContentLoaded", async function () {
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    const inputSenhaPadrao = document.getElementById("defaultAdminPassword");
    const btnTogglePwd = document.getElementById("btnToggleDefaultPwd");
    const btnCopiarSenha = document.getElementById("btnCopiarSenhaPadrao");
    const feedbackSenha = document.getElementById("feedbackSenhaPadrao");
    const formLote = document.getElementById("formCriarAdminsLote");
    const emailsContainer = document.getElementById("adminEmailsDynamicContainer");
    const btnAddRow = document.getElementById("btnAddAdminEmailRow");
    const msgCriar = document.getElementById("msgCriarAdmins");
    const btnSubmit = document.getElementById("btnSubmitAdmins");
    const tbody = document.getElementById("tabelaEquipeRows");

    const senhaSalva = localStorage.getItem(SENHA_PADRAO_ADMINS_KEY);
    if (senhaSalva && inputSenhaPadrao) {
        inputSenhaPadrao.value = senhaSalva;
    }

    inputSenhaPadrao?.addEventListener("input", () => {
        const val = inputSenhaPadrao.value.trim();
        if (val.length >= 8) {
            localStorage.setItem(SENHA_PADRAO_ADMINS_KEY, val);
        }
    });

    btnTogglePwd?.addEventListener("click", () => {
        const mostrar = inputSenhaPadrao.type === "password";
        inputSenhaPadrao.type = mostrar ? "text" : "password";
        btnTogglePwd.textContent = mostrar ? "Ocultar" : "Mostrar";
        btnTogglePwd.setAttribute("aria-pressed", String(mostrar));
    });

    btnCopiarSenha?.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(inputSenhaPadrao.value.trim());
            if (feedbackSenha) {
                feedbackSenha.textContent = "Copiada!";
                setTimeout(() => { feedbackSenha.textContent = ""; }, 2000);
            }
        } catch {
            alert(`Senha padrão: ${inputSenhaPadrao.value.trim()}`);
        }
    });

    function formatarDataHoraAcesso(isoString) {
        if (!isoString) return "Nunca acessou";
        const d = new Date(isoString);
        return Number.isNaN(d.getTime()) ? "Nunca acessou" : d.toLocaleString("pt-BR");
    }


    function adicionarLinhaEmailAdmin(adminExistente = null) {
        if (!emailsContainer) return;
        const row = document.createElement("div");
        row.className = "dynamic-email-row";

        const input = document.createElement("input");
        input.type = "email";

        if (adminExistente) {
            input.value = adminExistente.email;
            input.readOnly = true;
            input.style.background = "#f8fafc";
            input.style.color = "#475569";
        } else {
            input.name = "novoAdminEmailItem";
            input.placeholder = "novo.admin@rbs.com.br";
        }

        const btnRemove = document.createElement("button");
        btnRemove.type = "button";
        btnRemove.className = "btn-icon-remove";
        btnRemove.textContent = "×";
        btnRemove.title = adminExistente
            ? "Remover acesso deste administrador"
            : "Remover esta linha";

        btnRemove.addEventListener("click", async () => {
            if (!adminExistente) {
                const linhasNovas = emailsContainer.querySelectorAll("input[name='novoAdminEmailItem']");
                if (linhasNovas.length > 1) {
                    row.remove();
                } else {
                    input.value = "";
                }
                return;
            }


            const senhaSuperAdmin = window.prompt(
                `ATENÇÃO: Remover o e-mail "${adminExistente.email}" fará com que este administrador perca imediatamente o acesso à sua conta na plataforma.\n\nPara confirmar a remoção, digite a sua senha de SuperAdmin:`
            );
            if (senhaSuperAdmin === null) return;
            if (!senhaSuperAdmin.trim()) {
                alert("A senha do SuperAdmin é obrigatória para remover um administrador.");
                return;
            }

            try {
                const emailSuperAdmin = sessao?.email || "admin@rbs.com.br";
                await apiRequest("/auth/login", "POST", {
                    email: emailSuperAdmin,
                    senha: senhaSuperAdmin.trim()
                });

                await apiRequest(`/usuarios/${adminExistente.id}/desativar`, "POST").catch(() => { });
                await apiRequest(`/usuarios/${adminExistente.id}`, "DELETE");

                msgCriar.style.color = "#15803d";
                msgCriar.textContent = `O acesso do administrador ${adminExistente.email} foi revogado e removido.`;
                await carregarEquipeRbs();
            } catch (erro) {
                alert("Senha de SuperAdmin incorreta ou falha ao remover administrador. Operação cancelada.");
            }
        });

        row.append(input, btnRemove);
        emailsContainer.appendChild(row);
        emailsContainer.scrollTop = emailsContainer.scrollHeight;
    }

    btnAddRow?.addEventListener("click", () => adicionarLinhaEmailAdmin(null));

    async function carregarEquipeRbs() {
        if (!tbody) return;
        try {
            const [todosUsuarios, logsAuditoria] = await Promise.all([
                apiRequest("/usuarios", "GET").catch(() => []),
                apiRequest("/auditoria", "GET").catch(() => [])
            ]);

            const equipe = (todosUsuarios || []).filter(
                u => u.perfil === "SUPERADMIN" || u.perfil === "ADMIN"
            );


            if (emailsContainer) {
                emailsContainer.replaceChildren();
                const adminsComuns = equipe.filter(u => u.perfil === "ADMIN");
                adminsComuns.forEach(adm => adicionarLinhaEmailAdmin(adm));
                adicionarLinhaEmailAdmin(null);
            }

            const mapaUltimoLogin = {};
            (logsAuditoria || []).forEach(log => {
                if (log.acao === "LOGIN_REALIZADO" && log.atorNome) {
                    const chave = String(log.atorNome).toLowerCase();
                    if (!mapaUltimoLogin[chave]) {
                        mapaUltimoLogin[chave] = log.criadoEm;
                    }
                }
            });

            tbody.replaceChildren();

            if (equipe.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4">Nenhum administrador encontrado.</td></tr>`;
                return;
            }

            equipe.forEach(admin => {
                const tr = document.createElement("tr");
                const ehSuper = admin.perfil === "SUPERADMIN";

                const tdNome = document.createElement("td");
                tdNome.innerHTML = `<strong>${admin.nome || admin.email}</strong>`;

                const tdEmail = document.createElement("td");
                tdEmail.textContent = admin.email;

                const tdPerfil = document.createElement("td");
                tdPerfil.textContent = ehSuper ? "SUPERADMIN" : "ADMIN RBS";

                const ultimoLog =
                    mapaUltimoLogin[String(admin.email).toLowerCase()] ||
                    mapaUltimoLogin[String(admin.nome || "").toLowerCase()] ||
                    admin.primeiroAcessoEm;

                const tdUltimoAcesso = document.createElement("td");
                tdUltimoAcesso.textContent = admin.precisaTrocarSenha
                    ? "Pendente (1º acesso não realizado)"
                    : formatarDataHoraAcesso(ultimoLog);

                tr.append(tdNome, tdEmail, tdPerfil, tdUltimoAcesso);
                tbody.appendChild(tr);
            });
        } catch (erro) {
            console.error("Erro ao listar equipe RBS:", erro);
            tbody.innerHTML = `<tr><td colspan="4">Erro ao carregar equipe: ${erro.message}</td></tr>`;
        }
    }

    formLote?.addEventListener("submit", async (event) => {
        event.preventDefault();
        msgCriar.textContent = "";
        const senhaPadrao = inputSenhaPadrao.value.trim();

        const novosEmails = [...emailsContainer.querySelectorAll("input[name='novoAdminEmailItem']")]
            .map(inp => inp.value.trim().toLowerCase())
            .filter(Boolean);

        const emailsUnicos = [...new Set(novosEmails)];

        if (senhaPadrao.length < 8) {
            msgCriar.style.color = "#b42318";
            msgCriar.textContent = "A senha padrão precisa ter pelo menos 8 caracteres (letras e números).";
            return;
        }
        if (emailsUnicos.length === 0) {
            msgCriar.style.color = "#b42318";
            msgCriar.textContent = "Preencha pelo menos um novo e-mail para cadastrar.";
            return;
        }

        localStorage.setItem(SENHA_PADRAO_ADMINS_KEY, senhaPadrao);
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Cadastrando...";

        let criados = 0;
        const erros = [];

        for (const email of emailsUnicos) {
            const prefixoEmail = email.split("@")[0];
            try {
                await apiRequest("/admins", "POST", {
                    email,
                    nome: prefixoEmail,
                    senhaInicial: senhaPadrao
                });
                criados++;
            } catch (erro) {
                erros.push(`${email}: ${erro.message}`);
            }
        }

        btnSubmit.disabled = false;
        btnSubmit.textContent = "Cadastrar Administradores na Plataforma";

        if (criados > 0 && erros.length === 0) {
            msgCriar.style.color = "#15803d";
            msgCriar.textContent = `${criados} administrador(es) cadastrado(s) com sucesso!`;
        } else if (criados > 0 && erros.length > 0) {
            msgCriar.style.color = "#b45309";
            msgCriar.textContent = `${criados} criado(s). Avisos: ${erros.join(" | ")}`;
        } else {
            msgCriar.style.color = "#b42318";
            msgCriar.textContent = `Não foi possível cadastrar: ${erros.join(" | ")}`;
        }

        await carregarEquipeRbs();
    });

    await carregarEquipeRbs();
});