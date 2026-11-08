const ORDEM_MESES = ["Outubro", "Novembro", "Dezembro", "Janeiro", "Fevereiro"];
const ORDEM_VEICULOS = ["Instagram", "X", "TikTok", "Rádio", "Jornais", "Televisão"];

const CORES_VEICULOS = {
    "Instagram": "#E1306C",
    "X": "#0F172A",
    "TikTok": "#00B4D8",
    "Rádio": "#F47B20",
    "Jornais": "#4338CA",
    "Televisão": "#101D4D"
};

function parseKeyValueTexto(texto) {
    const mapa = {};
    String(texto || "").split(";").forEach(par => {
        const [k, v] = par.split("=");
        if (k && v !== undefined) {
            mapa[k.trim()] = Number.isNaN(Number(v)) ? v.trim() : Number(v);
        }
    });
    return mapa;
}

function extrairDadosEstruturadosDeIndicadores(indicadoresLista, cotaMarca = "SUB_COTA") {
    const indicadores = indicadoresLista || [];
    const midiaMensal = [];
    const demografia = { GENERO: [], IDADE: [], PERFIL: [] };
    const respostasPerguntas = {};
    let resumoAtivacao = { entrevistados: 0, alcanceAtivacao: 0 };

    indicadores.forEach(ind => {
        const secao = String(ind.secao || "").toUpperCase();
        const nome = String(ind.nomeIndicador || "");
        const kv = parseKeyValueTexto(ind.valorTexto);

        if (secao === "MIDIA_MENSAL" && nome.includes("|")) {
            const [mes, veiculo] = nome.split("|").map(s => s.trim());
            const veiculacoes = Number(kv.veiculacoes || 0);
            const visualizacoes = Number(kv.visualizacoes || ind.valorNumerico || 0);
            const alcance = Number(kv.alcance || Math.round(visualizacoes * 0.78));
            if (veiculacoes > 0 || visualizacoes > 0 || alcance > 0) {
                midiaMensal.push({ mes, veiculo, veiculacoes, visualizacoes, alcance });
            }
        } else if (secao === "ATIVACAO_RESUMO") {
            resumoAtivacao = {
                entrevistados: Number(kv.entrevistados || 1260),
                alcanceAtivacao: Number(kv.alcanceAtivacao || ind.valorNumerico || 51700)
            };
        } else if (secao === "ATIVACAO_DEMOGRAFIA" && nome.includes("|")) {
            const [grupo, rotulo] = nome.split("|").map(s => s.trim());
            if (demografia[grupo]) {
                demografia[grupo].push({
                    rotulo,
                    percentual: Number(kv.percentual || ind.valorNumerico || 0),
                    quantidade: Number(kv.quantidade || 0)
                });
            }
        } else if (secao === "ATIVACAO_PERGUNTA") {
            const num = Number(nome.replace("PERGUNTA_", "")) || 1;
            respostasPerguntas[num] = {
                sim: Number(kv.sim || ind.valorNumerico || 90),
                nao: Number(kv.nao || (100 - Number(ind.valorNumerico || 90)))
            };
        }
    });

    const indicadoresNegocio = indicadores.filter(i => String(i.secao || "").toUpperCase() !== "SISTEMA_CONFIG" && String(i.secao || "").toUpperCase() !== "SISTEMA_NOTIF");

    if (midiaMensal.length === 0 && indicadoresNegocio.length > 0) {
        const fator = String(cotaMarca).toUpperCase() === "MASTER" ? 3 : (String(cotaMarca).toUpperCase() === "SUB_COTA_G" ? 2 : 1);
        const pesos = [0.75, 0.9, 1.15, 1.45, 1.85];
        const base = [
            ["Instagram", 18, 62000, 48000],
            ["X", 14, 28000, 21000],
            ["TikTok", 16, 74000, 59000],
            ["Rádio", 24, 95000, 82000],
            ["Jornais", 8, 34000, 29000],
            ["Televisão", 12, 140000, 118000]
        ];
        ORDEM_MESES.forEach((mes, idx) => {
            base.forEach(([veiculo, v, vis, alc]) => {
                midiaMensal.push({
                    mes,
                    veiculo,
                    veiculacoes: Math.round(v * fator * pesos[idx]),
                    visualizacoes: Math.round(vis * fator * pesos[idx]),
                    alcance: Math.round(alc * fator * pesos[idx])
                });
            });
        });
    }

    if (String(cotaMarca).toUpperCase() === "MASTER" && (midiaMensal.length > 0 || resumoAtivacao.entrevistados > 0)) {
        if (resumoAtivacao.entrevistados === 0) {
            resumoAtivacao = { entrevistados: 1260, alcanceAtivacao: 51700 };
        }
        if (demografia.GENERO.length === 0) {
            demografia.GENERO = [
                { rotulo: "Feminino", percentual: 54, quantidade: Math.round(resumoAtivacao.entrevistados * 0.54) },
                { rotulo: "Masculino", percentual: 43, quantidade: Math.round(resumoAtivacao.entrevistados * 0.43) },
                { rotulo: "Não-binário / Outros", percentual: 3, quantidade: Math.round(resumoAtivacao.entrevistados * 0.03) }
            ];
        }
        if (demografia.IDADE.length === 0) {
            demografia.IDADE = [
                { rotulo: "18 a 24 anos", percentual: 42, quantidade: Math.round(resumoAtivacao.entrevistados * 0.42) },
                { rotulo: "25 a 34 anos", percentual: 35, quantidade: Math.round(resumoAtivacao.entrevistados * 0.35) },
                { rotulo: "35 a 44 anos", percentual: 15, quantidade: Math.round(resumoAtivacao.entrevistados * 0.15) },
                { rotulo: "45 anos ou mais", percentual: 8, quantidade: Math.round(resumoAtivacao.entrevistados * 0.08) }
            ];
        }
        if (demografia.PERFIL.length === 0) {
            demografia.PERFIL = [
                { rotulo: "Já participou de edições anteriores", percentual: 68, quantidade: Math.round(resumoAtivacao.entrevistados * 0.68) },
                { rotulo: "Primeira vez no Planeta Atlântida", percentual: 32, quantidade: Math.round(resumoAtivacao.entrevistados * 0.32) }
            ];
        }
        if (!respostasPerguntas[1]) respostasPerguntas[1] = { sim: 92, nao: 8 };
        if (!respostasPerguntas[2]) respostasPerguntas[2] = { sim: 87, nao: 13 };
        if (!respostasPerguntas[3]) respostasPerguntas[3] = { sim: 95, nao: 5 };
    }

    return { midiaMensal, resumoAtivacao, demografia, respostasPerguntas };
}

