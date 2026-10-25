import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import api, { salvarSessao, rotaPorPapel } from "../lib/api";
import Logo from "../components/Logo";

// Fase 64 — redesign da tela de login: painel dividido (igual referência que o Elismael mandou),
// mas em formato "de computador" (paisagem, lado a lado) em vez do formato vertical/retrato do
// print original — ele pediu explicitamente pra adaptar a orientação. No celular, os dois painéis
// empilham (a faixa de marca fica mais compacta, só o essencial, pra não empurrar o formulário
// pra baixo da dobra).
//
// O texto do painel de marca foi escrito pensando em quem FAZ login aqui (profissional, dono,
// atendente) — não é o mesmo texto de captação de cliente do site público (espacodorenascer.com),
// que fala com quem ainda não é paciente.
//
// Dois itens do print de referência ficaram de fora de propósito, pra não ter botão/opção que não
// funciona de verdade: "Entrar com Google" (não existe login por Google configurado no sistema) e
// "Lembrar de mim" (o login aqui já fica sempre salvo no aparelho até sair ou expirar — não existe
// hoje um modo "não lembrar" pra esse checkbox realmente fazer algo). Se um dia fizer sentido ter
// login por Google de verdade, dá pra integrar depois.
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Fase 58 — quando o interceptor do api.js redireciona pra cá por causa de um login expirado
  // (token com mais de 30 dias, ou inválido), mostra um aviso explicando o motivo — em vez da
  // pessoa só cair na tela de login sem entender por quê.
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.sessao === "expirada") {
      setErro("Seu login expirou — é só entrar de novo com seu e-mail/telefone e senha de sempre.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.sessao]);

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
    <div className="min-h-screen flex flex-col md:flex-row font-publicSans">
      {/* ---------- Painel de marca ---------- */}
      <div
        className="relative overflow-hidden flex flex-col justify-between px-8 py-10 md:w-[44%] md:min-h-screen md:px-12 md:py-14"
        style={{ background: "linear-gradient(160deg, #0D1B30 0%, #0B5FA8 100%)" }}
      >
        {/* manchas decorativas, mesmo gesto do print de referência, em CSS puro (sem foto) */}
        <div
          className="pointer-events-none absolute -top-16 -left-16 w-64 h-64 rounded-full blur-3xl opacity-40"
          style={{ background: "#9C6B2E" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-20 w-80 h-80 rounded-full blur-3xl opacity-30"
          style={{ background: "#1B9FE0" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        <div className="relative z-10">
          <Logo size={64} />
          <h1 className="font-sora font-bold text-[26px] md:text-[30px] text-white leading-tight mt-6 max-w-xs">
            Sua rotina de cuidado, organizada num só lugar.
          </h1>

          <div className="hidden md:flex flex-col gap-4 mt-8">
            <ItemBeneficio icone="agenda" texto="Agenda e sessões sempre à mão" />
            <ItemBeneficio icone="escudo" texto="Pagamentos e repasses com transparência" />
            <ItemBeneficio icone="coracao" texto="Pensado pra quem cuida de pessoas" />
          </div>
        </div>

        <div className="relative z-10 mt-10 md:mt-0">
          <div className="h-px w-10 bg-white/30 mb-3" />
          <p className="text-white/85 text-[15px] italic leading-snug" style={{ fontFamily: "Georgia, serif" }}>
            &ldquo;Cuidar de quem cuida também importa.&rdquo;
          </p>
        </div>
      </div>

      {/* ---------- Painel do formulário ---------- */}
      <div className="flex-1 flex items-center justify-center bg-nv-bg px-5 py-10 md:py-14">
        <div className="w-full max-w-sm">
          <p className="text-[11px] font-bold tracking-wide text-nv-blue uppercase mb-1.5">Área da equipe</p>
          <h2 className="font-sora font-bold text-2xl text-nv-ink">Entrar no Espaço do Renascer</h2>
          <p className="text-nv-muted text-sm mt-1.5 mb-7">
            Entre com seu login de profissional, cliente, atendente ou administração.
          </p>

          <form onSubmit={entrar} className="flex flex-col gap-3.5">
            <CampoComIcone icone="pessoa">
              <input
                className="input !pl-10"
                type="text"
                placeholder="E-mail, CPF ou telefone"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck="false"
                required
              />
            </CampoComIcone>

            <CampoComIcone icone="cadeado">
              <input
                className="input !pl-10 !pr-11"
                type={mostrarSenha ? "text" : "password"}
                placeholder="Senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="current-password"
                spellCheck="false"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-nv-muted3 hover:text-nv-ink2 text-sm"
                aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                title={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
              >
                {mostrarSenha ? "🙈" : "👁️"}
              </button>
            </CampoComIcone>

            {erro && <p className="text-red-600 text-sm">{erro}</p>}

            <button className="btn-primary w-full flex items-center justify-center gap-2 mt-1" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
              {!carregando && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="text-center text-nv-muted text-sm mt-6">
            Ainda não tem conta?{" "}
            <button type="button" onClick={() => router.push("/ia/cadastro")} className="text-nv-blue font-semibold hover:underline">
              Conhecer a Renascer IA
            </button>
          </p>

          <div className="flex items-start gap-2 mt-8 pt-6 border-t border-nv-borderLight">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8392A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-[12px] text-nv-muted3 leading-snug">
              Seus dados ficam protegidos — o acesso é só seu, com login e senha individuais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Campo de texto com um ícone fixo à esquerda (mesmo gesto do print de referência) — recebe o
// <input> real como filho, só cuida do posicionamento do ícone por cima.
function CampoComIcone({ icone, children }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nv-muted3 pointer-events-none">
        <IconeCampo tipo={icone} />
      </span>
      {children}
    </div>
  );
}

function IconeCampo({ tipo }) {
  if (tipo === "pessoa") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    );
  }
  // cadeado
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Lista de benefícios do painel de marca (ícone + texto curto) — só aparece no computador, pra não
// empurrar o formulário pra baixo da dobra no celular.
function ItemBeneficio({ icone, texto }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white">
        <IconeBeneficio tipo={icone} />
      </span>
      <p className="text-white/90 text-[13.5px] leading-snug">{texto}</p>
    </div>
  );
}

function IconeBeneficio({ tipo }) {
  if (tipo === "agenda") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (tipo === "escudo") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
      </svg>
    );
  }
  // coracao
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}
