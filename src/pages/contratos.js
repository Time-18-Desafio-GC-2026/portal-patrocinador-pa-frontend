document.addEventListener("DOMContentLoaded", async function () {
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    if (!sessao) return;

    const ehPatrocinador = String(sessao.perfil || "").toLowerCase() === "patrocinador";
    const visaoPatrocinador = document.getElementById("visaoContratoPatrocinador");
    const visaoAdmin = document.getElementById("visaoContratoAdmin");

    function parseSignatarioJson(descricao) {
        if (!descricao) return null;
        try {
            return JSON.parse(descricao);
        } catch {
            return null;
        }
    }

    function calcularEstadoContrato(materiais) {
        const todos = materiais || [];
        const regSignatario = todos.find(m => m.tipoMaterial === "DADOS_SIGNATARIO");
        const signatario = regSignatario ? parseSignatarioJson(regSignatario.descricao) : null;

        const pdfs = todos.filter(m => m.tipoMaterial === "CONTRATO");
        const pdfConsolidado = pdfs.find(
            m => m.status === "CONTRATO_CONSOLIDADO" || m.status === "CONTRATO_FINALIZADO" || m.autorPerfil === "PATROCINADOR"
        );
        const pdfEnviadoRbs = pdfs.find(
            m => m.autorPerfil !== "PATROCINADOR" && m.status !== "CONTRATO_CONSOLIDADO"
        ) || pdfs[0] || null;

        if (pdfConsolidado) {
            return {
                codigo: "CONSOLIDADO",
                rotulo: "Contrato Consolidado",
                bg: "#dcfce7",
                cor: "#166534",
                signatario,
                regSignatario,
                pdfAtivo: pdfConsolidado
            };
        }

        if (pdfEnviadoRbs && signatario?.nome) {
            return {
                codigo: "ENVIADO",
                rotulo: "Contrato Enviado",
                bg: "#fef3c7",
                cor: "#92400e",
                signatario,
                regSignatario,
                pdfAtivo: pdfEnviadoRbs
            };
        }

        return {
            codigo: "PENDENTE",
            rotulo: "Dados Pendentes",
            bg: "#fee2e2",
            cor: "#b42318",
            signatario,
            regSignatario,
            pdfAtivo: null
        };
    }

    if (ehPatrocinador) {
        if (visaoPatrocinador) visaoPatrocinador.hidden = false;
        const marcaId = sessao.patrocinadorId;
        const stepperEl = document.getElementById("stepperContratoCliente");
        const inputNome = document.getElementById("signatarioNome");
        const inputCargo = document.getElementById("signatarioCargo");
        const formSignatario = document.getElementById("formSignatarioContrato");
        const msgSignatario = document.getElementById("msgSignatarioCliente");
        const boxArquivo = document.getElementById("boxArquivoContratoCliente");
        const formReenviar = document.getElementById("formReenviarContratoAssinado");
        const inputPdfCliente = document.getElementById("inputPdfAssinadoCliente");
        const msgUploadCliente = document.getElementById("msgUploadContratoCliente");
        const btnReenviar = document.getElementById("btnReenviarContratoCliente");

        let estadoAtualCache = null;

        async function carregarContratoDoPatrocinador() {
            const materiais = await apiRequest(`/marcas/${marcaId}/materiais?abaDestino=ABA_7_CONTRATO`, "GET").catch(() => []);
            const estado = calcularEstadoContrato(materiais);
            estadoAtualCache = estado;

            if (estado.signatario) {
                if (inputNome) inputNome.value = estado.signatario.nome || "";
                if (inputCargo) inputCargo.value = estado.signatario.cargo || "";
            }

            const temSignatario = Boolean(estado.signatario?.nome);
            if (stepperEl) {
                stepperEl.innerHTML = `
                    <div class="contrato-step ${temSignatario ? "concluido" : "ativo"}">
                        <strong>1. Dados do Representante</strong>
                        <span>${temSignatario ? `Enviado: ${estado.signatario.nome} (${estado.signatario.cargo})` : "Preencha nome e cargo de quem assina"}</span>
                    </div>
                    <div class="contrato-step ${estado.codigo === "CONSOLIDADO" ? "concluido" : (estado.codigo === "ENVIADO" ? "ativo" : "")}">
                        <strong>2. Contrato Enviado pela RBS</strong>
                        <span>${estado.pdfAtivo ? "Disponível para download e assinatura" : "Aguardando envio do PDF pela RBS"}</span>
                    </div>
                    <div class="contrato-step ${estado.codigo === "CONSOLIDADO" ? "concluido" : ""}">
                        <strong>3. Contrato Consolidado</strong>
                        <span>${estado.codigo === "CONSOLIDADO" ? "Contrato assinado por ambas as partes" : "Reenvie o PDF assinado pela empresa"}</span>
                    </div>
                `;
            }

            if (boxArquivo) {
                boxArquivo.replaceChildren();
                if (!estado.pdfAtivo) {
                    boxArquivo.innerHTML = `
                        <p class="envios-patrocinador-vazio">
                            ${temSignatario
                            ? "Seus dados de representante foram enviados. Aguarde a RBS disponibilizar o contrato em PDF."
                            : "Preencha os dados do representante legal ao lado para que a RBS gere e envie o seu contrato."}
                        </p>
                    `;
                    if (formReenviar) formReenviar.hidden = true;
                } else {
                    const urlPdf = estado.pdfAtivo.caminhoStorage || estado.pdfAtivo.urlExterna;
                    boxArquivo.innerHTML = `
                        <div class="envio-item">
                            <div class="envio-linha">
                                <div>
                                    <span class="envio-status" style="background:${estado.bg}; color:${estado.cor}; margin-bottom:4px;">${estado.rotulo}</span>
                                    <p class="envio-texto"><strong>${estado.pdfAtivo.titulo}</strong></p>
                                </div>
                                <a href="${urlPdf}" target="_blank" rel="noopener noreferrer" download="${estado.pdfAtivo.titulo}" class="button button-primary">
                                    Baixar Contrato (PDF)
                                </a>
                            </div>
                        </div>
                    `;
                    if (formReenviar) {
                        formReenviar.hidden = estado.codigo === "CONSOLIDADO";
                    }
                }
            }
        }

        formSignatario?.addEventListener("submit", async (e) => {
            e.preventDefault();
            msgSignatario.textContent = "";
            const nome = inputNome.value.trim();
            const cargo = inputCargo.value.trim();
            if (!nome || !cargo) return;

            try {
                if (estadoAtualCache?.regSignatario?.id) {
                    await apiRequest(`/materiais/${estadoAtualCache.regSignatario.id}`, "DELETE").catch(() => { });
                }
                await apiUploadMaterial(marcaId, {
                    titulo: `Representante Legal: ${nome} (${cargo})`,
                    descricao: JSON.stringify({ nome, cargo }),
                    abaDestino: "ABA_7_CONTRATO",
                    tipoMaterial: "DADOS_SIGNATARIO",
                    caminhoStorage: null,
                    urlExterna: "https://portal.rbs.com.br/signatario"
                }, null);

                msgSignatario.style.color = "#15803d";
                msgSignatario.textContent = "Dados do representante salvos com sucesso!";
                await carregarContratoDoPatrocinador();
                if (typeof window.atualizarNotificacoesPlataforma === "function") {
                    await window.atualizarNotificacoesPlataforma();
                }
            } catch (erro) {
                msgSignatario.style.color = "#b42318";
                msgSignatario.textContent = erro.message || "Erro ao salvar dados do representante.";
            }
        });

        formReenviar?.addEventListener("submit", async (e) => {
            e.preventDefault();
            msgUploadCliente.textContent = "";
            const arquivo = inputPdfCliente?.files?.[0];
            if (!arquivo) return;

            btnReenviar.disabled = true;
            btnReenviar.textContent = "Enviando...";

            try {
                await apiUploadMaterial(marcaId, {
                    titulo: arquivo.name,
                    descricao: "Contrato consolidado e assinado pelo patrocinador",
                    abaDestino: "ABA_7_CONTRATO",
                    tipoMaterial: "CONTRATO",
                    caminhoStorage: null,
                    urlExterna: null
                }, arquivo);

                formReenviar.reset();
                msgUploadCliente.style.color = "#15803d";
                msgUploadCliente.textContent = "Contrato assinado enviado e consolidado com sucesso!";
                await carregarContratoDoPatrocinador();
                if (typeof window.atualizarNotificacoesPlataforma === "function") {
                    await window.atualizarNotificacoesPlataforma();
                }
            } catch (erro) {
                msgUploadCliente.style.color = "#b42318";
                msgUploadCliente.textContent = erro.message || "Não foi possível enviar o contrato assinado.";
            } finally {
                btnReenviar.disabled = false;
                btnReenviar.textContent = "Enviar Contrato Assinado";
            }
        });

        await carregarContratoDoPatrocinador();
        return;
    }

    if (visaoAdmin) visaoAdmin.hidden = false;
    const containerAccordion = document.getElementById("listaContratosAccordion");
    const inputBusca = document.getElementById("buscaContratoMarca");
    let listaConsolidadaAdmin = [];

    function renderizarAccordionContratos(lista) {
        if (!containerAccordion) return;
        containerAccordion.replaceChildren();

        if (lista.length === 0) {
            containerAccordion.innerHTML = `<div class="patrocinadores-vazio" style="border:0;">Nenhum patrocinador encontrado.</div>`;
            return;
        }

        lista.forEach(({ marca, logoUrl, estado, todosPdfs }) => {
            const item = document.createElement("div");
            item.className = "pesquisa-accordion-item";

            const header = document.createElement("div");
            header.className = "pesquisa-accordion-header";

            const iniciais = String(marca.nome || "M").slice(0, 2).toUpperCase();
            const htmlLogo = logoUrl ? `<img src="${logoUrl}" alt="${marca.nome}">` : iniciais;

            header.innerHTML = `
                <div class="pesquisa-marca-identidade">
                    <div class="pesquisa-marca-logo">${htmlLogo}</div>
                    <div>
                        <strong style="color: var(--text-strong); font-size: 14px; display: block;">${marca.nome}</strong>
                        <small style="color: var(--text-muted); font-size: 12px;">CNPJ: ${marca.cnpj || "Não informado"} • Cota: ${marca.cota}</small>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="patrocinador-cota" style="background: ${estado.bg}; color: ${estado.cor}; margin: 0;">${estado.rotulo}</span>
                    <button type="button" class="botao-recolher" aria-expanded="false">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                </div>
            `;

            const body = document.createElement("div");
            body.className = "pesquisa-accordion-body";
            body.hidden = true;

            const temSignatario = Boolean(estado.signatario?.nome);
            const infoSignatario = temSignatario
                ? `<strong>Representante Legal:</strong> ${estado.signatario.nome} - <strong>Cargo:</strong> ${estado.signatario.cargo}`
                : `<em style="color: #b42318;">O patrocinador ainda não preencheu o nome e cargo de quem assinará o contrato.</em>`;

            const urlPdf = estado.pdfAtivo ? (estado.pdfAtivo.caminhoStorage || estado.pdfAtivo.urlExterna) : "";

            if (!temSignatario) {
                body.innerHTML = `
                    <div class="pesquisa-linha-pergunta" style="margin-bottom: 10px;">
                        ${infoSignatario}
                    </div>
                    <div class="pesquisa-linha-pergunta" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong>Status do Contrato:</strong>
                            <span style="color:#64748b;">Aguardando o envio dos dados do representante legal pelo patrocinador para liberar o envio do contrato.</span>
                        </div>
                        <button type="button" class="button button-primary btn-notificar-parceiro-contrato">
                            Notificar Marca Parceira
                        </button>
                    </div>
                `;

                const btnNotificar = body.querySelector(".btn-notificar-parceiro-contrato");
                btnNotificar.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    btnNotificar.disabled = true;
                    btnNotificar.textContent = "Notificando...";
                    try {
                        await apiRequest(`/marcas/${marca.id}/indicadores`, "POST", {
                            secao: "SISTEMA_NOTIF",
                            nomeIndicador: "COBRANCA_CONTRATO",
                            valorNumerico: 1,
                            valorTexto: String(Date.now()),
                            fonteDados: "Notificação de Pendência Contratual RBS"
                        });
                        alert(`Notificação enviada com sucesso para ${marca.nome}! O aviso aparecerá em destaque no sino de notificações da marca.`);
                    } catch (erro) {
                        alert(erro.message || "Não foi possível enviar a notificação.");
                    } finally {
                        btnNotificar.disabled = false;
                        btnNotificar.textContent = "Notificar Marca Parceira";
                    }
                });
            } else {
                body.innerHTML = `
                    <div class="pesquisa-linha-pergunta" style="margin-bottom: 10px;">
                        ${infoSignatario}
                    </div>
                    <div class="pesquisa-linha-pergunta" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong>Arquivo do Contrato:</strong>
                            ${estado.pdfAtivo ? `<span>${estado.pdfAtivo.titulo} (${estado.rotulo})</span>` : `<span style="color:#64748b;">Nenhum PDF enviado ainda.</span>`}
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${urlPdf && urlPdf !== "#" ? `<a href="${urlPdf}" target="_blank" rel="noopener noreferrer" download="${estado.pdfAtivo.titulo}" class="btn-acao-pequeno">Visualizar / Baixar PDF</a>` : ""}
                            <button type="button" class="button button-primary btn-upload-contrato-rbs">
                                ${estado.pdfAtivo ? "Substituir Contrato (PDF)" : "Enviar Contrato Assinado pela RBS (PDF)"}
                            </button>
                            <input type="file" accept=".pdf,application/pdf" class="input-hidden-pdf-rbs" hidden>
                        </div>
                    </div>
                `;

                const btnUpload = body.querySelector(".btn-upload-contrato-rbs");
                const inputPdf = body.querySelector(".input-hidden-pdf-rbs");

                btnUpload.addEventListener("click", (e) => {
                    e.stopPropagation();
                    inputPdf.click();
                });

                inputPdf.addEventListener("change", async () => {
                    const arquivo = inputPdf.files?.[0];
                    if (!arquivo) return;
                    btnUpload.disabled = true;
                    btnUpload.textContent = "Enviando...";
                    try {
                        for (const p of todosPdfs) {
                            await apiRequest(`/materiais/${p.id}`, "DELETE").catch(() => { });
                        }
                        const novo = await apiUploadMaterial(marca.id, {
                            titulo: arquivo.name,
                            descricao: "Contrato preenchido e assinado pela RBS",
                            abaDestino: "ABA_7_CONTRATO",
                            tipoMaterial: "CONTRATO",
                            caminhoStorage: null,
                            urlExterna: null
                        }, arquivo);
                        if (novo?.id) {
                            await apiRequest(`/materiais/${novo.id}/status`, "PATCH", {
                                status: "CONTRATO_ENVIADO"
                            }).catch(() => { });
                        }
                        await carregarContratosAdmin();
                    } catch (erro) {
                        alert(erro.message || "Erro ao enviar o PDF do contrato.");
                    } finally {
                        btnUpload.disabled = false;
                    }
                });
            }

            const btnToggle = header.querySelector(".botao-recolher");
            header.addEventListener("click", () => {
                const vaiFechar = !body.hidden;
                body.hidden = vaiFechar;
                btnToggle.setAttribute("aria-expanded", String(!vaiFechar));
            });

            item.append(header, body);
            containerAccordion.appendChild(item);
        });
    }

    async function carregarContratosAdmin() {
        const marcas = (await apiRequest("/marcas", "GET").catch(() => [])) || [];
        listaConsolidadaAdmin = [];

        for (const marca of marcas) {
            const materiais = await apiRequest(`/marcas/${marca.id}/materiais`, "GET").catch(() => []);
            const fotoMat = (materiais || []).find(m => m.tipoMaterial === "FOTO_EMPRESA");
            const logoUrl = fotoMat ? (fotoMat.caminhoStorage || fotoMat.urlExterna) : "";
            const matContrato = (materiais || []).filter(
                m => m.abaDestino === "ABA_7_CONTRATO" || m.tipoMaterial === "CONTRATO" || m.tipoMaterial === "DADOS_SIGNATARIO"
            );
            const estado = calcularEstadoContrato(matContrato);
            const todosPdfs = matContrato.filter(m => m.tipoMaterial === "CONTRATO");
            listaConsolidadaAdmin.push({ marca, logoUrl, estado, todosPdfs });
        }

        filtrarERenderizar();
    }

    function filtrarERenderizar() {
        const termo = (inputBusca?.value || "").trim().toLowerCase();
        const filtrada = !termo
            ? listaConsolidadaAdmin
            : listaConsolidadaAdmin.filter(({ marca }) =>
                String(marca.nome || "").toLowerCase().includes(termo) ||
                String(marca.cnpj || "").toLowerCase().includes(termo)
            );
        renderizarAccordionContratos(filtrada);
    }

    inputBusca?.addEventListener("input", filtrarERenderizar);
    await carregarContratosAdmin();
});