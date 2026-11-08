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

function normalizarTexto(str) {
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function codificarMesParaBanco(itensMes) {
    return ORDEM_VEICULOS.map(veic => {
        const achado = (itensMes || []).find(i => i.veiculo === veic);
        const v = achado ? Number(achado.veiculacoes || 0) : 0;
        const vis = achado ? Number(achado.visualizacoes || 0) : 0;
        const alc = achado ? Number(achado.alcance || 0) : 0;
        return `${v},${vis},${alc}`;
    }).join("|");
}

function decodificarMesDoBanco(mesNome, strCompacta) {
    const blocos = String(strCompacta || "").split("|");
    const resultado = [];
    ORDEM_VEICULOS.forEach((veiculo, idx) => {
        const partes = (blocos[idx] || "0,0,0").split(",").map(n => Number(n) || 0);
        const [veiculacoes, visualizacoes, alcance] = partes;
        if (veiculacoes > 0 || visualizacoes > 0 || alcance > 0) {
            resultado.push({ mes: mesNome, veiculo, veiculacoes, visualizacoes, alcance });
        }
    });
    return resultado;
}

function codificarAtivacaoParaBanco(ativ) {
    if (!ativ || !ativ.resumoAtivacao || !ativ.resumoAtivacao.entrevistados) return "";
    const ent = Number(ativ.resumoAtivacao.entrevistados || 0);
    const alc = Number(ativ.resumoAtivacao.alcanceAtivacao || 0);
    const g = (ativ.demografia?.GENERO || []).map(x => Number(x.percentual || 0)).join(",");
    const idd = (ativ.demografia?.IDADE || []).map(x => Number(x.percentual || 0)).join(",");
    const pf = (ativ.demografia?.PERFIL || []).map(x => Number(x.percentual || 0)).join(",");
    const p1 = `${ativ.respostasPerguntas?.[1]?.sim ?? 0},${ativ.respostasPerguntas?.[1]?.nao ?? 0}`;
    const p2 = `${ativ.respostasPerguntas?.[2]?.sim ?? 0},${ativ.respostasPerguntas?.[2]?.nao ?? 0}`;
    const p3 = `${ativ.respostasPerguntas?.[3]?.sim ?? 0},${ativ.respostasPerguntas?.[3]?.nao ?? 0}`;
    return `${ent},${alc}|${g}|${idd}|${pf}|${p1}|${p2}|${p3}`;
}

function decodificarAtivacaoDoBanco(strCompacta) {
    const padraoVazio = {
        resumoAtivacao: { entrevistados: 0, alcanceAtivacao: 0 },
        demografia: { GENERO: [], IDADE: [], PERFIL: [] },
        respostasPerguntas: {}
    };
    if (!strCompacta || !String(strCompacta).includes("|")) return padraoVazio;

    const partes = String(strCompacta).split("|");
    const [ent, alc] = (partes[0] || "0,0").split(",").map(n => Number(n) || 0);
    if (ent <= 0 && alc <= 0) return padraoVazio;

    const [gFem, gMasc, gOut] = (partes[1] || "0,0,0").split(",").map(n => Number(n) || 0);
    const [i18, i25, i35, i45] = (partes[2] || "0,0,0,0").split(",").map(n => Number(n) || 0);
    const [pAnt, pPrim] = (partes[3] || "0,0").split(",").map(n => Number(n) || 0);
    const [p1Sim, p1Nao] = (partes[4] || "0,0").split(",").map(n => Number(n) || 0);
    const [p2Sim, p2Nao] = (partes[5] || "0,0").split(",").map(n => Number(n) || 0);
    const [p3Sim, p3Nao] = (partes[6] || "0,0").split(",").map(n => Number(n) || 0);

    return {
        resumoAtivacao: { entrevistados: ent, alcanceAtivacao: alc },
        demografia: {
            GENERO: [
                { rotulo: "Feminino", percentual: gFem, quantidade: Math.round((ent * gFem) / 100) },
                { rotulo: "Masculino", percentual: gMasc, quantidade: Math.round((ent * gMasc) / 100) },
                { rotulo: "Não-binário / Outros", percentual: gOut, quantidade: Math.round((ent * gOut) / 100) }
            ],
            IDADE: [
                { rotulo: "18 a 24 anos", percentual: i18, quantidade: Math.round((ent * i18) / 100) },
                { rotulo: "25 a 34 anos", percentual: i25, quantidade: Math.round((ent * i25) / 100) },
                { rotulo: "35 a 44 anos", percentual: i35, quantidade: Math.round((ent * i35) / 100) },
                { rotulo: "45 anos ou mais", percentual: i45, quantidade: Math.round((ent * i45) / 100) }
            ],
            PERFIL: [
                { rotulo: "Já participou de edições anteriores", percentual: pAnt, quantidade: Math.round((ent * pAnt) / 100) },
                { rotulo: "Primeira vez no Planeta Atlântida", percentual: pPrim, quantidade: Math.round((ent * pPrim) / 100) }
            ]
        },
        respostasPerguntas: {
            1: { sim: p1Sim, nao: p1Nao },
            2: { sim: p2Sim, nao: p2Nao },
            3: { sim: p3Sim, nao: p3Nao }
        }
    };
}

function extrairVolumetriaDosMateriaisDoBanco(materiaisLista) {
    const materiaisVol = (materiaisLista || []).filter(m => m.tipoMaterial === "DADOS_VOLUMETRIA");
    const midiaMensal = [];
    let ativacao = {
        resumoAtivacao: { entrevistados: 0, alcanceAtivacao: 0 },
        demografia: { GENERO: [], IDADE: [], PERFIL: [] },
        respostasPerguntas: {}
    };

    ORDEM_MESES.forEach(mes => {
        const regMes = materiaisVol.find(m => m.titulo === `VOL_MES:${mes}`);
        if (regMes && regMes.descricao) {
            midiaMensal.push(...decodificarMesDoBanco(mes, regMes.descricao));
        }
    });

    const regAtiv = materiaisVol.find(m => m.titulo === "VOL_ATIVACAO:MASTER");
    if (regAtiv && regAtiv.descricao) {
        ativacao = decodificarAtivacaoDoBanco(regAtiv.descricao);
    }

    return {
        midiaMensal,
        resumoAtivacao: ativacao.resumoAtivacao,
        demografia: ativacao.demografia,
        respostasPerguntas: ativacao.respostasPerguntas
    };
}

function baixarPlanilhaExcelPadraoMultiAbas(marcas) {
    const baseMarcas = marcas && marcas.length > 0
        ? [...marcas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        : [
            { nome: "Aurora", cota: "SUB_COTA" },
            { nome: "Banrisul", cota: "MASTER" },
            { nome: "Budweiser", cota: "MASTER" },
            { nome: "Coca-Cola", cota: "MASTER" },
            { nome: "Renner", cota: "MASTER" }
        ];

    const listaMasterObj = baseMarcas.filter(m => String(m.cota).toUpperCase() === "MASTER");
    const mastersFinal = listaMasterObj.length > 0 ? listaMasterObj : baseMarcas.slice(0, 5);
    const esc = (str) => String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const baseExemploPlanilha = {
        "Instagram": [22, 78000, 61000],
        "X": [15, 32000, 24000],
        "TikTok": [19, 84000, 66000],
        "Rádio": [28, 105000, 89000],
        "Jornais": [10, 41000, 34000],
        "Televisão": [14, 155000, 128000]
    };
    const pesosExemploMes = {
        "Outubro": 0.8,
        "Novembro": 0.95,
        "Dezembro": 1.15,
        "Janeiro": 1.4,
        "Fevereiro": 1.75
    };

    function criarAbaMesXml(nomeMes) {
        const pesoM = pesosExemploMes[nomeMes] || 1;
        let rowsXml = `<Row ss:StyleID="Header"><Cell><Data ss:Type="String">Veiculo</Data></Cell><Cell><Data ss:Type="String">Metrica</Data></Cell>`;
        baseMarcas.forEach(m => {
            rowsXml += `<Cell><Data ss:Type="String">${esc(m.nome)}</Data></Cell>`;
        });
        rowsXml += `</Row>`;

        const somaVeiculacoesPorMarca = new Array(baseMarcas.length).fill(0);

        ORDEM_VEICULOS.forEach(veiculo => {
            const [vBase, visBase, alcBase] = baseExemploPlanilha[veiculo] || [15, 50000, 40000];
            const metricas = [
                ["Veiculações", vBase],
                ["Visualizações", visBase],
                ["Alcance", alcBase]
            ];

            metricas.forEach(([metrica, valorBase]) => {
                rowsXml += `<Row><Cell><Data ss:Type="String">${esc(veiculo)}</Data></Cell><Cell><Data ss:Type="String">${esc(metrica)}</Data></Cell>`;
                baseMarcas.forEach((m, idx) => {
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
        baseMarcas.forEach((_, idx) => {
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

async function extrairAbasDaPlanilha(arquivo) {
    const buffer = await arquivo.arrayBuffer();
    const textoInicial = new TextDecoder("utf-8").decode(buffer.slice(0, 300));

    if (textoInicial.includes("<?xml") || textoInicial.includes("<Workbook")) {
        const xmlCompleto = new TextDecoder("utf-8").decode(buffer);
        const doc = new DOMParser().parseFromString(xmlCompleto, "text/xml");
        const worksheets = [...doc.getElementsByTagName("Worksheet")];
        const resultado = {};

        worksheets.forEach(ws => {
            const nomeAba = ws.getAttribute("ss:Name") || ws.getAttribute("Name") || "";
            const rows = [...ws.getElementsByTagName("Row")];
            if (rows.length < 2) return;

            const cabecalhos = [...rows[0].getElementsByTagName("Cell")].map(c => (c.textContent || "").trim());
            const objetosLinha = [];

            for (let r = 1; r < rows.length; r++) {
                const celulas = [...rows[r].getElementsByTagName("Cell")];
                const obj = {};
                cabecalhos.forEach((colName, idx) => {
                    if (colName) {
                        obj[colName] = celulas[idx] ? (celulas[idx].textContent || "").trim() : "";
                    }
                });
                objetosLinha.push(obj);
            }
            resultado[nomeAba] = objetosLinha;
        });

        return resultado;
    }

    if (typeof XLSX !== "undefined") {
        const workbook = XLSX.read(buffer, { type: "array" });
        const resultado = {};
        workbook.SheetNames.forEach(nomeAba => {
            resultado[nomeAba] = XLSX.utils.sheet_to_json(workbook.Sheets[nomeAba], { defval: "" });
        });
        return resultado;
    }

    throw new Error("Não foi possível ler o formato da planilha.");
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
        const val = sponsorSelect?.value;
        if (val === "TODAS") {
            return { id: "TODAS", nome: "TODAS", cota: "MASTER", ehConsolidadoGeral: true };
        }
        return marcasCarregadas.find(m => String(m.id) === String(val)) || null;
    }

    async function buscarDadosVolumetriaDaMarcaNoBanco(marcaId) {
        const materiais = await apiRequest(`/marcas/${marcaId}/materiais`, "GET").catch(() => []);
        return extrairVolumetriaDosMateriaisDoBanco(materiais);
    }

    async function buscarDadosConsolidadosDeTodasNoBanco() {
        const mapaMesVeiculo = {};
        let somaEntrevistados = 0;
        let somaAlcanceAtivacao = 0;
        let somaGen = [0, 0, 0];
        let somaIdd = [0, 0, 0, 0];
        let somaPerf = [0, 0];
        let somaP1 = [0, 0];
        let somaP2 = [0, 0];
        let somaP3 = [0, 0];
        let qtdMasterComDados = 0;

        const listasPorMarca = await Promise.all(
            marcasCarregadas.map(m => buscarDadosVolumetriaDaMarcaNoBanco(m.id))
        );

        listasPorMarca.forEach((dadosMarca, idx) => {
            const marca = marcasCarregadas[idx];
            (dadosMarca.midiaMensal || []).forEach(item => {
                const k = `${item.mes}|${item.veiculo}`;
                if (!mapaMesVeiculo[k]) {
                    mapaMesVeiculo[k] = {
                        mes: item.mes,
                        veiculo: item.veiculo,
                        veiculacoes: 0,
                        visualizacoes: 0,
                        alcance: 0
                    };
                }
                mapaMesVeiculo[k].veiculacoes += Number(item.veiculacoes || 0);
                mapaMesVeiculo[k].visualizacoes += Number(item.visualizacoes || 0);
                mapaMesVeiculo[k].alcance += Number(item.alcance || 0);
            });

            if (String(marca?.cota).toUpperCase() === "MASTER" && dadosMarca.resumoAtivacao?.entrevistados > 0) {
                qtdMasterComDados++;
                somaEntrevistados += Number(dadosMarca.resumoAtivacao.entrevistados || 0);
                somaAlcanceAtivacao += Number(dadosMarca.resumoAtivacao.alcanceAtivacao || 0);

                (dadosMarca.demografia?.GENERO || []).forEach((g, i) => { somaGen[i] = (somaGen[i] || 0) + Number(g.percentual || 0); });
                (dadosMarca.demografia?.IDADE || []).forEach((id, i) => { somaIdd[i] = (somaIdd[i] || 0) + Number(id.percentual || 0); });
                (dadosMarca.demografia?.PERFIL || []).forEach((pf, i) => { somaPerf[i] = (somaPerf[i] || 0) + Number(pf.percentual || 0); });

                somaP1[0] += Number(dadosMarca.respostasPerguntas?.[1]?.sim || 0);
                somaP1[1] += Number(dadosMarca.respostasPerguntas?.[1]?.nao || 0);
                somaP2[0] += Number(dadosMarca.respostasPerguntas?.[2]?.sim || 0);
                somaP2[1] += Number(dadosMarca.respostasPerguntas?.[2]?.nao || 0);
                somaP3[0] += Number(dadosMarca.respostasPerguntas?.[3]?.sim || 0);
                somaP3[1] += Number(dadosMarca.respostasPerguntas?.[3]?.nao || 0);
            }
        });

        const div = qtdMasterComDados || 1;
        const gFem = Math.round(somaGen[0] / div);
        const gMasc = Math.round(somaGen[1] / div);
        const gOut = Math.round(somaGen[2] / div);
        const i18 = Math.round(somaIdd[0] / div);
        const i25 = Math.round(somaIdd[1] / div);
        const i35 = Math.round(somaIdd[2] / div);
        const i45 = Math.round(somaIdd[3] / div);
        const pAnt = Math.round(somaPerf[0] / div);
        const pPrim = Math.round(somaPerf[1] / div);

        return {
            midiaMensal: Object.values(mapaMesVeiculo),
            resumoAtivacao: {
                entrevistados: somaEntrevistados,
                alcanceAtivacao: somaAlcanceAtivacao
            },
            demografia: qtdMasterComDados > 0 ? {
                GENERO: [
                    { rotulo: "Feminino", percentual: gFem, quantidade: Math.round((somaEntrevistados * gFem) / 100) },
                    { rotulo: "Masculino", percentual: gMasc, quantidade: Math.round((somaEntrevistados * gMasc) / 100) },
                    { rotulo: "Não-binário / Outros", percentual: gOut, quantidade: Math.round((somaEntrevistados * gOut) / 100) }
                ],
                IDADE: [
                    { rotulo: "18 a 24 anos", percentual: i18, quantidade: Math.round((somaEntrevistados * i18) / 100) },
                    { rotulo: "25 a 34 anos", percentual: i25, quantidade: Math.round((somaEntrevistados * i25) / 100) },
                    { rotulo: "35 a 44 anos", percentual: i35, quantidade: Math.round((somaEntrevistados * i35) / 100) },
                    { rotulo: "45 anos ou mais", percentual: i45, quantidade: Math.round((somaEntrevistados * i45) / 100) }
                ],
                PERFIL: [
                    { rotulo: "Já participou de edições anteriores", percentual: pAnt, quantidade: Math.round((somaEntrevistados * pAnt) / 100) },
                    { rotulo: "Primeira vez no Planeta Atlântida", percentual: pPrim, quantidade: Math.round((somaEntrevistados * pPrim) / 100) }
                ]
            } : { GENERO: [], IDADE: [], PERFIL: [] },
            respostasPerguntas: qtdMasterComDados > 0 ? {
                1: { sim: Math.round(somaP1[0] / div), nao: Math.round(somaP1[1] / div) },
                2: { sim: Math.round(somaP2[0] / div), nao: Math.round(somaP2[1] / div) },
                3: { sim: Math.round(somaP3[0] / div), nao: Math.round(somaP3[1] / div) }
            } : {}
        };
    }

    function atualizarPermissaoTipoRelatorioPorCota() {
        const marca = obterMarcaSelecionadaObj();
        const ehMaster = marca && (marca.ehConsolidadoGeral || String(marca.cota).toUpperCase() === "MASTER");

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
            const estruturado = marca.ehConsolidadoGeral
                ? await buscarDadosConsolidadosDeTodasNoBanco()
                : await buscarDadosVolumetriaDaMarcaNoBanco(marca.id);

            const mesesDisponiveis = [...new Set((estruturado.midiaMensal || []).map(i => i.mes))];
            if (mesesDisponiveis.length === 0) {
                alertaBanner.hidden = true;
                return;
            }

            alertaBanner.hidden = false;
            const ehMaster = marca.ehConsolidadoGeral || String(marca.cota).toUpperCase() === "MASTER";
            alertaTitulo.textContent = marca.ehConsolidadoGeral
                ? "Notificação de Dados Disponíveis: Todas as Marcas (Consolidado no Banco)"
                : `Notificação de Dados Disponíveis: ${marca.nome}`;
            alertaDetalhe.textContent = marca.ehConsolidadoGeral
                ? `Soma consolidada das marcas patrocinadoras salva no banco (${mesesDisponiveis.length} mês/meses).`
                : `Dados da última planilha importada salvos no banco para ${mesesDisponiveis.length} mês(es) da campanha.`;

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
                const lista = (await apiRequest("/marcas", "GET")) || [];
                marcasCarregadas = lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
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

            marcasCarregadas.forEach((marca) => {
                const option = document.createElement("option");
                option.value = marca.id;
                option.textContent = marca.nome;
                sponsorSelect.appendChild(option);
            });

            if (!ehPatrocinador && marcasCarregadas.length > 1) {
                const optTodas = document.createElement("option");
                optTodas.value = "TODAS";
                optTodas.textContent = "TODAS";
                sponsorSelect.appendChild(optTodas);
            }

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

        btnImportarGeral.disabled = true;
        btnImportarGeral.textContent = "Salvando no Banco...";

        try {
            const abasExtraidas = await extrairAbasDaPlanilha(arquivo);

            function encontrarMarcaPorColuna(nomeColuna) {
                const alvo = normalizarTexto(nomeColuna);
                if (!alvo || alvo.includes("veic") || alvo.includes("metr") || alvo.includes("categ") || alvo.includes("unnamed")) {
                    return null;
                }
                return marcasCarregadas.find(m => {
                    const nm = normalizarTexto(m.nome);
                    return nm === alvo || nm.includes(alvo) || alvo.includes(nm);
                }) || null;
            }

            const normalizarVeiculo = (v) => {
                const limpo = normalizarTexto(v);
                if (!limpo || limpo.includes("total") || limpo.includes("soma")) return null;
                if (limpo.includes("insta")) return "Instagram";
                if (limpo === "x" || limpo.includes("twitter")) return "X";
                if (limpo.includes("tik")) return "TikTok";
                if (limpo.includes("rad")) return "Rádio";
                if (limpo.includes("jorn")) return "Jornais";
                if (limpo.includes("tele") || limpo === "tv") return "Televisão";
                return null;
            };

            const dadosExtraidosPorMarcaId = {};
            marcasCarregadas.forEach(m => {
                dadosExtraidosPorMarcaId[m.id] = {
                    porMes: {},
                    ativacao: {
                        resumoAtivacao: { entrevistados: 0, alcanceAtivacao: 0 },
                        demografia: {
                            GENERO: [
                                { rotulo: "Feminino", percentual: 0 },
                                { rotulo: "Masculino", percentual: 0 },
                                { rotulo: "Não-binário / Outros", percentual: 0 }
                            ],
                            IDADE: [
                                { rotulo: "18 a 24 anos", percentual: 0 },
                                { rotulo: "25 a 34 anos", percentual: 0 },
                                { rotulo: "35 a 44 anos", percentual: 0 },
                                { rotulo: "45 anos ou mais", percentual: 0 }
                            ],
                            PERFIL: [
                                { rotulo: "Já participou de edições anteriores", percentual: 0 },
                                { rotulo: "Primeira vez no Planeta Atlântida", percentual: 0 }
                            ]
                        },
                        respostasPerguntas: {
                            1: { sim: 0, nao: 0 },
                            2: { sim: 0, nao: 0 },
                            3: { sim: 0, nao: 0 }
                        }
                    }
                };
            });

            ORDEM_MESES.forEach(mes => {
                const nomeAba = Object.keys(abasExtraidas).find(
                    s => normalizarTexto(s) === normalizarTexto(mes)
                );
                if (!nomeAba) return;

                const linhas = abasExtraidas[nomeAba] || [];
                const acumuladorMes = {};

                linhas.forEach(row => {
                    const chaves = Object.keys(row);
                    const colVeiculo = chaves.find(k => normalizarTexto(k).includes("veic")) || chaves[0];
                    const colMetrica = chaves.find(k => normalizarTexto(k).includes("metr")) || chaves[1];
                    if (!colVeiculo || !colMetrica) return;

                    const veiculoPadrao = normalizarVeiculo(row[colVeiculo]);
                    if (!veiculoPadrao) return;

                    const metricaStr = normalizarTexto(row[colMetrica]);
                    let campoMetrica = null;
                    if (metricaStr.includes("veic")) campoMetrica = "veiculacoes";
                    else if (metricaStr.includes("visu")) campoMetrica = "visualizacoes";
                    else if (metricaStr.includes("alcan")) campoMetrica = "alcance";
                    if (!campoMetrica) return;

                    chaves.forEach(col => {
                        if (col === colVeiculo || col === colMetrica) return;
                        const marca = encontrarMarcaPorColuna(col);
                        if (!marca) return;

                        const valorLimpo = String(row[col] ?? "").replace(/\./g, "").replace(",", ".").trim();
                        const num = Number(valorLimpo);
                        if (Number.isNaN(num) || num < 0) return;

                        const chaveItem = `${marca.id}|${veiculoPadrao}`;
                        if (!acumuladorMes[chaveItem]) {
                            acumuladorMes[chaveItem] = {
                                marcaId: marca.id,
                                mes,
                                veiculo: veiculoPadrao,
                                veiculacoes: 0,
                                visualizacoes: 0,
                                alcance: 0
                            };
                        }
                        acumuladorMes[chaveItem][campoMetrica] = num;
                    });
                });

                Object.values(acumuladorMes).forEach(item => {
                    if (!dadosExtraidosPorMarcaId[item.marcaId].porMes[mes]) {
                        dadosExtraidosPorMarcaId[item.marcaId].porMes[mes] = [];
                    }
                    dadosExtraidosPorMarcaId[item.marcaId].porMes[mes].push(item);
                });
            });

            const nomeAbaAtivacao = Object.keys(abasExtraidas).find(
                s => normalizarTexto(s).includes("ativacao")
            );
            if (nomeAbaAtivacao) {
                const linhasAtiv = abasExtraidas[nomeAbaAtivacao] || [];
                linhasAtiv.forEach(row => {
                    const chaves = Object.keys(row);
                    const colCat = chaves.find(k => normalizarTexto(k).includes("categ")) || chaves[0];
                    const colMet = chaves.find(k => normalizarTexto(k).includes("metr")) || chaves[1];
                    if (!colCat || !colMet) return;

                    const cat = normalizarTexto(row[colCat]);
                    const met = normalizarTexto(row[colMet]);

                    chaves.forEach(col => {
                        if (col === colCat || col === colMet) return;
                        const marca = encontrarMarcaPorColuna(col);
                        if (!marca) return;

                        const num = Number(String(row[col] ?? "").replace(/\./g, "").replace(",", ".").trim());
                        if (Number.isNaN(num)) return;

                        const alvoAtiv = dadosExtraidosPorMarcaId[marca.id].ativacao;
                        if (cat.includes("resumo") && met.includes("entrevistado")) alvoAtiv.resumoAtivacao.entrevistados = num;
                        else if (cat.includes("resumo") && met.includes("alcance")) alvoAtiv.resumoAtivacao.alcanceAtivacao = num;
                        else if (cat.includes("genero") && met.includes("femin")) alvoAtiv.demografia.GENERO[0].percentual = num;
                        else if (cat.includes("genero") && met.includes("mascul")) alvoAtiv.demografia.GENERO[1].percentual = num;
                        else if (cat.includes("genero")) alvoAtiv.demografia.GENERO[2].percentual = num;
                        else if (cat.includes("idade") && met.includes("18")) alvoAtiv.demografia.IDADE[0].percentual = num;
                        else if (cat.includes("idade") && met.includes("25")) alvoAtiv.demografia.IDADE[1].percentual = num;
                        else if (cat.includes("idade") && met.includes("35")) alvoAtiv.demografia.IDADE[2].percentual = num;
                        else if (cat.includes("idade") && met.includes("45")) alvoAtiv.demografia.IDADE[3].percentual = num;
                        else if (cat.includes("perfil") && met.includes("ja")) alvoAtiv.demografia.PERFIL[0].percentual = num;
                        else if (cat.includes("perfil") && met.includes("primeira")) alvoAtiv.demografia.PERFIL[1].percentual = num;
                        else if (cat.includes("pergunta 1") && met.includes("sim")) alvoAtiv.respostasPerguntas[1].sim = num;
                        else if (cat.includes("pergunta 1") && met.includes("nao")) alvoAtiv.respostasPerguntas[1].nao = num;
                        else if (cat.includes("pergunta 2") && met.includes("sim")) alvoAtiv.respostasPerguntas[2].sim = num;
                        else if (cat.includes("pergunta 2") && met.includes("nao")) alvoAtiv.respostasPerguntas[2].nao = num;
                        else if (cat.includes("pergunta 3") && met.includes("sim")) alvoAtiv.respostasPerguntas[3].sim = num;
                        else if (cat.includes("pergunta 3") && met.includes("nao")) alvoAtiv.respostasPerguntas[3].nao = num;
                    });
                });
            }

            const nomesSalvosNoBanco = [];
            for (const marca of marcasCarregadas) {
                const pacoteMarca = dadosExtraidosPorMarcaId[marca.id];
                const mesesExtraidos = Object.keys(pacoteMarca.porMes);
                if (mesesExtraidos.length === 0) continue;

                const materiaisAtuais = await apiRequest(`/marcas/${marca.id}/materiais`, "GET").catch(() => []);
                const antigosVolumetria = (materiaisAtuais || []).filter(m => m.tipoMaterial === "DADOS_VOLUMETRIA");

                if (antigosVolumetria.length > 0) {
                    await Promise.all(
                        antigosVolumetria.map(matAntigo =>
                            apiRequest(`/materiais/${matAntigo.id}`, "DELETE").catch(() => { })
                        )
                    );
                }

                for (const mes of mesesExtraidos) {
                    const strMes = codificarMesParaBanco(pacoteMarca.porMes[mes]);
                    await apiUploadMaterial(marca.id, {
                        titulo: `VOL_MES:${mes}`,
                        descricao: strMes,
                        abaDestino: "ABA_7_CONTRATO",
                        tipoMaterial: "DADOS_VOLUMETRIA",
                        caminhoStorage: null,
                        urlExterna: "https://portal.rbs.com.br/volumetria"
                    }, null);
                }

                if (String(marca.cota).toUpperCase() === "MASTER" && pacoteMarca.ativacao.resumoAtivacao.entrevistados > 0) {
                    const strAtiv = codificarAtivacaoParaBanco(pacoteMarca.ativacao);
                    if (strAtiv) {
                        await apiUploadMaterial(marca.id, {
                            titulo: "VOL_ATIVACAO:MASTER",
                            descricao: strAtiv,
                            abaDestino: "ABA_7_CONTRATO",
                            tipoMaterial: "DADOS_VOLUMETRIA",
                            caminhoStorage: null,
                            urlExterna: "https://portal.rbs.com.br/volumetria"
                        }, null);
                    }
                }

                nomesSalvosNoBanco.push(marca.nome);
            }

            await atualizarAlertaDisponibilidadeDaMarca();
            alert(`Planilha processada e salva no banco de dados! As planilhas anteriores foram substituídas e os novos dados estão prontos para: ${nomesSalvosNoBanco.join(", ")}.`);
        } catch (erro) {
            alert(erro.message || "Erro ao processar e salvar a planilha no banco de dados.");
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
        const valorSelecionado = sponsorSelect.value;
        const tipoRelatorio = reportTypeSelect.value;
        const cicloEdicao = document.getElementById("downloadFormat")?.value || "Out/2025 a Fev/2026";

        if (!valorSelecionado) {
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
            const ehConsolidadoTodas = valorSelecionado === "TODAS";
            let nomeExibicaoMarca = "Planeta Atlântida (Todas as Marcas)";
            let cotaExibicao = "CONSOLIDADO GERAL";
            let ehMaster = true;
            let logoUrl = "../assets/img/LogoPlanetaOrange.png";
            let comprovacoesMidia = [];
            let perguntasCadastradas = [];
            let dados = null;

            if (ehConsolidadoTodas) {
                dados = await buscarDadosConsolidadosDeTodasNoBanco();
                if (marcasCarregadas[0]?.id) {
                    await apiRequest(`/marcas/${marcasCarregadas[0].id}/relatorio-consolidado`, "GET").catch(() => null);
                }
            } else {
                const marcaObj = obterMarcaSelecionadaObj();
                const relatorio = await apiRequest(`/marcas/${valorSelecionado}/relatorio-consolidado`, "GET");
                nomeExibicaoMarca = relatorio.marcaNome || marcaObj?.nome || "Patrocinador";
                cotaExibicao = relatorio.cota || marcaObj?.cota || "SUB_COTA";
                ehMaster = String(cotaExibicao).toUpperCase() === "MASTER";

                if (tipoRelatorio === "ATIVACAO_EVENTO" && !ehMaster) {
                    alert("O Relatório de Ativações e Pesquisa do Evento é exclusivo para patrocinadores da Cota Master.");
                    return;
                }

                const materiais = relatorio.materiaisEntregues || [];
                dados = extrairVolumetriaDosMateriaisDoBanco(materiais);

                const fotoMat = materiais.find(m => m.tipoMaterial === "FOTO_EMPRESA");
                logoUrl = fotoMat ? (fotoMat.caminhoStorage || fotoMat.urlExterna) : "";
                comprovacoesMidia = materiais.filter(
                    m => m.tipoMaterial !== "FOTO_EMPRESA" &&
                        m.tipoMaterial !== "PLANO_COMERCIAL" &&
                        m.tipoMaterial !== "CONTRATO" &&
                        m.tipoMaterial !== "DADOS_SIGNATARIO" &&
                        m.tipoMaterial !== "PRAZO_PESQUISA" &&
                        m.tipoMaterial !== "DADOS_VOLUMETRIA" &&
                        m.tipoMaterial !== "COBRANCA_CONTRATO"
                );
                perguntasCadastradas = relatorio.perguntasPesquisa || [];
            }

            const registrosMidiaFiltrados = (dados.midiaMensal || []).filter(
                item => mesesEscolhidos.includes(item.mes) && veiculosEscolhidos.includes(item.veiculo)
            );

            if (tipoRelatorio !== "ATIVACAO_EVENTO" && registrosMidiaFiltrados.length === 0) {
                summary.innerHTML = `
                    <div style="padding: 1.25rem; border-radius: 8px; background: #ffffff; border: 1px solid #b42318; color: #1e293b;">
                        <strong style="color: #b42318; font-size: 1rem;">Nenhuma planilha importada no banco para ${nomeExibicaoMarca}</strong>
                        <p style="margin: 0.5rem 0 0; font-size: 0.92rem;">
                            A Administração RBS ainda não importou a Planilha Geral atualizada ou não há dados para os meses/veículos selecionados.
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

            const tdNumStyle = "text-align: right; font-variant-numeric: tabular-nums; color: #0f172a; font-weight: 600;";
            const thNumStyle = "text-align: right; color: #ffffff;";

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
                                <td style="${tdNumStyle}">${item.veiculacoes.toLocaleString("pt-BR")}</td>
                                <td style="${tdNumStyle}">${item.visualizacoes.toLocaleString("pt-BR")}</td>
                                <td style="${tdNumStyle}">${item.alcance.toLocaleString("pt-BR")}</td>
                            </tr>
                        `;
                    });
                    linhasTabelaMensal += `
                        <tr class="subtotal-row">
                            <td colspan="2">Subtotal: ${mes}</td>
                            <td style="${tdNumStyle} font-weight: 800;">${obj.subVeiculacoes.toLocaleString("pt-BR")}</td>
                            <td style="${tdNumStyle} font-weight: 800;">${obj.subVisualizacoes.toLocaleString("pt-BR")}</td>
                            <td style="${tdNumStyle} font-weight: 800;">${obj.subAlcance.toLocaleString("pt-BR")}</td>
                        </tr>
                    `;
                });

                linhasTabelaMensal += `
                    <tr class="grand-total-row">
                        <td colspan="2">SOMA TOTAL ACUMULADA (${mesesComDados.map(([m]) => m).join(", ")})</td>
                        <td style="${tdNumStyle} font-weight: 800;">${totalGeralVeiculacoes.toLocaleString("pt-BR")}</td>
                        <td style="${tdNumStyle} font-weight: 800;">${totalGeralVisualizacoes.toLocaleString("pt-BR")}</td>
                        <td style="${tdNumStyle} font-weight: 800;">${totalGeralAlcance.toLocaleString("pt-BR")}</td>
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
                        <table class="pbi-table" style="width: 100%; table-layout: fixed;">
                            <thead>
                                <tr>
                                    <th style="width: 22%;">Mês da Campanha</th>
                                    <th style="width: 24%;">Meio de Veiculação</th>
                                    <th style="width: 18%; ${thNumStyle}">Veiculações</th>
                                    <th style="width: 18%; ${thNumStyle}">Visualizações</th>
                                    <th style="width: 18%; ${thNumStyle}">Alcance</th>
                                </tr>
                            </thead>
                            <tbody>${linhasTabelaMensal}</tbody>
                        </table>
                    </div>
                `;
            }

            let htmlSecaoAtivacao = "";
            if (mostrarBlocoAtivacao && dados.resumoAtivacao.entrevistados > 0) {
                const refNomePergunta = ehConsolidadoTodas ? "dos patrocinadores Master" : `da marca ${nomeExibicaoMarca}`;
                const perguntasPadraoMaster = [
                    `A presença ${refNomePergunta} tem a ver com o Planeta Atlântida?`,
                    `A ativação ${refNomePergunta} foi uma parada obrigatória no evento?`,
                    `O Planeta Atlântida combina com a experiência ${refNomePergunta}?`
                ];

                let htmlPerguntasMaster = "";
                for (let i = 1; i <= 3; i++) {
                    const pergObj = perguntasCadastradas.find(p => Number(p.numeroPergunta) === i);
                    const textoPergunta = pergObj ? pergObj.textoPergunta : perguntasPadraoMaster[i - 1];
                    const resp = dados.respostasPerguntas[i] || { sim: 0, nao: 0 };
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
                "VOLUMETRIA_MIDIA": `Relatório de Volumetria de Entrega e Impacto ${nomeExibicaoMarca}`,
                "ATIVACAO_EVENTO": `Relatório de Ativações do Evento ${nomeExibicaoMarca}`,
                "FINAL_CONSOLIDADO": ehConsolidadoTodas
                    ? `Relatório Final Consolidado ${nomeExibicaoMarca}`
                    : `Relatório Final Patrocinador ${nomeExibicaoMarca}`
            };
            const tituloRelatorio = mapTitulos[tipoRelatorio] || `Relatório ${nomeExibicaoMarca}`;

            const iniciaisMarca = String(nomeExibicaoMarca || "M").slice(0, 2).toUpperCase();
            const htmlLogo = logoUrl
                ? `<img class="pbi-brand-logo" src="${logoUrl}" alt="${nomeExibicaoMarca}">`
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
                                <span>Cota: <strong>${cotaExibicao}</strong> • Ciclo: <strong>${cicloEdicao}</strong> • Planeta Atlântida Rede RBS</span>
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