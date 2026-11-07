var HISTORICO_KEY = "rbs_historico";
var USUARIO_EMAIL_KEY = "rbs_usuario_email";
var TAMANHO_PAGINA_LOGS = 20;

var TEXTOS_PERSONALIZADOS_ACOES = {
    "LOGIN_REALIZADO": "Login realizado na plataforma",
    "PRIMEIRO_ACESSO_CONCLUIDO": "Primeiro acesso e troca de senha concluídos",
    "SENHA_ALTERADA": "Senha da conta alterada",
    "SENHA_RESETADA": "Senha resetada para o padrão",
    "USUARIO_CRIADO": "Novo usuário liberado",
    "USUARIO_ATUALIZADO": "Dados do usuário atualizados",
    "USUARIO_DESATIVADO": "Usuário desativado",
    "USUARIO_REATIVADO": "Usuário reativado",
    "USUARIO_EXCLUIDO": "Usuário excluído",
    "MARCA_CRIADA": "Patrocinador cadastrado",
    "MARCA_ATUALIZADA": "Dados do patrocinador atualizados",
    "MARCA_SENHA_PADRAO_ALTERADA": "Senha padrão da marca alterada",
    "MARCA_DESATIVADA": "Patrocinador desativado",
    "MARCA_EXCLUIDA": "Patrocinador excluído definitivamente",
    "MATERIAL_ENVIADO": "Arquivo ou link enviado",
    "MATERIAL_BAIXADO": "Arquivo visualizado / baixado",
    "MATERIAL_STATUS_ATUALIZADO": "Material atualizado / substituído",
    "PERGUNTA_PESQUISA_SALVA": "Pergunta da pesquisa oficial salva",
    "CORTESIA_ATUALIZADA": "Cortesias atualizadas",
    "INDICADORES_IMPORTADOS": "Planilha de indicadores processada",
    "RELATORIO_VISUALIZADO": "Relatório executivo extraído",
    "DUVIDA_FAQ_ENVIADA": "Pergunta publicada no FAQ",
    "DUVIDA_FAQ_RESPONDIDA": "Resposta oficial publicada no FAQ"
};

var historicoServidorCache = [];
var limiteVisivelAtual = TAMANHO_PAGINA_LOGS;

function registrarHistorico(acao, emailAtor) {
    try {
        var historico = JSON.parse(localStorage.getItem(HISTORICO_KEY) || "[]");
        if (!Array.isArray(historico)) return false;
        historico.push({
            email: emailAtor || sessionStorage.getItem(USUARIO_EMAIL_KEY) || "admin@rbs.com.br",
            codigoAcao: "ACAO_PORTAL",
            acao: acao,
            dataHora: new Date().toISOString()
        });
        localStorage.setItem(HISTORICO_KEY, JSON.stringify(historico));
        return true;
    } catch {
        return false;
    }
}

async function carregarAuditoriaDoBackend() {
    if (typeof apiRequest !== "function" || !localStorage.getItem("rbs_token")) {
        return;
    }
    try {
        const [logsApi, usuariosApi] = await Promise.all([
            apiRequest("/auditoria", "GET"),
            apiRequest("/usuarios", "GET").catch(() => [])
        ]);


        const mapaEmails = {};
        (usuariosApi || []).forEach(u => {
            if (u.id) mapaEmails[String(u.id)] = u.email;
            if (u.nome) mapaEmails[String(u.nome).toLowerCase()] = u.email;
        });

        if (Array.isArray(logsApi)) {
            historicoServidorCache = logsApi.map(function (log) {
                const rawAtor = String(log.atorNome || "").trim();
                const emailResolvido = rawAtor.includes("@")
                    ? rawAtor
                    : (mapaEmails[rawAtor.toLowerCase()] || (rawAtor.toLowerCase().includes("superadmin") ? "admin@rbs.com.br" : rawAtor));

                const codigoAcao = log.acao || "ACAO_PORTAL";
                const rotuloPadrao = TEXTOS_PERSONALIZADOS_ACOES[codigoAcao] || codigoAcao;
                const textoAcao = log.detalhe
                    ? (log.marcaNome ? `${log.detalhe} (${log.marcaNome})` : log.detalhe)
                    : rotuloPadrao;

                return {
                    id: log.id,
                    email: emailResolvido || "admin@rbs.com.br",
                    codigoAcao: codigoAcao,
                    rotuloAcao: rotuloPadrao,
                    acao: textoAcao,
                    dataHora: log.criadoEm
                };
            });
        }
    } catch (erro) {
        console.error("Erro ao carregar auditoria do servidor:", erro);
    }
}