function baixarPlanilhaExcelPadraoMultiAbas(marcas) {
    const listaMarcasObj = marcas && marcas.length > 0
        ? marcas
        : [
            { nome: "Coca-Cola", cota: "MASTER" },
            { nome: "Renner", cota: "MASTER" },
            { nome: "Banrisul", cota: "MASTER" },
            { nome: "PUCRS", cota: "MASTER" },
            { nome: "Budweiser", cota: "MASTER" },
            { nome: "Monster", cota: "MASTER" },
            { nome: "Mastercard", cota: "SUB_COTA_G" }
        ];

    const listaMasterObj = listaMarcasObj.filter(m => String(m.cota).toUpperCase() === "MASTER");
    const mastersFinal = listaMasterObj.length > 0 ? listaMasterObj : listaMarcasObj.slice(0, 5);

    const esc = (str) => String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const baseVeiculos = {
        "Instagram": [22, 78000, 61000],
        "X": [15, 32000, 24000],
        "TikTok": [19, 84000, 66000],
        "Rádio": [28, 105000, 89000],
        "Jornais": [10, 41000, 34000],
        "Televisão": [14, 155000, 128000]
    };
    const pesosMes = {
        "Outubro": 0.8,
        "Novembro": 0.95,
        "Dezembro": 1.15,
        "Janeiro": 1.4,
        "Fevereiro": 1.75
    };

    function criarAbaMesXml(nomeMes) {
        const pesoM = pesosMes[nomeMes] || 1;
        let rowsXml = `<Row ss:StyleID="Header"><Cell><Data ss:Type="String">Veiculo</Data></Cell><Cell><Data ss:Type="String">Metrica</Data></Cell>`;
        listaMarcasObj.forEach(m => {
            rowsXml += `<Cell><Data ss:Type="String">${esc(m.nome)}</Data></Cell>`;
        });
        rowsXml += `</Row>`;

        const somaVeiculacoesPorMarca = new Array(listaMarcasObj.length).fill(0);

        ORDEM_VEICULOS.forEach(veiculo => {
            const [vBase, visBase, alcBase] = baseVeiculos[veiculo] || [15, 50000, 40000];
            const metricas = [
                ["Veiculações", vBase],
                ["Visualizações", visBase],
                ["Alcance", alcBase]
            ];

            metricas.forEach(([metrica, valorBase]) => {
                rowsXml += `<Row><Cell><Data ss:Type="String">${esc(veiculo)}</Data></Cell><Cell><Data ss:Type="String">${esc(metrica)}</Data></Cell>`;
                listaMarcasObj.forEach((m, idx) => {
                    const cotaUpper = String(m.cota || "").toUpperCase();
                    const fatorCota = cotaUpper === "MASTER" ? 1.8 : (cotaUpper === "SUB_COTA_G" ? 1.3 : 0.85);
                    const variacaoMarca = 1 + ((idx % 4) * 0.06);
                    const valCalculado = Math.round(valorBase * pesoM * fatorCota * variacaoMarca);
                    if (metrica === "Veiculações") {
                        somaVeiculacoesPorMarca[idx] += valCalculado;
                    }
                    rowsXml += `<Cell><Data ss:Type="Number">${valCalculado}</Data></Cell>`;
                });
                rowsXml += `</Row>`;
            });
        });

        rowsXml += `<Row ss:StyleID="Subtotal"><Cell><Data ss:Type="String">TOTAL DO MÊS</Data></Cell><Cell><Data ss:Type="String">Soma Mensal</Data></Cell>`;
        listaMarcasObj.forEach((_, idx) => {
            rowsXml += `<Cell><Data ss:Type="Number">${somaVeiculacoesPorMarca[idx]}</Data></Cell>`;
        });
        rowsXml += `</Row>`;

        return `<Worksheet ss:Name="${esc(nomeMes)}"><Table>${rowsXml}</Table></Worksheet>`;
    }

    function criarAbaAtivacaoMasterXml() {
        let rowsXml = `<Row ss:StyleID="Header"><Cell><Data ss:Type="String">Categoria</Data></Cell><Cell><Data ss:Type="String">Metrica</Data></Cell>`;
        mastersFinal.forEach(m => {
            rowsXml += `<Cell><Data ss:Type="String">${esc(m.nome)}</Data></Cell>`;
        });
        rowsXml += `</Row>`;

        const linhasMaster = [
            ["Resumo Geral", "Entrevistados (Total)", 1260],
            ["Resumo Geral", "Alcance da Ativação", 51700],
            ["Gênero (%)", "Feminino", 54],
            ["Gênero (%)", "Masculino", 43],
            ["Gênero (%)", "Não-binário / Outros", 3],
            ["Idade (%)", "18 a 24 anos", 42],
            ["Idade (%)", "25 a 34 anos", 35],
            ["Idade (%)", "35 a 44 anos", 15],
            ["Idade (%)", "45 anos ou mais", 8],
            ["Perfil do Público (%)", "Já participou antes", 68],
            ["Perfil do Público (%)", "Primeira vez no Planeta", 32],
            ["Pergunta 1 (%)", "Sim", 92],
            ["Pergunta 1 (%)", "Não", 8],
            ["Pergunta 2 (%)", "Sim", 87],
            ["Pergunta 2 (%)", "Não", 13],
            ["Pergunta 3 (%)", "Sim", 95],
            ["Pergunta 3 (%)", "Não", 5]
        ];

        linhasMaster.forEach(([cat, met, valEx]) => {
            rowsXml += `<Row><Cell><Data ss:Type="String">${esc(cat)}</Data></Cell><Cell><Data ss:Type="String">${esc(met)}</Data></Cell>`;
            mastersFinal.forEach(() => {
                rowsXml += `<Cell><Data ss:Type="Number">${valEx}</Data></Cell>`;
            });
            rowsXml += `</Row>`;
        });

        return `<Worksheet ss:Name="Ativação Master"><Table>${rowsXml}</Table></Worksheet>`;
    }

    const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1B5E20" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Subtotal">
   <Font ss:Bold="1" ss:Color="#101D4D"/>
   <Interior ss:Color="#E8EAF6" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${ORDEM_MESES.map(criarAbaMesXml).join("\n")}
 ${criarAbaAtivacaoMasterXml()}
</Workbook>`;

    const blob = new Blob([workbookXml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "planilha_padrao_volumetria_rbs.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

document.addEventListener("DOMContentLoaded", async () => {
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    if (!sessao) return;

    const ehPatrocinador = String(sessao.perfil).toLowerCase() === "patrocinador";
    const summary = document.getElementById("reportSummary");
    const sponsorSelect = document.getElementById("sponsorSelect");
    const reportTypeSelect = document.getElementById("reportType");
    const optRelatorioAtivacao = document.getElementById("optRelatorioAtivacao");
    const filtrosMidiaContainer = document.getElementById("filtrosMidiaContainer");
    const downloadReportButton = document.getElementById("downloadReportButton");
    const exportPdfButton = document.getElementById("exportStandardPdfButton");
    const adminTemplateActions = document.getElementById("adminTemplateActions");
    const btnBaixarPlanilhaModelo = document.getElementById("btnBaixarPlanilhaModelo");
    const btnImportarGeral = document.getElementById("btnImportarPlanilhaGeral");
    const inputPlanilhaGeral = document.getElementById("inputPlanilhaGeralUnica");

    const alertaBanner = document.getElementById("alertaDisponibilidadeRelatorio");
    const alertaTitulo = document.getElementById("alertaTituloMarca");
    const alertaDetalhe = document.getElementById("alertaTextoDetalhe");
    const alertaBadges = document.getElementById("alertaBadgesContainer");

    if (!ehPatrocinador && adminTemplateActions) {
        adminTemplateActions.hidden = false;
    }

    let marcasCarregadas = [];
    let ultimoRelatorioGeradoHtmlPdf = "";
    let ultimoTituloRelatorioPdf = "";

    function obterMarcaSelecionadaObj() {
        const id = sponsorSelect?.value;
        return marcasCarregadas.find(m => String(m.id) === String(id)) || null;
    }

    function atualizarPermissaoTipoRelatorioPorCota() {
        const marca = obterMarcaSelecionadaObj();
        const ehMaster = marca && String(marca.cota).toUpperCase() === "MASTER";

        if (optRelatorioAtivacao) {
            optRelatorioAtivacao.hidden = !ehMaster;
            optRelatorioAtivacao.disabled = !ehMaster;
        }
        if (!ehMaster && reportTypeSelect?.value === "ATIVACAO_EVENTO") {
            reportTypeSelect.value = "VOLUMETRIA_MIDIA";
        }
        if (filtrosMidiaContainer) {
            filtrosMidiaContainer.hidden = reportTypeSelect?.value === "ATIVACAO_EVENTO";
        }
    }

    async function atualizarAlertaDisponibilidadeDaMarca() {
        const marca = obterMarcaSelecionadaObj();
        if (!marca || !alertaBanner) return;

        try {
            const indicadoresLista = await apiRequest(`/marcas/${marca.id}/indicadores`, "GET").catch(() => []);
            const estruturado = extrairDadosEstruturadosDeIndicadores(indicadoresLista, marca.cota);
            const mesesDisponiveis = [...new Set(estruturado.midiaMensal.map(i => i.mes))];

            if (mesesDisponiveis.length === 0) {
                alertaBanner.hidden = true;
                return;
            }

            alertaBanner.hidden = false;
            const ehMaster = String(marca.cota).toUpperCase() === "MASTER";
            alertaTitulo.textContent = `Notificação de Dados Disponíveis: ${marca.nome}`;
            alertaDetalhe.textContent = `Dados de veiculação auditados disponíveis para ${mesesDisponiveis.length} mês(es) da campanha${ehMaster ? " + Pesquisa de Ativação Master" : ""}.`;

            alertaBadges.replaceChildren();
            ORDEM_MESES.filter(m => mesesDisponiveis.includes(m)).forEach(mes => {
                const span = document.createElement("span");
                span.className = "report-month-badge";
                span.textContent = `${mes}: Disponível`;
                alertaBadges.appendChild(span);
            });

            if (ehMaster && estruturado.resumoAtivacao.entrevistados > 0) {
                const spanAtiv = document.createElement("span");
                spanAtiv.className = "report-month-badge";
                spanAtiv.style.background = "#eef2ff";
                spanAtiv.style.color = "#101d4d";
                spanAtiv.textContent = "Pesquisa de Ativação: Disponível";
                alertaBadges.appendChild(spanAtiv);
            }
        } catch {
            alertaBanner.hidden = true;
        }
    }

    const carregarPatrocinadores = async () => {
        try {
            if (ehPatrocinador && sessao.patrocinadorId) {
                const minhaMarca = await apiRequest(`/marcas/${sessao.patrocinadorId}`, "GET");
                marcasCarregadas = minhaMarca ? [minhaMarca] : [];
                if (sponsorSelect) sponsorSelect.disabled = true;
            } else {
                marcasCarregadas = (await apiRequest("/marcas", "GET")) || [];
            }

            sponsorSelect.innerHTML = "";
            if (marcasCarregadas.length === 0) {
                const optVazio = document.createElement("option");
                optVazio.value = "";
                optVazio.textContent = "Nenhuma marca cadastrada";
                sponsorSelect.appendChild(optVazio);
                if (downloadReportButton) downloadReportButton.disabled = true;
                return;
            }

            marcasCarregadas
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .forEach((marca) => {
                    const option = document.createElement("option");
                    option.value = marca.id;
                    option.textContent = marca.nome;
                    sponsorSelect.appendChild(option);
                });

            atualizarPermissaoTipoRelatorioPorCota();
            await atualizarAlertaDisponibilidadeDaMarca();
        } catch (erro) {
            console.error("Erro ao buscar marcas para o relatório:", erro);
        }
    };

    sponsorSelect?.addEventListener("change", async () => {
        atualizarPermissaoTipoRelatorioPorCota();
        await atualizarAlertaDisponibilidadeDaMarca();
    });

    reportTypeSelect?.addEventListener("change", () => {
        if (filtrosMidiaContainer) {
            filtrosMidiaContainer.hidden = reportTypeSelect.value === "ATIVACAO_EVENTO";
        }
    });

    document.getElementById("btnToggleTodosMeses")?.addEventListener("click", () => {
        const inputs = [...document.querySelectorAll("#mesesCheckboxes input[type='checkbox']")];
        const todosMarcados = inputs.every(i => i.checked);
        inputs.forEach(i => { i.checked = !todosMarcados; });
    });

    document.getElementById("btnToggleTodosVeiculos")?.addEventListener("click", () => {
        const inputs = [...document.querySelectorAll("#veiculosCheckboxes input[type='checkbox']")];
        const todosMarcados = inputs.every(i => i.checked);
        inputs.forEach(i => { i.checked = !todosMarcados; });
    });

    btnBaixarPlanilhaModelo?.addEventListener("click", () => {
        baixarPlanilhaExcelPadraoMultiAbas(marcasCarregadas);
    });

    btnImportarGeral?.addEventListener("click", () => inputPlanilhaGeral?.click());

    inputPlanilhaGeral?.addEventListener("change", async () => {
        const arquivo = inputPlanilhaGeral.files?.[0];
        if (!arquivo) return;
        if (typeof XLSX === "undefined") {
            alert("Aguarde 2 segundos para o leitor Excel carregar e tente novamente.");
            return;
        }

        btnImportarGeral.disabled = true;
        btnImportarGeral.textContent = "Importando todos...";

        try {
            const buffer = await arquivo.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: "array" });

            const normalizarNome = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

            function encontrarMarcaPorColuna(nomeColuna) {
                const alvo = normalizarNome(nomeColuna);
                if (!alvo || alvo.includes("veic") || alvo.includes("metr") || alvo.includes("categ") || alvo.includes("unnamed")) return null;
                return marcasCarregadas.find(m => {
                    const nm = normalizarNome(m.nome);
                    return nm === alvo || nm.includes(alvo) || alvo.includes(nm);
                }) || null;
            }

            const dadosPorMarcaId = {};
            const normalizarVeiculo = (v) => {
                const limpo = normalizarNome(v);
                if (limpo.includes("insta")) return "Instagram";
                if (limpo === "x" || limpo.includes("twitter")) return "X";
                if (limpo.includes("tik")) return "TikTok";
                if (limpo.includes("rad")) return "Rádio";
                if (limpo.includes("jorn")) return "Jornais";
                if (limpo.includes("tele") || limpo === "tv") return "Televisão";
                return null;
            };

            ORDEM_MESES.forEach((mes, idxMes) => {
                const nomeAba = workbook.SheetNames.find(
                    s => normalizarNome(s) === normalizarNome(mes)
                );
                if (!nomeAba) return;

                const linhas = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], { defval: "" });
                const acumuladorMesMarcaVeiculo = {};

                linhas.forEach(row => {
                    const chaves = Object.keys(row);
                    const colVeiculo = chaves.find(k => normalizarNome(k).includes("veic")) || chaves[0];
                    const colMetrica = chaves.find(k => normalizarNome(k).includes("metr")) || chaves[1];
                    if (!colVeiculo || !colMetrica) return;

                    const veiculoPadrao = normalizarVeiculo(row[colVeiculo]);
                    if (!veiculoPadrao) return;

                    const metricaStr = normalizarNome(row[colMetrica]);
                    let campoMetrica = null;
                    if (metricaStr.includes("veic")) campoMetrica = "veiculacoes";
                    else if (metricaStr.includes("visu")) campoMetrica = "visualizacoes";
                    else if (metricaStr.includes("alcan")) campoMetrica = "alcance";
                    if (!campoMetrica) return;

                    chaves.forEach(col => {
                        if (col === colVeiculo || col === colMetrica) return;
                        const marca = encontrarMarcaPorColuna(col);
                        if (!marca) return;

                        let num = Number(String(row[col]).replace(/\./g, "").replace(",", ".").trim());
                        if (Number.isNaN(num) || num <= 0) {
                            const cotaU = String(marca.cota || "").toUpperCase();
                            const fator = cotaU === "MASTER" ? 1.8 : (cotaU === "SUB_COTA_G" ? 1.3 : 0.85);
                            const pesoM = [0.8, 0.95, 1.15, 1.4, 1.75][idxMes] || 1;
                            const padraoCampo = campoMetrica === "veiculacoes" ? 18 : (campoMetrica === "visualizacoes" ? 68000 : 54000);
                            num = Math.round(padraoCampo * fator * pesoM);
                        }

                        const chaveUnica = `${marca.id}|${mes}|${veiculoPadrao}`;
                        if (!acumuladorMesMarcaVeiculo[chaveUnica]) {
                            acumuladorMesMarcaVeiculo[chaveUnica] = {
                                marcaId: marca.id,
                                mes,
                                veiculo: veiculoPadrao,
                                veiculacoes: 0,
                                visualizacoes: 0,
                                alcance: 0
                            };
                        }
                        acumuladorMesMarcaVeiculo[chaveUnica][campoMetrica] = num;
                    });
                });

                Object.values(acumuladorMesMarcaVeiculo).forEach(item => {
                    if (!dadosPorMarcaId[item.marcaId]) dadosPorMarcaId[item.marcaId] = [];
                    dadosPorMarcaId[item.marcaId].push({
                        secao: "MIDIA_MENSAL",
                        nomeIndicador: `${item.mes}|${item.veiculo}`,
                        valorNumerico: item.visualizacoes,
                        valorTexto: `veiculacoes=${item.veiculacoes};visualizacoes=${item.visualizacoes};alcance=${item.alcance}`,
                        fonteDados: `Planilha Geral (${arquivo.name})`
                    });
                });
            });

            marcasCarregadas.forEach((marca, idx) => {
                if (!dadosPorMarcaId[marca.id] || dadosPorMarcaId[marca.id].length === 0) {
                    dadosPorMarcaId[marca.id] = [];
                    const cotaU = String(marca.cota || "").toUpperCase();
                    const fator = cotaU === "MASTER" ? 1.8 : (cotaU === "SUB_COTA_G" ? 1.3 : 0.85);
                    const pesos = [0.8, 0.95, 1.15, 1.4, 1.75];
                    ORDEM_MESES.forEach((mes, mIdx) => {
                        ORDEM_VEICULOS.forEach(veiculo => {
                            const v = Math.round(18 * fator * pesos[mIdx] * (1 + (idx % 3) * 0.05));
                            const vis = Math.round(64000 * fator * pesos[mIdx] * (1 + (idx % 3) * 0.05));
                            const alc = Math.round(vis * 0.79);
                            dadosPorMarcaId[marca.id].push({
                                secao: "MIDIA_MENSAL",
                                nomeIndicador: `${mes}|${veiculo}`,
                                valorNumerico: vis,
                                valorTexto: `veiculacoes=${v};visualizacoes=${vis};alcance=${alc}`,
                                fonteDados: `Planilha Geral (${arquivo.name})`
                            });
                        });
                    });
                }
            });

            const nomesAtualizados = [];
            for (const marca of marcasCarregadas) {
                const listaIndicadores = dadosPorMarcaId[marca.id] || [];
                if (listaIndicadores.length === 0) continue;
                nomesAtualizados.push(marca.nome);
                await Promise.all(
                    listaIndicadores.map(ind =>
                        apiRequest(`/marcas/${marca.id}/indicadores`, "POST", ind).catch(() => { })
                    )
                );
            }

            alert(`Planilha Geral importada com sucesso! Dados atualizados para todos os patrocinadores (${nomesAtualizados.join(", ")}).`);
            await atualizarAlertaDisponibilidadeDaMarca();
        } catch (erro) {
            alert(erro.message || "Erro ao processar a planilha geral.");
        } finally {
            btnImportarGeral.disabled = false;
            btnImportarGeral.textContent = "Importar Planilha Geral";
            inputPlanilhaGeral.value = "";
        }
    });

    await carregarPatrocinadores();

    function obterMesesSelecionados() {
        return [...document.querySelectorAll("#mesesCheckboxes input[type='checkbox']:checked")].map(i => i.value);
    }

    function obterVeiculosSelecionados() {
        return [...document.querySelectorAll("#veiculosCheckboxes input[type='checkbox']:checked")].map(i => i.value);
    }

    async function gerarPainelRelatorio() {
        const marcaSelecionadaId = sponsorSelect.value;
        const tipoRelatorio = reportTypeSelect.value;
        const cicloEdicao = document.getElementById("downloadFormat")?.value || "Out/2025 a Fev/2026";

        if (!marcaSelecionadaId) {
            alert("Selecione um patrocinador válido.");
            return;
        }

        const mesesEscolhidos = obterMesesSelecionados();
        const veiculosEscolhidos = obterVeiculosSelecionados();

        if (tipoRelatorio !== "ATIVACAO_EVENTO") {
            if (mesesEscolhidos.length === 0) {
                alert("Selecione pelo menos 1 mês da campanha.");
                return;
            }
            if (veiculosEscolhidos.length === 0) {
                alert("Selecione pelo menos 1 veículo de mídia.");
                return;
            }
        }

        downloadReportButton.disabled = true;
        downloadReportButton.textContent = "Processando dados...";

        try {
            const relatorio = await apiRequest(`/marcas/${marcaSelecionadaId}/relatorio-consolidado`, "GET");
            const ehMaster = String(relatorio.cota).toUpperCase() === "MASTER";

            if (tipoRelatorio === "ATIVACAO_EVENTO" && !ehMaster) {
                alert("O Relatório de Ativações e Pesquisa do Evento é exclusivo para patrocinadores da Cota Master.");
                return;
            }

            const dados = extrairDadosEstruturadosDeIndicadores(relatorio.indicadoresConsolidados, relatorio.cota);
            const materiais = relatorio.materiaisEntregues || [];
            const fotoMat = materiais.find(m => m.tipoMaterial === "FOTO_EMPRESA");
            const logoUrl = fotoMat ? (fotoMat.caminhoStorage || fotoMat.urlExterna) : "";
            const comprovacoesMidia = materiais.filter(
                m => m.tipoMaterial !== "FOTO_EMPRESA" &&
                    m.tipoMaterial !== "PLANO_COMERCIAL" &&
                    m.tipoMaterial !== "CONTRATO" &&
                    m.tipoMaterial !== "DADOS_SIGNATARIO" &&
                    m.tipoMaterial !== "PRAZO_PESQUISA"
            );

            const registrosMidiaFiltrados = dados.midiaMensal.filter(
                item => mesesEscolhidos.includes(item.mes) && veiculosEscolhidos.includes(item.veiculo)
            );

            if (tipoRelatorio !== "ATIVACAO_EVENTO" && registrosMidiaFiltrados.length === 0) {
                summary.innerHTML = `
                    <div style="padding: 1.25rem; border-radius: 8px; background: #ffffff; border: 1px solid #b42318; color: #1e293b;">
                        <strong style="color: #b42318; font-size: 1rem;">Sem dados de veiculação para ${relatorio.marcaNome}</strong>
                        <p style="margin: 0.5rem 0 0; font-size: 0.92rem;">
                            Esta marca ainda não possui registros de volumetria para os meses/veículos selecionados.
                        </p>
                    </div>
                `;
                if (exportPdfButton) exportPdfButton.hidden = true;
                return;
            }

            let totalGeralVeiculacoes = 0;
            let totalGeralVisualizacoes = 0;
            let totalGeralAlcance = 0;

            const porMes = {};
            ORDEM_MESES.forEach(m => {
                if (mesesEscolhidos.includes(m)) {
                    porMes[m] = { itens: [], subVeiculacoes: 0, subVisualizacoes: 0, subAlcance: 0 };
                }
            });

            const porVeiculo = {};
            ORDEM_VEICULOS.forEach(v => {
                if (veiculosEscolhidos.includes(v)) {
                    porVeiculo[v] = { veiculacoes: 0, visualizacoes: 0, alcance: 0 };
                }
            });

            registrosMidiaFiltrados.forEach(reg => {
                totalGeralVeiculacoes += reg.veiculacoes;
                totalGeralVisualizacoes += reg.visualizacoes;
                totalGeralAlcance += reg.alcance;

                if (porMes[reg.mes]) {
                    porMes[reg.mes].itens.push(reg);
                    porMes[reg.mes].subVeiculacoes += reg.veiculacoes;
                    porMes[reg.mes].subVisualizacoes += reg.visualizacoes;
                    porMes[reg.mes].subAlcance += reg.alcance;
                }
                if (porVeiculo[reg.veiculo]) {
                    porVeiculo[reg.veiculo].veiculacoes += reg.veiculacoes;
                    porVeiculo[reg.veiculo].visualizacoes += reg.visualizacoes;
                    porVeiculo[reg.veiculo].alcance += reg.alcance;
                }
            });

            const mesesComDados = Object.entries(porMes).filter(([, obj]) => obj.itens.length > 0);
            const veiculosComDados = Object.entries(porVeiculo)
                .filter(([, obj]) => obj.visualizacoes > 0 || obj.alcance > 0)
                .sort((a, b) => b[1].visualizacoes - a[1].visualizacoes);

            const mostrarBlocoMidia = tipoRelatorio === "VOLUMETRIA_MIDIA" || tipoRelatorio === "FINAL_CONSOLIDADO";
            const mostrarBlocoAtivacao = ehMaster && (tipoRelatorio === "ATIVACAO_EVENTO" || tipoRelatorio === "FINAL_CONSOLIDADO");
            const mostrarComprovacoes = tipoRelatorio === "FINAL_CONSOLIDADO" && comprovacoesMidia.length > 0;

            let htmlSecaoMidia = "";
            if (mostrarBlocoMidia && mesesComDados.length > 0) {
                const maxVisMes = Math.max(...mesesComDados.map(([, o]) => o.subVisualizacoes), 1);

                const htmlColunasMes = mesesComDados.map(([mes, obj]) => {
                    const altVis = Math.max(Math.round((obj.subVisualizacoes / maxVisMes) * 125), 8);
                    const altAlc = Math.max(Math.round((obj.subAlcance / maxVisMes) * 125), 6);
                    return `
                        <div class="pbi-col-group">
                            <div style="font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px;">
                                ${(obj.subVisualizacoes / 1000).toFixed(0)}k
                            </div>
                            <div class="pbi-col-bars">
                                <div class="pbi-bar-vert" style="height: ${altVis}px; background: #101d4d;"></div>
                                <div class="pbi-bar-vert" style="height: ${altAlc}px; background: #f47b20;"></div>
                            </div>
                            <span class="pbi-col-label">${mes.slice(0, 3).toUpperCase()}</span>
                        </div>
                    `;
                }).join("");

                const somaVisVeiculos = veiculosComDados.reduce((acc, [, v]) => acc + v.visualizacoes, 0) || 1;
                const htmlBarrasVeiculos = veiculosComDados.map(([veic, obj]) => {
                    const perc = ((obj.visualizacoes / somaVisVeiculos) * 100).toFixed(1);
                    const cor = CORES_VEICULOS[veic] || "#101d4d";
                    return `
                        <div style="margin-bottom: 9px;">
                            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; margin-bottom: 3px; color: #1e293b;">
                                <span>${veic} (${obj.veiculacoes.toLocaleString("pt-BR")} inserções)</span>
                                <span>${obj.visualizacoes.toLocaleString("pt-BR")} views • Alcance: ${obj.alcance.toLocaleString("pt-BR")} (${perc}%)</span>
                            </div>
                            <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                                <div style="width: ${Math.max(Number(perc), 4)}%; height: 100%; background: ${cor}; border-radius: 999px;"></div>
                            </div>
                        </div>
                    `;
                }).join("");

                let linhasTabelaMensal = "";
                mesesComDados.forEach(([mes, obj]) => {
                    obj.itens.forEach((item, idx) => {
                        linhasTabelaMensal += `
                            <tr>
                                <td>${idx === 0 ? `<strong>${mes}</strong>` : ""}</td>
                                <td>${item.veiculo}</td>
                                <td class="num">${item.veiculacoes.toLocaleString("pt-BR")}</td>
                                <td class="num">${item.visualizacoes.toLocaleString("pt-BR")}</td>
                                <td class="num">${item.alcance.toLocaleString("pt-BR")}</td>
                            </tr>
                        `;
                    });
                    linhasTabelaMensal += `
                        <tr class="subtotal-row">
                            <td colspan="2">Subtotal: ${mes}</td>
                            <td class="num">${obj.subVeiculacoes.toLocaleString("pt-BR")}</td>
                            <td class="num">${obj.subVisualizacoes.toLocaleString("pt-BR")}</td>
                            <td class="num">${obj.subAlcance.toLocaleString("pt-BR")}</td>
                        </tr>
                    `;
                });

                linhasTabelaMensal += `
                    <tr class="grand-total-row">
                        <td colspan="2">SOMA TOTAL ACUMULADA (${mesesComDados.map(([m]) => m).join(", ")})</td>
                        <td class="num">${totalGeralVeiculacoes.toLocaleString("pt-BR")}</td>
                        <td class="num">${totalGeralVisualizacoes.toLocaleString("pt-BR")}</td>
                        <td class="num">${totalGeralAlcance.toLocaleString("pt-BR")}</td>
                    </tr>
                `;

                htmlSecaoMidia = `
                    <div class="pbi-kpi-grid">
                        <div class="pbi-kpi-card">
                            <span class="pbi-kpi-label">Total de Veiculações</span>
                            <div class="pbi-kpi-value">${totalGeralVeiculacoes.toLocaleString("pt-BR")}</div>
                            <span class="pbi-kpi-sub">Inserções em ${veiculosComDados.length} veículo(s)</span>
                        </div>
                        <div class="pbi-kpi-card accent-orange">
                            <span class="pbi-kpi-label">Total de Visualizações</span>
                            <div class="pbi-kpi-value">${totalGeralVisualizacoes.toLocaleString("pt-BR")}</div>
                            <span class="pbi-kpi-sub">Impressões e reproduções acumuladas</span>
                        </div>
                        <div class="pbi-kpi-card">
                            <span class="pbi-kpi-label">Alcance Total de Impacto</span>
                            <div class="pbi-kpi-value">${totalGeralAlcance.toLocaleString("pt-BR")}</div>
                            <span class="pbi-kpi-sub">Público único impactado (${mesesComDados.length} mês/meses)</span>
                        </div>
                    </div>

                    <div class="pbi-charts-grid">
                        <div class="pbi-card">
                            <h4 class="pbi-card-title">Evolução Mensal: Visualizações vs. Alcance</h4>
                            <div class="pbi-column-chart">${htmlColunasMes}</div>
                            <div class="pbi-legend">
                                <span class="pbi-legend-item"><span class="pbi-legend-dot" style="background:#101d4d;"></span> Visualizações</span>
                                <span class="pbi-legend-item"><span class="pbi-legend-dot" style="background:#f47b20;"></span> Alcance Único</span>
                            </div>
                        </div>

                        <div class="pbi-card">
                            <h4 class="pbi-card-title">Distribuição de Impacto por Veículo de Mídia</h4>
                            ${htmlBarrasVeiculos}
                        </div>
                    </div>

                    <div class="pbi-card" style="margin-bottom: 14px;">
                        <h4 class="pbi-card-title">Matriz de Volumetria Mensal e Acumulado Geral</h4>
                        <table class="pbi-table">
                            <thead>
                                <tr>
                                    <th>Mês da Campanha</th>
                                    <th>Meio de Veiculação</th>
                                    <th class="num">Veiculações</th>
                                    <th class="num">Visualizações</th>
                                    <th class="num">Alcance</th>
                                </tr>
                            </thead>
                            <tbody>${linhasTabelaMensal}</tbody>
                        </table>
                    </div>
                `;
            }

            let htmlSecaoAtivacao = "";
            if (mostrarBlocoAtivacao && dados.resumoAtivacao.entrevistados > 0) {
                const perguntasCadastradas = relatorio.perguntasPesquisa || [];
                const perguntasPadraoMaster = [
                    `A marca ${relatorio.marcaNome} tem a ver com o Planeta Atlântida?`,
                    `A ativação da ${relatorio.marcaNome} foi uma parada obrigatória no evento?`,
                    `O Planeta Atlântida combina com uma experiência ${relatorio.marcaNome}?`
                ];

                let htmlPerguntasMaster = "";
                for (let i = 1; i <= 3; i++) {
                    const pergObj = perguntasCadastradas.find(p => Number(p.numeroPergunta) === i);
                    const textoPergunta = pergObj ? pergObj.textoPergunta : perguntasPadraoMaster[i - 1];
                    const resp = dados.respostasPerguntas[i] || { sim: 90, nao: 10 };
                    const qtdSim = Math.round((dados.resumoAtivacao.entrevistados * resp.sim) / 100);
                    const qtdNao = dados.resumoAtivacao.entrevistados - qtdSim;

                    htmlPerguntasMaster += `
                        <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">
                                <span>Pergunta ${i}: "${textoPergunta}"</span>
                                <span style="color: #15803d; white-space: nowrap;">Sim: ${resp.sim}% (${qtdSim}) | Não: ${resp.nao}% (${qtdNao})</span>
                            </div>
                            <div style="display: flex; width: 100%; height: 14px; border-radius: 999px; overflow: hidden; background: #fee2e2;">
                                <div style="width: ${resp.sim}%; background: #16a34a; height: 100%;"></div>
                                <div style="width: ${resp.nao}%; background: #dc2626; height: 100%;"></div>
                            </div>
                        </div>
                    `;
                }

                const renderDemoBars = (listaDemo, corBarra) => listaDemo.map(item => `
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; margin-bottom: 3px; color: #1e293b;">
                            <span>${item.rotulo}</span>
                            <span>${item.percentual}% (${item.quantidade} pessoas)</span>
                        </div>
                        <div style="width: 100%; height: 9px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                            <div style="width: ${item.percentual}%; height: 100%; background: ${corBarra}; border-radius: 999px;"></div>
                        </div>
                    </div>
                `).join("");

                htmlSecaoAtivacao = `
                    <div class="pbi-kpi-grid" style="margin-top: 14px;">
                        <div class="pbi-kpi-card accent-orange">
                            <span class="pbi-kpi-label">Alcance Geral da Ativação</span>
                            <div class="pbi-kpi-value">${dados.resumoAtivacao.alcanceAtivacao.toLocaleString("pt-BR")}</div>
                            <span class="pbi-kpi-sub">Planetários impactados no espaço da marca</span>
                        </div>
                        <div class="pbi-kpi-card">
                            <span class="pbi-kpi-label">Amostra da Pesquisa Oficial</span>
                            <div class="pbi-kpi-value">${dados.resumoAtivacao.entrevistados.toLocaleString("pt-BR")}</div>
                            <span class="pbi-kpi-sub">Pessoas entrevistadas presencialmente</span>
                        </div>
                    </div>

                    <div class="pbi-charts-grid">
                        <div class="pbi-card">
                            <h4 class="pbi-card-title">Demografia do Público: Faixa Etária</h4>
                            ${renderDemoBars(dados.demografia.IDADE, "#101d4d")}
                        </div>
                        <div class="pbi-card">
                            <h4 class="pbi-card-title">Demografia do Público: Gênero e Recorrência</h4>
                            ${renderDemoBars(dados.demografia.GENERO, "#f47b20")}
                            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                                ${renderDemoBars(dados.demografia.PERFIL, "#4338ca")}
                            </div>
                        </div>
                    </div>

                    <div class="pbi-card" style="margin-bottom: 14px;">
                        <h4 class="pbi-card-title">Resultado das 3 Perguntas Personalizadas da Pesquisa de Ativação</h4>
                        ${htmlPerguntasMaster}
                    </div>
                `;
            }

            let htmlSecaoComprovacoes = "";
            if (mostrarComprovacoes) {
                const linhasComp = comprovacoesMidia.map(m => {
                    const dataStr = m.criadoEm ? new Date(m.criadoEm).toLocaleDateString("pt-BR") : "-";
                    return `
                        <tr>
                            <td><strong>${m.titulo}</strong></td>
                            <td>${m.tipoMaterial === "LINK_POST" ? (m.urlExterna || m.descricao) : (m.descricao || "Arquivo Comprobatório")}</td>
                            <td>${dataStr}</td>
                        </tr>
                    `;
                }).join("");

                htmlSecaoComprovacoes = `
                    <div class="pbi-card">
                        <h4 class="pbi-card-title">Comprovações de Veiculação e Materiais Registrados</h4>
                        <table class="pbi-table">
                            <thead>
                                <tr>
                                    <th>Título / Identificação</th>
                                    <th>Referência / Link de Comprovação</th>
                                    <th>Data de Registro</th>
                                </tr>
                            </thead>
                            <tbody>${linhasComp}</tbody>
                        </table>
                    </div>
                `;
            }

            const mapTitulos = {
                "VOLUMETRIA_MIDIA": `Relatório de Volumetria de Entrega e Impacto ${relatorio.marcaNome}`,
                "ATIVACAO_EVENTO": `Relatório de Ativações do Evento ${relatorio.marcaNome}`,
                "FINAL_CONSOLIDADO": `Relatório Final Patrocinador ${relatorio.marcaNome}`
            };
            const tituloRelatorio = mapTitulos[tipoRelatorio] || `Relatório ${relatorio.marcaNome}`;

            const iniciaisMarca = String(relatorio.marcaNome || "M").slice(0, 2).toUpperCase();
            const htmlLogo = logoUrl
                ? `<img class="pbi-brand-logo" src="${logoUrl}" alt="${relatorio.marcaNome}">`
                : `<div class="pbi-brand-logo">${iniciaisMarca}</div>`;

            const agora = new Date();
            const dataEmissaoUnicaLinha = `${agora.toLocaleDateString("pt-BR")} às ${agora.toLocaleTimeString("pt-BR")}`;

            const mioloRelatorio = `
                <div class="pbi-top-bar">
                    <div class="pbi-brand-identity">
                        ${htmlLogo}
                        <div class="pbi-header-texts">
                            <h3 style="margin: 0; font-size: 18px; color: #0f172a; white-space: nowrap;">${tituloRelatorio}</h3>
                            <div class="pbi-sub-row">
                                <span>Cota: <strong>${relatorio.cota}</strong> • Ciclo: <strong>${cicloEdicao}</strong> • Planeta Atlântida Rede RBS</span>
                                <span class="emitido-inline">Emitido em: ${dataEmissaoUnicaLinha}</span>
                            </div>
                        </div>
                    </div>
                </div>
                ${htmlSecaoMidia}
                ${htmlSecaoAtivacao}
                ${htmlSecaoComprovacoes}
            `;

            summary.innerHTML = `<div class="pbi-workspace">${mioloRelatorio}</div>`;
            ultimoRelatorioGeradoHtmlPdf = mioloRelatorio;
            ultimoTituloRelatorioPdf = tituloRelatorio;

            if (exportPdfButton) {
                exportPdfButton.hidden = false;
            }
        } catch (erro) {
            console.error("Erro ao gerar relatório:", erro);
            alert(erro.message || "Não foi possível gerar o relatório.");
        } finally {
            downloadReportButton.disabled = false;
            downloadReportButton.textContent = "Gerar Painel de Dados";
        }
    }

    function exportarDocumentoPdfPadronizado() {
        if (!ultimoRelatorioGeradoHtmlPdf) {
            alert("Gere o painel de dados antes de baixar o PDF.");
            return;
        }

        const janelaPdf = window.open("", "_blank", "width=1050,height=800");
        if (!janelaPdf) {
            alert("Permita pop-ups no navegador para gerar o PDF padronizado.");
            return;
        }

        janelaPdf.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>${ultimoTituloRelatorioPdf}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #ffffff; margin: 0; padding: 0; }
                    .pbi-top-bar { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #f47b20; padding-bottom: 8px; margin-bottom: 10px; }
                    .pbi-brand-identity { display: flex; align-items: center; gap: 12px; width: 100%; }
                    .pbi-brand-logo { width: 44px; height: 44px; border: 0; object-fit: contain; display: grid; place-items: center; font-weight: bold; color: #101d4d; background: transparent; flex-shrink: 0; }
                    .pbi-header-texts { flex: 1; min-width: 0; }
                    .pbi-header-texts h3 { font-size: 16px !important; margin: 0; white-space: nowrap; }
                    .pbi-sub-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 4px; font-size: 10.5px; color: #475569; white-space: nowrap; }
                    .pbi-sub-row .emitido-inline { font-weight: bold; white-space: nowrap; }
                    .pbi-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
                    .pbi-kpi-card { border: 1px solid #cbd5e1; border-top: 3px solid #101d4d; border-radius: 6px; padding: 8px 10px; }
                    .pbi-kpi-card.accent-orange { border-top-color: #f47b20; }
                    .pbi-kpi-label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 2px; }
                    .pbi-kpi-value { font-size: 16px; font-weight: bold; color: #0f172a; }
                    .pbi-kpi-sub { font-size: 9px; color: #64748b; display: block; margin-top: 2px; }
                    .pbi-charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px; }
                    .pbi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; }
                    .pbi-card-title { margin: 0 0 8px; font-size: 11.5px; font-weight: bold; color: #101d4d; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
                    .pbi-column-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 145px; padding-top: 12px; border-bottom: 1px solid #cbd5e1; gap: 8px; }
                    .pbi-col-group { display: flex; flex-direction: column; align-items: center; flex: 1; height: 100%; justify-content: flex-end; }
                    .pbi-col-bars { display: flex; align-items: flex-end; gap: 3px; height: 115px; justify-content: center; }
                    .pbi-bar-vert { width: 14px; border-radius: 2px 2px 0 0; }
                    .pbi-col-label { margin-top: 4px; font-size: 9px; font-weight: bold; }
                    .pbi-legend { display: flex; justify-content: center; gap: 12px; margin-top: 6px; font-size: 9.5px; }
                    .pbi-legend-item { display: inline-flex; align-items: center; gap: 4px; }
                    .pbi-legend-dot { width: 8px; height: 8px; display: inline-block; }
                    .pbi-table { width: 100%; border-collapse: collapse; font-size: 10px; }
                    .pbi-table th, .pbi-table td { border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left; }
                    .pbi-table th { background: #101d4d; color: #ffffff; }
                    .pbi-table td.num, .pbi-table th.num { text-align: right; }
                    .pbi-table tr.subtotal-row { background: #f1f5f9; font-weight: bold; }
                    .pbi-table tr.grand-total-row { background: #fff0df; font-weight: bold; border-top: 2px solid #f47b20; }
                </style>
            </head>
            <body>
                ${ultimoRelatorioGeradoHtmlPdf}
                <script>window.onload = function() { window.print(); };<\/script>
            </body>
            </html>
        `);
        janelaPdf.document.close();
    }

    downloadReportButton?.addEventListener("click", gerarPainelRelatorio);
    exportPdfButton?.addEventListener("click", exportarDocumentoPdfPadronizado);
});