const PRAZO_PESQUISA_STORAGE_KEY = "rbs_pesquisa_data_limite";

document.addEventListener("DOMContentLoaded", async function () {
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    if (!sessao) return;

    const ehPatrocinador = String(sessao.perfil || "").toLowerCase() === "patrocinador";
    const visaoPatrocinador = document.getElementById("visaoPatrocinadorMaster");
    const visaoAdmin = document.getElementById("visaoAdminPesquisa");

    function formatarData(valor) {
        if (!valor) return "";
        const d = new Date(valor);
        return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR");
    }


    if (ehPatrocinador) {
        if (visaoPatrocinador) visaoPatrocinador.hidden = false;
        const marcaId = sessao.patrocinadorId;
        const form = document.getElementById("masterQuestionsForm");
        const msgEl = document.getElementById("pesquisaMensagem");
        const listaEl = document.getElementById("listaMinhasPerguntas");
        const btnSalvar = document.getElementById("btnSalvarPerguntas");

        async function carregarPerguntasDoCliente() {
            try {
                const [marcaInfo, perguntas] = await Promise.all([
                    apiRequest(`/marcas/${marcaId}`, "GET").catch(() => null),
                    apiRequest(`/marcas/${marcaId}/pesquisa-perguntas`, "GET").catch(() => [])
                ]);

                const nomeDaMarca = marcaInfo?.nome || sessao.marcaNome || "Sua Marca";
                listaEl.replaceChildren();

                for (let n = 1; n <= 3; n++) {
                    const input = document.getElementById(`perguntaInput${n}`);
                    const encontrada = (perguntas || []).find(p => Number(p.numeroPergunta) === n);
                    if (input) input.value = encontrada ? encontrada.textoPergunta : "";
                }

                if (!perguntas || perguntas.length === 0) {
                    const p = document.createElement("p");
                    p.className = "envios-patrocinador-vazio";
                    p.textContent = "Sua marca ainda não cadastrou nenhuma das 3 perguntas personalizadas.";
                    listaEl.appendChild(p);
                    return;
                }

                perguntas.forEach(q => {
                    const card = document.createElement("article");
                    card.className = "envio-patrocinador-item";
                    const nomeAutor = q.autorNome || sessao.nome || sessao.email;
                    const marcaRepresentada = q.marcaNome || nomeDaMarca;
                    card.innerHTML = `
                        <p class="envio-patrocinador-texto"><strong>Pergunta ${q.numeroPergunta}:</strong> ${q.textoPergunta}</p>
                        <p class="envio-patrocinador-detalhes">
                            Registrada por: <strong>${nomeAutor}</strong> • Representando: <strong>${marcaRepresentada}</strong> • Última atualização: ${formatarData(q.atualizadoEm)}
                        </p>
                    `;
                    listaEl.appendChild(card);
                });
            } catch (erro) {
                console.error("Erro ao carregar perguntas:", erro);
            }
        }

        form?.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (msgEl) msgEl.textContent = "";
            if (btnSalvar) {
                btnSalvar.disabled = true;
                btnSalvar.textContent = "Salvando no banco...";
            }

            try {
                for (let num = 1; num <= 3; num++) {
                    const input = document.getElementById(`perguntaInput${num}`);
                    const texto = input ? input.value.trim() : "";
                    if (texto) {
                        await apiRequest(`/marcas/${marcaId}/pesquisa-perguntas`, "POST", {
                            numeroPergunta: num,
                            textoPergunta: texto
                        });
                    }
                }
                if (msgEl) {
                    msgEl.classList.remove("is-error");
                    msgEl.textContent = "Suas perguntas foram salvas com sucesso e enviadas à equipe de pesquisa da RBS!";
                }
                await carregarPerguntasDoCliente();
            } catch (erro) {
                if (msgEl) {
                    msgEl.classList.add("is-error");
                    msgEl.textContent = erro.message || "Não foi possível salvar as perguntas.";
                }
            } finally {
                if (btnSalvar) {
                    btnSalvar.disabled = false;
                    btnSalvar.textContent = "Salvar Perguntas na Pesquisa Oficial";
                }
            }
        });

        await carregarPerguntasDoCliente();
        return;
    }


    if (visaoAdmin) visaoAdmin.hidden = false;
    const containerLista = document.getElementById("listaPesquisaAccordion");
    const inputBusca = document.getElementById("buscaMarcaPesquisa");
    const btnImportarPdf = document.getElementById("btnExportarPerguntasPdf");
    const inputDataLimite = document.getElementById("inputDataLimitePesquisa");
    const btnSalvarDataLimite = document.getElementById("btnSalvarDataLimitePesquisa");

    let consolidadoMaster = [];


    function ordenarPorMaisPerguntas(lista) {
        return [...(lista || [])].sort((a, b) => {
            const diff = (b.perguntas?.length || 0) - (a.perguntas?.length || 0);
            if (diff !== 0) return diff;
            return String(a.marca.nome || "").localeCompare(String(b.marca.nome || ""), "pt-BR");
        });
    }

    function renderizarListaMaster(listaFiltrada) {
        if (!containerLista) return;
        containerLista.replaceChildren();

        const ordenada = ordenarPorMaisPerguntas(listaFiltrada);

        if (ordenada.length === 0) {
            containerLista.innerHTML = `
                <div class="patrocinadores-vazio" style="border: 0; border-radius: 0;">
                    Nenhum patrocinador da cota <strong>Master</strong> encontrado.
                </div>
            `;
            return;
        }

        ordenada.forEach(({ marca, perguntas, logoUrl }) => {
            const qtdEnviadas = Math.min(3, (perguntas || []).length);
            const concluido = qtdEnviadas === 3;

            const textoTag = concluido ? "3/3 Concluído" : `${qtdEnviadas}/3`;
            const bgTag = concluido ? "#dcfce7" : (qtdEnviadas > 0 ? "#fef3c7" : "#fee2e2");
            const corTag = concluido ? "#166534" : (qtdEnviadas > 0 ? "#92400e" : "#b42318");

            const item = document.createElement("div");
            item.className = "pesquisa-accordion-item";

            const header = document.createElement("div");
            header.className = "pesquisa-accordion-header";

            const iniciais = String(marca.nome || "M").slice(0, 2).toUpperCase();
            const htmlLogo = logoUrl
                ? `<img src="${logoUrl}" alt="${marca.nome}">`
                : iniciais;

            header.innerHTML = `
                <div class="pesquisa-marca-identidade">
                    <div class="pesquisa-marca-logo">${htmlLogo}</div>
                    <div>
                        <strong style="color: var(--text-strong); font-size: 14px; display: block;">${marca.nome}</strong>
                        <small style="color: var(--text-muted); font-size: 12px;">CNPJ: ${marca.cnpj || "Não informado"}</small>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="patrocinador-cota" style="background: ${bgTag}; color: ${corTag}; margin: 0;">${textoTag}</span>
                    <button type="button" class="botao-recolher" aria-expanded="false" title="Expandir perguntas">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                </div>
            `;

            const body = document.createElement("div");
            body.className = "pesquisa-accordion-body";
            body.hidden = true;

            for (let i = 1; i <= 3; i++) {
                const p = (perguntas || []).find(q => Number(q.numeroPergunta) === i);
                const linha = document.createElement("div");
                linha.className = "pesquisa-linha-pergunta";
                linha.innerHTML = p
                    ? `<strong>Pergunta ${i}:</strong> ${p.textoPergunta} <span style="float:right; color:#64748b; font-size:11px;">Autor: ${p.autorNome || "-"} • ${formatarData(p.atualizadoEm)}</span>`
                    : `<strong>Pergunta ${i}:</strong> <em style="color:#94a3b8;">Ainda não enviada pelo patrocinador.</em>`;
                body.appendChild(linha);
            }

            const btnToggle = header.querySelector(".botao-recolher");
            header.addEventListener("click", () => {
                const vaiFechar = !body.hidden;
                body.hidden = vaiFechar;
                btnToggle.setAttribute("aria-expanded", String(!vaiFechar));
            });

            item.append(header, body);
            containerLista.appendChild(item);
        });
    }

    function obterListaFiltrada() {
        const termo = (inputBusca?.value || "").trim().toLowerCase();
        const filtrada = !termo
            ? consolidadoMaster
            : consolidadoMaster.filter(({ marca }) =>
                String(marca.nome || "").toLowerCase().includes(termo) ||
                String(marca.cnpj || "").toLowerCase().includes(termo)
            );
        return ordenarPorMaisPerguntas(filtrada);
    }

    async function carregarPainelAdminPesquisa() {
        try {
            const todasMarcas = (await apiRequest("/marcas", "GET")) || [];
            const marcasMaster = todasMarcas.filter(m => String(m.cota).toUpperCase() === "MASTER");
            consolidadoMaster = [];
            let dataLimiteEncontrada = localStorage.getItem(PRAZO_PESQUISA_STORAGE_KEY) || "";

            for (const marca of marcasMaster) {
                const [perguntas, materiais] = await Promise.all([
                    apiRequest(`/marcas/${marca.id}/pesquisa-perguntas`, "GET").catch(() => []),
                    apiRequest(`/marcas/${marca.id}/materiais`, "GET").catch(() => [])
                ]);
                const fotoMat = (materiais || []).find(mat => mat.tipoMaterial === "FOTO_EMPRESA");
                const prazoMat = (materiais || []).find(mat => mat.tipoMaterial === "PRAZO_PESQUISA");
                if (prazoMat?.descricao && !dataLimiteEncontrada) {
                    dataLimiteEncontrada = prazoMat.descricao;
                }
                const logoUrl = fotoMat ? (fotoMat.caminhoStorage || fotoMat.urlExterna) : "";
                consolidadoMaster.push({
                    marca,
                    perguntas: perguntas || [],
                    logoUrl,
                    prazoMatId: prazoMat?.id || null
                });
            }

            if (inputDataLimite && dataLimiteEncontrada) {
                inputDataLimite.value = dataLimiteEncontrada;
                localStorage.setItem(PRAZO_PESQUISA_STORAGE_KEY, dataLimiteEncontrada);
            }

            renderizarListaMaster(obterListaFiltrada());
        } catch (erro) {
            console.error("Erro ao carregar pesquisa admin:", erro);
        }
    }

    btnSalvarDataLimite?.addEventListener("click", async () => {
        const novaData = inputDataLimite?.value;
        if (!novaData) {
            alert("Selecione uma data limite válida.");
            return;
        }
        btnSalvarDataLimite.disabled = true;
        btnSalvarDataLimite.textContent = "Salvando...";
        try {
            localStorage.setItem(PRAZO_PESQUISA_STORAGE_KEY, novaData);
            for (const item of consolidadoMaster) {
                await apiRequest(`/marcas/${item.marca.id}/indicadores`, "POST", {
                    secao: "SISTEMA_CONFIG",
                    nomeIndicador: "PRAZO_PESQUISA",
                    valorNumerico: 0,
                    valorTexto: novaData,
                    fonteDados: "Configuração de Prazo RBS"
                }).catch(() => { });
            }
            if (typeof window.atualizarNotificacoesPlataforma === "function") {
                await window.atualizarNotificacoesPlataforma();
            }
            const dataPt = new Date(novaData + "T00:00:00").toLocaleDateString("pt-BR");
            alert(`Data limite definida para ${dataPt}! A notificação já está ativa no sino da barra superior dos patrocinadores Master.`);
        } catch (erro) {
            alert(erro.message || "Não foi possível salvar a data limite.");
        } finally {
            btnSalvarDataLimite.disabled = false;
            btnSalvarDataLimite.textContent = "Salvar Prazo";
        }
    });

    inputBusca?.addEventListener("input", () => {
        renderizarListaMaster(obterListaFiltrada());
    });


    btnImportarPdf?.addEventListener("click", () => {
        const lista = obterListaFiltrada();
        if (lista.length === 0) {
            alert("Não há patrocinadores Master listados para exportar.");
            return;
        }

        const linhasHtml = lista.map(({ marca, perguntas }) => {
            const q1 = perguntas.find(p => Number(p.numeroPergunta) === 1)?.textoPergunta || "<em>Pendente de envio</em>";
            const q2 = perguntas.find(p => Number(p.numeroPergunta) === 2)?.textoPergunta || "<em>Pendente de envio</em>";
            const q3 = perguntas.find(p => Number(p.numeroPergunta) === 3)?.textoPergunta || "<em>Pendente de envio</em>";
            const statusTxt = perguntas.length === 3 ? "3/3 Concluído" : `${perguntas.length}/3`;
            return `
                <tr>
                    <td><strong>${marca.nome}</strong><br><small>${marca.cnpj || "-"}</small></td>
                    <td>1. ${q1}<br>2. ${q2}<br>3. ${q3}</td>
                    <td>${statusTxt}</td>
                </tr>
            `;
        }).join("");

        const agora = new Date();
        const dataEmissaoUnicaLinha = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")}`;

        const janelaPdf = window.open("", "_blank", "width=950,height=750");
        if (!janelaPdf) {
            alert("Permita pop-ups no navegador para gerar o documento PDF.");
            return;
        }

        janelaPdf.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Pauta Pesquisa de Ativação Planeta Atlântida</title>
                <style>
                    @page { size: A4 portrait; margin: 12mm; }
                    body { font-family: Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; }
                    .header { border-bottom: 3px solid #f47b20; padding-bottom: 10px; margin-bottom: 16px; }
                    .header h1 { margin: 0 0 6px; color: #101d4d; font-size: 20px; white-space: nowrap; }
                    .sub-row { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: #64748b; white-space: nowrap; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #cbd5e1; padding: 9px 11px; text-align: left; font-size: 11.5px; vertical-align: top; line-height: 1.45; }
                    th { background: #101d4d; color: #ffffff; }
                    tr:nth-child(even) { background: #f8fafc; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Pauta Pesquisa de Ativação Planeta Atlântida</h1>
                    <div class="sub-row">
                        <span>Documento Oficial de Auditoria e Pesquisa • Grupo RBS</span>
                        <strong>Emitido em: ${dataEmissaoUnicaLinha}</strong>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 24%;">Patrocinador Master</th>
                            <th style="width: 62%;">Perguntas Cadastradas</th>
                            <th style="width: 14%;">Status</th>
                        </tr>
                    </thead>
                    <tbody>${linhasHtml}</tbody>
                </table>
                <script>window.onload = function() { window.print(); };<\/script>
            </body>
            </html>
        `);
        janelaPdf.document.close();
    });

    await carregarPainelAdminPesquisa();
});