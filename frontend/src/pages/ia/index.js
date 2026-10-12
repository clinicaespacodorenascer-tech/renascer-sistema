import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/useAuth";
import api, { sair } from "../../lib/api";
import { linkWhatsapp } from "../../lib/whatsapp";
import Logo from "../../components/Logo";

// Tela principal da Renascer IA (etapa 1 — base grátis): só a conversa por enquanto. As outras
// abas da especificação (Hoje, Jornadas, Sessões, Perfil) chegam nas próximas etapas — por isso
// essa página ainda não tem o menu de baixo com 5 abas, só o essencial: conversar com a IA.
export default function RenascerIA() {
  const { user, carregando: carregandoAuth } = useAuth("USUARIO_IA");
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [restantesHoje, setRestantesHoje] = useState(null);
  const [limiteDiario, setLimiteDiario] = useState(null);
  const [limiteAtingido, setLimiteAtingido] = useState(false);
  const [crise, setCrise] = useState(false);
  const [sugerirSessao, setSugerirSessao] = useState(false);
  const [erro, setErro] = useState("");
  const fimDaListaRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    carregarConversa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    fimDaListaRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function carregarConversa() {
    const { data } = await api.get("/ia/mensagens");
    setMensagens(data.mensagens);
    setRestantesHoje(data.restantesHoje);
    setLimiteDiario(data.limiteDiario);
    if (data.mensagens.some((m) => m.sinalizouCrise)) setCrise(true);
  }

  async function enviar(e) {
    e.preventDefault();
    const textoParaEnviar = texto.trim();
    if (!textoParaEnviar || enviando) return;
    setErro("");
    setEnviando(true);
    setTexto("");

    // Mostra a mensagem da pessoa na hora, sem esperar a IA responder.
    setMensagens((prev) => [...prev, { id: `temp-${Date.now()}`, autor: "USUARIO", texto: textoParaEnviar }]);

    try {
      const { data } = await api.post("/ia/mensagens", { texto: textoParaEnviar });
      setMensagens((prev) => [...prev, { id: `resp-${Date.now()}`, autor: "IA", texto: data.resposta }]);
      setRestantesHoje(data.restantesHoje);
      setLimiteDiario(data.limiteDiario);
      if (data.crise) setCrise(true);
      if (data.sugerirSessao) setSugerirSessao(true);
    } catch (err) {
      if (err?.response?.status === 429 && err?.response?.data?.erro === "limite_diario") {
        setLimiteAtingido(true);
        setRestantesHoje(0);
        setLimiteDiario(err.response.data.limiteDiario ?? limiteDiario);
      } else {
        setErro("Não foi possível enviar sua mensagem agora. Tente de novo em instantes.");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function dispensarSugestaoDeSessao() {
    setSugerirSessao(false);
    try {
      await api.post("/ia/sessao-dispensada");
    } catch (e) {
      // silencioso — não é crítico se isso falhar, a IA só volta a sugerir um pouco antes
    }
  }

  if (carregandoAuth || !user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-renascer-light/40">
      <header className="bg-white border-b border-renascer-ink/[0.06] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={38} />
            <div>
              <p className="font-bold text-sm text-renascer-ink leading-tight">Renascer IA</p>
              <p className="text-xs text-renascer-ink/50 leading-tight">
                {limiteDiario != null ? `Restam ${restantesHoje} de ${limiteDiario} hoje` : "Olá, " + user.nome}
              </p>
            </div>
          </div>
          <button onClick={sair} className="btn-secondary !px-4 !py-2 text-sm">
            Sair
          </button>
        </div>
      </header>

      {crise && <CartaoCrise onFechar={() => setCrise(false)} />}

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 flex flex-col gap-3">
        {mensagens.length === 0 && (
          <div className="card text-center text-sm text-renascer-ink/60">
            Oi, {user.nome.split(" ")[0]}. Pode escrever o que estiver pensando — estou aqui para conversar.
          </div>
        )}

        {mensagens.map((m) => (
          <BolhaDeMensagem key={m.id} autor={m.autor} texto={m.texto} />
        ))}

        {sugerirSessao && (
          <div className="card border-renascer/30 bg-renascer-light/60 space-y-2.5">
            <p className="text-sm font-semibold text-renascer-ink">Conversar com uma profissional pode ajudar</p>
            <p className="text-xs text-renascer-ink/60">
              Além de mim, o Espaço do Renascer tem profissionais de verdade prontas para te acompanhar.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.open(linkWhatsapp(`Olá! Estou usando a Renascer IA e gostaria de saber mais sobre as sessões.`), "_blank")}
                className="btn-primary !py-2 text-sm"
              >
                Ver profissionais
              </button>
              <button type="button" onClick={dispensarSugestaoDeSessao} className="btn-secondary !py-2 text-sm">
                Agora não
              </button>
            </div>
          </div>
        )}

        {limiteAtingido && <CartaoLimiteDoDia limiteDiario={limiteDiario} />}

        {erro && <p className="text-red-600 text-sm text-center">{erro}</p>}

        <div ref={fimDaListaRef} />
      </main>

      <footer className="bg-white border-t border-renascer-ink/[0.06] sticky bottom-0">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <form onSubmit={enviar} className="flex items-end gap-2">
            <button
              type="button"
              disabled
              title="Conversa por áudio chega em breve"
              className="shrink-0 w-11 h-11 rounded-full border border-renascer-ink/15 text-renascer-ink/30 flex items-center justify-center"
            >
              🎤
            </button>
            <textarea
              className="input flex-1 resize-none"
              rows={1}
              placeholder={limiteAtingido ? "Você já usou suas mensagens de hoje" : "Escreva aqui..."}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={limiteAtingido || enviando}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(e);
                }
              }}
            />
            <button type="submit" className="btn-primary !px-4 !py-3 text-sm shrink-0" disabled={limiteAtingido || enviando || !texto.trim()}>
              {enviando ? "..." : "Enviar"}
            </button>
          </form>
          <p className="text-[11px] text-renascer-ink/40 text-center mt-2">
            Apoio para reflexão. Não é diagnóstico nem substitui terapia.
          </p>
        </div>
      </footer>
    </div>
  );
}