function preencherSelectTiposDeAcao(baseCompleta) {
    const selectAcao = document.getElementById("filterAction");
    if (!selectAcao) return;

    const valorAtual = selectAcao.value;
    const codigosPresentes = [...new Set(baseCompleta.map(item => item.codigoAcao).filter(Boolean))];

    selectAcao.innerHTML = '<option value="">Todas as ações</option>';
    codigosPresentes.forEach(codigo => {
        const opt = document.createElement("option");
        opt.value = codigo;
        opt.textContent = TEXTOS_PERSONALIZADOS_ACOES[codigo] || codigo;
        selectAcao.appendChild(opt);
    });
    selectAcao.value = codigosPresentes.includes(valorAtual) ? valorAtual : "";
}

function obterHistoricoFiltrado() {
    const baseCompleta = historicoServidorCache.length > 0
        ? historicoServidorCache
        : JSON.parse(localStorage.getItem(HISTORICO_KEY) || "[]");

    const ordenados = [...baseCompleta].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

    const emailInput = document.getElementById("filterEmail");
    const dateInput = document.getElementById("filterDate");
    const actionSelect = document.getElementById("filterAction");

    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const data = dateInput ? dateInput.value : "";
    const tipoAcao = actionSelect ? actionSelect.value : "";

    return ordenados.filter(function (registro) {
        const dataHora = new Date(registro.dataHora);
        const dataLocal = [
            dataHora.getFullYear(),
            String(dataHora.getMonth() + 1).padStart(2, "0"),
            String(dataHora.getDate()).padStart(2, "0")
        ].join("-");

        const bateEmail = !email || (registro.email || "").toLowerCase().includes(email);
        const bateData = !data || dataLocal === data;
        const bateAcao = !tipoAcao || registro.codigoAcao === tipoAcao;

        return bateEmail && bateData && bateAcao;
    });
}

function renderizarHistorico() {
    const linhas = document.getElementById("historyRows");
    const containerPaginacao = document.getElementById("paginacaoHistoricoContainer");
    const btnExpandir = document.getElementById("btnExpandirMaisLogs");
    if (!linhas) return;

    const filtrados = obterHistoricoFiltrado();
    linhas.replaceChildren();

    if (filtrados.length === 0) {
        const linha = document.createElement("tr");
        const mensagem = document.createElement("td");
        mensagem.colSpan = 4;
        mensagem.textContent = "Nenhuma atividade encontrada para esses filtros.";
        linha.appendChild(mensagem);
        linhas.appendChild(linha);
        if (containerPaginacao) containerPaginacao.hidden = true;
        return;
    }

    const fatiaVisivel = filtrados.slice(0, limiteVisivelAtual);

    fatiaVisivel.forEach((registro) => {
        const dataHora = new Date(registro.dataHora);
        const linha = document.createElement("tr");
        [
            registro.email || "admin@rbs.com.br",
            dataHora.toLocaleDateString("pt-BR"),
            dataHora.toLocaleTimeString("pt-BR"),
            registro.acao
        ].forEach((valor) => {
            const celula = document.createElement("td");
            celula.textContent = valor;
            linha.appendChild(celula);
        });
        linhas.appendChild(linha);
    });

    if (containerPaginacao && btnExpandir) {
        const restantes = filtrados.length - fatiaVisivel.length;
        if (restantes > 0) {
            containerPaginacao.hidden = false;
            btnExpandir.textContent = `Expandir mais registros (+${Math.min(TAMANHO_PAGINA_LOGS, restantes)} de ${restantes} restantes)`;
        } else {
            containerPaginacao.hidden = true;
        }
    }
}

