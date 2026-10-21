import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import api from "../../lib/api";
import Logo from "../../components/Logo";

// Página pública de um formulário (pesquisa) — aberta pra qualquer pessoa que receber o link,
// sem precisar ter login no sistema (igual ao cadastro público da Renascer IA em
// /ia/cadastro.js, mesma ideia de tela "solta", sem o Layout do sistema). O token na URL
// identifica qual formulário mostrar (ver `linkToken` em backend/prisma/schema.prisma).
export default function ResponderFormulario() {
  const router = useRouter();
  const { token } = router.query;

  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState("");
  const [formulario, setFormulario] = useState(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [respostas, setRespostas] = useState({}); // { [perguntaId]: texto }
  const [erroEnviar, setErroEnviar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (!token) return;
    carregar();
  }, [token]);

  async function carregar() {
    setCarregando(true);
    setErroCarregar("");
    try {
      const { data } = await api.get(`/formularios/publico/${token}`);
      setFormulario(data);
    } catch (e) {
      setErroCarregar(e?.response?.data?.erro || "Não foi possível abrir este formulário agora.");
    } finally {
      setCarregando(false);
    }
  }

  function responder(perguntaId, texto) {
    setRespostas((atual) => ({ ...atual, [perguntaId]: texto }));
  }

  async function enviar(e) {
    e.preventDefault();
    setErroEnviar("");
    setEnviando(true);
    try {
      await api.post(`/formularios/publico/${token}/responder`, {
        nome,
        email,
        respostas: Object.entries(respostas).map(([perguntaId, texto]) => ({ perguntaId, texto })),
      });
      setEnviado(true);
    } catch (e) {
      setErroEnviar(e?.response?.data?.erro || "Não foi possível enviar suas respostas. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-renascer-light/60 px-4 py-10">
      <div className="w-full max-w-lg mx-auto">
        <div className="flex flex-col items-center text-center mb-6">
          <Logo size={72} />
        </div>

        {carregando && <p className="text-center text-renascer-ink/50">Carregando...</p>}

        {!carregando && erroCarregar && (
          <div className="card border border-red-200 bg-red-50 space-y-3 text-center">
            <p className="text-red-700 text-sm">{erroCarregar}</p>
          </div>
        )}

        {!carregando && !erroCarregar && formulario && enviado && (
          <div className="card space-y-2 text-center">
            <h1 className="text-xl font-bold text-renascer-ink">Respostas enviadas!</h1>
            <p className="text-sm text-renascer-ink/60">
              Muito obrigado por responder. Sua contribuição foi registrada com sucesso.
            </p>
          </div>
        )}

        {!carregando && !erroCarregar && formulario && !enviado && (
          <form onSubmit={enviar} className="space-y-5">
            <div className="card space-y-2">
              <h1 className="text-xl font-bold text-renascer-ink">{formulario.titulo}</h1>
              {formulario.descricao && (
                <p className="text-sm text-renascer-ink/70 whitespace-pre-line">{formulario.descricao}</p>
              )}
            </div>

            <div className="card space-y-3">
              <input
                className="input"
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
              <input
                className="input"
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {formulario.perguntas.map((pergunta, i) => (
              <div key={pergunta.id} className="card space-y-2.5">
                <p className="font-semibold text-sm text-renascer-ink">
                  {i + 1}. {pergunta.texto}
                  {!pergunta.obrigatoria && <span className="text-renascer-ink/40 font-normal"> (opcional)</span>}
                </p>
                <CampoPergunta
                  pergunta={pergunta}
                  valor={respostas[pergunta.id] || ""}
                  onChange={(texto) => responder(pergunta.id, texto)}
                />
              </div>
            ))}

            {erroEnviar && <p className="text-red-600 text-sm text-center">{erroEnviar}</p>}

            <button className="btn-primary w-full" disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar respostas"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function CampoPergunta({ pergunta, valor, onChange }) {
  if (pergunta.tipo === "TEXTO_LONGO") {
    return (
      <textarea
        className="input"
        rows={4}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        required={pergunta.obrigatoria}
      />
    );
  }

  if (pergunta.tipo === "MULTIPLA_ESCOLHA") {
    const opcoes = Array.isArray(pergunta.opcoes) ? pergunta.opcoes : [];
    return (
      <div className="space-y-1.5">
        {opcoes.map((opcao) => (
          <label key={opcao} className="flex items-center gap-2.5 text-sm text-renascer-ink/80">
            <input
              type="radio"
              name={pergunta.id}
              checked={valor === opcao}
              onChange={() => onChange(opcao)}
              required={pergunta.obrigatoria}
            />
            {opcao}
          </label>
        ))}
      </div>
    );
  }

  if (pergunta.tipo === "ESCALA") {
    const min = pergunta.opcoes?.min ?? 0;
    const max = pergunta.opcoes?.max ?? 10;
    const notas = [];
    for (let n = min; n <= max; n++) notas.push(n);
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {notas.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={`w-9 h-9 rounded-lg text-sm font-semibold border transition ${
              valor === String(n)
                ? "bg-renascer text-white border-renascer"
                : "bg-white text-renascer-ink/70 border-renascer-ink/15 hover:border-renascer/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  }

  // TEXTO_CURTO (padrão)
  return (
    <input className="input" value={valor} onChange={(e) => onChange(e.target.value)} required={pergunta.obrigatoria} />
  );
}
