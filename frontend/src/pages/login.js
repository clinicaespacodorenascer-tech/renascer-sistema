import { useState } from "react";
import { useRouter } from "next/router";
import api, { salvarSessao, rotaPorPapel } from "../lib/api";
import Logo from "../components/Logo";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    try {
      const { data } = await api.post("/auth/login", { email, senha });
      salvarSessao(data.token, data.user);
      router.push(rotaPorPapel(data.user.role));
    } catch (err) {
      setErro(err?.response?.data?.erro || "Não foi possível entrar. Confira seus dados.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-renascer-light to-white px-4">
      <div className="card w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={64} />
        </div>
        <h1 className="text-center text-renascer-ink/70 mb-6 text-sm">
          Entre com seu login (profissional, cliente, atendente ou administração)
        </h1>
        <form onSubmit={entrar} className="space-y-4">
          <input
            className="input"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <button className="btn-primary w-full" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