function BolhaDeMensagem({ autor, texto }) {
  const daPessoa = autor === "USUARIO";
  return (
    <div className={`flex ${daPessoa ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          daPessoa ? "bg-renascer text-white rounded-br-sm" : "bg-white border border-renascer-ink/[0.08] text-renascer-ink rounded-bl-sm"
        }`}
      >
        {texto}
      </div>
    </div>
  );
}

function CartaoCrise({ onFechar }) {
  return (
    <div className="bg-[#FFF4E8] border-b border-[#F0C98B]">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <p className="text-sm font-bold text-[#8F3F05]">Se você não está bem agora, tem ajuda disponível</p>
          <div className="flex flex-wrap gap-2">
            <a href="tel:188" className="btn-primary !py-2 text-sm !bg-none !bg-[#B4530A]">
              Ligar para o CVV: 188
            </a>
            <button
              type="button"
              onClick={() => window.open(linkWhatsapp("Preciso de ajuda, estou passando por um momento difícil."), "_blank")}
              className="btn-secondary !py-2 text-sm"
            >
              Falar com a equipe da Renascer
            </button>
            <a href="tel:192" className="btn-secondary !py-2 text-sm">
              Risco imediato: SAMU 192
            </a>
          </div>
        </div>
        <button type="button" onClick={onFechar} className="text-[#8F3F05]/60 hover:text-[#8F3F05] text-sm" aria-label="Fechar aviso">
          ✕
        </button>
      </div>
    </div>
  );
}

function CartaoLimiteDoDia({ limiteDiario }) {
  return (
    <div className="card text-center space-y-3">
      <p className="font-semibold text-renascer-ink">Você usou suas {limiteDiario} mensagens de hoje</p>
      <p className="text-sm text-renascer-ink/60">Volto a conversar com você amanhã. Enquanto isso, veja outras formas de continuar.</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => window.open(linkWhatsapp("Olá! Quero saber mais sobre o plano completo da Renascer IA."), "_blank")}
          className="btn-primary"
        >
          Saber mais sobre o plano completo
        </button>
        <button
          type="button"
          onClick={() => window.open(linkWhatsapp("Olá! Gostaria de ver os profissionais disponíveis no Espaço do Renascer."), "_blank")}
          className="btn-secondary"
        >
          Ver profissionais disponíveis
        </button>
      </div>
    </div>
  );
}
