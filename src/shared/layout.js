const PRAZO_PESQUISA_KEY = "rbs_pesquisa_data_limite";
const NOTIFS_LIDAS_KEY = "rbs_notificacoes_lidas";
const NOTIFS_SESSAO_DISPENSADAS_KEY = "rbs_notifs_contrato_sessao";

function obterNotificacoesLidas() {
    try {
        return JSON.parse(localStorage.getItem(NOTIFS_LIDAS_KEY) || "[]");
    } catch {
        return [];
    }
}

function obterNotificacoesSessaoDispensadas() {
    try {
        return JSON.parse(sessionStorage.getItem(NOTIFS_SESSAO_DISPENSADAS_KEY) || "[]");
    } catch {
        return [];
    }
}

function marcarNotificacoesComoLidas(ids) {
    const lidasPermanentes = new Set(obterNotificacoesLidas());
    const lidasSessao = new Set(obterNotificacoesSessaoDispensadas());

    ids.forEach(id => {
        if (String(id).startsWith("contrato_sem_signatario_")) {
            lidasSessao.add(id);
        } else {
            lidasPermanentes.add(id);
        }
    });

    localStorage.setItem(NOTIFS_LIDAS_KEY, JSON.stringify([...lidasPermanentes]));
    sessionStorage.setItem(NOTIFS_SESSAO_DISPENSADAS_KEY, JSON.stringify([...lidasSessao]));
}

function verificarEExibirModalPrimeiroAcesso(sessao) {
    if (!sessao || !sessao.precisaTrocarSenha) return;
    const perfilApi = String(sessao.perfilApi || "").toUpperCase();
    if (perfilApi === "SUPERADMIN") return;
    if (document.getElementById("modalPrimeiroAcessoObrigatorio")) return;

    const modal = document.createElement("div");
    modal.id = "modalPrimeiroAcessoObrigatorio";
    modal.className = "modal-primeiro-acesso-box";
    modal.innerHTML = `
        <div class="form-header">
            <div>
                <h3>Primeiro Acesso: Segurança Obrigatória</h3>
                <p>Por segurança, personalize seu nome de exibição e substitua a senha padrão inicial antes de utilizar a plataforma.</p>
            </div>
        </div>
        <form id="formPrimeiroAcessoModal">
            <div class="form-group">
                <label for="primeiroAcessoNome">Seu Nome Completo</label>
                <input type="text" id="primeiroAcessoNome" required maxlength="120"
                    placeholder="Digite seu nome e sobrenome" value="${sessao.nome && sessao.nome !== sessao.email ? sessao.nome : ""}">
            </div>
            <div class="form-group">
                <label for="primeiroAcessoNovaSenha">Nova Senha Pessoal (mín. 8 caracteres, letras e números)</label>
                <input type="password" id="primeiroAcessoNovaSenha" required minlength="8"
                    placeholder="Crie uma senha forte e exclusiva">
            </div>
            <div class="form-group">
                <label for="primeiroAcessoConfirmaSenha">Confirmar Nova Senha</label>
                <input type="password" id="primeiroAcessoConfirmaSenha" required minlength="8"
                    placeholder="Repita a nova senha">
            </div>
            <p class="profile-message" id="msgErroPrimeiroAcesso" style="color:#b42318;"></p>
            <div class="form-actions">
                <button type="submit" class="button button-primary" id="btnSalvarPrimeiroAcesso">
                    Confirmar e Acessar Plataforma
                </button>
            </div>
        </form>
    `;

    document.body.appendChild(modal);

    const form = document.getElementById("formPrimeiroAcessoModal");
    const msgErro = document.getElementById("msgErroPrimeiroAcesso");
    const btnSubmit = document.getElementById("btnSalvarPrimeiroAcesso");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msgErro.textContent = "";
        const nome = document.getElementById("primeiroAcessoNome").value.trim();
        const novaSenha = document.getElementById("primeiroAcessoNovaSenha").value;
        const confirma = document.getElementById("primeiroAcessoConfirmaSenha").value;

        if (novaSenha.length < 8) {
            msgErro.textContent = "A nova senha deve ter pelo menos 8 caracteres (letras e números).";
            return;
        }
        if (novaSenha !== confirma) {
            msgErro.textContent = "A confirmação de senha não confere.";
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        try {
            const resposta = await apiRequest("/auth/primeiro-acesso", "POST", {
                nome,
                novaSenha
            });

            if (resposta && resposta.tokenJwt) {
                localStorage.setItem("rbs_token", resposta.tokenJwt);
            }

            sessao.nome = resposta?.usuario?.nome || nome;
            sessao.precisaTrocarSenha = false;
            localStorage.setItem("rbs_sessao", JSON.stringify(sessao));

            modal.remove();
            inicializarLayoutPortal();
        } catch (erro) {
            msgErro.textContent = erro.message || "Não foi possível concluir o primeiro acesso.";
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Confirmar e Acessar Plataforma";
        }
    });
}

