document.addEventListener("DOMContentLoaded", async function () {
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");
    if (!sessao) return;

    const perfil = String(sessao.perfil || "").toLowerCase();
    const isAdmin = perfil === "funcionario" || perfil === "admin" || perfil === "superadmin";

    const questionSection = document.getElementById("questionSection");
    const faqIntro = document.getElementById("faqIntro");
    const form = document.getElementById("questionForm");
    const categorySelect = document.getElementById("questionCategory");
    const filterCategorySelect = document.getElementById("faqFilterCategory");
    const input = document.getElementById("questionInput");
    const counter = document.getElementById("questionCounter");
    const message = document.getElementById("faqMessage");

    const secaoRecebidas = document.getElementById("secaoRecebidasFaq");
    const headerRecebidas = document.getElementById("headerRecebidasFaq");
    const bodyRecebidas = document.getElementById("bodyRecebidasFaq");
    const btnToggleRecebidas = document.getElementById("btnToggleRecebidas");
    const countRecebidas = document.getElementById("countRecebidasFaq");
    const listRecebidas = document.getElementById("faqListRecebidas");

    const headerPublicadas = document.getElementById("headerPublicadasFaq");
    const bodyPublicadas = document.getElementById("bodyPublicadasFaq");
    const btnTogglePublicadas = document.getElementById("btnTogglePublicadas");
    const countPublicadas = document.getElementById("countPublicadasFaq");
    const listPublicadas = document.getElementById("faqListPublicadas");

    let cacheRecebidas = [];
    let cachePublicadas = [];
    const visualizadasNestaSessao = new Set();

    if (isAdmin) {
        if (questionSection) questionSection.hidden = true;
        if (faqIntro) {
            faqIntro.textContent = "Consulte as perguntas recebidas dos patrocinadores e gerencie as respostas publicadas.";
        }
    } else {
        if (secaoRecebidas) secaoRecebidas.hidden = true;
    }

    headerRecebidas?.addEventListener("click", () => {
        const vaiFechar = !bodyRecebidas.hidden;
        bodyRecebidas.hidden = vaiFechar;
        btnToggleRecebidas?.setAttribute("aria-expanded", String(!vaiFechar));
    });

    headerPublicadas?.addEventListener("click", () => {
        const vaiFechar = !bodyPublicadas.hidden;
        bodyPublicadas.hidden = vaiFechar;
        btnTogglePublicadas?.setAttribute("aria-expanded", String(!vaiFechar));
    });

    function showMessage(text, isError = false) {
        if (!message) return;
        message.textContent = text;
        message.classList.toggle("is-error", Boolean(isError));
    }


    function criarItemPerguntaRecebida(item) {
        const wrapper = document.createElement("article");
        wrapper.className = "faq-dropdown-item";

        const conteudo = document.createElement("div");
        conteudo.style.padding = "14px 16px";

        const topo = document.createElement("div");
        topo.style.display = "flex";
        topo.style.justifyContent = "space-between";
        topo.style.alignItems = "center";
        topo.style.marginBottom = "8px";

        const autorInfo = document.createElement("small");
        autorInfo.style.color = "#64748b";
        autorInfo.style.fontWeight = "700";
        autorInfo.textContent = `${item.marcaNome || item.autorMarcaNome || "Patrocinador"} • Categoria: ${item.categoria || "GERAL"}`;

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "faq-delete-button";
        deleteBtn.textContent = "Excluir";
        deleteBtn.addEventListener("click", async () => {
            if (!window.confirm("Deseja realmente excluir esta pergunta recebida?")) return;
            try {
                await apiRequest(`/faq/${item.id}`, "DELETE");
                showMessage("Pergunta excluída com sucesso.", false);
                await carregarFaq();
            } catch (erro) {
                showMessage(erro.message || "Erro ao excluir pergunta.", true);
            }
        });

        topo.append(autorInfo, deleteBtn);

        const perguntaP = document.createElement("p");
        perguntaP.className = "faq-dropdown-question-title";
        perguntaP.style.marginBottom = "12px";
        perguntaP.textContent = item.pergunta;

        const answerForm = document.createElement("form");
        answerForm.className = "faq-answer-form";

        const answerInput = document.createElement("textarea");
        answerInput.maxLength = 1000;
        answerInput.required = true;
        answerInput.placeholder = "Digite a resposta oficial para publicar...";

        const answerButton = document.createElement("button");
        answerButton.className = "button button-primary";
        answerButton.style.alignSelf = "flex-end";
        answerButton.type = "submit";
        answerButton.textContent = "Responder e Publicar";

        answerForm.append(answerInput, answerButton);
        answerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const answerText = answerInput.value.trim();
            if (!answerText) return;
            answerButton.disabled = true;
            try {
                await apiRequest(`/faq/${item.id}/responder`, "PUT", {
                    resposta: answerText,
                    publicarParaTodos: true
                });
                showMessage("Resposta publicada com sucesso!", false);
                await carregarFaq();
            } catch (erro) {
                showMessage(erro.message || "Erro ao publicar resposta.", true);
            } finally {
                answerButton.disabled = false;
            }
        });

        conteudo.append(topo, perguntaP, answerForm);
        wrapper.appendChild(conteudo);
        return wrapper;
    }


    function criarItemRespostaPublicada(item) {
        const itemBox = document.createElement("article");
        itemBox.className = "faq-dropdown-item";

        const trigger = document.createElement("div");
        trigger.className = "faq-dropdown-trigger";

        const questionTitle = document.createElement("p");
        questionTitle.className = "faq-dropdown-question-title";
        questionTitle.textContent = item.pergunta;

        const meta = document.createElement("div");
        meta.className = "faq-dropdown-meta";


        let badgeAcessos = null;
        if (isAdmin) {
            badgeAcessos = document.createElement("span");
            badgeAcessos.className = "faq-access-counter";
            badgeAcessos.textContent = `${item.visualizacoes ?? 0} acessos`;
            meta.appendChild(badgeAcessos);
        }

        const btnChevron = document.createElement("button");
        btnChevron.type = "button";
        btnChevron.className = "botao-recolher";
        btnChevron.setAttribute("aria-expanded", "false");
        btnChevron.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
        meta.appendChild(btnChevron);

        trigger.append(questionTitle, meta);

        const content = document.createElement("div");
        content.className = "faq-dropdown-content";
        content.hidden = true;

        const answerClean = document.createElement("div");
        answerClean.className = "faq-answer-clean";
        answerClean.textContent = item.resposta;
        content.appendChild(answerClean);

        if (isAdmin) {
            const controls = document.createElement("div");
            controls.className = "faq-admin-controls";

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "btn-acao-pequeno";
            btnEditar.textContent = "Editar resposta";

            const btnExcluir = document.createElement("button");
            btnExcluir.type = "button";
            btnExcluir.className = "faq-delete-button";
            btnExcluir.textContent = "Excluir resposta";

            const formEdicao = document.createElement("form");
            formEdicao.className = "faq-answer-form";
            formEdicao.style.marginTop = "10px";
            formEdicao.hidden = true;

            const textareaEdicao = document.createElement("textarea");
            textareaEdicao.maxLength = 1000;
            textareaEdicao.required = true;
            textareaEdicao.value = item.resposta || "";

            const botoesEdicao = document.createElement("div");
            botoesEdicao.style.display = "flex";
            botoesEdicao.style.justifyContent = "flex-end";
            botoesEdicao.style.gap = "8px";

            const btnCancelarEdicao = document.createElement("button");
            btnCancelarEdicao.type = "button";
            btnCancelarEdicao.className = "form-cancel";
            btnCancelarEdicao.textContent = "Cancelar";

            const btnSalvarEdicao = document.createElement("button");
            btnSalvarEdicao.type = "submit";
            btnSalvarEdicao.className = "button button-primary";
            btnSalvarEdicao.textContent = "Salvar alterações";

            botoesEdicao.append(btnCancelarEdicao, btnSalvarEdicao);
            formEdicao.append(textareaEdicao, botoesEdicao);

            btnEditar.addEventListener("click", () => {
                formEdicao.hidden = !formEdicao.hidden;
            });

            btnCancelarEdicao.addEventListener("click", () => {
                formEdicao.hidden = true;
                textareaEdicao.value = item.resposta || "";
            });

            formEdicao.addEventListener("submit", async (e) => {
                e.preventDefault();
                const novoTexto = textareaEdicao.value.trim();
                if (!novoTexto) return;
                btnSalvarEdicao.disabled = true;
                try {
                    await apiRequest(`/faq/${item.id}/responder`, "PUT", {
                        resposta: novoTexto,
                        publicarParaTodos: true
                    });
                    showMessage("Resposta atualizada com sucesso!", false);
                    await carregarFaq();
                } catch (erro) {
                    showMessage(erro.message || "Erro ao editar resposta.", true);
                } finally {
                    btnSalvarEdicao.disabled = false;
                }
            });

            btnExcluir.addEventListener("click", async () => {
                if (!window.confirm("Deseja realmente excluir esta resposta publicada?")) return;
                try {
                    await apiRequest(`/faq/${item.id}`, "DELETE");
                    showMessage("Resposta excluída com sucesso.", false);
                    await carregarFaq();
                } catch (erro) {
                    showMessage(erro.message || "Não foi possível excluir a resposta.", true);
                }
            });

            controls.append(btnEditar, btnExcluir);
            content.append(controls, formEdicao);
        }


        trigger.addEventListener("click", async () => {
            const vaiAbrir = content.hidden;
            content.hidden = !vaiAbrir;
            btnChevron.setAttribute("aria-expanded", String(vaiAbrir));

            if (vaiAbrir && !isAdmin && !visualizadasNestaSessao.has(item.id)) {
                visualizadasNestaSessao.add(item.id);
                try {
                    await apiRequest(`/faq/${item.id}`, "GET");
                } catch {

                }
            }
        });

        itemBox.append(trigger, content);
        return itemBox;
    }

    function renderizarListasFaq() {
        const catFiltro = filterCategorySelect ? filterCategorySelect.value : "";

        const recebidasFiltradas = cacheRecebidas.filter(
            item => !catFiltro || String(item.categoria || "GERAL").toUpperCase() === catFiltro
        );
        const publicadasFiltradas = cachePublicadas.filter(
            item => !catFiltro || String(item.categoria || "GERAL").toUpperCase() === catFiltro
        );

        if (countRecebidas) countRecebidas.textContent = String(recebidasFiltradas.length);
        if (countPublicadas) countPublicadas.textContent = String(publicadasFiltradas.length);

        if (listRecebidas) {
            listRecebidas.replaceChildren();
            if (recebidasFiltradas.length === 0) {
                const empty = document.createElement("p");
                empty.className = "faq-empty";
                empty.textContent = "Nenhuma pergunta pendente.";
                listRecebidas.appendChild(empty);
            } else {
                recebidasFiltradas.forEach(item => listRecebidas.appendChild(criarItemPerguntaRecebida(item)));
            }
        }

        if (listPublicadas) {
            listPublicadas.replaceChildren();
            if (publicadasFiltradas.length === 0) {
                const empty = document.createElement("p");
                empty.className = "faq-empty";
                empty.textContent = "Ainda não há respostas publicadas para esta categoria.";
                listPublicadas.appendChild(empty);
            } else {
                publicadasFiltradas.forEach(item => listPublicadas.appendChild(criarItemRespostaPublicada(item)));
            }
        }
    }

    async function carregarFaq() {
        try {
            const [publicadas, pendentes] = await Promise.all([
                apiRequest("/faq", "GET").catch(() => []),
                isAdmin ? apiRequest("/faq/pendentes", "GET").catch(() => []) : Promise.resolve([])
            ]);

            cacheRecebidas = (pendentes || []).filter(item => !item.resposta);
            cachePublicadas = (publicadas || []).filter(item => Boolean(item.resposta));

            renderizarListasFaq();
        } catch (erro) {
            console.error("Erro ao carregar FAQ:", erro);
            showMessage("Não foi possível carregar as perguntas do servidor.", true);
        }
    }

    filterCategorySelect?.addEventListener("change", renderizarListasFaq);

    input?.addEventListener("input", () => {
        if (counter) counter.textContent = `${input.value.length}/500`;
    });

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const perguntaTexto = input.value.trim();
        const categoriaEscolhida = categorySelect ? categorySelect.value : "GERAL";
        if (!perguntaTexto) {
            showMessage("Escreva uma pergunta antes de publicar.", true);
            return;
        }
        try {
            await apiRequest("/faq/perguntas", "POST", {
                pergunta: perguntaTexto,
                categoria: categoriaEscolhida
            });
            form.reset();
            if (counter) counter.textContent = "0/500";
            showMessage("Pergunta enviada para a equipe RBS!", false);
            await carregarFaq();
        } catch (erro) {
            showMessage(erro.message || "Não foi possível enviar sua pergunta.", true);
        }
    });

    await carregarFaq();
});