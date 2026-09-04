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
  return { PROFISSIONAL: "/profissional", CLIENTE: "/cliente", DONO: "/dono", ATENDENTE: "/atendente" }[role] || "/login";
}

export default api;
