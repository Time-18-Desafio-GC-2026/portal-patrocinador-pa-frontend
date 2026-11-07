const IS_LOCAL = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE_URL = IS_LOCAL
    ? "http://localhost:8080"
    : "https://portal-patrocinador-pa-backend.onrender.com";

async function apiRequest(endpoint, method = "GET", body = null) {
    const token = localStorage.getItem("rbs_token");
    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);


    if ((response.status === 401 || response.status === 403) && endpoint !== "/auth/login") {
        localStorage.removeItem("rbs_token");
        localStorage.removeItem("rbs_sessao");
        window.location.replace("indexLogin.html");
        return null;
    }

    if (!response.ok) {
        const erro = await response.json().catch(() => ({}));
        throw new Error(erro.mensagem || erro.message || "Erro ao comunicar com o servidor.");
    }

    if (response.status === 204) {
        return null;
    }

    return await response.json();
}

async function apiUploadMaterial(marcaId, payloadDados, arquivoFisico = null) {
    if (arquivoFisico && arquivoFisico.size > 20 * 1024 * 1024) {
        throw new Error("O arquivo deve ter no máximo 20 MB.");
    }

    const formData = new FormData();
    formData.append(
        "dados",
        new Blob([JSON.stringify(payloadDados)], { type: "application/json" })
    );

    if (arquivoFisico) {
        formData.append("arquivo", arquivoFisico);
    }

    const token = localStorage.getItem("rbs_token");
    const baseUrl = typeof API_BASE_URL !== "undefined"
        ? API_BASE_URL
        : "http://localhost:8080";

    const response = await fetch(`${baseUrl}/marcas/${marcaId}/materiais`, {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
        body: formData
    });

    if (!response.ok) {
        const erroJson = await response.json().catch(() => ({}));
        throw new Error(erroJson.mensagem || erroJson.message || `Erro ao enviar material (Status ${response.status}).`);
    }

    return await response.json();
}
