(function verificarIsolamentoDeSeguranca() {
    const token = localStorage.getItem("rbs_token");
    const sessao = JSON.parse(localStorage.getItem("rbs_sessao") || "null");

    function expulsarParaLogin() {
        localStorage.removeItem("rbs_token");
        localStorage.removeItem("rbs_sessao");
        sessionStorage.removeItem("rbs_usuario_email");
        window.location.replace("indexLogin.html");
    }

    if (!token || !sessao || !sessao.perfil) {
        expulsarParaLogin();
        return;
    }

    const perfil = String(sessao.perfil).toLowerCase();
    const perfilApi = String(sessao.perfilApi || "").toUpperCase();
    const ehPatrocinador = perfil === "patrocinador";
    const ehFuncionario = perfil === "funcionario" || perfil === "admin" || perfil === "superadmin";


    const ehSuperAdmin = perfilApi === "SUPERADMIN";
    const ehCotaMaster = String(sessao.marcaCota || "").toUpperCase() === "MASTER";

    if (!ehPatrocinador && !ehFuncionario) {
        expulsarParaLogin();
        return;
    }


    if (ehPatrocinador && !sessao.patrocinadorId) {
        expulsarParaLogin();
        return;
    }

    const paginaAtual = window.location.pathname.split("/").pop() || "";


    if (paginaAtual === "indexEquipe.html" && !ehSuperAdmin) {
        window.location.replace(ehPatrocinador ? "indexPatrocinador.html" : "indexAdministrador.html");
        return;
    }


    if (paginaAtual === "indexPesquisa.html" && ehPatrocinador && !ehCotaMaster) {
        window.location.replace("indexPatrocinador.html");
        return;
    }


    if (
        ehPatrocinador &&
        (paginaAtual === "indexAdministrador.html" ||
            paginaAtual === "detalhes-patrocinador.html" ||
            paginaAtual === "indexHistorico.html")
    ) {
        window.location.replace("indexPatrocinador.html");
        return;
    }


    if (ehFuncionario && paginaAtual === "indexPatrocinador.html") {
        window.location.replace("indexAdministrador.html");
        return;
    }
})();