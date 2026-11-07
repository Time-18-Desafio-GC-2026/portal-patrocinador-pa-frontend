document.addEventListener("DOMContentLoaded", async function () {
    const botaoNovoEnvio = document.getElementById("newSponsorButton");
    const formularioContainer = document.getElementById("newSponsorForm");
    const botaoFechar = document.getElementById("closeSponsorForm");
    const botaoCancelar = document.getElementById("cancelSponsor");
    const formularioEnvio = document.getElementById("sponsorForm");

    const logoContainer = document.getElementById("logoContainerPatrocinador");
    const nomeEmpresa = document.getElementById("nomePatrocinador");
    const badgeCota = document.getElementById("badgeCotaPatrocinador");
    const infoCnpj = document.getElementById("infoCnpjPatrocinador");
    const infoEmail = document.getElementById("infoEmailPatrocinador");
    const infoPlano = document.getElementById("infoPlanoPatrocinador");

    const campoEmail = document.getElementById("sponsorActorEmail");
    const listaMateriaisRBS = document.getElementById("listaMateriaisRBS");
    const listaMeusEnvios = document.getElementById("listaMeusEnvios");
    const resumoCortesiasCliente = document.getElementById("resumoCortesiasCliente");
    const listaContratosCliente = document.getElementById("listaContratosCliente");
    const formContratoAssinado = document.getElementById("formEnviarContratoAssinado");
    const inputContratoPdf = document.getElementById("inputContratoAssinadoPdf");
    const btnContratoAssinado = document.getElementById("btnEnviarContratoAssinado");

    const MAPA_COTA_FRONT = {
        "MASTER": "Master",
        "SUB_COTA_G": "Subcota G",
        "SUB_COTA": "Subcota"
    };

    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    const marcaId = sessao?.patrocinadorId;
    const emailLogado = sessionStorage.getItem("rbs_usuario_email") || sessao?.email || "";

    if (campoEmail) campoEmail.value = emailLogado;
    if (infoEmail) infoEmail.textContent = emailLogado || "Não identificado";

    let contratosAtuaisCache = [];

    async function carregarPainelDoPatrocinador() {
        if (!marcaId) {
            if (botaoNovoEnvio) botaoNovoEnvio.disabled = true;
            return;
        }
        try {
            const [marcaApi, materiaisApi, cortesiaApi] = await Promise.all([
                apiRequest(`/marcas/${marcaId}`, "GET"),
                apiRequest(`/marcas/${marcaId}/materiais`, "GET").catch(() => []),
                apiRequest(`/marcas/${marcaId}/cortesias`, "GET").catch(() => null)
            ]);

            if (nomeEmpresa) nomeEmpresa.textContent = marcaApi.nome;
            if (infoCnpj) infoCnpj.textContent = marcaApi.cnpj || "Não informado";

            const cotaLegivel = MAPA_COTA_FRONT[marcaApi.cota] || marcaApi.cota || "Subcota";
            if (badgeCota) badgeCota.textContent = cotaLegivel;

            const todosMateriais = materiaisApi || [];
            for (const m of todosMateriais) {
                if (m.tipoMaterial === "PRAZO_PESQUISA") {
                    apiRequest(`/materiais/${m.id}`, "DELETE").catch(() => { });
                }
            }
            const fotoMat = todosMateriais.find(m => m.tipoMaterial === "FOTO_EMPRESA");
            const planoMat = todosMateriais.find(m => m.tipoMaterial === "PLANO_COMERCIAL");
            const contratos = todosMateriais.filter(
                m => m.tipoMaterial === "CONTRATO" || m.abaDestino === "ABA_7_CONTRATO" || m.tipoMaterial === "DADOS_SIGNATARIO"
            );
            const demaisMateriais = todosMateriais.filter(
                m => m.tipoMaterial !== "CONTRATO" &&
                    m.abaDestino !== "ABA_7_CONTRATO" &&
                    m.tipoMaterial !== "DADOS_SIGNATARIO" &&
                    m.tipoMaterial !== "FOTO_EMPRESA" &&
                    m.tipoMaterial !== "PLANO_COMERCIAL" &&
                    m.tipoMaterial !== "PRAZO_PESQUISA"
            );


            if (logoContainer) {
                const urlLogo = fotoMat ? (fotoMat.caminhoStorage || fotoMat.urlExterna) : "";
                if (urlLogo) {
                    logoContainer.innerHTML = `<img src="${urlLogo}" alt="Logo de ${marcaApi.nome}">`;
                } else {
                    const iniciais = String(marcaApi.nome || "M").slice(0, 2).toUpperCase();
                    logoContainer.innerHTML = `<strong style="font-size:14px;">${iniciais}</strong>`;
                }
            }


            if (infoPlano) {
                infoPlano.replaceChildren();
                const urlPlano = planoMat ? (planoMat.caminhoStorage || planoMat.urlExterna) : "";
                if (urlPlano) {
                    const link = document.createElement("a");
                    link.href = urlPlano;
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";
                    link.textContent = planoMat.titulo || "Baixar Plano Comercial";
                    link.addEventListener("click", () => {
                        if (planoMat.id) apiRequest(`/materiais/${planoMat.id}/acessar`, "POST").catch(() => { });
                    });
                    infoPlano.appendChild(link);
                } else {
                    const span = document.createElement("span");
                    span.textContent = "Aguardando publicação pela RBS";
                    infoPlano.appendChild(span);
                }
            }

            renderizarContratosCliente(contratos);
            renderizarMateriais(demaisMateriais);
            renderizarCortesiasCliente(cortesiaApi);
        } catch (erro) {
            console.error("Erro ao carregar dados do patrocinador:", erro);
        }
    }

    function renderizarContratosCliente(contratos) {
        contratosAtuaisCache = contratos || [];
        if (!listaContratosCliente) return;
        listaContratosCliente.replaceChildren();

        const formAssinado = document.getElementById("formEnviarContratoAssinado");
        if (formAssinado) formAssinado.hidden = true;

        const pdfConsolidado = contratosAtuaisCache.find(
            c => c.tipoMaterial === "CONTRATO" &&
                (c.status === "CONTRATO_CONSOLIDADO" || c.status === "CONTRATO_FINALIZADO" || c.autorPerfil === "PATROCINADOR")
        );

        if (!pdfConsolidado) {
            listaContratosCliente.innerHTML = `
                <div class="envio-item">
                    <div class="envio-linha">
                        <span style="color: #475569; font-size: 0.9rem;">Ainda existem ações pendentes nos seus contratos.</span>
                        <a href="indexContratos.html" class="button button-primary" style="text-decoration: none;">Acessar aba Contratos</a>
                    </div>
                </div>
            `;
            return;
        }

        const urlNuvem = pdfConsolidado.caminhoStorage || pdfConsolidado.urlExterna;
        listaContratosCliente.innerHTML = `
            <div class="envio-item">
                <div class="envio-linha">
                    <p class="envio-texto"><strong>${pdfConsolidado.titulo}</strong></p>
                    <a href="${urlNuvem}" target="_blank" rel="noopener noreferrer" download="${pdfConsolidado.titulo}" class="button button-primary">
                        Visualizar / Baixar Contrato (PDF)
                    </a>
                </div>
            </div>
        `;
    }

    function renderizarMateriais(materiais) {
        if (listaMeusEnvios) {
            listaMeusEnvios.replaceChildren();
            const enviadosCliente = materiais.filter(m => m.autorPerfil === "PATROCINADOR");
            if (enviadosCliente.length === 0) {
                const msg = document.createElement("p");
                msg.className = "envios-patrocinador-vazio";
                msg.textContent = "Sua marca ainda não enviou arquivos ou conteúdos.";
                listaMeusEnvios.appendChild(msg);
            } else {
                enviadosCliente.forEach(mat => {
                    const item = document.createElement("div");
                    item.className = "envio-item";
                    const linha = document.createElement("div");
                    linha.className = "envio-linha";

                    const dataFormatada = mat.criadoEm ? new Date(mat.criadoEm).toLocaleString("pt-BR") : "";
                    const textoInfo = document.createElement("div");
                    textoInfo.style.flex = "1";
                    textoInfo.innerHTML = `
                        <p class="envio-texto" style="margin:0 0 2px;"><strong>${mat.titulo}</strong></p>
                        <small style="color:#64748b; font-size:12px;">Enviado em: ${dataFormatada}</small>
                    `;

                    const acoes = document.createElement("div");
                    acoes.style.display = "flex";
                    acoes.style.gap = "8px";
                    acoes.style.alignItems = "center";

                    const urlNuvem = mat.caminhoStorage || mat.urlExterna;
                    if (urlNuvem && urlNuvem.startsWith("http")) {
                        const baixarArquivo = document.createElement("a");
                        baixarArquivo.className = "btn-acao-pequeno";
                        baixarArquivo.href = urlNuvem;
                        baixarArquivo.target = "_blank";
                        baixarArquivo.rel = "noopener noreferrer";
                        baixarArquivo.download = mat.titulo || "arquivo";
                        baixarArquivo.textContent = "Baixar arquivo";
                        acoes.appendChild(baixarArquivo);
                    }

                    const btnApagar = document.createElement("button");
                    btnApagar.type = "button";
                    btnApagar.className = "btn-acao-perigo";
                    btnApagar.textContent = "Apagar";
                    btnApagar.addEventListener("click", async () => {
                        if (!window.confirm(`Deseja remover o envio "${mat.titulo}"?`)) return;
                        try {
                            await apiRequest(`/materiais/${mat.id}`, "DELETE");
                            await carregarPainelDoPatrocinador();
                        } catch (erro) {
                            alert(erro.message || "Não foi possível apagar o envio.");
                        }
                    });
                    acoes.appendChild(btnApagar);

                    linha.append(textoInfo, acoes);
                    item.appendChild(linha);

                    if (mat.descricao) {
                        const descP = document.createElement("p");
                        descP.className = "envio-descricao-abaixo";
                        descP.innerHTML = `<strong>Descrição:</strong> ${mat.descricao}`;
                        item.appendChild(descP);
                    }

                    listaMeusEnvios.appendChild(item);
                });
            }
        }

        if (listaMateriaisRBS) {
            listaMateriaisRBS.replaceChildren();
            const publicadosRbs = materiais.filter(m => m.autorPerfil !== "PATROCINADOR");
            if (publicadosRbs.length === 0) {
                const msg = document.createElement("p");
                msg.className = "envios-patrocinador-vazio";
                msg.textContent = "Nenhum material ou link publicado pela RBS até o momento.";
                listaMateriaisRBS.appendChild(msg);
            } else {
                publicadosRbs.forEach(mat => {
                    const item = document.createElement("div");
                    item.className = "envio-item";
                    const linha = document.createElement("div");
                    linha.className = "envio-linha";

                    const urlNuvem = mat.caminhoStorage || mat.urlExterna;
                    const titulo = document.createElement("p");
                    titulo.className = "envio-texto";
                    titulo.innerHTML = `<strong>${mat.tipoMaterial === "LINK_POST" ? mat.urlExterna : mat.titulo}</strong>`;

                    const acoes = document.createElement("div");
                    acoes.style.display = "flex";
                    acoes.style.gap = "8px";

                    if (urlNuvem && urlNuvem.startsWith("http")) {
                        const btnAbrir = document.createElement("a");
                        btnAbrir.className = "button button-primary";
                        btnAbrir.href = urlNuvem;
                        btnAbrir.target = "_blank";
                        btnAbrir.rel = "noopener noreferrer";
                        btnAbrir.textContent = mat.tipoMaterial === "LINK_POST" ? "Abrir publicação" : "Visualizar / Baixar";
                        btnAbrir.addEventListener("click", () => {
                            if (mat.id) apiRequest(`/materiais/${mat.id}/acessar`, "POST").catch(() => { });
                        });
                        acoes.appendChild(btnAbrir);
                    }

                    linha.append(titulo, acoes);
                    item.appendChild(linha);

                    if (mat.descricao && mat.descricao !== mat.urlExterna) {
                        const descP = document.createElement("p");
                        descP.className = "envio-descricao-abaixo";
                        descP.innerHTML = `<strong>Descrição:</strong> ${mat.descricao}`;
                        item.appendChild(descP);
                    }

                    listaMateriaisRBS.appendChild(item);
                });
            }
        }
    }

    function renderizarCortesiasCliente(cortesia) {
        if (!resumoCortesiasCliente) return;
        resumoCortesiasCliente.replaceChildren();

        let extras = { Hooftop: { passaporte: 0, sexta: 0, sabado: 0 }, "Terraço": { passaporte: 0, sexta: 0, sabado: 0 } };
        if (cortesia?.loungeInfo) {
            try { extras = JSON.parse(cortesia.loungeInfo); } catch { }
        }

        const setores = [
            { nome: "Arena", passaporte: cortesia?.arenaPassaporte || 0, sexta: cortesia?.arenaSexta || 0, sabado: cortesia?.arenaSabado || 0 },
            { nome: "Camarote", passaporte: cortesia?.camarotePassaporte || 0, sexta: cortesia?.camaroteSexta || 0, sabado: cortesia?.camaroteSabado || 0 },
            { nome: "Premium", passaporte: cortesia?.premiumPassaporte || 0, sexta: cortesia?.premiumSexta || 0, sabado: cortesia?.premiumSabado || 0 },
            { nome: "Hooftop", passaporte: extras?.Hooftop?.passaporte || 0, sexta: extras?.Hooftop?.sexta || 0, sabado: extras?.Hooftop?.sabado || 0 },
            { nome: "Terraço", passaporte: extras?.["Terraço"]?.passaporte || 0, sexta: extras?.["Terraço"]?.sexta || 0, sabado: extras?.["Terraço"]?.sabado || 0 }
        ];

        setores.forEach(s => {
            const bloco = document.createElement("div");
            bloco.className = "cortesia-setor";
            bloco.innerHTML = `
                <h5>${s.nome}</h5>
                <div class="cortesia-resumo"><span>Passaporte</span><strong>${s.passaporte}</strong></div>
                <div class="cortesia-resumo"><span>Sexta-feira</span><strong>${s.sexta}</strong></div>
                <div class="cortesia-resumo"><span>Sábado</span><strong>${s.sabado}</strong></div>
            `;
            resumoCortesiasCliente.appendChild(bloco);
        });
    }

    function fecharFormularioEnvio() {
        if (!formularioContainer || !botaoNovoEnvio) return;
        formularioContainer.classList.remove("open");
        botaoNovoEnvio.setAttribute("aria-expanded", "false");
    }

    if (botaoNovoEnvio && formularioContainer) {
        fecharFormularioEnvio();
        botaoNovoEnvio.addEventListener("click", function () {
            const aberto = formularioContainer.classList.toggle("open");
            botaoNovoEnvio.setAttribute("aria-expanded", String(aberto));
        });
        botaoFechar?.addEventListener("click", fecharFormularioEnvio);
        botaoCancelar?.addEventListener("click", fecharFormularioEnvio);
    }

    if (formularioEnvio) {
        const botaoSubmitEnvio = formularioEnvio.querySelector("[type='submit']");
        formularioEnvio.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (!marcaId) return;
            const texto = document.getElementById("sponsorTexto").value.trim();
            const arquivoInput = document.getElementById("sponsorArchive");
            const arquivo = arquivoInput?.files?.[0] || null;
            if (!texto && !arquivo) {
                alert("Informe um conteúdo em texto ou selecione um arquivo para enviar.");
                return;
            }
            if (botaoSubmitEnvio) {
                botaoSubmitEnvio.disabled = true;
                botaoSubmitEnvio.textContent = "Enviando...";
            }
            try {
                await apiUploadMaterial(marcaId, {
                    titulo: arquivo ? arquivo.name : "Conteúdo enviado pelo Patrocinador",
                    descricao: texto,
                    abaDestino: "ABA_2_MARCA",
                    tipoMaterial: "MIV_LOGO",
                    caminhoStorage: null,
                    urlExterna: null
                }, arquivo);
                alert("Material enviado com sucesso!");
                formularioEnvio.reset();
                if (campoEmail) campoEmail.value = emailLogado;
                fecharFormularioEnvio();
                await carregarPainelDoPatrocinador();
            } catch (erro) {
                alert(erro.message || "Não foi possível registrar o envio.");
            } finally {
                if (botaoSubmitEnvio) {
                    botaoSubmitEnvio.disabled = false;
                    botaoSubmitEnvio.textContent = "Enviar Dados";
                }
            }
        });
    }

    formContratoAssinado?.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!marcaId) return;
        const arquivoPdf = inputContratoPdf?.files?.[0];
        if (!arquivoPdf) {
            alert("Selecione o arquivo PDF do contrato assinado.");
            return;
        }
        if (btnContratoAssinado) {
            btnContratoAssinado.disabled = true;
            btnContratoAssinado.textContent = "Atualizando contrato...";
        }
        try {
            for (const c of contratosAtuaisCache) {
                await apiRequest(`/materiais/${c.id}`, "DELETE").catch(() => { });
            }
            await apiUploadMaterial(marcaId, {
                titulo: arquivoPdf.name,
                descricao: "Fase 2/3: Contrato assinado pela empresa patrocinadora",
                abaDestino: "ABA_7_CONTRATO",
                tipoMaterial: "CONTRATO",
                caminhoStorage: null,
                urlExterna: null
            }, arquivoPdf);
            alert("Contrato assinado enviado e atualizado com sucesso! A RBS fará a assinatura final.");
            formContratoAssinado.reset();
            await carregarPainelDoPatrocinador();
        } catch (erro) {
            alert(erro.message || "Não foi possível enviar o contrato assinado.");
        } finally {
            if (btnContratoAssinado) {
                btnContratoAssinado.disabled = false;
                btnContratoAssinado.textContent = "Enviar Contrato Assinado (PDF)";
            }
        }
    });

    await carregarPainelDoPatrocinador();
});