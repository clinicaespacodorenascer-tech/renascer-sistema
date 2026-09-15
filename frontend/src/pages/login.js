import { useState } from "react";
import { useRouter } from "next/router";
import api, { salvarSessao, rotaPorPapel } from "../lib/api";
import Logo from "../components/Logo";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-renascer-deep px-4 py-10 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "26px 26px" }}
      />
      <div className="w-full max-w-sm relative">
        <div className="h-[3px] w-24 bg-gold-line mx-auto mb-6" />
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lift p-8 border border-white/10">
          <div className="flex justify-center mb-5">
            <Logo size={100} />
          </div>
          <h1 className="text-center text-renascer-ink text-lg mb-1">Espaço do Renascer</h1>
          <p className="text-center text-renascer-ink/55 mb-6 text-sm">
            Entre com seu login (profissional, cliente, atendente ou administração)
          </p>
          <form onSubmit={entrar} className="space-y-4">
            <input
              className="input"
              type="text"
              placeholder="E-mail, CPF ou telefone"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="relative">
              <input
                className="input pr-11"
                type={mostrarSenha ? "text" : "password"}
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-renascer-ink/40 hover:text-renascer-ink/70 text-sm"
                aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                title={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
              >
                {mostrarSenha ? "🙈" : "👁️"}
              </button>
            </div>
            {erro && <p className="text-red-600 text-sm">{erro}</p>}
            <button className="btn-primary w-full" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
        <p className="text-center text-white/40 text-xs mt-6 tracking-wide">Espaço do Renascer · acolhimento e cuidado</p>
      </div>
    </div>
  );
}
