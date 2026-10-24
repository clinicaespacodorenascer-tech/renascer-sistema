import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("renascer_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Fase 58 — antes, quando o login expirava (token com mais de 30 dias, ou inválido por qualquer
// motivo), a pessoa ficava travada na tela em que estava, vendo um erro cru tipo "Token inválido
// ou expirado." sem nenhum jeito óbvio de voltar a entrar (em telas sem menu visível, tipo um
// formulário rolado pra baixo, nem dava pra achar o "Sair"). Agora qualquer resposta 401 já limpa
// o login salvo e manda direto pra tela de entrar de novo, com um aviso explicando o que houve.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (erro?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("renascer_token");
      localStorage.removeItem("renascer_user");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?sessao=expirada";
      }
    }
    return Promise.reject(erro);
  }
);

export function salvarSessao(token, user) {
  localStorage.setItem("renascer_token", token);
  localStorage.setItem("renascer_user", JSON.stringify(user));
}

export function pegarUsuario() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("renascer_user");
  return raw ? JSON.parse(raw) : null;
}

// Atualiza só alguns campos do usuário salvo (ex: depois de trocar a foto de perfil), sem precisar
// logar de novo — assim a próxima vez que a página carregar já vem com o dado novo.
export function atualizarUsuarioLocal(patch) {
  const atual = pegarUsuario();
  if (!atual) return null;
  const atualizado = { ...atual, ...patch };
  localStorage.setItem("renascer_user", JSON.stringify(atualizado));
  return atualizado;
}

export function sair() {
  localStorage.removeItem("renascer_token");
  localStorage.removeItem("renascer_user");
  window.location.href = "/login";
}

export function rotaPorPapel(role) {
  return (
    {
      PROFISSIONAL: "/profissional",
      CLIENTE: "/cliente",
      DONO: "/dono",
      ATENDENTE: "/atendente",
      USUARIO_IA: "/ia",
      FINANCEIRO: "/financeiro", // Fase 31 — Setor Financeiro
    }[role] || "/login"
  );
}

export default api;
