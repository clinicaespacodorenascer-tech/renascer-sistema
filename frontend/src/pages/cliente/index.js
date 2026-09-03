import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { linkWhatsapp } from "../../lib/whatsapp";

export default function AreaCliente() {
  const { user, carregando } = useAuth("CLIENTE");
  const [contrato, setContrato] = useState(null);
  const [aba, setAba] = useState("painel");

  useEffect(() => {
    if (user) api.get("/cliente/contrato").then((r) => setContrato(r.data));
  }, [user]);

  if (carregando || (user && !contrato)) return null;

  if (contrato && !contrato.aceito) {
    return <TelaContrato textoContrato={contrato.textoContrato} onAceito={() => setContrato({ ...contrato, aceito: true })} />;
  }

  const ABAS = [
    { id: "painel", label: "Início" },
    { id: "agenda", label: "Agenda" },
    { id: "financeiro", label: "Pacotes" },
    { id: "chat", label: "Chat" },
    { id: "diario", label: "Meu dia" },
    { id: "tarefas", label: "Tarefas" },
    { id: "relatorios", label: "Relatórios" },
    { id: "avisos", label: "Avisos" },
    { id: "suporte", label: "Suporte" },
    { id: "materiais", label: "Materiais" },
    { id: "duvidas", label: "Dúvidas" },
  ];

  return (
    <Layout user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "painel" && <AbaPainel />}
      {aba === "agenda" && <AbaAgenda />}
      {aba === "financeiro" && <AbaFinanceiro />}
      {aba === "chat" && <AbaChat />}
      {aba === "diario" && <AbaDiario />}
      {aba === "tarefas" && <AbaTarefas />}
      {aba === "relatorios" && <AbaRelatorios />}
      {aba === "avisos" && <AbaAvisos />}
      {aba === "suporte" && <AbaSuporte />}
      {aba === "materiais" && <AbaMateriais />}
      {aba === "duvidas" && <AbaDuvidas />}
    </Layout>
  );
}