async function carregarNotificacoesDaPlataforma(sessao) {
    if (typeof apiRequest !== "function" || !localStorage.getItem("rbs_token")) return [];
    const ehPatrocinador = String(sessao?.perfil || "").toLowerCase() === "patrocinador";
    const notificacoes = [];

    try {
        if (ehPatrocinador && sessao.patrocinadorId) {
            const marcaId = sessao.patrocinadorId;
            const ehMaster = String(sessao.marcaCota || "").toUpperCase() === "MASTER";

            const [materiais, perguntas, faqPublicadas] = await Promise.all([
                apiRequest(`/marcas/${marcaId}/materiais`, "GET").catch(() => []),
                ehMaster ? apiRequest(`/marcas/${marcaId}/pesquisa-perguntas`, "GET").catch(() => []) : Promise.resolve([]),
                apiRequest("/faq", "GET").catch(() => [])
            ]);

            if (ehMaster) {
                const matPrazo = (materiais || []).find(m => m.tipoMaterial === "PRAZO_PESQUISA");
                const dataIso = matPrazo?.descricao || localStorage.getItem(PRAZO_PESQUISA_KEY) || "";
                const qtdPerguntas = (perguntas || []).length;

                if (dataIso && qtdPerguntas < 3) {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    const limite = new Date(dataIso + "T00:00:00");
                    if (!Number.isNaN(limite.getTime())) {
                        const diffDias = Math.round((limite - hoje) / (1000 * 60 * 60 * 24));
                        const dataBr = limite.toLocaleDateString("pt-BR");

                        if (diffDias === 0) {
                            notificacoes.push({
                                id: `prazo_hoje_${dataIso}`,
                                titulo: "Hoje é o dia limite da Pesquisa",
                                descricao: `Envie as perguntas restantes da Pesquisa de Ativação até hoje (${dataBr}). Status atual: ${qtdPerguntas}/3.`,
                                link: "indexPesquisa.html"
                            });
                        } else if (diffDias === 1) {
                            notificacoes.push({
                                id: `prazo_1d_${dataIso}`,
                                titulo: "Falta 1 dia: Pesquisa de Ativação",
                                descricao: `O prazo para cadastrar as 3 perguntas encerra amanhã (${dataBr}). Status: ${qtdPerguntas}/3.`,
                                link: "indexPesquisa.html"
                            });
                        } else if (diffDias === 7) {
                            notificacoes.push({
                                id: `prazo_7d_${dataIso}`,
                                titulo: "Faltam 7 dias: Pesquisa de Ativação",
                                descricao: `Data limite definida para ${dataBr}. Você cadastrou ${qtdPerguntas}/3 perguntas.`,
                                link: "indexPesquisa.html"
                            });
                        } else {
                            notificacoes.push({
                                id: `prazo_def_${dataIso}_${qtdPerguntas}`,
                                titulo: "Prazo da Pesquisa de Ativação",
                                descricao: `Data limite para envio das 3 perguntas: ${dataBr} (${qtdPerguntas}/3 cadastradas).`,
                                link: "indexPesquisa.html"
                            });
                        }
                    }
                }
            }

            const temSignatario = (materiais || []).some(m => m.tipoMaterial === "DADOS_SIGNATARIO");
            const pdfContrato = (materiais || []).find(m => m.tipoMaterial === "CONTRATO");
            const cobrancasRbs = (materiais || []).filter(m => m.tipoMaterial === "COBRANCA_CONTRATO");
            const ultimaCobranca = cobrancasRbs.length > 0 ? cobrancasRbs[0] : null;

            if (!temSignatario) {
                const sufixoCobranca = ultimaCobranca ? `_${ultimaCobranca.id}` : "";
                notificacoes.push({
                    id: `contrato_sem_signatario_${marcaId}${sufixoCobranca}`,
                    titulo: "Contrato: Dados Pendentes",
                    descricao: ultimaCobranca
                        ? "A Administração RBS solicitou o preenchimento urgente do representante legal para emissão do seu contrato."
                        : "Informe o nome e o cargo do representante legal que assinará o contrato da sua marca.",
                    link: "indexContratos.html"
                });
            } else if (pdfContrato && pdfContrato.status !== "CONTRATO_CONSOLIDADO" && pdfContrato.autorPerfil !== "PATROCINADOR") {
                notificacoes.push({
                    id: `contrato_enviado_rbs_${pdfContrato.id}`,
                    titulo: "Contrato Disponível para Assinatura",
                    descricao: `A RBS enviou o contrato (${pdfContrato.titulo}). Baixe o PDF e reenvie assinado.`,
                    link: "indexContratos.html"
                });
            } else if (pdfContrato && (pdfContrato.status === "CONTRATO_CONSOLIDADO" || pdfContrato.autorPerfil === "PATROCINADOR")) {
                notificacoes.push({
                    id: `contrato_consolidado_${pdfContrato.id}`,
                    titulo: "Contrato Consolidado",
                    descricao: "O contrato de patrocínio da sua empresa está assinado e consolidado.",
                    link: "indexContratos.html"
                });
            }

            const enviosRbs = (materiais || []).filter(
                m => m.autorPerfil !== "PATROCINADOR" &&
                    m.tipoMaterial !== "CONTRATO" &&
                    m.tipoMaterial !== "DADOS_SIGNATARIO" &&
                    m.tipoMaterial !== "FOTO_EMPRESA" &&
                    m.tipoMaterial !== "PRAZO_PESQUISA" &&
                    m.tipoMaterial !== "DADOS_VOLUMETRIA" &&
                    m.tipoMaterial !== "COBRANCA_CONTRATO"
            );
            enviosRbs.slice(0, 4).forEach(m => {
                notificacoes.push({
                    id: `midia_rbs_${m.id}`,
                    titulo: "Novo material publicado pela RBS",
                    descricao: `${m.titulo}${m.descricao ? ": " + m.descricao : ""}`,
                    link: "indexPatrocinador.html"
                });
            });

            const mesesVol = (materiais || [])
                .filter(m => m.tipoMaterial === "DADOS_VOLUMETRIA" && String(m.titulo).startsWith("VOL_MES:"))
                .map(m => m.titulo.replace("VOL_MES:", ""));
            if (mesesVol.length > 0) {
                notificacoes.push({
                    id: `relatorio_disp_${marcaId}_${mesesVol.join("_")}`,
                    titulo: "Relatórios de Volumetria Atualizados",
                    descricao: `Dados disponíveis para emissão: ${mesesVol.join(", ")}.`,
                    link: "indexRelatorio.html"
                });
            }

            (faqPublicadas || []).filter(f => f.resposta).slice(0, 3).forEach(f => {
                notificacoes.push({
                    id: `faq_resp_${f.id}`,
                    titulo: "Nova resposta publicada no FAQ",
                    descricao: `Pergunta respondida: "${f.pergunta}"`,
                    link: "indexFaq.html"
                });
            });
        } else {
            const [pendentesFaq, marcas] = await Promise.all([
                apiRequest("/faq/pendentes", "GET").catch(() => []),
                apiRequest("/marcas", "GET").catch(() => [])
            ]);

            const solicitacoesSenha = JSON.parse(localStorage.getItem("rbs_solicitacoes_senha") || "[]");
            solicitacoesSenha.forEach(sol => {
                notificacoes.push({
                    id: sol.id,
                    titulo: `Recuperação de Senha: ${sol.email}`,
                    descricao: `Solicitação registrada (${sol.documento}) em ${sol.data}.`,
                    link: "indexAdministrador.html"
                });
            });

            const faqSemResposta = (pendentesFaq || []).filter(item => !item.resposta);
            if (faqSemResposta.length > 0) {
                notificacoes.push({
                    id: `admin_faq_pend_${faqSemResposta.map(f => f.id).join("_")}`,
                    titulo: `FAQ: ${faqSemResposta.length} pergunta(s) recebida(s)`,
                    descricao: "Existem dúvidas de patrocinadores aguardando resposta oficial da RBS.",
                    link: "indexFaq.html"
                });
            }

            for (const m of (marcas || [])) {
                const mats = await apiRequest(`/marcas/${m.id}/materiais`, "GET").catch(() => []);
                const signatario = (mats || []).find(x => x.tipoMaterial === "DADOS_SIGNATARIO");
                const pdfsContrato = (mats || []).filter(x => x.tipoMaterial === "CONTRATO");
                const pdfConsolidado = pdfsContrato.find(x => x.status === "CONTRATO_CONSOLIDADO" || x.autorPerfil === "PATROCINADOR");

                if (signatario && pdfsContrato.length === 0) {
                    notificacoes.push({
                        id: `admin_signatario_${signatario.id}`,
                        titulo: `Contrato: Representante de ${m.nome}`,
                        descricao: `A marca ${m.nome} enviou os dados do representante legal e aguarda o envio do contrato em PDF.`,
                        link: "indexContratos.html"
                    });
                } else if (pdfConsolidado) {
                    notificacoes.push({
                        id: `admin_contrato_ok_${pdfConsolidado.id}`,
                        titulo: `Contrato Consolidado: ${m.nome}`,
                        descricao: `A empresa ${m.nome} reenviou o contrato assinado.`,
                        link: "indexContratos.html"
                    });
                }

                const enviosPatrocinador = (mats || []).filter(
                    x => x.autorPerfil === "PATROCINADOR" &&
                        x.tipoMaterial !== "CONTRATO" &&
                        x.tipoMaterial !== "DADOS_SIGNATARIO" &&
                        x.tipoMaterial !== "DADOS_VOLUMETRIA" &&
                        x.tipoMaterial !== "COBRANCA_CONTRATO"
                );
                if (enviosPatrocinador.length > 0) {
                    const ultimo = enviosPatrocinador[0];
                    notificacoes.push({
                        id: `admin_envio_marca_${ultimo.id}`,
                        titulo: `Novo envio de ${m.nome}`,
                        descricao: `Arquivo enviado: ${ultimo.titulo}`,
                        link: `detalhes-patrocinador.html?id=${m.id}`
                    });
                }
            }
        }
    } catch {

    }

    return notificacoes;
}

