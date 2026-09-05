import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { verComprovante, verComprovanteRepasse } from "../../lib/comprovante";
import DisponibilidadeSemanal from "../../components/DisponibilidadeSemanal";
import StatusCliente from "../../components/StatusCliente";
import SituacaoCliente from "../../components/SituacaoCliente";

const TIPO_LABEL = {
  PACOTE_NOVO: "Contratação nova",
  RENOVACAO: "Renovação",
  SESSAO_EXTRA: "Sessão extra",
  OUTRO: "Outro",
};

const DIAS = [
  ["SEGUNDA", "Segunda"],
  ["TERCA", "Terça"],
  ["QUARTA", "Quarta"],
  ["QUINTA", "Quinta"],
  ["SEXTA", "Sexta"],
  ["SABADO", "Sábado"],
  ["DOMINGO", "Domingo"],
];

// Pra pré-preencher a data ao agendar direto de uma coluna da Agenda: acha a próxima ocorrência
// (a mais próxima, podendo ser hoje) daquele dia da semana.
const DIA_SEMANA_PARA_JS = { DOMINGO: 0, SEGUNDA: 1, TERCA: 2, QUARTA: 3, QUINTA: 4, SEXTA: 5, SABADO: 6 };
function proximaDataDoDia(diaSemana) {
  const alvo = DIA_SEMANA_PARA_JS[diaSemana];
  const hoje = new Date();
  const diff = (alvo - hoje.getDay() + 7) % 7;
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + diff);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const CATEGORIAS_SUGERIDAS = [
  "Ansiedade",
  "Depressão",
  "Relacionamentos",
  "Autoestima",
  "Luto e mudanças",
  "Estresse",
  "Sono",
  "Terapia de casal",
  "Neurodivergência",
  "Autoconhecimento",
];

const STATUS_COR = {
  AGENDADO: "bg-blue-100 text-blue-700",
  CONFIRMADO: "bg-emerald-100 text-emerald-700",
  REALIZADO: "bg-renascer-light text-renascer",
  CANCELADO: "bg-red-100 text-red-700",
  REAGENDADO: "bg-amber-100 text-amber-700",
  FALTOU: "bg-gray-200 text-gray-600",
};

export default function AreaProfissional() {
  const { user, carregando } = useAuth("PROFISSIONAL");
  const [aba, setAba] = useState("agenda");

  if (carregando) return null;

  const ABAS = [
    { id: "agenda", label: "Agenda" },
    { id: "clientes", label: "Clientes" },
    { id: "cadastrar", label: "Cadastrar cliente" },
    { id: "financeiro", label: "Financeiro" },
    { id: "notificacoes", label: "Avisos" },
    { id: "config", label: "Disponibilidade" },
  ];

  return (
    <Layout user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "agenda" && <AbaAgenda />}
      {aba === "clientes" && <AbaClientes />}
      {aba === "cadastrar" && <AbaCadastrarCliente />}
      {aba === "financeiro" && <AbaFinanceiro />}
      {aba === "notificacoes" && <AbaNotificacoes />}
      {aba === "config" && <AbaConfig />}
    </Layout>
  );
}

// ---------------- CADASTRAR CLIENTE ANTIGO (sem depender da recepção) ----------------
const FORM_CADASTRO_VAZIO = {
  nome: "",
  email: "",
  telefone: "",
  senhaProvisoria: "",
  duracao: "MIN50",
  totalSessoes: 4,
  sessoesRestantes: "4",
  valorTotal: "",
  diaSemanaFixo: "",
  horaFixa: "",
};