// ---------------- CONTRATO (item 16 — obrigatório antes de tudo) ----------------
function TelaContrato({ textoContrato, onAceito }) {
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cpf, setCpf] = useState("");
  const [fotoDocumento, setFotoDocumento] = useState(null);
  const [fotoRosto, setFotoRosto] = useState(null);
  const [concordo, setConcordo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  function lerArquivo(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  async function aceitar() {
    if (!nomeCompleto || !cpf || !fotoDocumento || !concordo) {
      setErro("Preencha nome, CPF, anexe a foto do documento e marque que concorda com o contrato.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const fotoDocumentoUrl = await lerArquivo(fotoDocumento);
      const fotoRostoUrl = fotoRosto ? await lerArquivo(fotoRosto) : null;
      await api.post("/cliente/contrato/aceitar", { nomeCompleto, cpf, fotoDocumentoUrl, fotoRostoUrl });
      onAceito();
    } catch (e) {
      setErro("Não foi possível registrar seu aceite. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-renascer-light flex items-center justify-center px-4 py-10">
      <div className="card max-w-2xl w-full">
        <h1 className="text-xl font-semibold mb-4">Contrato de prestação de serviços</h1>
        <div className="h-56 overflow-y-auto border border-renascer/10 rounded-lg p-3 text-sm whitespace-pre-line bg-renascer-light/40 mb-4">
          {textoContrato}
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Nome completo" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
          <input className="input" placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
          <div>
            <label className="text-sm text-renascer-ink/60">Foto do documento (obrigatória)</label>
            <input type="file" accept="image/*" onChange={(e) => setFotoDocumento(e.target.files[0])} />
          </div>
          <div>
            <label className="text-sm text-renascer-ink/60">Foto do seu rosto (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => setFotoRosto(e.target.files[0])} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} />
            Li e concordo com os termos do contrato acima.
          </label>
          {erro && <p className="text-red-600 text-sm">{erro}</p>}
          <button className="btn-primary w-full" onClick={aceitar} disabled={enviando}>
            {enviando ? "Registrando..." : "Aceitar e continuar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- PAINEL (início) ----------------
function AbaPainel() {
  const [painel, setPainel] = useState(null);
  useEffect(() => {
    api.get("/cliente/painel").then((r) => setPainel(r.data));
  }, []);
  if (!painel) return <p>Carregando...</p>;

  return (
    <div className="space-y-4">
      {painel.pendencias.length > 0 && (
        <div className="card border-amber-300 bg-amber-50">
          <h3 className="font-semibold text-amber-700 mb-1">Pendências</h3>
          {painel.pendencias.map((p, i) => (
            <p key={i} className="text-sm text-amber-800">
              {p}
            </p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Sua profissional</p>
          <p className="font-semibold">{painel.cliente.profissionalAtual?.user?.nome || "Não vinculada ainda"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Sessões restantes</p>
          <p className="text-2xl font-bold text-renascer">{painel.sessoesRestantes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Próxima sessão</p>
          <p className="font-semibold">
            {painel.proximaSessao ? new Date(painel.proximaSessao.data).toLocaleString("pt-BR") : "Nenhuma agendada"}
          </p>
        </div>
      </div>
      <ContatoWhatsapp />
    </div>
  );
}

// ---------------- CONTATO RÁPIDO PELO WHATSAPP ----------------
function ContatoWhatsapp() {
  const opcoes = [
    {
      label: "💬 Trocar de plano / Renovar pacote",
      msg: "Olá! Quero saber sobre trocar de plano ou renovar meu pacote no Espaço do Renascer.",
    },
    {
      label: "💬 Dúvidas gerais / suporte",
      msg: "Olá! Tenho uma dúvida sobre meu atendimento no Espaço do Renascer.",
    },
  ];
  return (
    <div className="card">
      <h3 className="font-semibold mb-1">Fale com a gente no WhatsApp</h3>
      <p className="text-xs text-renascer-ink/50 mb-3">
        Pra trocar de plano, renovar seu pacote ou tirar outras dúvidas, é só chamar.
      </p>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <a key={o.label} href={linkWhatsapp(o.msg)} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
            {o.label}
          </a>
        ))}
      </div>
    </div>
  );
}

// ---------------- AGENDA / TROCA DE PROFISSIONAL ----------------
const STATUS_COR_CLIENTE = {
  AGENDADO: "bg-blue-100 text-blue-700",
  CONFIRMADO: "bg-emerald-100 text-emerald-700",
  REALIZADO: "bg-renascer-light text-renascer",
  CANCELADO: "bg-red-100 text-red-700",
  REAGENDADO: "bg-amber-100 text-amber-700",
  FALTOU: "bg-gray-200 text-gray-600",
};

function AbaAgenda() {
  const [sessoes, setSessoes] = useState(null);
  const [mostrarTroca, setMostrarTroca] = useState(false);

  async function carregar() {
    const { data } = await api.get("/cliente/agenda");
    setSessoes(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-1">Suas sessões</h2>
        <p className="text-xs text-renascer-ink/50 mb-3">
          Quem marca sua sessão é a recepção do Espaço do Renascer, de acordo com os horários da sua profissional.
          Fale com a recepção pra marcar uma nova sessão.
        </p>
        {sessoes === null && <p className="text-sm text-renascer-ink/50">Carregando...</p>}
        {sessoes?.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma sessão marcada ainda.</p>}
        <div className="space-y-2">
          {sessoes?.map((ag) => (
            <div key={ag.id} className="border border-renascer/10 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium">
                  {new Date(ag.data).toLocaleDateString("pt-BR")} às {ag.horaInicio} · {ag.profissional?.user?.nome}
                </p>
                <span className={`badge mt-1 ${STATUS_COR_CLIENTE[ag.status] || ""}`}>{ag.status}</span>
              </div>
              {ag.status !== "REALIZADO" && ag.status !== "CANCELADO" && (
                <a href={`/cliente/videochamada/${ag.id}`} className="text-sm text-renascer underline">
                  🎥 Entrar na videochamada
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <ReagendarSessao sessoes={sessoes || []} onReagendado={carregar} />

      <div className="card">
        <h2 className="font-semibold mb-2">Quer trocar de profissional?</h2>
        <p className="text-sm text-renascer-ink/60 mb-3">
          Você precisa encerrar seu pacote atual antes de trocar. Ao escolher uma nova profissional, você será redirecionado ao WhatsApp para finalizar o pagamento do novo pacote.
        </p>
        <button className="btn-secondary" onClick={() => setMostrarTroca(!mostrarTroca)}>
          {mostrarTroca ? "Fechar" : "Ver profissionais disponíveis"}
        </button>
        {mostrarTroca && <TrocaProfissional />}
      </div>
    </div>
  );
}

// O cliente nunca digita um horário livremente — ele só pode escolher entre os horários que a
// agenda real da profissional permite naquele dia (já descontando o que está ocupado e já
// considerando se a sessão é de 30 ou 50min). Isso evita virar bagunça de horários batendo um
// em cima do outro; o servidor revalida tudo de novo antes de confirmar (ver /cliente/agenda/:id/reagendar).
function ReagendarSessao({ sessoes, onReagendado }) {
  const [id, setId] = useState("");
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState(null);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState("");

  const elegiveis = (sessoes || []).filter((s) => s.status !== "REALIZADO" && s.status !== "CANCELADO");

  async function buscarHorarios() {
    if (!id || !data) return;
    setMsg("");
    setHoraEscolhida("");
    setBuscando(true);
    try {
      const { data: resp } = await api.get(`/cliente/agenda/${id}/horarios`, { params: { data } });
      setHorarios(resp);
    } catch (e) {
      setHorarios(null);
      setMsg(e?.response?.data?.erro || "Erro ao buscar horários livres.");
    } finally {
      setBuscando(false);
    }
  }

  async function reagendar() {
    if (!id || !data || !horaEscolhida) {
      setMsg("Escolha a sessão, a nova data e um horário disponível.");
      return;
    }
    setMsg("");
    try {
      await api.post(`/cliente/agenda/${id}/reagendar`, { data, horaInicio: horaEscolhida });
      setMsg("Sessão reagendada com sucesso!");
      setId("");
      setData("");
      setHorarios(null);
      setHoraEscolhida("");
      onReagendado?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao reagendar.");
    }
  }

  return (
    <div className="card">
      <h2 className="font-semibold mb-2">Reagendar uma sessão existente</h2>
      <p className="text-xs text-renascer-ink/50 mb-3">
        Escolha qual sessão marcada você quer mudar e a nova data — só aparecem os horários realmente livres na agenda
        da sua profissional (já considerando se a sessão é de 30 ou 50 minutos). Só é possível reagendar com pelo menos
        24h de antecedência da sessão original.
      </p>
      <div className="space-y-2">
        <div>
          <label className="text-sm text-renascer-ink/60 block mb-1">Qual sessão você quer reagendar?</label>
          <select
            className="input"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setHorarios(null);
              setHoraEscolhida("");
              setMsg("");
            }}
          >
            <option value="">Escolha a sessão marcada</option>
            {elegiveis.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.data).toLocaleDateString("pt-BR")} às {s.horaInicio} — {s.profissional?.user?.nome} · sessão de{" "}
                {s.duracao === "MIN30" ? "30min" : "50min"}
              </option>
            ))}
          </select>
          {elegiveis.length === 0 && (
            <p className="text-xs text-renascer-ink/40 mt-1">Você não tem sessões marcadas pra reagendar.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[150px]">
            <label className="text-sm text-renascer-ink/60 block mb-1">Para qual data você quer mudar?</label>
            <input type="date" className="input w-full" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <button className="btn-secondary whitespace-nowrap self-end" onClick={buscarHorarios} disabled={!id || !data || buscando}>
            {buscando ? "Buscando..." : "Ver horários livres"}
          </button>
        </div>

        {horarios && (
          <div>
            <p className="text-xs text-renascer-ink/50 mb-1">
              Horários livres em {horarios.diaSemana.toLowerCase()} pra uma sessão de {horarios.duracao === "MIN30" ? "30min" : "50min"}:
            </p>
            <div className="flex flex-wrap gap-2">
              {horarios.livres.length === 0 && (
                <p className="text-sm text-amber-700">Nenhum horário livre nesse dia. Escolha outra data.</p>
              )}
              {horarios.livres.map((h) => (
                <button
                  key={h}
                  onClick={() => setHoraEscolhida(h)}
                  className={`text-sm px-3 py-1.5 rounded-full border ${
                    horaEscolhida === h ? "bg-renascer text-white border-renascer" : "border-renascer/20 text-renascer-ink/70"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="btn-secondary mt-3" onClick={reagendar} disabled={!horaEscolhida}>
        Reagendar
      </button>
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </div>
  );
}

function TrocaProfissional() {
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/cliente/profissionais-disponiveis").then((r) => setLista(r.data));
  }, []);

  async function escolher(id) {
    setMsg("");
    // Abre a aba já no clique (antes do await) — no celular, se abrir só depois da resposta
    // da API, o navegador entende como pop-up indesejado e bloqueia.
    const novaAba = window.open("", "_blank");
    try {
      const { data } = await api.post("/cliente/trocar-profissional", { novoProfissionalId: id });
      if (novaAba) novaAba.location = data.linkWhatsapp;
      else window.location.href = data.linkWhatsapp;
    } catch (e) {
      if (novaAba) novaAba.close();
      setMsg(e?.response?.data?.erro || "Erro ao trocar de profissional.");
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {msg && <p className="text-amber-700 text-sm">{msg}</p>}
      {lista.map((p) => (
        <div key={p.id} className="flex items-center justify-between border border-renascer/10 rounded-lg p-2">
          <div>
            <p className="font-medium">{p.nome}</p>
            <p className="text-xs text-renascer-ink/50">{p.titulo}</p>
          </div>
          <button className="btn-secondary !py-1.5 !px-3 text-sm" onClick={() => escolher(p.id)}>
            Escolher
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------- FINANCEIRO / PACOTES (renovar, trocar plano, sessão extra) ----------------
function AbaFinanceiro() {
  const [planos, setPlanos] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/cliente/planos").then((r) => setPlanos(r.data));
  }, []);

  async function escolherPlano(duracao, totalSessoes) {
    // Abre a aba já no clique (antes do await) — no celular, se abrir só depois da resposta
    // da API, o navegador entende como pop-up indesejado e bloqueia.
    const novaAba = window.open("", "_blank");
    try {
      const { data } = await api.post("/cliente/renovar-ou-trocar-plano", { duracao, totalSessoes });
      if (novaAba) novaAba.location = data.linkWhatsapp;
      else window.location.href = data.linkWhatsapp;
    } catch (e) {
      if (novaAba) novaAba.close();
      alert(e?.response?.data?.erro || "Não foi possível processar. Tente de novo.");
    }
  }

  async function sessaoExtra(duracao) {
    const novaAba = window.open("", "_blank");
    try {
      const { data } = await api.post("/cliente/sessao-extra", { duracao });
      if (novaAba) novaAba.location = data.linkWhatsapp;
      else window.location.href = data.linkWhatsapp;
    } catch (e) {
      if (novaAba) novaAba.close();
      alert(e?.response?.data?.erro || "Não foi possível processar. Tente de novo.");
    }
  }

  if (!planos) return <p>Carregando planos...</p>;

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-3">Renovar pacote / trocar de plano</h2>
        <p className="text-xs text-renascer-ink/50 mb-3">Ao escolher, você será redirecionado ao WhatsApp para finalizar o pagamento.</p>
        {["MIN30", "MIN50"].map((dur) => (
          <div key={dur} className="mb-4">
            <p className="font-medium mb-2">Sessões de {dur === "MIN30" ? "30 minutos" : "50 minutos"}</p>
            <div className="flex flex-wrap gap-2">
              {planos[dur].map((p) => (
                <button key={p.totalSessoes} className="btn-secondary" onClick={() => escolherPlano(dur, p.totalSessoes)}>
                  {p.totalSessoes} sessão(ões) — R$ {p.valor}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Solicitar sessão extra</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => sessaoExtra("MIN30")}>
            Extra de 30min
          </button>
          <button className="btn-secondary" onClick={() => sessaoExtra("MIN50")}>
            Extra de 50min
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- CHAT / RECADOS ----------------
function AbaChat() {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const { data } = await api.get("/cliente/chat");
    setMensagens(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function enviar() {
    if (!texto.trim()) return;
    setErro("");
    setEnviando(true);
    try {
      await api.post("/cliente/chat", { texto });
      setTexto("");
      carregar();
    } catch (e) {
      setErro(e?.response?.data?.erro || "Não foi possível enviar a mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Chat com sua profissional</h2>
      <p className="text-xs text-renascer-ink/50 mb-3">
        Por segurança, não é permitido trocar telefone/WhatsApp por aqui — todo o contato é feito dentro do app.
      </p>
      <div className="h-64 overflow-y-auto border border-renascer/10 rounded-lg p-3 space-y-2 mb-3 bg-renascer-light/30">
        {mensagens.map((m) => (
          <div key={m.id} className={`text-sm ${m.autor === "CLIENTE" ? "text-right" : ""}`}>
            <span className="inline-block bg-white px-3 py-1.5 rounded-lg border border-renascer/10">
              {m.tipo === "recado_diario" && <span className="block text-xs text-renascer font-medium mb-0.5">Recado do dia</span>}
              {m.texto}
            </span>
          </div>
        ))}
        {mensagens.length === 0 && <p className="text-xs text-renascer-ink/40">Sem mensagens ainda.</p>}
      </div>
      {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-2">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-[150px]"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escreva sua mensagem..."
        />
        <button className="btn-primary" onClick={enviar} disabled={enviando}>
          Enviar
        </button>
      </div>
    </div>
  );
}

// ---------------- MEU DIA (checkin com emojis, opcional) ----------------
const HUMORES = [
  ["MUITO_BOM", "😄"],
  ["BOM", "🙂"],
  ["NEUTRO", "😐"],
  ["RUIM", "🙁"],
  ["MUITO_RUIM", "😢"],
];

function AbaDiario() {
  const [humor, setHumor] = useState(null);
  const [nota, setNota] = useState("");
  const [tarefaFeita, setTarefaFeita] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [enviado, setEnviado] = useState(false);

  async function carregar() {
    const { data } = await api.get("/cliente/checkins");
    setHistorico(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function enviar() {
    if (!humor) return;
    await api.post("/cliente/checkin", { humor, nota, tarefaFeita });
    setHumor(null);
    setNota("");
    setTarefaFeita(null);
    setEnviado(true);
    carregar();
    setTimeout(() => setEnviado(false), 2500);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold mb-1">Como foi seu dia?</h2>
        <p className="text-xs text-renascer-ink/50 mb-3">Totalmente opcional — só compartilhe se quiser.</p>
        <div className="flex gap-3 text-3xl mb-3">
          {HUMORES.map(([valor, emoji]) => (
            <button
              key={valor}
              onClick={() => setHumor(valor)}
              className={`p-2 rounded-full ${humor === valor ? "bg-renascer-light ring-2 ring-renascer" : ""}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <textarea className="input mb-2" rows={3} placeholder="Quer contar mais alguma coisa?" value={nota} onChange={(e) => setNota(e.target.value)} />
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={!!tarefaFeita} onChange={(e) => setTarefaFeita(e.target.checked)} />
          Consegui fazer a tarefa que me passaram
        </label>
        <button className="btn-primary" onClick={enviar} disabled={!humor}>
          Enviar
        </button>
        {enviado && <p className="text-emerald-600 text-sm mt-2">Registrado! Obrigado por compartilhar.</p>}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Histórico recente</h3>
        <div className="flex flex-wrap gap-2">
          {historico.map((h) => (
            <span key={h.id} title={new Date(h.data).toLocaleDateString("pt-BR")} className="text-2xl">
              {HUMORES.find(([v]) => v === h.humor)?.[1]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- TAREFAS ----------------
function AbaTarefas() {
  const [minhas, setMinhas] = useState([]);
  const [biblioteca, setBiblioteca] = useState(null);

  async function carregar() {
    const [a, b] = await Promise.all([api.get("/cliente/tarefas"), api.get("/cliente/biblioteca-tarefas")]);
    setMinhas(a.data);
    setBiblioteca(b.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function concluir(id) {
    await api.put(`/cliente/tarefas/${id}/concluir`);
    carregar();
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-3">Tarefas que sua profissional te enviou</h2>
        {minhas.map((t) => (
          <div key={t.id} className="border border-renascer/10 rounded-lg p-3 mb-2 flex justify-between items-center">
            <div>
              <p className="font-medium">{t.tarefa.titulo}</p>
              <p className="text-sm text-renascer-ink/60">{t.tarefa.descricao}</p>
            </div>
            {!t.concluida ? (
              <button className="btn-secondary !py-1 !px-3 text-sm" onClick={() => concluir(t.id)}>
                Marcar feita
              </button>
            ) : (
              <span className="badge bg-emerald-100 text-emerald-700">Concluída</span>
            )}
          </div>
        ))}
        {minhas.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma tarefa atribuída ainda.</p>}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-1">Biblioteca de apoio por tema</h2>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">{biblioteca?.aviso}</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {biblioteca?.tarefas?.map((t) => (
            <div key={t.id} className="border border-renascer/10 rounded-lg p-3">
              <span className="badge bg-renascer-light text-renascer mb-1">{t.tema}</span>
              <p className="font-medium">{t.titulo}</p>
              <p className="text-sm text-renascer-ink/60">{t.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- RELATÓRIOS PÚBLICOS ----------------
function AbaRelatorios() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/cliente/relatorios").then((r) => setLista(r.data));
  }, []);
  return (
    <div className="card">
      <h2 className="font-semibold mb-3">Relatórios disponibilizados pela sua profissional</h2>
      {lista.map((r) => (
        <div key={r.id} className="border border-renascer/10 rounded-lg p-3 mb-2">
          <p className="font-medium">{r.titulo}</p>
          <p className="text-sm text-renascer-ink/60">{r.conteudo}</p>
        </div>
      ))}
      {lista.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhum relatório disponibilizado ainda.</p>}
    </div>
  );
}

// ---------------- AVISOS (pendências, renovação, tarefas, mensalidade — item 12) ----------------
function AbaAvisos() {
  const [lista, setLista] = useState([]);

  async function carregar() {
    const { data } = await api.get("/comum/notificacoes");
    setLista(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function marcarLida(id) {
    await api.put(`/comum/notificacoes/${id}/lida`);
    carregar();
  }

  return (
    <div className="card">
      <h2 className="font-semibold mb-3">Seus avisos</h2>
      <div className="space-y-2">
        {lista.map((n) => (
          <div key={n.id} className={`border rounded-lg p-3 flex justify-between items-start ${n.lida ? "border-renascer/10" : "border-renascer/40 bg-renascer-light/40"}`}>
            <div>
              <p className="font-medium text-sm">{n.titulo}</p>
              <p className="text-sm text-renascer-ink/60">{n.mensagem}</p>
            </div>
            {!n.lida && (
              <button className="text-xs text-renascer underline whitespace-nowrap ml-2" onClick={() => marcarLida(n.id)}>
                marcar como lida
              </button>
            )}
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhum aviso por enquanto.</p>}
      </div>
    </div>
  );
}

// ---------------- SUPORTE (inclui escalonar pra gerência — item 19) ----------------
function AbaSuporte() {
  const [tickets, setTickets] = useState([]);
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [escalonar, setEscalonar] = useState(false);

  async function carregar() {
    const { data } = await api.get("/cliente/suporte");
    setTickets(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function abrirTicket() {
    if (!assunto || !texto) return;
    await api.post("/cliente/suporte", { assunto, texto, escalonarGerencia: escalonar });
    setAssunto("");
    setTexto("");
    setEscalonar(false);
    carregar();
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-3">Abrir novo chamado</h2>
        <input className="input mb-2" placeholder="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} />
        <textarea className="input mb-2" rows={3} placeholder="Descreva sua dúvida ou situação (pode anexar prints depois, no chat do chamado)" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={escalonar} onChange={(e) => setEscalonar(e.target.checked)} />
          Quero falar diretamente com a gerência (ex: para relatar algo sobre minha profissional)
        </label>
        <button className="btn-primary" onClick={abrirTicket}>
          Enviar
        </button>
      </div>

      <div className="space-y-2">
        {tickets.map((t) => (
          <div key={t.id} className="card">
            <div className="flex justify-between">
              <p className="font-medium">{t.assunto}</p>
              <span className="badge bg-renascer-light text-renascer">{t.status}</span>
            </div>
            {t.mensagens.map((m) => (
              <p key={m.id} className="text-sm text-renascer-ink/70 mt-1">
                {m.texto}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- MATERIAIS (e-book / cursos via Hotmart) ----------------
function AbaMateriais() {
  const [materiais, setMateriais] = useState(null);
  useEffect(() => {
    api.get("/cliente/materiais").then((r) => setMateriais(r.data));
  }, []);
  if (!materiais) return null;
  return (
    <div className="card">
      <h2 className="font-semibold mb-3">Materiais e cursos</h2>
      <div className="border border-renascer/10 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="font-medium">{materiais.ebook.titulo}</p>
          <p className="text-sm text-renascer-ink/60">Disponível para compra</p>
        </div>
        <a className="btn-primary" href={materiais.ebook.linkHotmart} target="_blank" rel="noreferrer">
          Ver e-book
        </a>
      </div>
      {materiais.cursos.length === 0 && <p className="text-sm text-renascer-ink/50 mt-3">Cursos e vídeo-aulas em breve.</p>}
    </div>
  );
}

// ---------------- DÚVIDAS (FAQ) ----------------
function AbaDuvidas() {
  const [faq, setFaq] = useState([]);
  useEffect(() => {
    api.get("/cliente/duvidas").then((r) => setFaq(r.data));
  }, []);
  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Dúvidas frequentes</h2>
      {faq.map((f, i) => (
        <details key={i} className="border border-renascer/10 rounded-lg p-3">
          <summary className="font-medium cursor-pointer">{f.pergunta}</summary>
          <p className="text-sm text-renascer-ink/70 mt-2">{f.resposta}</p>
        </details>
      ))}
    </div>
  );
}