function inicializarLayoutPortal() {
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    if (!sessao) return;

    const perfil = String(sessao.perfil || "").toLowerCase();
    const perfilApi = String(sessao.perfilApi || "").toUpperCase();
    const ehPatrocinador = perfil === "patrocinador";
    const ehSuperAdmin = perfilApi === "SUPERADMIN";
    const ehPatrocinadorMaster = ehPatrocinador && String(sessao.marcaCota || "").toUpperCase() === "MASTER";
    const podeVerPesquisa = !ehPatrocinador || ehPatrocinadorMaster;

    const paginaAtual = window.location.pathname.split("/").pop() || "indexAdministrador.html";

    const titulosPaginas = {
        "indexAdministrador.html": "Dashboard",
        "detalhes-patrocinador.html": "Visualização da Marca",
        "indexPatrocinador.html": "Dashboard",
        "indexContratos.html": "Contratos",
        "indexRelatorio.html": "Relatórios",
        "indexPesquisa.html": "Pesquisa",
        "indexCredenciamento.html": "Credenciamento",
        "indexFaq.html": "FAQ",
        "indexEquipe.html": "Equipe RBS",
        "indexHistorico.html": "Auditoria",
        "indexPerfil.html": "Perfil"
    };

    const tituloBreadcrumb = titulosPaginas[paginaAtual] || "Dashboard";
    const linkDashboard = ehPatrocinador ? "indexPatrocinador.html" : "indexAdministrador.html";
    const textoWorkspace = ehPatrocinador ? "Área do Patrocinador" : "Administração RBS";
    const textoSubtitulo = ehPatrocinador ? "Visão geral da sua marca" : "Visão geral da operação";

    const isDashActive =
        paginaAtual === "indexAdministrador.html" ||
        paginaAtual === "detalhes-patrocinador.html" ||
        paginaAtual === "indexPatrocinador.html";
    const isCntActive = paginaAtual === "indexContratos.html";
    const isRelActive = paginaAtual === "indexRelatorio.html";
    const isPesqActive = paginaAtual === "indexPesquisa.html";
    const isCredActive = paginaAtual === "indexCredenciamento.html";
    const isFaqActive = paginaAtual === "indexFaq.html";
    const isEqpActive = paginaAtual === "indexEquipe.html";
    const isAudActive = paginaAtual === "indexHistorico.html";
    const isCfgActive = paginaAtual === "indexPerfil.html";

    const logoInicial = "../assets/img/LogoPlanetaOrange.png";

    const sidebarEl = document.getElementById("sidebar");
    if (sidebarEl) {
        sidebarEl.innerHTML = `
            <a class="sidebar-brand" href="${linkDashboard}">
                <img class="brand-mark" src="${logoInicial}" alt="Planeta Atlântida">
                <div class="brand-copy">
                    <strong>Portal do Patrocinador</strong>
                </div>
            </a>
            <div class="workspace">
                <span class="eyebrow">ÁREA DE TRABALHO</span>
                <strong>${textoWorkspace}</strong>
                <span>${textoSubtitulo}</span>
            </div>
            <nav class="main-nav" aria-label="Navegação principal">
                <span class="nav-label">NAVEGAÇÃO</span>
                <a class="nav-item ${isDashActive ? "active" : ""}" id="dashboardNav" href="${linkDashboard}" ${isDashActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    <span>Dashboard</span>
                </a>
                <a class="nav-item ${isCntActive ? "active" : ""}" href="indexContratos.html" ${isCntActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                    </svg>
                    <span>Contratos</span>
                </a>
                <a class="nav-item ${isRelActive ? "active" : ""}" href="indexRelatorio.html" ${isRelActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 19V9M10 19V5M16 19v-8M22 19H2"/>
                    </svg>
                    <span>Relatórios</span>
                </a>
                ${podeVerPesquisa ? `
                <a class="nav-item ${isPesqActive ? "active" : ""}" href="indexPesquisa.html" ${isPesqActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 11l3 3L22 4"/>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    <span>Pesquisa</span>
                </a>
                ` : ""}
                <a class="nav-item ${isCredActive ? "active" : ""}" href="indexCredenciamento.html" ${isCredActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="16" rx="2"/>
                        <circle cx="9" cy="10" r="2"/>
                        <path d="M15 8h2M15 12h2M7 16h10"/>
                    </svg>
                    <span>Credenciamento</span>
                </a>
                <a class="nav-item ${isFaqActive ? "active" : ""}" href="indexFaq.html" ${isFaqActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/>
                        <path d="M12 17h.01"/>
                        <circle cx="12" cy="12" r="9"/>
                    </svg>
                    <span>FAQ</span>
                </a>
                ${ehSuperAdmin ? `
                <a class="nav-item ${isEqpActive ? "active" : ""}" href="indexEquipe.html" ${isEqpActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>Equipe RBS</span>
                </a>
                ` : ""}
                ${!ehPatrocinador ? `
                <a class="nav-item ${isAudActive ? "active" : ""}" href="indexHistorico.html" ${isAudActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3l8 3v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6l8-3z"/>
                        <path d="M9 12l2 2 4-4"/>
                    </svg>
                    <span>Auditoria</span>
                </a>
                ` : ""}
                <a class="nav-item ${isCfgActive ? "active" : ""}" id="profileNav" href="indexPerfil.html#perfil" ${isCfgActive ? 'aria-current="page"' : ""}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="8" r="4"/>
                        <path d="M4 21a8 8 0 0 1 16 0"/>
                    </svg>
                    <span>Perfil</span>
                </a>
                <button class="nav-item nav-item-button" id="logoutButton" type="button">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 17l5-5-5-5M15 12H3"/>
                        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>
                    </svg>
                    <span>Sair</span>
                </button>
            </nav>
        `;
    }

    const topbarEl = document.querySelector("header.topbar");
    if (topbarEl) {
        topbarEl.innerHTML = `
            <div class="topbar-breadcrumb">
                <span class="breadcrumb">${textoWorkspace} <b>/</b> <span id="breadcrumbTitle">${tituloBreadcrumb}</span></span>
            </div>
            <div class="topbar-right-actions">
                <div class="notif-wrapper" id="notifWrapper">
                    <button type="button" class="notif-bell-btn" id="notifBellBtn" aria-label="Notificações da plataforma" aria-expanded="false">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        <span class="notif-badge" id="notifBadgeCount" hidden>0</span>
                    </button>
                    <div class="notif-dropdown" id="notifDropdown" hidden>
                        <div class="notif-dropdown-header">
                            <strong>Notificações</strong>
                            <button type="button" class="notif-clear-btn" id="notifMarkAllReadBtn">Marcar como lidas</button>
                        </div>
                        <div class="notif-list" id="notifListContainer">
                            <div class="notif-empty">Carregando avisos...</div>
                        </div>
                    </div>
                </div>
                <div class="topbar-user">
                    <a class="topbar-user-link" href="indexPerfil.html#perfil" aria-label="Abrir perfil da conta">
                        <div class="user-text">
                            <strong id="accountName" data-account-name>${sessao.nome || "Usuário"}</strong>
                            <span id="accountEmail" data-account-email>${sessao.email || ""}</span>
                        </div>
                    </a>
                </div>
            </div>
        `;
    }

    window.definirTituloMarcaTopbar = function (nomeMarca) {
        const breadcrumbTitle = document.getElementById("breadcrumbTitle");
        if (breadcrumbTitle && nomeMarca) {
            breadcrumbTitle.innerHTML = `Visualização da Marca: <strong>${nomeMarca}</strong>`;
        }
    };

    function aplicarNomeEEmail(nome, email) {
        const nomeLimpo = String(nome || email || "Conta").trim();
        const emailLimpo = String(email || sessao.email || "").trim();

        document.querySelectorAll("[data-account-name]").forEach(el => {
            el.textContent = nomeLimpo;
        });
        document.querySelectorAll("[data-account-email]").forEach(el => {
            el.textContent = emailLimpo;
        });
    }

    aplicarNomeEEmail(sessao.nome, sessao.email);
    verificarEExibirModalPrimeiroAcesso(sessao);

    const bellBtn = document.getElementById("notifBellBtn");
    const dropdownEl = document.getElementById("notifDropdown");
    const badgeEl = document.getElementById("notifBadgeCount");
    const listEl = document.getElementById("notifListContainer");
    const markReadBtn = document.getElementById("notifMarkAllReadBtn");
    let notificacoesAtuais = [];

    function renderizarPainelNotificacoes() {
        if (!listEl || !badgeEl) return;
        const lidasPermanentes = new Set(obterNotificacoesLidas());
        const lidasSessao = new Set(obterNotificacoesSessaoDispensadas());

        const naoLidas = notificacoesAtuais.filter(
            n => !lidasPermanentes.has(n.id) && !lidasSessao.has(n.id)
        );

        if (naoLidas.length > 0) {
            badgeEl.textContent = String(naoLidas.length);
            badgeEl.hidden = false;
        } else {
            badgeEl.hidden = true;
        }

        listEl.replaceChildren();
        if (naoLidas.length === 0) {
            listEl.innerHTML = `<div class="notif-empty">Nenhuma notificação pendente.</div>`;
            return;
        }

        naoLidas.forEach(n => {
            const a = document.createElement("a");
            a.className = "notif-item unread";
            a.href = n.link || "#";
            a.innerHTML = `
                <div class="notif-item-title">
                    <span>${n.titulo}</span>
                </div>
                <span class="notif-item-desc">${n.descricao}</span>
            `;
            a.addEventListener("click", () => {
                marcarNotificacoesComoLidas([n.id]);
                renderizarPainelNotificacoes();
            });
            listEl.appendChild(a);
        });
    }

    bellBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const vaiAbrir = dropdownEl.hidden;
        dropdownEl.hidden = !vaiAbrir;
        bellBtn.setAttribute("aria-expanded", String(vaiAbrir));
    });

    markReadBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        marcarNotificacoesComoLidas(notificacoesAtuais.map(n => n.id));
        renderizarPainelNotificacoes();
    });

    document.addEventListener("click", (e) => {
        const wrapper = document.getElementById("notifWrapper");
        if (wrapper && dropdownEl && !wrapper.contains(e.target)) {
            dropdownEl.hidden = true;
            bellBtn?.setAttribute("aria-expanded", "false");
        }
    });

    carregarNotificacoesDaPlataforma(sessao).then(lista => {
        notificacoesAtuais = lista;
        renderizarPainelNotificacoes();
    });

    window.atualizarNotificacoesPlataforma = async function () {
        notificacoesAtuais = await carregarNotificacoesDaPlataforma(sessao);
        renderizarPainelNotificacoes();
    };

    if (typeof apiRequest === "function" && localStorage.getItem("rbs_token")) {
        apiRequest("/auth/eu", "GET")
            .then(eu => {
                if (eu && (eu.nome || eu.email)) {
                    const nomeReal = (eu.nome || eu.email).trim();
                    const emailReal = (eu.email || sessao.email || "").trim();
                    aplicarNomeEEmail(nomeReal, emailReal);

                    const mudouCotaOuPerfil =
                        (eu.marcaCota && eu.marcaCota !== sessao.marcaCota) ||
                        (eu.perfil && eu.perfil !== sessao.perfilApi);
                    sessao.nome = nomeReal;
                    sessao.email = emailReal;
                    sessao.precisaTrocarSenha = Boolean(eu.precisaTrocarSenha);
                    if (eu.perfil) sessao.perfilApi = eu.perfil;
                    if (eu.marcaCota) sessao.marcaCota = eu.marcaCota;
                    localStorage.setItem("rbs_sessao", JSON.stringify(sessao));

                    verificarEExibirModalPrimeiroAcesso(sessao);
                    if (mudouCotaOuPerfil) {
                        inicializarLayoutPortal();
                    }
                }
            })
            .catch(() => { });
    }

    const botaoLogout = document.getElementById("logoutButton");
    if (botaoLogout) {
        botaoLogout.addEventListener("click", function () {
            if (!window.confirm("Deseja realmente sair da plataforma?")) return;
            sessionStorage.removeItem("rbs_usuario_email");
            sessionStorage.removeItem(NOTIFS_SESSAO_DISPENSADAS_KEY);
            localStorage.removeItem("rbs_sessao");
            localStorage.removeItem("rbs_token");
            window.location.replace("indexLogin.html");
        });
    }
}

document.addEventListener("DOMContentLoaded", inicializarLayoutPortal);
window.addEventListener("storage", function (event) {
    if (event.key === "rbs_sessao") {
        inicializarLayoutPortal();
    }
});