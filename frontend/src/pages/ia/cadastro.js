import { useState } from "react";
import { useRouter } from "next/router";
import api, { salvarSessao } from "../../lib/api";
import Logo from "../../components/Logo";

// Cadastro público da Renascer IA — diferente do cadastro de cliente (contrato, CPF, foto de
// documento): aqui é só nome, e-mail, WhatsApp e senha, aberto pra qualquer pessoa, não só quem já
// é cliente da clínica. Junta, numa página só, as telas "Boas-vindas", "Criar conta" e "Avisos e
// termos" da especificação, pra manter o fluxo curto.
export default function CadastroIA() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [maiorDeIdade, setMaiorDeIdade] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function criarConta(e) {
    e.preventDefault();
    setErro("");
    if (!maiorDeIdade || !aceitouTermos) {
      setErro("Confirme que tem 18 anos ou mais e aceite os termos para continuar.");
      return;
    }
    setCarregando(true);
    try {
      const { data } = await api.post("/ia/cadastro", {
        nome,
        email,
        whatsapp,
        senha,
        aceitouTermos: true,
      });
      salvarSessao(data.token, data.user);
      router.push("/ia");
    } catch (err) {
      setErro(err?.response?.data?.erro || "Não foi possível criar sua conta. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-renascer-light/60 px-4 py-10">
      <div className="w-full max-w-md mx-auto">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size={80} />
          <h1 className="text-xl font-bold text-renascer-ink mt-3">Renascer IA</h1>
          <p className="text-renascer-ink/60 text-sm mt-1">Uma companheira para conversar entre as sessões.</p>
        </div>

        <div className="card space-y-2.5 mb-5">
          <AvisoLinha texto="Grátis para começar, sem cartão." />
          <AvisoLinha texto="Sua conversa é privada — ninguém da clínica lê." />
          <AvisoLinha texto="Não é diagnóstico e não substitui terapia." />
          <AvisoLinha texto="Em emergência, ligue 188 (CVV) ou 192 (SAMU)." />
        </div>

        <form onSubmit={criarConta} className="card space-y-4">
          <input className="input" placeholder="Seu nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <input
            className="input"
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Seu WhatsApp (com DDD)"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Crie uma senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
          />

          <label className="flex items-start gap-2.5 text-sm text-renascer-ink/75">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={maiorDeIdade}
              onChange={(e) => setMaiorDeIdade(e.target.checked)}
            />
            Tenho 18 anos ou mais.
          </label>
          <label className="flex items-start gap-2.5 text-sm text-renascer-ink/75">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={aceitouTermos}
              onChange={(e) => setAceitouTermos(e.target.checked)}
            />
            Li e aceito os termos de uso e a política de privacidade.
          </label>

          {erro && <p className="text-red-600 text-sm">{erro}</p>}

          <button className="btn-primary w-full" disabled={carregando}>
            {carregando ? "Criando conta..." : "Criar minha conta"}
          </button>
        </form>

        <p className="text-center text-renascer-ink/50 text-sm mt-5">
          Já tem conta?{" "}
          <button type="button" onClick={() => router.push("/login")} className="text-renascer font-semibold underline">
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}

function AvisoLinha({ texto }) {
  return (
    <p className="text-sm text-renascer-ink/70 flex items-start gap-2">
      <span className="text-renascer mt-0.5">•</span>
      {texto}
    </p>
  );
}
