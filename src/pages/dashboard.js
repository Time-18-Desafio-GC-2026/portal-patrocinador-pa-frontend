const PATROCINADORES_KEY = "rbs_patrocinadores";
const USUARIOS_KEY = "rbs_usuarios";
const ENVIOS_KEY = "rbs_envios";
const MIDIA_RBS_KEY = "rbs_midia_rbs";
const CONTRATOS_KEY = "rbs_contratos";
const CORTESIAS_KEY = "rbs_cortesias";
const SETORES_CORTESIA = ["Arena", "Camarote", "Premium", "Hooftop", "Terraço"];

const MAPA_COTA_PARA_API = {
    "Master": "MASTER",
    "Subcota G": "SUB_COTA_G",
    "Subcota": "SUB_COTA"
};

const MAPA_COTA_PARA_FRONT = {
    "MASTER": "Master",
    "SUB_COTA_G": "Subcota G",
    "SUBcota": "Subcota",
    "SUB_COTA": "Subcota"
};

const PESO_ORDEM_COTA = {
    "Master": 1,
    "Subcota G": 2,
    "Subcota": 3
};

function traduzirCotaParaApi(cotaFront) {
    return MAPA_COTA_PARA_API[cotaFront] || "SUB_COTA";
}

function traduzirCotaParaFront(cotaApi) {
    return MAPA_COTA_PARA_FRONT[cotaApi] || cotaApi;
}