function exportarRelatorioAuditoriaPdf() {
    const filtrados = obterHistoricoFiltrado();
    if (filtrados.length === 0) {
        alert("Não há registros de auditoria para os filtros selecionados.");
        return;
    }

    const emailFiltro = document.getElementById("filterEmail")?.value || "Todos";
    const dataFiltro = document.getElementById("filterDate")?.value || "Todas";
    const acaoSelect = document.getElementById("filterAction");
    const acaoFiltro = acaoSelect && acaoSelect.value
        ? acaoSelect.options[acaoSelect.selectedIndex].text
        : "Todas as ações";

    const linhasHtml = filtrados.map(reg => {
        const d = new Date(reg.dataHora);
        return `
            <tr>
                <td>${reg.email}</td>
                <td>${d.toLocaleDateString("pt-BR")}</td>
                <td>${d.toLocaleTimeString("pt-BR")}</td>
                <td>${reg.acao}</td>
            </tr>
        `;
    }).join("");

    const janelaPdf = window.open("", "_blank", "width=960,height=760");
    if (!janelaPdf) {
        alert("Permita pop-ups no navegador para gerar o documento PDF de auditoria.");
        return;
    }

    janelaPdf.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório de Comprovação e Auditoria — Portal RBS</title>
            <style>
                body { font-family: Arial, sans-serif; color: #1e293b; margin: 32px; }
                .header { border-bottom: 3px solid #f47b20; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
                .header h1 { margin: 0 0 4px; color: #101d4d; font-size: 20px; }
                .meta { font-size: 12px; color: #64748b; }
                .filtros-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 12px; }
                th { background: #101d4d; color: #ffffff; }
                tr:nth-child(even) { background: #f8fafc; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1>Documento Oficial de Comprovação e Auditoria</h1>
                    <div class="meta">Portal do Patrocinador • Planeta Atlântida (Grupo RBS)</div>
                </div>
                <div class="meta">Emitido em: ${new Date().toLocaleString("pt-BR")}<br>Total de registros: ${filtrados.length}</div>
            </div>
            <div class="filtros-box">
                <strong>Filtros aplicados na emissão:</strong> E-mail: <em>${emailFiltro}</em> | Data: <em>${dataFiltro}</em> | Tipo de ação: <em>${acaoFiltro}</em>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 28%;">E-mail</th>
                        <th style="width: 12%;">Data</th>
                        <th style="width: 12%;">Hora</th>
                        <th style="width: 48%;">Ação Registrada</th>
                    </tr>
                </thead>
                <tbody>${linhasHtml}</tbody>
            </table>
            <script>window.onload = function() { window.print(); };<\/script>
        </body>
        </html>
    `);
    janelaPdf.document.close();
}

document.addEventListener("DOMContentLoaded", async function () {
    const linhas = document.getElementById("historyRows");
    if (!linhas) return;

    await carregarAuditoriaDoBackend();
    preencherSelectTiposDeAcao(historicoServidorCache);
    renderizarHistorico();

    const filtros = document.getElementById("historyFilters");
    const resetPaginacaoERenderizar = () => {
        limiteVisivelAtual = TAMANHO_PAGINA_LOGS;
        renderizarHistorico();
    };

    filtros?.addEventListener("input", resetPaginacaoERenderizar);
    filtros?.addEventListener("change", resetPaginacaoERenderizar);
    filtros?.addEventListener("reset", () => {
        window.setTimeout(resetPaginacaoERenderizar, 0);
    });

    document.getElementById("btnExpandirMaisLogs")?.addEventListener("click", () => {
        limiteVisivelAtual += TAMANHO_PAGINA_LOGS;
        renderizarHistorico();
    });

    document.getElementById("btnImportarLogsPdf")?.addEventListener("click", exportarRelatorioAuditoriaPdf);
});