function AbaCadastrarCliente() {
  const [total, setTotal] = useState(null);
  const [form, setForm] = useState(FORM_CADASTRO_VAZIO);
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState("");

  async function carregarTotal() {
    const { data } = await api.get("/profissional/clientes");
    setTotal(data.length);
  }
  useEffect(() => {
    carregarTotal();
  }, []);

  async function cadastrar() {
    setMsg("");
    setResultado(null);
    try {
      const { data } = await api.post("/profissional/clientes", {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        senhaProvisoria: form.senhaProvisoria || undefined,
        duracao: form.duracao,
        totalSessoes: Number(form.totalSessoes),
        sessoesRestantes: form.sessoesRestantes !== "" ? Number(form.sessoesRestantes) : undefined,
        valorTotal: form.valorTotal ? Number(form.valorTotal) : undefined,
        diaSemanaFixo: form.diaSemanaFixo || undefined,
        horaFixa: form.horaFixa || undefined,
      });
      setResultado(data);
      setForm(FORM_CADASTRO_VAZIO);
      carregarTotal();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao cadastrar cliente.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-sm text-renascer-ink/60">Seus clientes no Espaço do Renascer</p>
        <p className="text-3xl font-bold text-renascer">{total === null ? "..." : total}</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-1">Cadastrar cliente que você já atende</h2>
        <p className="text-xs text-renascer-ink/50 mb-3">
          Use isso pra colocar no sistema os clientes que você já atendia antes, já com o pacote e o dia/horário fixo que
          vocês combinaram. Se preencher o dia e o horário, a sessão já entra direto na sua Agenda.
        </p>

        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="input" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input
            className="input"
            placeholder="Telefone"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
          <input
            className="input"
            placeholder="Senha do login (opcional, senão é gerada uma)"
            value={form.senhaProvisoria}
            onChange={(e) => setForm({ ...form, senhaProvisoria: e.target.value })}
          />
        </div>

        <div className="border-t border-renascer/10 mt-4 pt-4">
          <p className="text-sm font-medium mb-2">Pacote atual (opcional)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select className="input" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })}>
              <option value="MIN30">30 minutos</option>
              <option value="MIN50">50 minutos</option>
            </select>
            <select className="input" value={form.totalSessoes} onChange={(e) => setForm({ ...form, totalSessoes: e.target.value })}>
              <option value={1}>Pacote de 1</option>
              <option value={2}>Pacote de 2</option>
              <option value={4}>Pacote de 4</option>
            </select>
            <input
              type="number"
              min="0"
              className="input"
              placeholder="Sessões que faltam"
              value={form.sessoesRestantes}
              onChange={(e) => setForm({ ...form, sessoesRestantes: e.target.value })}
            />
            <input
              className="input"
              placeholder="Valor pago (opcional)"
              value={form.valorTotal}
              onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
            />
          </div>
          <p className="text-xs text-renascer-ink/40 mt-1">
            Deixe "Sessões que faltam" igual ao total do pacote se ele está no início.
          </p>
        </div>

        <div className="border-t border-renascer/10 mt-4 pt-4">
          <p className="text-sm font-medium mb-2">Dia e horário fixo já combinado (opcional)</p>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={form.diaSemanaFixo} onChange={(e) => setForm({ ...form, diaSemanaFixo: e.target.value })}>
              <option value="">Sem dia fixo</option>
              {DIAS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Horário (ex: 14:00)"
              value={form.horaFixa}
              onChange={(e) => setForm({ ...form, horaFixa: e.target.value })}
            />
          </div>
        </div>

        <button className="btn-primary mt-4" onClick={cadastrar}>
          Cadastrar cliente
        </button>
        {msg && <p className="text-red-600 text-sm mt-2">{msg}</p>}
        {resultado && (
          <div className="text-sm mt-2 space-y-1">
            <p className="text-emerald-600">
              Cliente cadastrado! Senha provisória: <strong>{resultado.senhaProvisoria}</strong> (repasse isso pro cliente por
              um canal seguro)
            </p>
            {resultado.transacao && (
              <p className="text-emerald-600">
                Pagamento contabilizado! Seu repasse: R$ {resultado.transacao.valorProfissional.toFixed(2)} · Parte da
                Renascer (você ainda deve repassar): R$ {resultado.transacao.valorRenascer.toFixed(2)}
              </p>
            )}
            {resultado.avisoFinanceiro && <p className="text-amber-700">{resultado.avisoFinanceiro}</p>}
            {resultado.agendamento && <p className="text-emerald-600">Sessão fixa já criada direto na sua Agenda ✅</p>}
            {resultado.avisoAgenda && <p className="text-amber-700">{resultado.avisoAgenda}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- AGENDA (estilo Trello por dia) ----------------
function AbaAgenda() {
  const [colunas, setColunas] = useState(null);
  const [colunaSobre, setColunaSobre] = useState(null);
  const [erro, setErro] = useState("");
  const [clientes, setClientes] = useState([]);
  const [colunaAberta, setColunaAberta] = useState(null);
  const [reagendando, setReagendando] = useState(null);

  async function carregar() {
    const [a, c] = await Promise.all([api.get("/profissional/agenda"), api.get("/profissional/clientes")]);
    setColunas(a.data);
    setClientes(c.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function mudarStatus(id, status) {
    await api.put(`/profissional/agenda/${id}/status`, { status });
    carregar();
  }

  async function moverSessao(id, novoDiaSemana) {
    setErro("");
    try {
      await api.put(`/profissional/agenda/${id}/mover`, { novoDiaSemana });
      carregar();
    } catch (e) {
      setErro(e?.response?.data?.erro || "Não foi possível mover a sessão.");
    }
  }

  async function excluirDaAgenda(ag) {
    const aviso =
      ag.status === "REALIZADO"
        ? `Excluir esse card da agenda? Foi um agendamento por engano — a sessão de "${ag.pacote ? `${ag.pacote.sessoesUsadas}/${ag.pacote.totalSessoes}" ` : ""}será descontada de volta pro pacote (o cadastro do cliente continua normal, só some esse card da agenda).`
        : `Excluir esse card da agenda? O cadastro do cliente continua normal, só some esse card daqui.`;
    if (!window.confirm(aviso)) return;
    setErro("");
    try {
      await api.delete(`/profissional/agenda/${ag.id}`);
      carregar();
    } catch (e) {
      setErro(e?.response?.data?.erro || "Não foi possível excluir esse card da agenda.");
    }
  }

  if (!colunas) return <p>Carregando agenda...</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Sua semana</h2>
      <p className="text-xs text-renascer-ink/50 mb-3">
        Arraste o card de uma sessão pra outro dia (no computador) ou use o menu "Mover para..." (no celular) — o horário continua o mesmo.
      </p>
      {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{erro}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {DIAS.map(([chave, label]) => (
          <div
            key={chave}
            className={`card !p-3 min-h-[200px] ${colunaSobre === chave ? "ring-2 ring-renascer" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setColunaSobre(chave);
            }}
            onDragLeave={() => setColunaSobre((atual) => (atual === chave ? null : atual))}
            onDrop={(e) => {
              e.preventDefault();
              setColunaSobre(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) moverSessao(id, chave);
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-renascer text-sm">{label}</h3>
              <button
                className="text-renascer text-base leading-none w-6 h-6 rounded-full border border-renascer/30 hover:bg-renascer-light"
                title="Adicionar sessão de um cliente já cadastrado"
                onClick={() => setColunaAberta(colunaAberta === chave ? null : chave)}
              >
                +
              </button>
            </div>
            <div className="space-y-2">
              {colunas[chave]?.length === 0 && <p className="text-xs text-renascer-ink/40">Sem sessões</p>}
              {colunas[chave]?.map((ag) => {
                const podeMover = ag.status !== "REALIZADO" && ag.status !== "CANCELADO";
                return (
                  <div
                    key={ag.id}
                    draggable={podeMover}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", ag.id)}
                    className={`border border-renascer/10 rounded-lg p-2 bg-renascer-light/40 ${podeMover ? "cursor-move" : ""}`}
                  >
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <StatusCliente status={ag.statusCliente} />
                      {ag.horaInicio} · {ag.cliente.user.nome}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <span className={`badge ${STATUS_COR[ag.status]}`}>{ag.status}</span>
                      {ag.pacote && (
                        <span className="badge bg-renascer-light text-renascer" title="Sessões realizadas / total do pacote">
                          {ag.pacote.sessoesUsadas}/{ag.pacote.totalSessoes} sessões
                        </span>
                      )}
                    </div>
                    {podeMover && (
                      <>
                        <select
                          className="input !text-xs !py-1 !w-full mt-1"
                          value=""
                          onChange={(e) => {
                            if (e.target.value) moverSessao(ag.id, e.target.value);
                          }}
                        >
                          <option value="">Mover para...</option>
                          {DIAS.filter(([d]) => d !== chave).map(([d, l]) => (
                            <option key={d} value={d}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <Link
                          href={`/profissional/videochamada/${ag.id}`}
                          className="block text-xs text-renascer underline mt-2"
                        >
                          🎥 Entrar na videochamada
                        </Link>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <button className="text-xs text-emerald-700 underline" onClick={() => mudarStatus(ag.id, "REALIZADO")}>
                            Realizada
                          </button>
                          <button className="text-xs text-red-600 underline" onClick={() => mudarStatus(ag.id, "CANCELADO")}>
                            Cancelar
                          </button>
                          <button className="text-xs text-renascer underline" onClick={() => setReagendando(ag)}>
                            Mudar data/horário
                          </button>
                        </div>
                      </>
                    )}
                    <button
                      className="text-xs text-red-600/70 underline mt-1"
                      onClick={() => excluirDaAgenda(ag)}
                      title="Remove só o card da agenda — o cadastro do cliente continua normal"
                    >
                      Excluir da agenda
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {colunaAberta && (
        <NovaSessaoModal
          diaSemana={colunaAberta}
          diaLabel={DIAS.find(([d]) => d === colunaAberta)?.[1] || ""}
          clientes={clientes}
          onAgendado={() => {
            setColunaAberta(null);
            carregar();
          }}
          onFechar={() => setColunaAberta(null)}
        />
      )}
      {reagendando && (
        <ReagendarModal
          agendamento={reagendando}
          onReagendado={() => {
            setReagendando(null);
            carregar();
          }}
          onFechar={() => setReagendando(null)}
        />
      )}
    </div>
  );
}

// Mudar a data/horário de UMA sessão específica — diferente do "Mover para..." (que só troca o
// dia dentro da mesma semana): aqui dá pra jogar pra qualquer data, útil pra imprevisto ou pra
// remarcar a última sessão do pacote antes de renovar. A sessão antiga fica marcada como
// "REAGENDADO" no histórico e uma nova é criada na data escolhida.
const JS_PARA_DIA_SEMANA = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
function ReagendarModal({ agendamento, onReagendado, onFechar }) {
  const dataAtual = new Date(agendamento.data).toISOString().slice(0, 10);
  const [novaData, setNovaData] = useState(dataAtual);
  const [novaHora, setNovaHora] = useState(agendamento.horaInicio);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  async function confirmar() {
    if (!novaData || !novaHora) {
      setMsg("Escolha a nova data e o novo horário.");
      return;
    }
    setEnviando(true);
    setMsg("");
    try {
      const novoDiaSemana = JS_PARA_DIA_SEMANA[new Date(`${novaData}T00:00:00`).getDay()];
      await api.post(`/profissional/agenda/${agendamento.id}/reagendar`, {
        novaData,
        novoDiaSemana,
        novaHora,
        motivo: motivo || undefined,
      });
      onReagendado?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao mudar a data da sessão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar?.();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-renascer text-lg">Mudar data/horário · {agendamento.cliente.user.nome}</h3>
          <button className="text-renascer-ink/40 hover:text-renascer-ink text-2xl leading-none" onClick={onFechar} title="Fechar">
            ×
          </button>
        </div>
        <p className="text-xs text-renascer-ink/50">
          Data e horário atuais: {new Date(agendamento.data).toLocaleDateString("pt-BR")} às {agendamento.horaInicio}.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Nova data</label>
            <input type="date" className="input" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Novo horário</label>
            <input type="time" className="input" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Motivo (opcional, o cliente vê no aviso)</label>
          <input className="input" placeholder="Ex: imprevisto, remarcação da última sessão..." value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>

        {msg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{msg}</p>}

        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1" onClick={confirmar} disabled={enviando}>
            {enviando ? "Salvando..." : "Confirmar nova data"}
          </button>
          <button className="btn-secondary" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// Popup de "+ adicionar sessão" que abre por cima da tela (e não mais espremido dentro da
// coluna estreita do dia) — pra profissional poder marcar um cliente já cadastrado direto na
// Agenda, sem precisar da recepção. Já vem com a data mais próxima daquele dia da semana
// preenchida, e busca os horários livres sozinho sempre que cliente/data/duração mudam — não
// precisa lembrar de clicar em nada pra ver as opções.
function NovaSessaoModal({ diaSemana, diaLabel, clientes, onAgendado, onFechar }) {
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState(proximaDataDoDia(diaSemana));
  const [duracao, setDuracao] = useState("MIN50");
  const [horarios, setHorarios] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data) return;
    setMsg("");
    setHoraEscolhida("");
    setBuscando(true);
    api
      .get("/profissional/horarios", { params: { data, duracao, clienteId: clienteId || undefined } })
      .then(({ data: resp }) => setHorarios(resp.livres))
      .catch((e) => {
        setHorarios(null);
        setMsg(e?.response?.data?.erro || "Erro ao buscar horários.");
      })
      .finally(() => setBuscando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, duracao, clienteId]);

  async function confirmar() {
    if (!clienteId) return setMsg("Escolha o cliente.");
    if (!data) return setMsg("Escolha a data.");
    if (!horaEscolhida) return setMsg("Escolha um horário na lista abaixo.");
    setEnviando(true);
    setMsg("");
    try {
      await api.post("/profissional/agenda", { clienteId, data, horaInicio: horaEscolhida, duracao });
      onAgendado?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao agendar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar?.();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-renascer text-lg">Nova sessão · {diaLabel}</h3>
          <button className="text-renascer-ink/40 hover:text-renascer-ink text-2xl leading-none" onClick={onFechar} title="Fechar">
            ×
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Cliente</label>
          <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Escolha o cliente...</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.user.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Data</label>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Duração</label>
            <select className="input" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
              <option value="MIN30">30 minutos</option>
              <option value="MIN50">50 minutos</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Horário</label>
          {buscando && <p className="text-xs text-renascer-ink/40">Buscando horários livres...</p>}
          {!buscando && horarios?.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Nenhum horário livre nesse dia. Tente outra data ou libere um horário na aba Disponibilidade.
            </p>
          )}
          {!buscando && horarios?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHoraEscolhida(h)}
                  className={`text-sm px-3 py-1.5 rounded-full border ${
                    horaEscolhida === h
                      ? "bg-renascer text-white border-renascer"
                      : "border-renascer/20 text-renascer-ink/70 hover:border-renascer/50"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        {msg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{msg}</p>}

        <div className="flex gap-2 pt-1">
          <button className="btn-primary flex-1" onClick={confirmar} disabled={enviando || !horaEscolhida}>
            {enviando ? "Agendando..." : "Agendar"}
          </button>
          <button className="btn-secondary" onClick={onFechar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- CLIENTES (lista + chat + relatórios) ----------------
function AbaClientes() {
  const [clientes, setClientes] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);

  async function carregar() {
    const { data } = await api.get("/profissional/clientes");
    setClientes(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  const selecionado = clientes.find((c) => c.id === selecionadoId) || null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card md:col-span-1">
        <h2 className="font-semibold mb-1">Meus clientes</h2>
        <p className="text-xs text-renascer-ink/50 mb-3">Você tem {clientes.length} cliente(s) no Espaço do Renascer.</p>
        <div className="space-y-2">
          {clientes.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelecionadoId(c.id)}
              className={`w-full text-left px-3 py-2 rounded-lg border ${
                selecionadoId === c.id ? "border-renascer bg-renascer-light" : "border-renascer/10"
              }`}
            >
              <p className="font-medium flex items-center gap-1.5">
                <StatusCliente status={c.statusCliente} />
                {c.user.nome}
              </p>
              <p className="text-xs text-renascer-ink/50">
                {c.pacotes[0] ? `${c.pacotes[0].sessoesUsadas}/${c.pacotes[0].totalSessoes} sessões` : "sem pacote ativo"}
              </p>
            </button>
          ))}
          {clientes.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhum cliente ainda.</p>}
        </div>
      </div>
      <div className="md:col-span-2">
        {selecionado ? (
          <DetalheCliente cliente={selecionado} onMudouSituacao={() => { carregar(); setSelecionadoId(null); }} />
        ) : (
          <p className="text-renascer-ink/50">Selecione um cliente.</p>
        )}
      </div>
    </div>
  );
}

function DetalheCliente({ cliente, onMudouSituacao }) {
  const [sub, setSub] = useState("chat");
  return (
    <div className="card">
      <h2 className="font-semibold text-lg flex items-center gap-2">
        <StatusCliente status={cliente.statusCliente} />
        {cliente.user.nome}
      </h2>
      <div className="flex gap-2 my-3 flex-wrap">
        {[
          ["chat", "Chat / recados"],
          ["agendar", "Agendar sessão"],
          ["relatorios", "Relatórios"],
          ["pacote", "Pacote / pagamento"],
          ["notificacao", "Notificação"],
          ["login", "Corrigir login"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`text-sm px-3 py-1.5 rounded-full ${sub === id ? "bg-renascer text-white" : "bg-renascer-light"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {sub === "chat" && <ChatCliente clienteId={cliente.id} />}
      {sub === "agendar" && <AgendarSessaoCliente clienteId={cliente.id} clienteNome={cliente.user.nome} />}
      {sub === "relatorios" && <RelatoriosCliente clienteId={cliente.id} />}
      {sub === "pacote" && <NovoPacoteCliente clienteId={cliente.id} />}
      {sub === "notificacao" && <NotificacaoCliente clienteId={cliente.id} rotaBase="/profissional" />}
      {sub === "login" && <CorrigirLoginCliente cliente={cliente} />}
      <SituacaoCliente clienteId={cliente.id} rotaBase="/profissional" onMudou={onMudouSituacao} />
    </div>
  );
}

// Corrigir nome, e-mail ou senha do login do cliente — pra quando a profissional errou algo no
// cadastro (e-mail digitado errado, por exemplo) e o cliente não consegue entrar. Cada campo é
// opcional: só muda o que ela preencher.
function CorrigirLoginCliente({ cliente }) {
  const [nome, setNome] = useState(cliente.user.nome || "");
  const [email, setEmail] = useState(cliente.user.email || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  async function salvar() {
    setSalvando(true);
    setMsg("");
    try {
      const { data } = await api.put(`/profissional/clientes/${cliente.id}/login`, {
        nome: nome !== cliente.user.nome ? nome : undefined,
        email: email !== cliente.user.email ? email : undefined,
        novaSenha: novaSenha || undefined,
      });
      setMsg(`Salvo! Login atualizado: ${data.email}` + (novaSenha ? " · Senha alterada." : ""));
      setNovaSenha("");
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2 mt-2 max-w-sm">
      <p className="text-xs text-renascer-ink/50">
        Errou o e-mail, o nome ou quer trocar a senha do cliente? Corrija aqui — ele passa a usar o novo login na hora.
      </p>
      <input className="input" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      <input className="input" placeholder="E-mail de login" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        className="input"
        placeholder="Nova senha (deixe em branco pra não mudar)"
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
      />
      <button className="btn-secondary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar alterações"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

// Agendar uma sessão pra esse cliente direto da própria ficha dele (aba Clientes) — sem precisar
// ir até a coluna do dia na Agenda. Usa o mesmo endpoint/lógica do botão "+" da Agenda (só que
// aqui o cliente já vem fixo, só falta escolher o dia e o horário) — assim que confirma, a sessão
// já aparece normalmente na aba Agenda (ela sempre busca os dados atualizados do servidor quando
// é aberta, não precisa de nenhum passo extra).
function AgendarSessaoCliente({ clienteId, clienteNome }) {
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState("MIN50");
  const [horarios, setHorarios] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [msg, setMsg] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!data) {
      setHorarios(null);
      return;
    }
    setMsg("");
    setHoraEscolhida("");
    setBuscando(true);
    api
      .get("/profissional/horarios", { params: { data, duracao, clienteId } })
      .then(({ data: resp }) => setHorarios(resp.livres))
      .catch((e) => {
        setHorarios(null);
        setMsg(e?.response?.data?.erro || "Erro ao buscar horários.");
      })
      .finally(() => setBuscando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, duracao, clienteId]);

  async function confirmar() {
    if (!data) return setMsg("Escolha o dia da sessão.");
    if (!horaEscolhida) return setMsg("Escolha um horário na lista abaixo.");
    setEnviando(true);
    setMsg("");
    try {
      await api.post("/profissional/agenda", { clienteId, data, horaInicio: horaEscolhida, duracao });
      setMsg(`Sessão marcada com ${clienteNome}! Já aparece na aba Agenda.`);
      setData("");
      setHorarios(null);
      setHoraEscolhida("");
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao agendar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-renascer-ink/50">
        Escolha o dia e o horário — só aparecem os horários que você realmente atende e que ainda estão livres nesse
        dia. Ao confirmar, a sessão já é criada e aparece direto na aba Agenda.
      </p>
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <div>
          <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Dia da sessão</label>
          <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Duração</label>
          <select className="input" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
            <option value="MIN30">30 minutos</option>
            <option value="MIN50">50 minutos</option>
          </select>
        </div>
      </div>

      {data && (
        <div>
          <label className="text-xs font-medium text-renascer-ink/60 block mb-1">Horário</label>
          {buscando && <p className="text-xs text-renascer-ink/40">Buscando horários livres...</p>}
          {!buscando && horarios?.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Nenhum horário livre nesse dia. Tente outro dia ou libere um horário na aba Disponibilidade.
            </p>
          )}
          {!buscando && horarios?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHoraEscolhida(h)}
                  className={`text-sm px-3 py-1.5 rounded-full border ${
                    horaEscolhida === h
                      ? "bg-renascer text-white border-renascer"
                      : "border-renascer/20 text-renascer-ink/70 hover:border-renascer/50"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {msg && <p className="text-sm text-renascer-ink/80 bg-renascer-light/50 border border-renascer/20 rounded-lg p-2">{msg}</p>}

      <button className="btn-primary" onClick={confirmar} disabled={enviando || !data || !horaEscolhida}>
        {enviando ? "Agendando..." : "Confirmar sessão"}
      </button>
    </div>
  );
}

// ---------------- NOTIFICAÇÃO (contato p/ avisos automáticos + data de renovação) ----------------
function NotificacaoCliente({ clienteId, rotaBase }) {
  const [notifEmail, setNotifEmail] = useState("");
  const [notifTelefone, setNotifTelefone] = useState("");
  const [renovarEm, setRenovarEm] = useState("");
  const [carregado, setCarregado] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setCarregado(false);
    api.get(`${rotaBase}/clientes/${clienteId}`).then((r) => {
      setNotifEmail(r.data.notifEmail || "");
      setNotifTelefone(r.data.notifTelefone || "");
      setRenovarEm(r.data.renovarEm ? new Date(r.data.renovarEm).toISOString().slice(0, 10) : "");
      setCarregado(true);
    });
  }, [clienteId, rotaBase]);

  async function salvar() {
    setMsg("");
    try {
      await api.put(`${rotaBase}/clientes/${clienteId}/notificacao`, {
        notifEmail: notifEmail || null,
        notifTelefone: notifTelefone || null,
        renovarEm: renovarEm || null,
      });
      setMsg("Salvo! O sistema vai usar esses dados pra mandar os avisos automáticos.");
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar.");
    }
  }

  if (!carregado) return <p className="text-sm text-renascer-ink/50">Carregando...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-renascer-ink/50">
        Cadastre um e-mail (e/ou telefone) pra receber os lembretes automáticos de sessão e de renovação — pode ser diferente do
        login do cliente. Também dá pra marcar a data prevista de renovação, pra avisarmos com antecedência.
      </p>
      <input className="input" placeholder="E-mail para notificação" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} />
      <input className="input" placeholder="Telefone para notificação" value={notifTelefone} onChange={(e) => setNotifTelefone(e.target.value)} />
      <div>
        <label className="text-sm text-renascer-ink/60 block mb-1">Data prevista de renovação</label>
        <input type="date" className="input" value={renovarEm} onChange={(e) => setRenovarEm(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={salvar}>
        Salvar
      </button>
      {msg && <p className="text-sm mt-1">{msg}</p>}
    </div>
  );
}

function NovoPacoteCliente({ clienteId }) {
  const [duracao, setDuracao] = useState("MIN50");
  const [totalSessoes, setTotalSessoes] = useState(4);
  const [valorTotal, setValorTotal] = useState("");
  const [msg, setMsg] = useState("");

  async function registrar() {
    setMsg("");
    try {
      const { data } = await api.post(`/profissional/clientes/${clienteId}/pacotes`, {
        duracao,
        totalSessoes: Number(totalSessoes),
        valorTotal: valorTotal ? Number(valorTotal) : undefined,
      });
      const repasseInfo = data.transacao
        ? ` Seu repasse: R$ ${data.transacao.valorProfissional.toFixed(2)} · Parte da Renascer (a repassar): R$ ${data.transacao.valorRenascer.toFixed(2)}.`
        : "";
      setMsg(`Pacote registrado! ${data.totalSessoes} sessão(ões) de ${data.duracao === "MIN30" ? "30min" : "50min"} liberadas.${repasseInfo}`);
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao registrar pacote.");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-renascer-ink/50">
        Use isso depois que o pagamento (Pix/cartão pelo WhatsApp) for confirmado, pra liberar as sessões do cliente no app.
      </p>
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
          <option value="MIN30">30 minutos</option>
          <option value="MIN50">50 minutos</option>
        </select>
        <select className="input !w-auto" value={totalSessoes} onChange={(e) => setTotalSessoes(e.target.value)}>
          <option value={1}>1 sessão</option>
          <option value={2}>2 sessões</option>
          <option value={4}>4 sessões</option>
        </select>
        <input className="input !w-40" placeholder="Valor (opcional)" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
        <button className="btn-primary" onClick={registrar}>
          Registrar pacote
        </button>
      </div>
      {msg && <p className="text-sm mt-1">{msg}</p>}
    </div>
  );
}

function ChatCliente({ clienteId }) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("mensagem");
  const [erro, setErro] = useState("");

  async function carregar() {
    const { data } = await api.get(`/profissional/clientes/${clienteId}/mensagens`);
    setMensagens(data);
  }
  useEffect(() => {
    carregar();
  }, [clienteId]);

  async function enviar() {
    if (!texto.trim()) return;
    setErro("");
    try {
      if (tipo === "recado_diario") {
        await api.post(`/profissional/clientes/${clienteId}/recado`, { texto });
      } else {
        await api.post(`/profissional/clientes/${clienteId}/mensagens`, { texto, tipo });
      }
      setTexto("");
      carregar();
    } catch (e) {
      setErro(e?.response?.data?.erro || "Não foi possível enviar a mensagem.");
    }
  }

  return (
    <div>
      <p className="text-xs text-renascer-ink/50 mb-2">
        Por segurança, não é permitido trocar telefone/WhatsApp por aqui — todo o contato é feito dentro do app.
      </p>
      <div className="h-56 overflow-y-auto border border-renascer/10 rounded-lg p-3 space-y-2 mb-3 bg-renascer-light/30">
        {mensagens.map((m) => (
          <div key={m.id} className={`text-sm ${m.autor === "PROFISSIONAL" ? "text-right" : ""}`}>
            <span className="inline-block bg-white px-3 py-1.5 rounded-lg border border-renascer/10">{m.texto}</span>
          </div>
        ))}
        {mensagens.length === 0 && <p className="text-xs text-renascer-ink/40">Sem mensagens ainda.</p>}
      </div>
      {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-2">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <select className="input !w-full sm:!w-56" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="mensagem">Mensagem</option>
          <option value="recado_diario">Recado do dia (imprevisto / o que vai trabalhar)</option>
        </select>
        <input className="input flex-1 min-w-0" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva..." />
        <button className="btn-primary" onClick={enviar}>
          Enviar
        </button>
      </div>
    </div>
  );
}

function RelatoriosCliente({ clienteId }) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function publicar() {
    await api.post(`/profissional/clientes/${clienteId}/relatorios`, { titulo, conteudo, visivelParaCliente: visivel });
    setTitulo("");
    setConteudo("");
    setVisivel(false);
    setEnviado(true);
    setTimeout(() => setEnviado(false), 3000);
  }

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Título do relatório" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <textarea className="input" rows={5} placeholder="Conteúdo do relatório" value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} />
        Tornar visível para o cliente
      </label>
      <button className="btn-primary" onClick={publicar} disabled={!titulo || !conteudo}>
        Salvar relatório
      </button>
      {enviado && <p className="text-emerald-600 text-sm">Relatório salvo!</p>}
    </div>
  );
}

// ---------------- FINANCEIRO ----------------
function AbaFinanceiro() {
  const [resumo, setResumo] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [valorCalc, setValorCalc] = useState("");
  const [repasse, setRepasse] = useState(null);
  const [tipo, setTipo] = useState("RENOVACAO");
  const [clienteId, setClienteId] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [valorManual, setValorManual] = useState("");
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function carregar() {
    const [r, c] = await Promise.all([api.get("/profissional/financeiro/resumo"), api.get("/profissional/clientes")]);
    setResumo(r.data);
    setClientes(c.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function calcular() {
    const { data } = await api.post("/profissional/financeiro/calcular", { valorTotal: Number(valorCalc) });
    setRepasse(data);
  }

  function lerArquivo(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
  }

  async function enviarComprovante() {
    setProcessando(true);
    setResultado(null);
    try {
      const imagemBase64 = arquivo ? await lerArquivo(arquivo) : null;
      const { data } = await api.post("/profissional/financeiro/comprovante", {
        clienteId: clienteId || undefined,
        tipoManual: tipo,
        imagemBase64,
        mimeType: arquivo?.type,
        valorManual: valorManual || undefined,
      });
      setResultado(data);
      setArquivo(null);
      setValorManual("");
      carregar();
    } catch (err) {
      setResultado({ erro: err?.response?.data?.erro || "Erro ao processar comprovante." });
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Faturado no mês (sua parte)</p>
          <p className="text-2xl font-bold text-renascer">R$ {resumo?.totalProfissional?.toFixed(2) ?? "0,00"}</p>
          <p className="text-xs text-renascer-ink/50 mt-1">Só o que é seu — não conta a parte que fica com a Renascer.</p>
        </div>
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Repasse Renascer</p>
          <p className="text-2xl font-bold text-renascer-ink/70">R$ {resumo?.totalRenascer?.toFixed(2) ?? "0,00"}</p>
        </div>
        <div className="card !border-amber-300 bg-amber-50">
          <p className="text-sm text-renascer-ink/60">Você ainda deve repassar</p>
          <p className="text-2xl font-bold text-amber-700">R$ {resumo?.totalPendenteRepassar?.toFixed(2) ?? "0,00"}</p>
          <p className="text-xs text-renascer-ink/50 mt-1">Dinheiro que você recebeu direto do cliente e ainda não repassou pra Renascer.</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Calculadora rápida de repasse</h3>
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1 min-w-[150px]" placeholder="Valor total recebido (ex: 170)" value={valorCalc} onChange={(e) => setValorCalc(e.target.value)} />
          <button className="btn-secondary" onClick={calcular}>
            Calcular
          </button>
        </div>
        {repasse && (
          <p className="mt-2 text-sm">
            Seu repasse: <strong>R$ {repasse.valorProfissional}</strong> · Renascer: <strong>R$ {repasse.valorRenascer}</strong>
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-1">Anexar renovação ou pagamento</h3>
        <p className="text-xs text-renascer-ink/50 mb-3">
          Escolha o cliente, coloque o valor e anexe o comprovante — o comprovante fica guardado pra poder ver depois, e o
          sistema já calcula sozinho quanto você vai receber (seu repasse). A IA tenta reconhecer o valor automaticamente
          pela imagem; se não conseguir, você confirma manualmente.
        </p>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Cliente (opcional)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.user.nome}
              </option>
            ))}
          </select>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="RENOVACAO">Renovação</option>
            <option value="SESSAO_EXTRA">Sessão extra</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
        <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files[0])} className="mb-2" />
        <input
          className="input mb-2"
          placeholder="Valor manual (opcional, se a IA não reconhecer)"
          value={valorManual}
          onChange={(e) => setValorManual(e.target.value)}
        />
        <button className="btn-primary" onClick={enviarComprovante} disabled={processando || (!arquivo && !valorManual)}>
          {processando ? "Processando..." : "Enviar comprovante"}
        </button>
        {resultado?.erro && <p className="text-red-600 text-sm mt-2">{resultado.erro}</p>}
        {resultado?.transacao && (
          <p className="text-emerald-600 text-sm mt-2">
            Registrado: R$ {resultado.transacao.valorTotal} (você vai receber R$ {resultado.transacao.valorProfissional})
            {resultado.transacao.reconhecidoPorIA ? " — reconhecido automaticamente pela IA." : " — valor manual."}
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-3">Transações do mês</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th className="py-1">Data</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Total</th>
              <th>Seu repasse</th>
              <th>Repasse à Renascer</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resumo?.transacoes?.map((t) => (
              <tr key={t.id} className="border-t border-renascer/10">
                <td className="py-1">{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                <td>{t.cliente?.user?.nome || "-"}</td>
                <td>
                  {TIPO_LABEL[t.tipo] || t.tipo}
                  {t.origem === "ATENDENTE" && (
                    <span className="block text-[10px] text-renascer-ink/40">fechado pela recepção</span>
                  )}
                </td>
                <td>R$ {t.valorTotal.toFixed(2)}</td>
                <td>R$ {t.valorProfissional.toFixed(2)}</td>
                <td>
                  {t.recebidoPor === "PROFISSIONAL" ? (
                    <LinhaRepasse t={t} onMudou={carregar} />
                  ) : (
                    <span className="text-renascer-ink/30 text-xs">recebido pela clínica</span>
                  )}
                </td>
                <td className="text-right">
                  {t.temComprovante ? (
                    <button className="text-renascer text-xs underline" onClick={() => verComprovante(t.id)}>
                      Ver comprovante
                    </button>
                  ) : (
                    <span className="text-renascer-ink/30 text-xs">sem comprovante</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {resumo?.transacoes?.length === 0 && <p className="text-sm text-renascer-ink/50 mt-2">Nenhuma transação neste mês.</p>}
      </div>
    </div>
  );
}

// Célula da tabela de Financeiro que cuida do ciclo de vida do repasse de UMA transação: antes
// de mandar qualquer coisa, mostra o botão pra anexar o comprovante; depois de enviado, fica
// "aguardando confirmação do dono" (não zera sozinho — só quando ele confirma do lado dele); e
// quando confirmado, mostra "Já repassado".
function LinhaRepasse({ t, onMudou }) {
  const [aberto, setAberto] = useState(false);
  const [arquivo, setArquivo] = useState(null);
  const [valorManual, setValorManual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  function lerArquivo(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
  }

  async function enviar() {
    setEnviando(true);
    setMsg("");
    try {
      const imagemBase64 = arquivo ? await lerArquivo(arquivo) : null;
      const { data } = await api.post(`/profissional/financeiro/${t.id}/repasse-comprovante`, {
        imagemBase64,
        mimeType: arquivo?.type,
        valorManual: valorManual || undefined,
      });
      setMsg(
        data.bateComEsperado === false
          ? "Comprovante enviado — mas o valor não bateu com o esperado, o dono vai conferir com atenção."
          : "Comprovante enviado! Agora é só aguardar o dono confirmar."
      );
      setArquivo(null);
      setValorManual("");
      setAberto(false);
      onMudou?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao enviar comprovante.");
    } finally {
      setEnviando(false);
    }
  }

  if (t.repassado) {
    return <span className="badge bg-emerald-100 text-emerald-700">Já repassado</span>;
  }

  if (t.repasseSolicitadoEm) {
    const bateComEsperado = t.repasseValorInformado == null || Math.abs(t.repasseValorInformado - t.valorRenascer) < 0.01;
    return (
      <div className="space-y-0.5">
        <span className="badge bg-amber-100 text-amber-700">Aguardando confirmação do dono</span>
        {t.repasseValorInformado != null && (
          <p className="text-[11px] text-renascer-ink/50">
            Valor no comprovante: R$ {t.repasseValorInformado.toFixed(2)}
            {!bateComEsperado && " — diferente do esperado"}
          </p>
        )}
        {t.temComprovanteRepasse && (
          <button className="text-renascer text-[11px] underline block" onClick={() => verComprovanteRepasse(t.id)}>
            Ver comprovante enviado
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {!aberto ? (
        <button className="text-amber-700 text-xs underline" onClick={() => setAberto(true)}>
          Enviar comprovante do repasse (R$ {t.valorRenascer.toFixed(2)})
        </button>
      ) : (
        <div className="bg-renascer-light/50 border border-renascer/10 rounded-lg p-2 space-y-1 min-w-[220px]">
          <input type="file" accept="image/*" className="text-xs" onChange={(e) => setArquivo(e.target.files[0])} />
          <input
            className="input !py-1 !text-xs"
            placeholder="Valor manual (se não anexar foto)"
            value={valorManual}
            onChange={(e) => setValorManual(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-primary !py-1 !px-2 text-xs"
              onClick={enviar}
              disabled={enviando || (!arquivo && !valorManual)}
            >
              {enviando ? "Enviando..." : "Enviar"}
            </button>
            <button className="text-xs text-renascer-ink/50 underline" onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {msg && <p className="text-[11px] mt-1">{msg}</p>}
    </div>
  );
}

// ---------------- NOTIFICAÇÕES ----------------
function AbaNotificacoes() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/comum/notificacoes").then((r) => setLista(r.data));
  }, []);
  return (
    <div className="card">
      <h2 className="font-semibold mb-3">Avisos de renovação e sistema</h2>
      <p className="text-sm text-renascer-ink/50 mb-3">
        Você recebe um aviso automático aqui sempre que um cliente estiver na 2ª ou 3ª sessão de um pacote de 4, ou faltando a última sessão de um pacote menor.
      </p>
      <div className="space-y-2">
        {lista.map((n) => (
          <div key={n.id} className={`border rounded-lg p-3 ${n.lida ? "border-renascer/10" : "border-renascer/40 bg-renascer-light/40"}`}>
            <p className="font-medium text-sm">{n.titulo}</p>
            <p className="text-sm text-renascer-ink/60">{n.mensagem}</p>
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-renascer-ink/40">Nenhum aviso por enquanto.</p>}
      </div>
    </div>
  );
}

// ---------------- CONFIGURAÇÃO / PERFIL + DISPONIBILIDADE ----------------
function AbaConfig() {
  const [perfil, setPerfil] = useState(null);
  const [disponibilidades, setDisponibilidades] = useState([]);

  async function carregarPerfil() {
    const r = await api.get("/profissional/perfil");
    setPerfil(r.data);
    setDisponibilidades(r.data.disponibilidades.map((d) => ({ diaSemana: d.diaSemana, horaInicio: d.horaInicio })));
  }
  useEffect(() => {
    carregarPerfil();
  }, []);

  if (!perfil) return <p>Carregando...</p>;

  const ocupados = (perfil.disponibilidades || [])
    .filter((d) => d.ocupadoPorCliente)
    .map((d) => ({ diaSemana: d.diaSemana, horaInicio: d.horaInicio, nome: d.ocupadoPorCliente.user.nome }));

  return (
    <div className="space-y-4">
      <PerfilCompleto perfil={perfil} onAtualizado={carregarPerfil} />
      <DisponibilidadeSemanal
        disponibilidades={disponibilidades}
        setDisponibilidades={setDisponibilidades}
        ocupados={ocupados}
        salvar={(disp) => api.put("/profissional/disponibilidades", { disponibilidades: disp })}
      />
    </div>
  );
}

function PerfilCompleto({ perfil, onAtualizado }) {
  const [nome, setNome] = useState(perfil.user.nome || "");
  const [titulo, setTitulo] = useState(perfil.titulo || "");
  const [registro, setRegistro] = useState(perfil.registro || "");
  const [idade, setIdade] = useState(perfil.idade || "");
  const [bio, setBio] = useState(perfil.bio || "");
  const [abordagens, setAbordagens] = useState(perfil.abordagens || "");
  const [linkMeet, setLinkMeet] = useState(perfil.linkMeet || "");
  const [especialidades, setEspecialidades] = useState(perfil.especialidades || []);
  const [foto, setFoto] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  function alternarCategoria(cat) {
    setEspecialidades((atual) => (atual.includes(cat) ? atual.filter((c) => c !== cat) : [...atual, cat]));
  }

  function lerArquivo(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  async function salvar() {
    setSalvando(true);
    setMsg("");
    try {
      const fotoBase64 = foto ? await lerArquivo(foto) : undefined;
      await api.put("/profissional/perfil", {
        nome,
        titulo,
        registro,
        idade: idade || null,
        bio,
        abordagens,
        especialidades,
        linkMeet,
        ...(fotoBase64 && { fotoBase64 }),
      });
      setMsg("Perfil atualizado! A atendente já vê essas informações pra te encaixar certinho.");
      setFoto(null);
      onAtualizado();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar perfil.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Seu perfil (o que a atendente e o time vê de você)</h2>
      <div className="flex items-center gap-4">
        <img
          src={foto ? URL.createObjectURL(foto) : perfil.user.fotoUrl || "https://via.placeholder.com/80?text=Foto"}
          alt="Foto de perfil"
          className="w-20 h-20 rounded-full object-cover border border-renascer/20"
        />
        <div>
          <label className="text-sm text-renascer-ink/60 block mb-1">Trocar foto</label>
          <input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files[0])} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <input className="input" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="input" placeholder="Idade" type="number" value={idade} onChange={(e) => setIdade(e.target.value)} />
        <input className="input" placeholder="Categoria (ex: Psicóloga Clínica, Psicanalista)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <input className="input" placeholder="Registro / CRP (se tiver)" value={registro} onChange={(e) => setRegistro(e.target.value)} />
        <input className="input sm:col-span-2" placeholder="Abordagem (ex: TCC, Psicanálise)" value={abordagens} onChange={(e) => setAbordagens(e.target.value)} />
      </div>

      <div>
        <p className="text-sm text-renascer-ink/60 mb-1">O que você atende</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS_SUGERIDAS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => alternarCategoria(cat)}
              className={`text-sm px-3 py-1.5 rounded-full border ${
                especialidades.includes(cat) ? "bg-renascer text-white border-renascer" : "border-renascer/20 text-renascer-ink/70"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <textarea className="input" rows={3} placeholder="Bio curta" value={bio} onChange={(e) => setBio(e.target.value)} />

      <div>
        <label className="text-sm text-renascer-ink/60 block mb-1">
          Link fixo da sua sala no Google Meet (usado em todas as suas sessões)
        </label>
        <input
          className="input"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={linkMeet}
          onChange={(e) => setLinkMeet(e.target.value)}
        />
        <p className="text-xs text-renascer-ink/50 mt-1">
          Pra criar: entre no Google Meet, clique em "Nova reunião" → "Iniciar uma reunião instantânea" (ou "Criar reunião para mais tarde") e copie o link gerado aqui.
        </p>
      </div>

      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar perfil"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