function ordenarPatrocinadoresPorCotaEAlfabetica(lista) {
    return [...(lista || [])].sort((a, b) => {
        const pesoA = PESO_ORDEM_COTA[a.cota] || 99;
        const pesoB = PESO_ORDEM_COTA[b.cota] || 99;
        if (pesoA !== pesoB) return pesoA - pesoB;
        return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
}

function extrairSetoresExtrasDeLoungeInfo(loungeInfoStr) {
    const padrao = {
        Hooftop: { passaporte: 0, sexta: 0, sabado: 0 },
        "Terraço": { passaporte: 0, sexta: 0, sabado: 0 }
    };
    if (!loungeInfoStr) return padrao;
    try {
        const parsed = JSON.parse(loungeInfoStr);
        return {
            Hooftop: {
                passaporte: Number(parsed?.Hooftop?.passaporte) || 0,
                sexta: Number(parsed?.Hooftop?.sexta) || 0,
                sabado: Number(parsed?.Hooftop?.sabado) || 0
            },
            "Terraço": {
                passaporte: Number(parsed?.["Terraço"]?.passaporte) || 0,
                sexta: Number(parsed?.["Terraço"]?.sexta) || 0,
                sabado: Number(parsed?.["Terraço"]?.sabado) || 0
            }
        };
    } catch {
        return padrao;
    }
}

function gerarSenhaPadraoPorNome(nomeMarca) {
    const prefixoLimpo = String(nomeMarca || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) || "Marca";
    return `${prefixoLimpo}@2026`;
}

function obterSenhaPadraoMarca(marcaId, nomeMarca) {
    const senhasSalvas = JSON.parse(localStorage.getItem("rbs_senhas_padrao") || "{}");
    return senhasSalvas[marcaId] || gerarSenhaPadraoPorNome(nomeMarca);
}

function salvarSenhaPadraoMarca(marcaId, novaSenha) {
    const senhasSalvas = JSON.parse(localStorage.getItem("rbs_senhas_padrao") || "{}");
    senhasSalvas[marcaId] = novaSenha;
    localStorage.setItem("rbs_senhas_padrao", JSON.stringify(senhasSalvas));
}

function lerListaLocalStorage(chave) {
    try {
        const dados = JSON.parse(localStorage.getItem(chave) || "[]");
        return Array.isArray(dados) ? dados : [];
    } catch {
        return [];
    }
}

function salvarListaLocalStorage(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

function listarPatrocinadores() {
    return ordenarPatrocinadoresPorCotaEAlfabetica(lerListaLocalStorage(PATROCINADORES_KEY));
}

function salvarPatrocinadores(patrocinadores) {
    salvarListaLocalStorage(PATROCINADORES_KEY, ordenarPatrocinadoresPorCotaEAlfabetica(patrocinadores));
}

function validarArquivoFoto(arquivo) {
    if (!arquivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) {
        throw new Error("Arquivo com formato inválido para a logo. Utilize apenas PNG, JPG ou WEBP.");
    }
    if (arquivo.size > 2 * 1024 * 1024) {
        throw new Error("O arquivo da logo excede o tamanho máximo de 2 MB.");
    }
}

async function sincronizarDadosComBackend() {
    try {
        const [marcasApi, usuariosApi] = await Promise.all([
            apiRequest("/marcas", "GET"),
            apiRequest("/usuarios", "GET").catch(() => [])
        ]);
        if (!Array.isArray(marcasApi)) return;

        const cacheAnterior = lerListaLocalStorage(PATROCINADORES_KEY);
        const patrocinadoresSincronizados = [];
        const enviosCliente = [];
        const midiasRbs = [];
        const contratosMarca = [];
        const cortesiasBanco = [];

        for (const m of marcasApi) {
            const anterior = cacheAnterior.find(item => item.id === m.id) || {};
            const contasDaMarca = (usuariosApi || []).filter(
                u => String(u.marcaId) === String(m.id)
            );
            const emailsFormatados = contasDaMarca.length > 0
                ? contasDaMarca.map(u => u.email).join(", ")
                : (anterior.email || "");

            const senhaPadrao = obterSenhaPadraoMarca(m.id, m.nome);
            salvarSenhaPadraoMarca(m.id, senhaPadrao);

            const [materiaisApi, cortesiaApi] = await Promise.all([
                apiRequest(`/marcas/${m.id}/materiais`, "GET").catch(() => []),
                apiRequest(`/marcas/${m.id}/cortesias`, "GET").catch(() => null)
            ]);

            if (cortesiaApi) {
                const extras = extrairSetoresExtrasDeLoungeInfo(cortesiaApi.loungeInfo);
                cortesiasBanco.push({
                    patrocinadorId: m.id,
                    setores: {
                        Arena: {
                            passaporte: cortesiaApi.arenaPassaporte || 0,
                            sexta: cortesiaApi.arenaSexta || 0,
                            sabado: cortesiaApi.arenaSabado || 0
                        },
                        Camarote: {
                            passaporte: cortesiaApi.camarotePassaporte || 0,
                            sexta: cortesiaApi.camaroteSexta || 0,
                            sabado: cortesiaApi.camaroteSabado || 0
                        },
                        Premium: {
                            passaporte: cortesiaApi.premiumPassaporte || 0,
                            sexta: cortesiaApi.premiumSexta || 0,
                            sabado: cortesiaApi.premiumSabado || 0
                        },
                        Hooftop: extras.Hooftop,
                        "Terraço": extras["Terraço"]
                    },
                    atualizadoEm: cortesiaApi.atualizadoEm
                });
            }

            const planoComercial = (materiaisApi || []).find(mat => mat.tipoMaterial === "PLANO_COMERCIAL");
            const fotoEmpresaMat = (materiaisApi || []).find(mat => mat.tipoMaterial === "FOTO_EMPRESA");

            (materiaisApi || []).forEach(mat => {
                const urlArquivoNuvem = mat.caminhoStorage || mat.urlExterna || null;

                if (mat.tipoMaterial === "CONTRATO" || mat.abaDestino === "ABA_7_CONTRATO" || mat.tipoMaterial === "DADOS_SIGNATARIO") {
                    contratosMarca.push({
                        id: mat.id,
                        patrocinadorId: m.id,
                        titulo: mat.titulo,
                        descricao: mat.descricao || "",
                        tipoMaterial: mat.tipoMaterial,
                        arquivoData: urlArquivoNuvem || "#",
                        autorNome: mat.autorNome || (mat.autorPerfil === "PATROCINADOR" ? "Empresa Patrocinadora" : "Administração RBS"),
                        autorPerfil: mat.autorPerfil,
                        status: mat.status,
                        criadoEm: mat.criadoEm
                    });
                } else if (mat.autorPerfil === "PATROCINADOR") {
                    enviosCliente.push({
                        id: mat.id,
                        patrocinadorId: m.id,
                        texto: mat.descricao || "",
                        arquivo: urlArquivoNuvem ? { nome: mat.titulo, arquivoData: urlArquivoNuvem } : null,
                        status: mat.status,
                        criadoEm: mat.criadoEm
                    });
                } else if (
                    mat.tipoMaterial !== "PLANO_COMERCIAL" &&
                    mat.tipoMaterial !== "FOTO_EMPRESA" &&
                    mat.tipoMaterial !== "PRAZO_PESQUISA"
                ) {
                    midiasRbs.push({
                        id: mat.id,
                        patrocinadorId: m.id,
                        tipo: mat.tipoMaterial === "LINK_POST" ? "link" : "relatorio",
                        nome: mat.titulo,
                        descricao: mat.descricao || "",
                        url: mat.urlExterna || mat.descricao,
                        arquivoData: urlArquivoNuvem || "#",
                        criadoEm: mat.criadoEm
                    });
                }
            });

            patrocinadoresSincronizados.push({
                id: m.id,
                nome: m.nome,
                cnpj: m.cnpj,
                email: emailsFormatados,
                senhaPadrao: senhaPadrao,
                cota: traduzirCotaParaFront(m.cota),
                arquivo: planoComercial ? planoComercial.titulo : "",
                planoComercialUrl: planoComercial ? (planoComercial.caminhoStorage || planoComercial.urlExterna) : null,
                planoComercialId: planoComercial ? planoComercial.id : null,
                foto: fotoEmpresaMat
                    ? (fotoEmpresaMat.caminhoStorage || fotoEmpresaMat.urlExterna)
                    : (anterior.foto || ""),
                criadoEm: m.criadoEm
            });
        }

        salvarPatrocinadores(patrocinadoresSincronizados);
        localStorage.setItem(USUARIOS_KEY, JSON.stringify(
            (usuariosApi || []).map(u => ({
                id: u.id,
                nome: u.nome || u.email,
                email: u.email,
                ativo: u.ativo,
                perfil: u.perfil === "PATROCINADOR" ? "patrocinador" : "funcionario",
                patrocinadorId: u.marcaId
            }))
        ));
        localStorage.setItem(ENVIOS_KEY, JSON.stringify(enviosCliente));
        localStorage.setItem(MIDIA_RBS_KEY, JSON.stringify(midiasRbs));
        localStorage.setItem(CONTRATOS_KEY, JSON.stringify(contratosMarca));
        localStorage.setItem(CORTESIAS_KEY, JSON.stringify(cortesiasBanco));
    } catch (erro) {
        console.error("Erro ao sincronizar com o Back-end:", erro);
    }
}

function normalizarEmailsPatrocinador(valor) {
    if (Array.isArray(valor)) {
        return [...new Set(valor.map(e => String(e || "").trim().toLowerCase()).filter(Boolean))];
    }
    return [...new Set(
        String(valor || "")
            .split(/[;,]/)
            .map(email => email.trim().toLowerCase())
            .filter(Boolean)
    )];
}

function validarEmailsPatrocinador(valor) {
    const emails = normalizarEmailsPatrocinador(valor);
    if (emails.length === 0) {
        throw new Error("Informe pelo menos um e-mail válido.");
    }
    const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalido = emails.find(email => !formatoEmail.test(email));
    if (invalido) {
        throw new Error(`E-mail inválido: ${invalido}`);
    }
    return emails;
}

function listarEnviosPorPatrocinador(patrocinadorId) {
    const todos = JSON.parse(localStorage.getItem(ENVIOS_KEY) || "[]");
    return todos.filter(envio => String(envio.patrocinadorId) === String(patrocinadorId));
}

function listarContratosPorPatrocinador(patrocinadorId) {
    const todos = JSON.parse(localStorage.getItem(CONTRATOS_KEY) || "[]");
    return todos.filter(c => String(c.patrocinadorId) === String(patrocinadorId));
}

function listarMidiaRBSPorPatrocinador(patrocinadorId) {
    const todos = JSON.parse(localStorage.getItem(MIDIA_RBS_KEY) || "[]");
    return todos.filter(item => String(item.patrocinadorId) === String(patrocinadorId));
}

function criarSecaoContratos(patrocinador) {
    const registros = listarContratosPorPatrocinador(patrocinador.id);
    const pdfsContrato = registros.filter(c => c.tipoMaterial === "CONTRATO");
    const contratoConsolidado = pdfsContrato.find(
        c => c.status === "CONTRATO_CONSOLIDADO" || c.status === "CONTRATO_FINALIZADO" || c.autorPerfil === "PATROCINADOR"
    );

    const secao = document.createElement("section");
    secao.className = "patrocinador-cortesias";

    const cabecalho = document.createElement("div");
    cabecalho.className = "secao-cabecalho";
    const titulo = document.createElement("h4");
    titulo.textContent = "Contrato de Patrocínio";
    cabecalho.appendChild(titulo);

    const conteudo = document.createElement("div");
    conteudo.className = "secao-conteudo";

    if (contratoConsolidado && contratoConsolidado.arquivoData && contratoConsolidado.arquivoData !== "#") {
        const item = document.createElement("div");
        item.className = "envio-item";
        const linha = document.createElement("div");
        linha.className = "envio-linha";

        const nomeArquivo = document.createElement("p");
        nomeArquivo.className = "envio-arquivo-nome";
        nomeArquivo.innerHTML = `<strong>${contratoConsolidado.titulo}</strong>`;

        const btnBaixar = document.createElement("a");
        btnBaixar.className = "button button-primary";
        btnBaixar.href = contratoConsolidado.arquivoData;
        btnBaixar.target = "_blank";
        btnBaixar.rel = "noopener noreferrer";
        btnBaixar.download = contratoConsolidado.titulo || "contrato.pdf";
        btnBaixar.textContent = "Visualizar / Baixar Contrato (PDF)";
        btnBaixar.addEventListener("click", () => {
            if (contratoConsolidado.id) {
                apiRequest(`/materiais/${contratoConsolidado.id}/acessar`, "POST").catch(() => { });
            }
        });

        linha.append(nomeArquivo, btnBaixar);
        item.appendChild(linha);
        conteudo.appendChild(item);
    } else {
        const pendenteMsg = document.createElement("div");
        pendenteMsg.className = "envio-item";
        pendenteMsg.innerHTML = `
            <div class="envio-linha">
                <span style="color: #475569; font-size: 0.9rem;">Ainda existem ações pendentes nos seus contratos.</span>
                <a href="indexContratos.html" class="btn-acao-pequeno" style="text-decoration: none;">Gerenciar na aba Contratos</a>
            </div>
        `;
        conteudo.appendChild(pendenteMsg);
    }

    secao.append(cabecalho, conteudo);
    return secao;
}

function criarSecaoMidiaUnificada(patrocinador) {
    const enviosMarca = listarEnviosPorPatrocinador(patrocinador.id);
    const enviosRbs = listarMidiaRBSPorPatrocinador(patrocinador.id);
    const secao = document.createElement("div");
    secao.className = "patrocinador-envios";
    const cabecalho = document.createElement("div");
    cabecalho.className = "secao-cabecalho";
    const titulo = document.createElement("h4");
    titulo.textContent = "Mídia e Conteúdo";
    cabecalho.appendChild(titulo);
    const conteudo = document.createElement("div");
    conteudo.className = "secao-conteudo";

    const blocoMarca = document.createElement("div");
    blocoMarca.className = "midia-subbloco";
    const h5Marca = document.createElement("h5");
    h5Marca.textContent = "Envios da Marca";
    blocoMarca.appendChild(h5Marca);

    if (enviosMarca.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "envios-vazio";
        vazio.textContent = "Nenhum conteúdo enviado pela marca patrocinadora.";
        blocoMarca.appendChild(vazio);
    } else {
        enviosMarca.forEach(function (envio) {
            const item = document.createElement("div");
            item.className = "envio-item";
            if (envio.arquivo && envio.arquivo.arquivoData && envio.arquivo.arquivoData !== "#") {
                const linhaArquivo = document.createElement("div");
                linhaArquivo.className = "envio-linha";
                const nomeArquivo = document.createElement("a");
                nomeArquivo.className = "envio-arquivo-nome";
                nomeArquivo.href = envio.arquivo.arquivoData;
                nomeArquivo.target = "_blank";
                nomeArquivo.rel = "noopener noreferrer";
                nomeArquivo.style.fontWeight = "600";
                nomeArquivo.textContent = envio.arquivo.nome || "Arquivo enviado";
                const baixarArquivo = document.createElement("a");
                baixarArquivo.className = "button button-primary";
                baixarArquivo.href = envio.arquivo.arquivoData;
                baixarArquivo.target = "_blank";
                baixarArquivo.rel = "noopener noreferrer";
                baixarArquivo.download = envio.arquivo.nome || "arquivo-enviado";
                baixarArquivo.textContent = "Baixar mídia";
                linhaArquivo.append(nomeArquivo, baixarArquivo);
                item.appendChild(linhaArquivo);
            }
            if (envio.texto && (!envio.arquivo || envio.texto !== envio.arquivo.nome)) {
                const desc = document.createElement("p");
                desc.className = "envio-descricao-abaixo";
                desc.innerHTML = `<strong>Descrição:</strong> ${envio.texto}`;
                item.appendChild(desc);
            }
            blocoMarca.appendChild(item);
        });
    }

    const blocoRbs = document.createElement("div");
    blocoRbs.className = "midia-subbloco";
    const h5Rbs = document.createElement("h5");
    h5Rbs.textContent = "Envios da RBS";
    blocoRbs.appendChild(h5Rbs);
    const listaRbs = document.createElement("div");
    listaRbs.className = "midia-rbs-lista";

    if (enviosRbs.length === 0) {
        const vazioRbs = document.createElement("p");
        vazioRbs.className = "midia-rbs-vazio";
        vazioRbs.textContent = "Nenhum material ou link enviado pela RBS.";
        listaRbs.appendChild(vazioRbs);
    } else {
        enviosRbs.forEach(function (registro) {
            const item = document.createElement("div");
            item.className = "midia-rbs-item";
            const linha = document.createElement("div");
            linha.className = "envio-linha";
            const linkPrincipal = document.createElement("a");
            linkPrincipal.className = "envio-arquivo-nome";
            linkPrincipal.target = "_blank";
            linkPrincipal.rel = "noopener noreferrer";
            linkPrincipal.style.fontWeight = "600";
            linkPrincipal.href = registro.tipo === "relatorio" ? registro.arquivoData : registro.url;
            linkPrincipal.textContent = registro.tipo === "relatorio" ? registro.nome : registro.url;

            const acoesItem = document.createElement("div");
            acoesItem.style.display = "flex";
            acoesItem.style.gap = "8px";
            acoesItem.style.alignItems = "center";

            if (registro.tipo === "relatorio") {
                const baixarArquivo = document.createElement("a");
                baixarArquivo.className = "button button-primary";
                baixarArquivo.href = registro.arquivoData;
                baixarArquivo.target = "_blank";
                baixarArquivo.rel = "noopener noreferrer";
                baixarArquivo.download = registro.nome;
                baixarArquivo.textContent = "Baixar";
                acoesItem.appendChild(baixarArquivo);
            }

            const btnApagar = document.createElement("button");
            btnApagar.type = "button";
            btnApagar.className = "btn-acao-perigo";
            btnApagar.textContent = "Apagar";
            btnApagar.addEventListener("click", async () => {
                if (!window.confirm(`Deseja apagar "${registro.nome || registro.url}"?`)) return;
                try {
                    await apiRequest(`/materiais/${registro.id}`, "DELETE");
                    await sincronizarDadosComBackend();
                    atualizarTelaPatrocinadores(patrocinador.id);
                } catch (erro) {
                    alert(erro.message || "Não foi possível apagar o conteúdo.");
                }
            });

            acoesItem.appendChild(btnApagar);
            linha.append(linkPrincipal, acoesItem);
            item.appendChild(linha);

            if (registro.descricao && registro.descricao !== registro.url) {
                const descP = document.createElement("p");
                descP.className = "envio-descricao-abaixo";
                descP.innerHTML = `<strong>Descrição:</strong> ${registro.descricao}`;
                item.appendChild(descP);
            }
            listaRbs.appendChild(item);
        });
    }

    const btnAbrirNovoEnvio = document.createElement("button");
    btnAbrirNovoEnvio.type = "button";
    btnAbrirNovoEnvio.className = "button button-primary";
    btnAbrirNovoEnvio.style.marginTop = "10px";
    btnAbrirNovoEnvio.textContent = "Realizar novo envio";

    const formNovoEnvio = document.createElement("form");
    formNovoEnvio.className = "form-novo-envio-rbs";
    formNovoEnvio.hidden = true;
    formNovoEnvio.innerHTML = `
        <h6>Realizar novo envio para ${patrocinador.nome}</h6>
        <div class="form-edicao-grid">
            <div class="form-group">
                <label>Anexar arquivo (opcional)</label>
                <div class="file-input-with-clear">
                    <input type="file" name="arquivoRbs" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.mp4,.zip">
                    <button type="button" class="btn-icon-remove btn-clear-arq-rbs" title="Remover arquivo" hidden>×</button>
                </div>
            </div>
            <div class="form-group">
                <label>Link externo (opcional)</label>
                <input type="url" name="linkRbs" placeholder="https://link-da-publicacao.com">
            </div>
        </div>
        <div class="form-group">
            <label>Descrição</label>
            <input type="text" name="descricaoRbs" placeholder="Ex.: Comprovação de inserção no Instagram do Planeta Atlântida" required>
        </div>
        <div class="form-actions">
            <button type="button" class="form-cancel btn-cancel-envio-rbs">Cancelar</button>
            <button type="submit" class="button button-primary btn-submit-envio-rbs">Enviar</button>
        </div>
    `;

    const inputArqRbs = formNovoEnvio.elements.arquivoRbs;
    const btnClearArqRbs = formNovoEnvio.querySelector(".btn-clear-arq-rbs");
    inputArqRbs.addEventListener("change", () => {
        btnClearArqRbs.hidden = !(inputArqRbs.files && inputArqRbs.files.length > 0);
    });
    btnClearArqRbs.addEventListener("click", () => {
        inputArqRbs.value = "";
        btnClearArqRbs.hidden = true;
    });

    btnAbrirNovoEnvio.addEventListener("click", () => {
        formNovoEnvio.hidden = false;
        btnAbrirNovoEnvio.hidden = true;
    });

    formNovoEnvio.querySelector(".btn-cancel-envio-rbs").addEventListener("click", () => {
        formNovoEnvio.reset();
        btnClearArqRbs.hidden = true;
        formNovoEnvio.hidden = true;
        btnAbrirNovoEnvio.hidden = false;
    });

    formNovoEnvio.addEventListener("submit", async (e) => {
        e.preventDefault();
        const arquivo = inputArqRbs.files?.[0] || null;
        const link = formNovoEnvio.elements.linkRbs.value.trim();
        const descricao = formNovoEnvio.elements.descricaoRbs.value.trim();
        if (!arquivo && !link) {
            alert("Anexe um arquivo ou informe um link externo para realizar o envio.");
            return;
        }
        const btnSubmit = formNovoEnvio.querySelector(".btn-submit-envio-rbs");
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Enviando...";
        try {
            if (arquivo) {
                await apiUploadMaterial(patrocinador.id, {
                    titulo: arquivo.name,
                    descricao: descricao,
                    abaDestino: "ABA_3_MIDIA",
                    tipoMaterial: "PLANILHA_MIDIA",
                    caminhoStorage: null,
                    urlExterna: null
                }, arquivo);
            }
            if (link) {
                const endereco = new URL(link);
                await apiUploadMaterial(patrocinador.id, {
                    titulo: endereco.href,
                    descricao: descricao,
                    abaDestino: "ABA_3_MIDIA",
                    tipoMaterial: "LINK_POST",
                    caminhoStorage: null,
                    urlExterna: endereco.href
                }, null);
            }
            await sincronizarDadosComBackend();
            atualizarTelaPatrocinadores(patrocinador.id);
        } catch (erro) {
            alert(erro.message || "Não foi possível realizar o envio.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Enviar";
        }
    });

    blocoRbs.append(listaRbs, btnAbrirNovoEnvio, formNovoEnvio);
    conteudo.append(blocoMarca, blocoRbs);
    secao.append(cabecalho, conteudo);
    return secao;
}

function listarCortesias() {
    return JSON.parse(localStorage.getItem(CORTESIAS_KEY) || "[]");
}

function obterCortesias(patrocinadorId) {
    const registro = listarCortesias().find(item => String(item.patrocinadorId) === String(patrocinadorId));
    const setores = {};
    SETORES_CORTESIA.forEach(setor => {
        setores[setor] = {
            passaporte: registro?.setores?.[setor]?.passaporte || 0,
            sexta: registro?.setores?.[setor]?.sexta || 0,
            sabado: registro?.setores?.[setor]?.sabado || 0
        };
    });
    return { patrocinadorId, setores };
}

async function salvarCortesiasNoBackend(patrocinadorId, valoresPorSetor) {
    const extrasJson = JSON.stringify({
        Hooftop: {
            passaporte: Number(valoresPorSetor["Hooftop"]?.passaporte) || 0,
            sexta: Number(valoresPorSetor["Hooftop"]?.sexta) || 0,
            sabado: Number(valoresPorSetor["Hooftop"]?.sabado) || 0
        },
        "Terraço": {
            passaporte: Number(valoresPorSetor["Terraço"]?.passaporte) || 0,
            sexta: Number(valoresPorSetor["Terraço"]?.sexta) || 0,
            sabado: Number(valoresPorSetor["Terraço"]?.sabado) || 0
        }
    });

    await apiRequest(`/marcas/${patrocinadorId}/cortesias`, "PUT", {
        arenaPassaporte: Number(valoresPorSetor["Arena"]?.passaporte) || 0,
        arenaSexta: Number(valoresPorSetor["Arena"]?.sexta) || 0,
        arenaSabado: Number(valoresPorSetor["Arena"]?.sabado) || 0,
        camarotePassaporte: Number(valoresPorSetor["Camarote"]?.passaporte) || 0,
        camaroteSexta: Number(valoresPorSetor["Camarote"]?.sexta) || 0,
        camaroteSabado: Number(valoresPorSetor["Camarote"]?.sabado) || 0,
        premiumPassaporte: Number(valoresPorSetor["Premium"]?.passaporte) || 0,
        premiumSexta: Number(valoresPorSetor["Premium"]?.sexta) || 0,
        premiumSabado: Number(valoresPorSetor["Premium"]?.sabado) || 0,
        loungeInfo: extrasJson
    });
}

function criarSecaoCortesias(patrocinador) {
    const dados = obterCortesias(patrocinador.id);
    const secao = document.createElement("section");
    secao.className = "patrocinador-cortesias";

    const cabecalhoCortesias = document.createElement("div");
    cabecalhoCortesias.className = "secao-cabecalho";
    const titulo = document.createElement("h4");
    titulo.textContent = "Cortesias";
    cabecalhoCortesias.appendChild(titulo);

    const conteudoCortesias = document.createElement("div");
    conteudoCortesias.className = "secao-conteudo";

    const grade = document.createElement("div");
    grade.className = "cortesias-grade";

    function adicionarResumo(pai, rotulo, valor) {
        const linha = document.createElement("div");
        linha.className = "cortesia-resumo";
        const nome = document.createElement("span");
        nome.textContent = rotulo;
        const quantidade = document.createElement("strong");
        quantidade.textContent = String(valor ?? 0);
        linha.append(nome, quantidade);
        pai.appendChild(linha);
    }

    SETORES_CORTESIA.forEach(setor => {
        const bloco = document.createElement("div");
        bloco.className = "cortesia-setor";
        const nomeSetor = document.createElement("h5");
        nomeSetor.textContent = setor;
        bloco.appendChild(nomeSetor);
        const quantidades = dados.setores[setor] || {};
        adicionarResumo(bloco, "Passaporte", quantidades.passaporte);
        adicionarResumo(bloco, "Sexta-feira", quantidades.sexta);
        adicionarResumo(bloco, "Sábado", quantidades.sabado);
        grade.appendChild(bloco);
    });

    conteudoCortesias.appendChild(grade);

    const botaoEditar = document.createElement("button");
    botaoEditar.type = "button";
    botaoEditar.className = "botao-editar-cortesias button button-primary";
    botaoEditar.textContent = "Editar cortesias";

    const formulario = document.createElement("form");
    formulario.className = "form-cortesias";
    formulario.hidden = true;
    const tituloFormulario = document.createElement("h5");
    tituloFormulario.textContent = "Definir quantidades de ingressos por setor";
    formulario.appendChild(tituloFormulario);

    const gradeForm = document.createElement("div");
    gradeForm.className = "cortesias-grade";

    const campos = {};
    SETORES_CORTESIA.forEach(setor => {
        const cardSetor = document.createElement("div");
        cardSetor.className = "cortesia-setor";
        const subtitulo = document.createElement("h5");
        subtitulo.textContent = setor;
        cardSetor.appendChild(subtitulo);
        campos[setor] = {};
        [
            ["passaporte", "Passaporte"],
            ["sexta", "Sexta-feira"],
            ["sabado", "Sábado"]
        ].forEach(([tipo, rotulo]) => {
            const grupo = document.createElement("label");
            grupo.className = "campo-cortesia";
            grupo.textContent = rotulo;
            const input = document.createElement("input");
            input.type = "number";
            input.min = "0";
            input.step = "1";
            input.required = true;
            input.value = dados.setores[setor]?.[tipo] ?? 0;
            campos[setor][tipo] = input;
            grupo.appendChild(input);
            cardSetor.appendChild(grupo);
        });
        gradeForm.appendChild(cardSetor);
    });
    formulario.appendChild(gradeForm);

    const botoes = document.createElement("div");
    botoes.className = "cortesias-acoes";
    const salvar = document.createElement("button");
    salvar.type = "submit";
    salvar.className = "button button-primary";
    salvar.textContent = "Salvar cortesias";
    const cancelar = document.createElement("button");
    cancelar.type = "button";
    cancelar.textContent = "Cancelar";
    botoes.append(salvar, cancelar);
    formulario.appendChild(botoes);

    botaoEditar.addEventListener("click", function () {
        formulario.hidden = false;
        botaoEditar.hidden = true;
    });

    cancelar.addEventListener("click", function () {
        formulario.reset();
        formulario.hidden = true;
        botaoEditar.hidden = false;
    });

    formulario.addEventListener("submit", async function (event) {
        event.preventDefault();
        const valores = {};
        SETORES_CORTESIA.forEach(setor => {
            valores[setor] = {
                passaporte: Number(campos[setor]["passaporte"].value) || 0,
                sexta: Number(campos[setor]["sexta"].value) || 0,
                sabado: Number(campos[setor]["sabado"].value) || 0
            };
        });
        try {
            await salvarCortesiasNoBackend(patrocinador.id, valores);
            alert("Cortesias salvas com sucesso!");
            await sincronizarDadosComBackend();
            atualizarTelaPatrocinadores(patrocinador.id);
        } catch (erro) {
            alert(erro.message || "Não foi possível salvar as cortesias.");
        }
    });

    conteudoCortesias.append(botaoEditar, formulario);
    secao.append(cabecalhoCortesias, conteudoCortesias);
    return secao;
}

function normalizarTexto(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function configurarFiltrosPatrocinadores() {
    const campoBusca = document.getElementById("buscarPatrocinador");
    const filtroCota = document.getElementById("filtrarCota");
    if (!campoBusca || !filtroCota) return;

    const cotaAnterior = filtroCota.value;
    const cotas = ["Master", "Subcota G", "Subcota"];

    filtroCota.replaceChildren();
    const opcaoTodas = document.createElement("option");
    opcaoTodas.value = "";
    opcaoTodas.textContent = "Todas as cotas";
    filtroCota.appendChild(opcaoTodas);

    cotas.forEach(cota => {
        const opcao = document.createElement("option");
        opcao.value = cota;
        opcao.textContent = cota;
        filtroCota.appendChild(opcao);
    });
    filtroCota.value = cotas.includes(cotaAnterior) ? cotaAnterior : "";

    function aplicarFiltros() {
        const busca = normalizarTexto(campoBusca.value);
        const cotaSelecionada = filtroCota.value;
        const cards = document.querySelectorAll("#patrocinadoresGrid .patrocinador-card");
        cards.forEach(card => {
            const nome = normalizarTexto(
                card.querySelector(".patrocinador-card-header h3")?.textContent
            );
            const cnpj = normalizarTexto(card.dataset.cnpj || "");
            const cota = card.querySelector(".patrocinador-cota")?.textContent.trim() || "";
            const correspondeBusca = !busca || nome.includes(busca) || cnpj.includes(busca);
            const correspondeCota = !cotaSelecionada || cota === cotaSelecionada;
            card.hidden = !(correspondeBusca && correspondeCota);
        });
    }

    campoBusca.addEventListener("input", aplicarFiltros);
    filtroCota.addEventListener("change", aplicarFiltros);
    aplicarFiltros();
}

async function cadastrarPatrocinador(dados) {
    const emailsValidos = validarEmailsPatrocinador(dados.emails);
    const senhaPadraoInicial = gerarSenhaPadraoPorNome(dados.nome);

    const marcaCriada = await apiRequest("/marcas", "POST", {
        nome: dados.nome,
        cnpj: dados.cnpj,
        cota: traduzirCotaParaApi(dados.cota),
        senhaPadrao: senhaPadraoInicial
    });

    salvarSenhaPadraoMarca(marcaCriada.id, senhaPadraoInicial);

    for (const email of emailsValidos) {
        await apiRequest(`/marcas/${marcaCriada.id}/patrocinadores`, "POST", {
            email: email,
            nome: dados.nome
        });
    }

    if (dados.cortesiasIniciais) {
        await salvarCortesiasNoBackend(marcaCriada.id, dados.cortesiasIniciais).catch(() => { });
    }

    if (dados.arquivoFisico) {
        await apiUploadMaterial(marcaCriada.id, {
            titulo: dados.arquivoFisico.name,
            descricao: "Plano Comercial da Marca",
            abaDestino: "ABA_1_PERFIL",
            tipoMaterial: "PLANO_COMERCIAL",
            caminhoStorage: null,
            urlExterna: null
        }, dados.arquivoFisico);
    }

    if (dados.fotoFisica) {
        await apiUploadMaterial(marcaCriada.id, {
            titulo: dados.fotoFisica.name,
            descricao: "Foto / Logo da Empresa",
            abaDestino: "ABA_1_PERFIL",
            tipoMaterial: "FOTO_EMPRESA",
            caminhoStorage: null,
            urlExterna: null
        }, dados.fotoFisica);
    }

    await sincronizarDadosComBackend();
    return marcaCriada;
}

async function editarPatrocinadorInline(patrocinadorAtual, novosDados) {
    const emailsNovos = validarEmailsPatrocinador(novosDados.email);

    await apiRequest(`/marcas/${patrocinadorAtual.id}`, "PUT", {
        nome: novosDados.nome,
        cnpj: novosDados.cnpj,
        cota: traduzirCotaParaApi(novosDados.cota),
        senhaPadrao: novosDados.senhaPadrao
    });

    const todosUsuarios = JSON.parse(localStorage.getItem(USUARIOS_KEY) || "[]");
    const contasDaMarca = todosUsuarios.filter(
        u => String(u.patrocinadorId) === String(patrocinadorAtual.id)
    );

    for (const email of emailsNovos) {
        const jaExiste = contasDaMarca.some(u => String(u.email || "").toLowerCase() === email);
        if (!jaExiste) {
            await apiRequest(`/marcas/${patrocinadorAtual.id}/patrocinadores`, "POST", {
                email: email,
                nome: novosDados.nome
            });
        }
    }

    for (const contaAntiga of contasDaMarca) {
        const mantido = emailsNovos.includes(String(contaAntiga.email || "").toLowerCase());
        if (!mantido) {
            await apiRequest(`/usuarios/${contaAntiga.id}/desativar`, "POST").catch(() => { });
            await apiRequest(`/usuarios/${contaAntiga.id}`, "DELETE").catch(() => { });
        }
    }

    if (novosDados.senhaPadrao && novosDados.senhaPadrao.trim().length >= 6) {
        salvarSenhaPadraoMarca(patrocinadorAtual.id, novosDados.senhaPadrao.trim());
    }

    if (novosDados.arquivoFisico) {
        if (patrocinadorAtual.planoComercialId) {
            await apiRequest(`/materiais/${patrocinadorAtual.planoComercialId}`, "DELETE").catch(() => { });
        }
        await apiUploadMaterial(patrocinadorAtual.id, {
            titulo: novosDados.arquivoFisico.name,
            descricao: "Plano Comercial atualizado",
            abaDestino: "ABA_1_PERFIL",
            tipoMaterial: "PLANO_COMERCIAL",
            caminhoStorage: null,
            urlExterna: null
        }, novosDados.arquivoFisico);
    }

    if (novosDados.fotoFisica) {
        await apiUploadMaterial(patrocinadorAtual.id, {
            titulo: novosDados.fotoFisica.name,
            descricao: "Foto / Logo da Empresa",
            abaDestino: "ABA_1_PERFIL",
            tipoMaterial: "FOTO_EMPRESA",
            caminhoStorage: null,
            urlExterna: null
        }, novosDados.fotoFisica);
    }

    await sincronizarDadosComBackend();
}

async function excluirPatrocinador(id) {
    await apiRequest(`/marcas/${id}/desativar`, "POST");
    await apiRequest(`/marcas/${id}`, "DELETE");
    await sincronizarDadosComBackend();
}

function atualizarTelaPatrocinadores(patrocinadorId) {
    if (document.body.classList.contains("sponsor-detail-page")) {
        const idAlvo = patrocinadorId || new URLSearchParams(window.location.search).get("id");
        renderizarDetalhePatrocinador(idAlvo);
    } else {
        renderizarPatrocinadores();
    }
}

function renderizarPatrocinadores(patrocinadoresParaExibir, modoDetalhes = false) {
    const grid = document.getElementById("patrocinadoresGrid");
    if (!grid) return;

    const patrocinadores = ordenarPatrocinadoresPorCotaEAlfabetica(
        patrocinadoresParaExibir || listarPatrocinadores()
    );
    grid.replaceChildren();

    if (patrocinadores.length === 0) {
        const mensagem = document.createElement("div");
        mensagem.className = "patrocinadores-vazio";
        mensagem.textContent = "Nenhum patrocinador cadastrado ainda.";
        grid.appendChild(mensagem);
        return;
    }

    patrocinadores.forEach(function (patrocinador) {
        const card = document.createElement("article");
        card.className = "patrocinador-card";
        card.dataset.patrocinadorId = String(patrocinador.id);
        card.dataset.cnpj = String(patrocinador.cnpj || "");

        const header = document.createElement("div");
        header.className = "patrocinador-card-header";

        const foto = document.createElement("div");
        foto.className = "patrocinador-foto";
        if (patrocinador.foto) {
            const imagem = document.createElement("img");
            imagem.src = patrocinador.foto;
            imagem.alt = `Logo de ${patrocinador.nome || "empresa"}`;
            foto.appendChild(imagem);
        } else {
            foto.classList.add("patrocinador-foto-vazia");
            foto.textContent = String(patrocinador.nome || "M").slice(0, 2).toUpperCase();
        }

        const nome = document.createElement("h3");
        nome.textContent = patrocinador.nome || "Empresa sem nome";
        const cota = document.createElement("span");
        cota.className = "patrocinador-cota";
        cota.textContent = patrocinador.cota || "Subcota";

        if (!modoDetalhes) {
            card.setAttribute("role", "link");
            card.tabIndex = 0;
            card.setAttribute("aria-label", `Abrir detalhes de ${patrocinador.nome || "empresa"}`);

            function abrirDetalhes() {
                const url = new URL("detalhes-patrocinador.html", window.location.href);
                url.searchParams.set("id", String(patrocinador.id));
                window.location.href = url.href;
            }

            card.addEventListener("click", event => {
                if (event.target.closest("button, a, input, select, textarea, label")) return;
                abrirDetalhes();
            });
            card.addEventListener("keydown", event => {
                if (event.target !== card || !["Enter", " "].includes(event.key)) return;
                event.preventDefault();
                abrirDetalhes();
            });

            header.append(foto, nome, cota);
            card.appendChild(header);
            grid.appendChild(card);
            return;
        }

        if (typeof window.definirTituloMarcaTopbar === "function") {
            window.definirTituloMarcaTopbar(patrocinador.nome);
        }

        const blocoNomeECota = document.createElement("div");
        blocoNomeECota.className = "titulo-cota-inline";
        blocoNomeECota.append(nome, cota);

        const botaoEditarTopo = document.createElement("button");
        botaoEditarTopo.type = "button";
        botaoEditarTopo.className = "button button-primary";
        botaoEditarTopo.textContent = "Editar";

        header.append(foto, blocoNomeECota, botaoEditarTopo);

        const info = document.createElement("div");
        info.className = "patrocinador-info";

        function adicionarInfoSimples(rotulo, valor) {
            const item = document.createElement("div");
            item.className = "patrocinador-info-item";
            const titulo = document.createElement("strong");
            titulo.textContent = rotulo;
            const conteudo = document.createElement("span");
            conteudo.textContent = valor || "Não informado";
            item.append(titulo, conteudo);
            info.appendChild(item);
        }

        adicionarInfoSimples("CNPJ", patrocinador.cnpj);
        adicionarInfoSimples("E-mail", patrocinador.email);

        const senhaReal = patrocinador.senhaPadrao || obterSenhaPadraoMarca(patrocinador.id, patrocinador.nome);
        const itemSenha = document.createElement("div");
        itemSenha.className = "patrocinador-info-item";
        const tituloSenha = document.createElement("strong");
        tituloSenha.textContent = "Senha padrão da marca";
        const linhaSenha = document.createElement("div");
        linhaSenha.className = "senha-padrao-inline";
        const valorSenha = document.createElement("span");
        valorSenha.textContent = "••••••••••";
        const btnMostrarSenha = document.createElement("button");
        btnMostrarSenha.type = "button";
        btnMostrarSenha.className = "btn-acao-pequeno";
        btnMostrarSenha.textContent = "Mostrar";
        let senhaVisivel = false;
        btnMostrarSenha.addEventListener("click", () => {
            senhaVisivel = !senhaVisivel;
            valorSenha.textContent = senhaVisivel ? senhaReal : "••••••••••";
            btnMostrarSenha.textContent = senhaVisivel ? "Ocultar" : "Mostrar";
        });
        linhaSenha.append(valorSenha, btnMostrarSenha);
        itemSenha.append(tituloSenha, linhaSenha);
        info.appendChild(itemSenha);

        const itemPlano = document.createElement("div");
        itemPlano.className = "patrocinador-info-item";
        const tituloPlano = document.createElement("strong");
        tituloPlano.textContent = "Plano comercial";
        const linhaPlano = document.createElement("div");
        linhaPlano.className = "senha-padrao-inline";

        if (patrocinador.planoComercialUrl) {
            const linkPlano = document.createElement("a");
            linkPlano.href = patrocinador.planoComercialUrl;
            linkPlano.target = "_blank";
            linkPlano.rel = "noopener noreferrer";
            linkPlano.textContent = patrocinador.arquivo || "Abrir Plano Comercial";
            linkPlano.addEventListener("click", () => {
                if (patrocinador.planoComercialId) {
                    apiRequest(`/materiais/${patrocinador.planoComercialId}/acessar`, "POST").catch(() => { });
                }
            });

            const btnRemoverPlano = document.createElement("button");
            btnRemoverPlano.type = "button";
            btnRemoverPlano.className = "btn-acao-perigo";
            btnRemoverPlano.textContent = "Remover plano";
            btnRemoverPlano.addEventListener("click", async () => {
                if (!window.confirm("Deseja remover o Plano Comercial atual desta empresa?")) return;
                try {
                    await apiRequest(`/materiais/${patrocinador.planoComercialId}`, "DELETE");
                    await sincronizarDadosComBackend();
                    renderizarDetalhePatrocinador(patrocinador.id);
                } catch (erro) {
                    alert(erro.message || "Não foi possível remover o Plano Comercial.");
                }
            });
            linhaPlano.append(linkPlano, btnRemoverPlano);
        } else {
            const semPlano = document.createElement("span");
            semPlano.textContent = "Não informado";
            linhaPlano.appendChild(semPlano);
        }
        itemPlano.append(tituloPlano, linhaPlano);
        info.appendChild(itemPlano);

        const formEdicaoInline = document.createElement("form");
        formEdicaoInline.className = "form-edicao-inline";
        formEdicaoInline.hidden = true;
        formEdicaoInline.innerHTML = `
            <h4>Editar dados da empresa</h4>
            <div class="form-edicao-grid">
                <div class="form-group">
                    <label>Nome da empresa</label>
                    <input type="text" name="nome" value="${patrocinador.nome || ""}" required>
                </div>
                <div class="form-group">
                    <label>CNPJ</label>
                    <input type="text" name="cnpj" value="${patrocinador.cnpj || ""}" maxlength="18" required>
                </div>
                <div class="form-group">
                    <label>Cota</label>
                    <select name="cota" required>
                        <option value="Master" ${patrocinador.cota === "Master" ? "selected" : ""}>Master</option>
                        <option value="Subcota G" ${patrocinador.cota === "Subcota G" ? "selected" : ""}>Subcota G</option>
                        <option value="Subcota" ${patrocinador.cota === "Subcota" ? "selected" : ""}>Subcota</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Senha padrão da marca</label>
                    <input type="text" name="senhaPadrao" value="${senhaReal}" required>
                </div>
            </div>
            <div class="form-group" style="margin-top:8px;">
                <div class="dynamic-emails-header">
                    <label>E-mails autorizados</label>
                    <button type="button" class="btn-icon-add btn-add-email-inline" title="Adicionar linha de e-mail">+</button>
                </div>
                <div class="dynamic-emails-scroll emails-inline-container"></div>
            </div>
            <div class="form-edicao-grid" style="margin-top:8px;">
                <div class="form-group">
                    <label>Adicionar / Substituir Plano Comercial</label>
                    <div class="file-input-with-clear">
                        <input type="file" name="planoComercial">
                        <button type="button" class="btn-icon-remove btn-clear-plano-inline" title="Remover arquivo" hidden>×</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>Alterar Foto da Empresa</label>
                    <div class="file-input-with-clear">
                        <input type="file" name="fotoEmpresa" accept="image/png,image/jpeg,image/webp">
                        <button type="button" class="btn-icon-remove btn-clear-foto-inline" title="Remover foto" hidden>×</button>
                    </div>
                </div>
            </div>
            <div class="form-actions" style="margin-top:12px;">
                <button type="button" class="form-cancel" id="btnCancelarEdicaoInline">Cancelar</button>
                <button type="submit" class="button button-primary">Salvar alterações</button>
            </div>
        `;

        const containerEmailsInline = formEdicaoInline.querySelector(".emails-inline-container");
        function adicionarLinhaEmailEdicao(valor = "") {
            const row = document.createElement("div");
            row.className = "dynamic-email-row";
            const inp = document.createElement("input");
            inp.type = "email";
            inp.name = "emailInlineItem";
            inp.placeholder = "funcionario@empresa.com";
            inp.value = valor;
            inp.required = true;
            const btnRem = document.createElement("button");
            btnRem.type = "button";
            btnRem.className = "btn-icon-remove";
            btnRem.textContent = "×";
            btnRem.addEventListener("click", () => {
                if (containerEmailsInline.querySelectorAll(".dynamic-email-row").length > 1) {
                    row.remove();
                } else {
                    inp.value = "";
                }
            });
            row.append(inp, btnRem);
            containerEmailsInline.appendChild(row);
        }

        function popularEmailsAtuaisNaEdicao() {
            containerEmailsInline.replaceChildren();
            const listaAtuais = normalizarEmailsPatrocinador(patrocinador.email);
            if (listaAtuais.length === 0) {
                adicionarLinhaEmailEdicao("");
            } else {
                listaAtuais.forEach(em => adicionarLinhaEmailEdicao(em));
            }
        }
        popularEmailsAtuaisNaEdicao();

        formEdicaoInline.querySelector(".btn-add-email-inline").addEventListener("click", () => {
            adicionarLinhaEmailEdicao("");
        });

        const inpPlanoInline = formEdicaoInline.elements.planoComercial;
        const btnClearPlanoInline = formEdicaoInline.querySelector(".btn-clear-plano-inline");
        inpPlanoInline.addEventListener("change", () => {
            btnClearPlanoInline.hidden = !(inpPlanoInline.files && inpPlanoInline.files.length > 0);
        });
        btnClearPlanoInline.addEventListener("click", () => {
            inpPlanoInline.value = "";
            btnClearPlanoInline.hidden = true;
        });

        const inpFotoInline = formEdicaoInline.elements.fotoEmpresa;
        const btnClearFotoInline = formEdicaoInline.querySelector(".btn-clear-foto-inline");
        inpFotoInline.addEventListener("change", () => {
            btnClearFotoInline.hidden = !(inpFotoInline.files && inpFotoInline.files.length > 0);
        });
        btnClearFotoInline.addEventListener("click", () => {
            inpFotoInline.value = "";
            btnClearFotoInline.hidden = true;
        });

        botaoEditarTopo.addEventListener("click", () => {
            popularEmailsAtuaisNaEdicao();
            formEdicaoInline.hidden = !formEdicaoInline.hidden;
        });

        formEdicaoInline.querySelector("#btnCancelarEdicaoInline").addEventListener("click", () => {
            formEdicaoInline.hidden = true;
        });

        formEdicaoInline.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btnSalvar = formEdicaoInline.querySelector("[type='submit']");
            btnSalvar.disabled = true;
            btnSalvar.textContent = "Salvando...";
            try {
                const arqFoto = inpFotoInline?.files?.[0] || null;
                validarArquivoFoto(arqFoto);
                const emailsColetados = [...containerEmailsInline.querySelectorAll("input[name='emailInlineItem']")]
                    .map(i => i.value.trim())
                    .filter(Boolean);
                await editarPatrocinadorInline(patrocinador, {
                    nome: formEdicaoInline.elements.nome.value.trim(),
                    cnpj: formEdicaoInline.elements.cnpj.value.trim(),
                    cota: formEdicaoInline.elements.cota.value,
                    email: emailsColetados,
                    senhaPadrao: formEdicaoInline.elements.senhaPadrao.value.trim(),
                    arquivoFisico: inpPlanoInline?.files?.[0] || null,
                    fotoFisica: arqFoto
                });
                alert("Dados da empresa atualizados com sucesso!");
                renderizarDetalhePatrocinador(patrocinador.id);
            } catch (erro) {
                alert(erro.message || "Não foi possível atualizar os dados da empresa.");
            } finally {
                btnSalvar.disabled = false;
                btnSalvar.textContent = "Salvar alterações";
            }
        });

        const secaoContratos = criarSecaoContratos(patrocinador);
        const secaoMidia = criarSecaoMidiaUnificada(patrocinador);
        const secaoCortesias = criarSecaoCortesias(patrocinador);

        const acoesRodape = document.createElement("div");
        acoesRodape.className = "patrocinador-acoes";
        acoesRodape.style.justifyContent = "flex-end";
        acoesRodape.style.marginTop = "16px";
        acoesRodape.style.paddingTop = "16px";
        acoesRodape.style.borderTop = "1px solid var(--border)";

        const botaoExcluir = document.createElement("button");
        botaoExcluir.type = "button";
        botaoExcluir.className = "btn-acao-perigo";
        botaoExcluir.style.padding = "9px 16px";
        botaoExcluir.textContent = "Excluir patrocinador";
        botaoExcluir.addEventListener("click", async function () {
            const senhaEsperada = patrocinador.senhaPadrao || obterSenhaPadraoMarca(patrocinador.id, patrocinador.nome);
            const senhaDigitada = window.prompt(
                `Medida de segurança: Para excluir permanentemente "${patrocinador.nome}", digite a senha padrão desta empresa:`
            );
            if (senhaDigitada === null) return;
            if (senhaDigitada.trim() !== senhaEsperada) {
                alert("Senha incorreta! A exclusão do patrocinador foi cancelada por segurança.");
                return;
            }
            try {
                await excluirPatrocinador(patrocinador.id);
                window.location.href = "indexAdministrador.html";
            } catch (erro) {
                alert(erro.message || "Não foi possível excluir o patrocinador.");
            }
        });

        acoesRodape.appendChild(botaoExcluir);

        const conteudoPatrocinador = document.createElement("div");
        conteudoPatrocinador.className = "patrocinador-conteudo";
        conteudoPatrocinador.append(
            info,
            formEdicaoInline,
            secaoContratos,
            secaoMidia,
            secaoCortesias,
            acoesRodape
        );

        card.append(header, conteudoPatrocinador);
        grid.appendChild(card);
    });

    configurarFiltrosPatrocinadores();
}

function renderizarDetalhePatrocinador(id) {
    const grid = document.getElementById("patrocinadoresGrid");
    if (!grid) return;

    const patrocinador = listarPatrocinadores().find(
        item => String(item.id) === String(id)
    );
    if (!patrocinador) {
        const mensagem = document.createElement("div");
        mensagem.className = "patrocinadores-vazio";
        mensagem.textContent = "Esta empresa não foi encontrada.";
        grid.replaceChildren(mensagem);
        return;
    }

    renderizarPatrocinadores([patrocinador], true);
}

document.addEventListener("DOMContentLoaded", async function () {
    const isDetailPage = document.body.classList.contains("sponsor-detail-page");
    const parametrosUrl = new URLSearchParams(window.location.search);
    const idDetalhe = parametrosUrl.get("id");

    await sincronizarDadosComBackend();

    if (isDetailPage) {
        renderizarDetalhePatrocinador(idDetalhe);
        document.getElementById("backToDashboard")?.addEventListener("click", function () {
            window.location.href = "indexAdministrador.html";
        });
        return;
    }

    renderizarPatrocinadores();

    const newSponsorButton = document.getElementById("newSponsorButton");
    const newSponsorForm = document.getElementById("newSponsorForm");
    const closeSponsorForm = document.getElementById("closeSponsorForm");
    const cancelSponsor = document.getElementById("cancelSponsor");
    const sponsorForm = document.getElementById("sponsorForm");
    const emailsContainer = document.getElementById("sponsorEmailsContainer");
    const btnAddEmailRow = document.getElementById("btnAddSponsorEmailRow");
    const modalCortesiasGrid = document.getElementById("modalCortesiasInputsGrid");
    const inputPlan = document.getElementById("sponsorComercialPlan");
    const clearPlanBtn = document.getElementById("clearSponsorPlanBtn");
    const inputPhoto = document.getElementById("sponsorPhoto");
    const clearPhotoBtn = document.getElementById("clearSponsorPhotoBtn");
    const feedbackEl = document.getElementById("sponsorFormFeedback");
    const submitBtn = document.getElementById("submitSponsorBtn");

    function adicionarLinhaEmailModal(valorInicial = "") {
        if (!emailsContainer) return;
        const row = document.createElement("div");
        row.className = "dynamic-email-row";

        const input = document.createElement("input");
        input.type = "email";
        input.name = "sponsorEmailItem";
        input.placeholder = "funcionario@empresa.com";
        input.value = valorInicial;
        input.required = true;

        const btnRemove = document.createElement("button");
        btnRemove.type = "button";
        btnRemove.className = "btn-icon-remove";
        btnRemove.textContent = "×";
        btnRemove.title = "Remover este e-mail";
        btnRemove.addEventListener("click", () => {
            if (emailsContainer.querySelectorAll(".dynamic-email-row").length > 1) {
                row.remove();
            } else {
                input.value = "";
            }
        });

        row.append(input, btnRemove);
        emailsContainer.appendChild(row);
        emailsContainer.scrollTop = emailsContainer.scrollHeight;
    }

    function inicializarCamposCortesiasModal() {
        if (!modalCortesiasGrid) return;
        modalCortesiasGrid.replaceChildren();
        SETORES_CORTESIA.forEach(setor => {
            const box = document.createElement("div");
            box.className = "modal-cortesia-card";
            box.innerHTML = `
                <strong>${setor}</strong>
                <div class="modal-cortesia-inputs">
                    <label>Pass.<input type="number" min="0" value="0" data-setor="${setor}" data-tipo="passaporte"></label>
                    <label>Sexta<input type="number" min="0" value="0" data-setor="${setor}" data-tipo="sexta"></label>
                    <label>Sáb.<input type="number" min="0" value="0" data-setor="${setor}" data-tipo="sabado"></label>
                </div>
            `;
            modalCortesiasGrid.appendChild(box);
        });
    }

    function resetarModalCadastro() {
        sponsorForm?.reset();
        if (feedbackEl) feedbackEl.textContent = "";
        if (clearPlanBtn) clearPlanBtn.hidden = true;
        if (clearPhotoBtn) clearPhotoBtn.hidden = true;
        if (emailsContainer) {
            emailsContainer.replaceChildren();
            adicionarLinhaEmailModal("");
        }
        inicializarCamposCortesiasModal();
    }

    resetarModalCadastro();

    btnAddEmailRow?.addEventListener("click", () => adicionarLinhaEmailModal(""));

    inputPlan?.addEventListener("change", () => {
        if (clearPlanBtn) clearPlanBtn.hidden = !(inputPlan.files && inputPlan.files.length > 0);
    });

    clearPlanBtn?.addEventListener("click", () => {
        if (inputPlan) inputPlan.value = "";
        clearPlanBtn.hidden = true;
    });

    inputPhoto?.addEventListener("change", () => {
        if (feedbackEl) feedbackEl.textContent = "";
        const arq = inputPhoto.files?.[0];
        if (!arq) {
            if (clearPhotoBtn) clearPhotoBtn.hidden = true;
            return;
        }
        try {
            validarArquivoFoto(arq);
            if (clearPhotoBtn) clearPhotoBtn.hidden = false;
        } catch (erro) {
            inputPhoto.value = "";
            if (clearPhotoBtn) clearPhotoBtn.hidden = true;
            if (feedbackEl) feedbackEl.textContent = erro.message;
        }
    });

    clearPhotoBtn?.addEventListener("click", () => {
        if (inputPhoto) inputPhoto.value = "";
        clearPhotoBtn.hidden = true;
        if (feedbackEl) feedbackEl.textContent = "";
    });

    function closeForm() {
        if (!newSponsorForm || !newSponsorButton) return;
        newSponsorForm.classList.remove("open");
        newSponsorButton.setAttribute("aria-expanded", "false");
    }

    if (newSponsorButton && newSponsorForm) {
        closeForm();
        newSponsorButton.addEventListener("click", function () {
            const isOpen = newSponsorForm.classList.toggle("open");
            newSponsorButton.setAttribute("aria-expanded", String(isOpen));
        });
        closeSponsorForm?.addEventListener("click", closeForm);
        cancelSponsor?.addEventListener("click", () => {
            resetarModalCadastro();
            closeForm();
        });
    }

    if (sponsorForm) {
        sponsorForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            if (feedbackEl) feedbackEl.textContent = "";

            const nome = document.getElementById("sponsorName").value.trim();
            const cnpj = document.getElementById("sponsorCnpj").value.trim();
            const cota = document.getElementById("sponsorQuota").value;
            const emailsDigitados = [...emailsContainer.querySelectorAll("input[name='sponsorEmailItem']")]
                .map(inp => inp.value.trim())
                .filter(Boolean);

            const arquivoFisico = inputPlan?.files?.[0] || null;
            const fotoFisica = inputPhoto?.files?.[0] || null;

            const cortesiasIniciais = {};
            SETORES_CORTESIA.forEach(s => {
                cortesiasIniciais[s] = { passaporte: 0, sexta: 0, sabado: 0 };
            });
            modalCortesiasGrid?.querySelectorAll("input[data-setor]").forEach(inp => {
                const s = inp.dataset.setor;
                const t = inp.dataset.tipo;
                if (cortesiasIniciais[s]) {
                    cortesiasIniciais[s][t] = Number(inp.value) || 0;
                }
            });

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Cadastrando...";
            }

            try {
                validarArquivoFoto(fotoFisica);

                await cadastrarPatrocinador({
                    nome,
                    cnpj,
                    emails: emailsDigitados,
                    cota,
                    arquivoFisico,
                    fotoFisica,
                    cortesiasIniciais
                });

                resetarModalCadastro();
                closeForm();
                renderizarPatrocinadores();
            } catch (erro) {
                if (feedbackEl) {
                    feedbackEl.textContent = erro.message || "Não foi possível cadastrar o patrocinador.";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Cadastrar";
                }
            }
        });
    }
});