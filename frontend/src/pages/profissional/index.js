import { useEffect, useState } from "react";
import LayoutNovo from "../../components/LayoutNovo";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { verComprovante, verComprovanteRepasse } from "../../lib/comprovante";
import DisponibilidadeSemanal from "../../components/DisponibilidadeSemanal";
import StatusCliente from "../../components/StatusCliente";
import SituacaoCliente from "../../components/SituacaoCliente";
import IndicadorPresenca from "../../components/IndicadorPresenca";
import ChecklistMeuDia from "../../components/ChecklistMeuDia";

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
  REALIZADO: "bg-nv-green/10 text-nv-green",
  CANCELADO: "bg-red-100 text-red-700",
  REAGENDADO: "bg-amber-100 text-amber-700",
  FALTOU: "bg-gray-200 text-gray-600",
};

export default function AreaProfissional() {
  const { user, carregando } = useAuth("PROFISSIONAL");
  const [aba, setAba] = useState("agenda");
  const [qtdNovosPacientes, setQtdNovosPacientes] = useState(0);

  useEffect(() => {
    if (carregando) return;
    api.get("/profissional/novos-pacientes").then((r) => setQtdNovosPacientes(r.data.length)).catch(() => {});
  }, [carregando, aba]);

  if (carregando) return null;

  // Fase 51 — "Meu dia" saiu do menu da Profissional: o canvas (fonte de verdade do layout) nunca
  // teve esse item pra ela, só pro Dono e pra Atendente. O componente continua no arquivo (só não
  // é mais renderizado) pra não perder o código à toa.
  const ABAS = [
    { id: "agenda", label: "Minha agenda" },
    { id: "novos", label: qtdNovosPacientes > 0 ? `Novos pacientes (${qtdNovosPacientes})` : "Novos pacientes" },
    { id: "clientes", label: "Meus clientes" },
    { id: "cadastrar", label: "Cadastrar cliente" },
    { id: "financeiro", label: "Financeiro" },
    { id: "notificacoes", label: "Avisos" },
    { id: "config", label: "Disponibilidade" },
  ];

  return (
    <LayoutNovo user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "agenda" && <AbaAgenda />}
      {aba === "novos" && <AbaNovosPacientes />}
      {aba === "clientes" && <AbaClientes />}
      {aba === "cadastrar" && <AbaCadastrarCliente />}
      {aba === "financeiro" && <AbaFinanceiro />}
      {aba === "notificacoes" && <AbaNotificacoes />}
      {aba === "config" && <AbaConfig />}
    </LayoutNovo>
  );
}

const DIAS_LABEL_NOVOS = { SEGUNDA: "Segunda", TERCA: "Terça", QUARTA: "Quarta", QUINTA: "Quinta", SEXTA: "Sexta", SABADO: "Sábado", DOMINGO: "Domingo" };
const DURACAO_LABEL_NOVOS = { MIN30: "30min", MIN50: "50min" };

// Fase 55 — "Novos pacientes": fila de cadastros feitos pela Atendente/Dono esperando o aceite da
// profissional. Aceitar é o que cria o pacote, lança as sessões na Agenda (se veio dia/hora fixo)
// e confirma o pagamento já recebido (se informado) — só então vira receita de verdade.
export function AbaNovosPacientes() {
  const [pedidos, setPedidos] = useState(null);
  const [processandoId, setProcessandoId] = useState(null);
  const [resultadoPorId, setResultadoPorId] = useState({});
  const [msg, setMsg] = useState("");

  async function carregar() {
    const { data } = await api.get("/profissional/novos-pacientes");
    setPedidos(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function aceitar(p) {
    setProcessandoId(p.id);
    setMsg("");
    try {
      const { data } = await api.post(`/profissional/novos-pacientes/${p.id}/aceitar`);
      // Não recarrega agora de propósito: o pedido já não volta mais (virou ACEITA no servidor),
      // mas queremos continuar mostrando a confirmação na tela até ela sair da aba/recarregar.
      setResultadoPorId((r) => ({ ...r, [p.id]: data }));
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao aceitar paciente.");
    } finally {
      setProcessandoId(null);
    }
  }

  async function recusar(p) {
    if (!window.confirm(`Recusar o cadastro de ${p.nome}? Isso desfaz o cadastro por completo — use só se não era pra você.`)) return;
    setProcessandoId(p.id);
    setMsg("");
    try {
      await api.delete(`/profissional/novos-pacientes/${p.id}`);
      carregar();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao recusar.");
    } finally {
      setProcessandoId(null);
    }
  }

  if (!pedidos) return <p className="text-sm text-nv-muted">Carregando...</p>;

  return (
    <div className="font-publicSans space-y-4">
      <div className="mb-1">
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Novos pacientes</h1>
        <p className="text-nv-muted text-sm mt-0.5">
          Cadastros feitos pela recepção/dono esperando você aceitar — ao aceitar, já confirma na sua agenda e no financeiro.
        </p>
      </div>

      {msg && <p className="text-red-600 text-sm">{msg}</p>}

      {pedidos.length === 0 && <p className="nv-card text-sm text-nv-muted">Nenhum pedido pendente no momento.</p>}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const resultado = resultadoPorId[p.id];
          return (
            <div key={p.id} className="nv-card">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-sora font-semibold text-nv-ink">{p.nome}</p>
                  <p className="text-xs text-nv-muted3">
                    {p.whatsapp && `${p.whatsapp} · `}
                    cadastrado por {p.criadoPorNome}
                  </p>
                </div>
                {!resultado && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn-secondary !text-xs !px-3 !py-1.5 text-red-600"
                      disabled={processandoId === p.id}
                      onClick={() => recusar(p)}
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      className="btn-primary !text-xs !px-3.5 !py-1.5"
                      disabled={processandoId === p.id}
                      onClick={() => aceitar(p)}
                    >
                      {processandoId === p.id ? "Aceitando..." : "Aceitar"}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-nv-muted2">
                {p.totalSessoes && (
                  <span>
                    Pacote: {p.totalSessoes} sessões · {DURACAO_LABEL_NOVOS[p.duracao] || p.duracao}
                  </span>
                )}
                {p.diaSemanaFixo && p.horaFixa && (
                  <span>
                    Dia/horário combinado: {DIAS_LABEL_NOVOS[p.diaSemanaFixo]}, {p.horaFixa}
                  </span>
                )}
                {p.valorTotal != null && <span>Pagamento já recebido: R$ {p.valorTotal.toFixed(2)}</span>}
                {!p.totalSessoes && !p.diaSemanaFixo && p.valorTotal == null && <span>Sem pacote/dia fixo/pagamento informado ainda.</span>}
              </div>

              {resultado && (
                <div className="text-sm mt-3 space-y-1 border-t border-nv-borderLight pt-3">
                  <p className="text-nv-green">Paciente aceito!</p>
                  {resultado.agendamentos?.length > 0 && (
                    <p className="text-nv-green">{resultado.agendamentos.length} sessão(ões) já criadas direto na sua Agenda ✅</p>
                  )}
                  {resultado.avisoAgenda && <p className="text-amber-700">{resultado.avisoAgenda}</p>}
                  {resultado.transacao && (
                    <p className="text-nv-green">
                      Pagamento contabilizado! Seu repasse: R$ {resultado.transacao.valorProfissional.toFixed(2)} · Parte da
                      Renascer (você ainda deve repassar): R$ {resultado.transacao.valorRenascer.toFixed(2)}
                    </p>
                  )}
                  {resultado.avisoFinanceiro && <p className="text-amber-700">{resultado.avisoFinanceiro}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- CADASTRAR CLIENTE ANTIGO (sem depender da recepção) ----------------
const FORM_CADASTRO_VAZIO = {
  nome: "",
  telefone: "",
  duracao: "MIN50",
  totalSessoes: 4,
  diaSemanaFixo: "",
  horaFixa: "",
};

// Fase 51 — "há quanto tempo" compacto pro card de "Cadastrados recentemente por mim".
function formatarHaQuanto(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "agora há pouco";
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return diffD === 1 ? "ontem" : `há ${diffD} dias`;
}

export function AbaCadastrarCliente() {
  const [total, setTotal] = useState(null);
  const [form, setForm] = useState(FORM_CADASTRO_VAZIO);
  const [sessoesExtras, setSessoesExtras] = useState(0); // local-only, decorativo (igual o mock do canvas)
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState("");
  const [recentes, setRecentes] = useState([]);
  const [excluindoId, setExcluindoId] = useState(null);

  async function carregarTotal() {
    const { data } = await api.get("/profissional/clientes");
    setTotal(data.length);
  }
  async function carregarRecentes() {
    const { data } = await api.get("/profissional/clientes/recentes");
    setRecentes(data);
  }
  useEffect(() => {
    carregarTotal();
    carregarRecentes();
  }, []);

  async function cadastrar() {
    setMsg("");
    setResultado(null);
    try {
      const { data } = await api.post("/profissional/clientes", {
        nome: form.nome,
        telefone: form.telefone,
        duracao: form.duracao,
        totalSessoes: Number(form.totalSessoes),
        diaSemanaFixo: form.diaSemanaFixo || undefined,
        horaFixa: form.horaFixa || undefined,
      });
      setResultado(data);
      setForm(FORM_CADASTRO_VAZIO);
      setSessoesExtras(0);
      carregarTotal();
      carregarRecentes();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao cadastrar cliente.");
    }
  }

  async function excluirRecente(c) {
    if (!window.confirm(`Excluir o cadastro de ${c.nome}? Isso desfaz o cadastro por completo (e avisa o Dono).`)) return;
    setExcluindoId(c.id);
    try {
      await api.delete(`/profissional/clientes/${c.id}/recente`);
      carregarRecentes();
      carregarTotal();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Não foi possível excluir esse cadastro.");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="font-publicSans space-y-4">
      <div className="mb-1">
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Cadastrar cliente</h1>
      </div>

      <div className="nv-card">
        <p className="text-sm text-nv-muted">Seus clientes no Espaço do Renascer</p>
        <p className="font-sora text-3xl font-bold text-nv-blue">{total === null ? "..." : total}</p>
      </div>

      <div className="nv-card">
        <h2 className="font-sora font-semibold text-nv-ink mb-1">Cadastrar cliente que você já atende</h2>
        <p className="text-xs text-nv-muted mb-3">
          Nome e WhatsApp já bastam — o login é gerado sozinho. Preenchendo o pacote e o dia/horário fixo, a agenda dela já
          sai pronta.
        </p>

        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input
            className="input"
            placeholder="WhatsApp"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />
        </div>

        <div className="border-t border-nv-borderLight mt-4 pt-4">
          <p className="text-sm font-semibold text-nv-ink mb-2">Pacote</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-nv-muted mb-1.5">Sessões no pacote</p>
              <div className="flex gap-1.5">
                {[4, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`nv-seg ${Number(form.totalSessoes) === n ? "nv-seg-ativo" : ""}`}
                    onClick={() => setForm({ ...form, totalSessoes: n })}
                  >
                    {n} sessões
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-nv-muted mb-1.5">Duração</p>
              <div className="flex gap-1.5">
                {[["MIN30", "30 min"], ["MIN50", "50 min"]].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className={`nv-seg ${form.duracao === v ? "nv-seg-ativo" : ""}`}
                    onClick={() => setForm({ ...form, duracao: v })}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-xs text-nv-muted mb-1.5">Sessões extras</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-nv-bg text-nv-ink2 font-bold flex items-center justify-center"
                onClick={() => setSessoesExtras((n) => Math.max(0, n - 1))}
              >
                −
              </button>
              <span className="font-sora font-bold text-nv-ink text-sm w-5 text-center">{sessoesExtras}</span>
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-nv-bg text-nv-ink2 font-bold flex items-center justify-center"
                onClick={() => setSessoesExtras((n) => n + 1)}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-nv-borderLight mt-4 pt-4">
          <p className="text-sm font-semibold text-nv-ink mb-2">Dia e horário fixo</p>
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
          Cadastrar e gerar agenda
        </button>
        {msg && <p className="text-red-600 text-sm mt-2">{msg}</p>}
        {resultado && (
          <div className="text-sm mt-2 space-y-1">
            <p className="text-nv-green">
              Cliente cadastrado! Login: <strong>{resultado.email}</strong> · Senha provisória:{" "}
              <strong>{resultado.senhaProvisoria}</strong> (repasse isso pro cliente por um canal seguro)
            </p>
            {resultado.transacao && (
              <p className="text-nv-green">
                Pagamento contabilizado! Seu repasse: R$ {resultado.transacao.valorProfissional.toFixed(2)} · Parte da
                Renascer (você ainda deve repassar): R$ {resultado.transacao.valorRenascer.toFixed(2)}
              </p>
            )}
            {resultado.avisoFinanceiro && <p className="text-amber-700">{resultado.avisoFinanceiro}</p>}
            {resultado.agendamentos?.length > 0 && (
              <p className="text-nv-green">{resultado.agendamentos.length} sessão(ões) já criadas direto na sua Agenda ✅</p>
            )}
            {resultado.avisoAgenda && <p className="text-amber-700">{resultado.avisoAgenda}</p>}
          </div>
        )}
      </div>

      <div className="nv-card">
        <h3 className="font-sora font-semibold text-nv-ink mb-1">Cadastrados recentemente por mim</h3>
        <p className="text-xs text-nv-muted mb-3">Últimas 48h — dá pra desfazer se foi engano.</p>
        <div className="flex flex-col gap-2">
          {recentes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 bg-nv-bg rounded-[10px] px-3 py-2">
              <div>
                <p className="text-[13px] font-semibold text-nv-ink">{c.nome}</p>
                <p className="text-[11px] text-nv-muted3">{formatarHaQuanto(c.criadoEm)}</p>
              </div>
              <button
                type="button"
                className="text-red-600 text-xs font-semibold underline disabled:opacity-50"
                disabled={excluindoId === c.id}
                onClick={() => excluirRecente(c)}
              >
                {excluindoId === c.id ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          ))}
          {recentes.length === 0 && <p className="text-xs text-nv-muted3">Nenhum cadastro seu nas últimas 48h.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------- AGENDA (estilo Trello por dia) ----------------
const NOMES_MES_AGENDA = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA_CURTO_AGENDA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dataISO(ano, mesIndex, dia) {
  const mm = String(mesIndex + 1).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

// Fase 51 — "Sua semana" virou um calendário de mês de verdade, igual ao "Agenda geral" do Dono
// (o Elismael pediu "quadro gigante de calendário" no lugar daquele quadro semanal por dia). O
// botão "Entrar na videochamada" também saiu daqui — o atendimento não é mais feito pelo sistema,
// então profissional (e cliente, na própria aba dela) perdem esse "iniciar sessão".
export function AbaAgenda() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [clientes, setClientes] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(hoje.getDate());
  const [novaSessaoAberta, setNovaSessaoAberta] = useState(false);
  const [reagendando, setReagendando] = useState(null);

  async function carregar() {
    const [a, c] = await Promise.all([
      api.get(`/profissional/agenda?mes=${mesIndex + 1}&ano=${ano}`),
      api.get("/profissional/clientes"),
    ]);
    setLista(a.data);
    setClientes(c.data);
  }
  useEffect(() => {
    carregar();
    setDiaSelecionado(hoje.getFullYear() === ano && hoje.getMonth() === mesIndex ? hoje.getDate() : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesIndex, ano]);

  function mudarMes(delta) {
    let novoMes = mesIndex + delta;
    let novoAno = ano;
    if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    } else if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    }
    setMesIndex(novoMes);
    setAno(novoAno);
  }

  async function mudarStatus(id, status) {
    await api.put(`/profissional/agenda/${id}/status`, { status });
    carregar();
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

  if (!lista) return <p className="text-sm text-nv-muted">Carregando agenda...</p>;

  const porDia = {};
  for (const ag of lista) {
    const dia = new Date(ag.data).getDate();
    (porDia[dia] = porDia[dia] || []).push(ag);
  }
  const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay();
  const diasNoMes = new Date(ano, mesIndex + 1, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const agendamentosDoDia = (porDia[diaSelecionado] || []).sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Agenda</h1>
        <p className="text-xs text-nv-muted mt-0.5">
          {NOMES_MES_AGENDA[mesIndex]} de {ano} · clique num dia pra ver os agendamentos
        </p>
      </div>
      {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">{erro}</p>}
      <div className="flex items-center gap-2 mb-3">
        <button className="nv-seg rounded-lg" onClick={() => mudarMes(-1)}>
          ← Mês anterior
        </button>
        <button className="nv-seg rounded-lg" onClick={() => mudarMes(1)}>
          Próximo mês →
        </button>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        <div className="flex-[3_1_560px] nv-card">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DIAS_SEMANA_CURTO_AGENDA.map((d) => (
              <div key={d} className="text-center text-[11px] font-bold text-nv-muted3 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {celulas.map((dia, i) => {
              if (dia === null) return <div key={i} className="min-h-[86px]" />;
              const doDia = porDia[dia] || [];
              const chips = doDia.slice(0, 2);
              const selecionado = dia === diaSelecionado;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDiaSelecionado(dia)}
                  className={`text-left rounded-[10px] p-1.5 border min-h-[86px] flex flex-col gap-1 transition-shadow hover:shadow-md ${
                    selecionado ? "border-nv-blue shadow-md" : "border-nv-borderLight"
                  } bg-white`}
                >
                  <span className={`text-xs font-bold ${selecionado ? "text-nv-blue" : "text-nv-ink2"}`}>{dia}</span>
                  {chips.map((ag) => (
                    <span key={ag.id} className="text-[10px] font-semibold text-white bg-nv-blue rounded px-1.5 py-0.5 truncate">
                      {ag.horaInicio} {ag.cliente.user.nome}
                    </span>
                  ))}
                  {doDia.length > 2 && <span className="text-[10px] text-nv-muted3 font-semibold">+{doDia.length - 2} mais</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-[1_1_300px] nv-card self-start">
          <div className="flex items-center justify-between mb-2">
            <p className="font-sora font-semibold text-sm text-nv-ink">
              Dia {diaSelecionado} · {NOMES_MES_AGENDA[mesIndex]}
            </p>
            <button
              className="text-nv-blue text-base leading-none w-6 h-6 rounded-full border border-nv-blue/30 hover:bg-nv-blue/10"
              title="Adicionar sessão de um cliente já cadastrado nesse dia"
              onClick={() => setNovaSessaoAberta(true)}
            >
              +
            </button>
          </div>
          {agendamentosDoDia.length === 0 && <p className="text-xs text-nv-muted3">Nenhum agendamento nesse dia.</p>}
          <div className="space-y-2">
            {agendamentosDoDia.map((ag) => {
              const podeMudar = ag.status !== "REALIZADO" && ag.status !== "CANCELADO";
              return (
                <div key={ag.id} className="border border-nv-borderLight rounded-lg p-2 bg-nv-bg">
                  <p className="text-sm font-medium text-nv-ink2 flex items-center gap-1.5">
                    <StatusCliente status={ag.statusCliente} />
                    {ag.horaInicio} · {ag.cliente.user.nome}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span className={`badge ${STATUS_COR[ag.status]}`}>{ag.status}</span>
                    {ag.pacote && (
                      <span className="badge bg-nv-blue/10 text-nv-blue" title="Sessões realizadas / total do pacote">
                        {ag.pacote.sessoesUsadas}/{ag.pacote.totalSessoes} sessões
                      </span>
                    )}
                  </div>
                  {podeMudar && (
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <button className="text-xs text-nv-green underline" onClick={() => mudarStatus(ag.id, "REALIZADO")}>
                        Realizada
                      </button>
                      <button className="text-xs text-red-600 underline" onClick={() => mudarStatus(ag.id, "CANCELADO")}>
                        Cancelar
                      </button>
                      <button className="text-xs text-nv-blue underline" onClick={() => setReagendando(ag)}>
                        Mudar data/horário
                      </button>
                    </div>
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
      </div>

      {novaSessaoAberta && (
        <NovaSessaoModal
          dataInicial={dataISO(ano, mesIndex, diaSelecionado)}
          diaLabel={`${diaSelecionado}/${mesIndex + 1}`}
          clientes={clientes}
          onAgendado={() => {
            setNovaSessaoAberta(false);
            carregar();
          }}
          onFechar={() => setNovaSessaoAberta(false)}
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
          <h3 className="font-sora font-semibold text-nv-ink text-lg">Mudar data/horário · {agendamento.cliente.user.nome}</h3>
          <button className="text-nv-muted3 hover:text-nv-ink text-2xl leading-none" onClick={onFechar} title="Fechar">
            ×
          </button>
        </div>
        <p className="text-xs text-nv-muted">
          Data e horário atuais: {new Date(agendamento.data).toLocaleDateString("pt-BR")} às {agendamento.horaInicio}.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-nv-muted block mb-1">Nova data</label>
            <input type="date" className="input" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-nv-muted block mb-1">Novo horário</label>
            <input type="time" className="input" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-nv-muted block mb-1">Motivo (opcional, o cliente vê no aviso)</label>
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
// Fase 51 — ganhou o prop "dataInicial": quando a Agenda já sabe a data exata (o dia clicado no
// calendário de mês), usa ela direto, em vez de calcular "próxima ocorrência desse dia da semana"
// (que podia pular pro mês seguinte quando o dia clicado já tinha passado nesse mês).
function NovaSessaoModal({ diaSemana, dataInicial, diaLabel, clientes, onAgendado, onFechar }) {
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState(dataInicial || proximaDataDoDia(diaSemana));
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
          <h3 className="font-sora font-semibold text-nv-ink text-lg">Nova sessão · {diaLabel}</h3>
          <button className="text-nv-muted3 hover:text-nv-ink text-2xl leading-none" onClick={onFechar} title="Fechar">
            ×
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-nv-muted block mb-1">Cliente</label>
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
            <label className="text-xs font-medium text-nv-muted block mb-1">Data</label>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-nv-muted block mb-1">Duração</label>
            <select className="input" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
              <option value="MIN30">30 minutos</option>
              <option value="MIN50">50 minutos</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-nv-muted block mb-1">Horário</label>
          {buscando && <p className="text-xs text-nv-muted3">Buscando horários livres...</p>}
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
                      ? "bg-nv-blue text-white border-nv-blue"
                      : "border-nv-border text-nv-ink2 hover:border-nv-blue/50"
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

// ---------------- CLIENTES (lista + ficha completa) ----------------
// Fase 52 — redesenhada igual ao canvas "Meus clientes": lista com busca e filtro de quem está
// aguardando renovação, e a ficha abre em tela cheia (não mais numa coluna ao lado) com 3 abas —
// Dados, Prontuário e evolução, Financeiro — e um botão "Agendar sessão" sempre à mão no topo. O
// chat interno foi removido (o Elismael pediu pra tirar, não é mais usado).
export function AbaClientes() {
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selecionadoId, setSelecionadoId] = useState(null);

  async function carregar() {
    const { data } = await api.get("/profissional/clientes");
    setClientes(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  if (selecionadoId) {
    return (
      <FichaCliente
        clienteId={selecionadoId}
        onVoltar={() => setSelecionadoId(null)}
        onMudouSituacao={() => {
          carregar();
          setSelecionadoId(null);
        }}
      />
    );
  }

  const filtrados = clientes
    .filter((c) => (filtro === "renovar" ? c.statusCliente !== "VERDE" : true))
    .filter((c) => c.user.nome.toLowerCase().includes(busca.toLowerCase()))
    .slice()
    .sort((a, b) => a.user.nome.localeCompare(b.user.nome));

  return (
    <div className="space-y-4 font-publicSans">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="nv-eyebrow mb-1">Painel da Profissional</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Meus clientes</h1>
          <p className="text-nv-muted text-sm mt-0.5">{clientes.length} cliente(s) em ordem alfabética</p>
        </div>
        <input className="input !w-56" placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="flex gap-2">
        {[
          ["todos", "Todos"],
          ["renovar", "Aguardando renovação"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            className={`text-[13px] px-3.5 py-1.5 rounded-[9px] font-semibold ${
              filtro === id ? "bg-nv-blue text-white" : "bg-white text-nv-muted border border-nv-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="nv-card !p-0 divide-y divide-nv-borderLight">
        {filtrados.map((c) => {
          const pacote = c.pacotes?.[0];
          const aguardando = c.statusCliente !== "VERDE";
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelecionadoId(c.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-nv-bg transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <StatusCliente status={c.statusCliente} />
                <div className="min-w-0">
                  <p className="font-semibold text-nv-ink2 text-[14px] truncate">{c.user.nome}</p>
                  <p className="text-xs text-nv-muted3 truncate">
                    {pacote ? `Pacote ${pacote.totalSessoes} sessões · ${pacote.duracao === "MIN30" ? "30min" : "50min"}` : "Sem pacote ativo"}
                    {" · contrato desde "}
                    {new Date(c.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[11.5px] font-semibold whitespace-nowrap ${aguardando ? "text-[#D6883B]" : "text-nv-green"}`}>
                  {aguardando ? "Aguardando renovação" : "Ativo"}
                </span>
                <span className="text-nv-blue text-[12.5px] font-semibold whitespace-nowrap">Ver ficha →</span>
              </div>
            </button>
          );
        })}
        {filtrados.length === 0 && <p className="text-sm text-nv-muted px-4 py-6">Nenhum cliente encontrado.</p>}
      </div>
    </div>
  );
}

const TABS_FICHA_CLIENTE = [
  ["dados", "Dados"],
  ["prontuario", "Prontuário e evolução"],
  ["financeiro", "Financeiro"],
];

// Fase 52 — ficha do cliente em tela cheia, igual ao canvas: cabeçalho com pacote/status +
// "Agendar sessão" sempre visível, e as 3 abas (Dados / Prontuário e evolução / Financeiro).
// Busca o cliente completo direto pelo id (pacotes, horário fixo, relatórios, transações), em
// vez de depender do resumo da listagem.
function FichaCliente({ clienteId, onVoltar, onMudouSituacao }) {
  const [detalhe, setDetalhe] = useState(null);
  const [abaFicha, setAbaFicha] = useState("dados");
  const [agendando, setAgendando] = useState(false);

  async function carregar() {
    const { data } = await api.get(`/profissional/clientes/${clienteId}`);
    setDetalhe(data);
  }
  useEffect(() => {
    setDetalhe(null);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const voltar = (
    <button type="button" onClick={onVoltar} className="text-nv-blue text-xs font-semibold underline">
      ← Meus clientes
    </button>
  );

  if (!detalhe) {
    return (
      <div className="space-y-3 font-publicSans">
        {voltar}
        <p className="text-sm text-nv-muted">Carregando ficha...</p>
      </div>
    );
  }

  const iniciais = detalhe.user.nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const pacote = detalhe.pacotes?.[0];
  const horarioFixo = detalhe.horariosFixos?.[0];

  return (
    <div className="space-y-4 font-publicSans">
      {voltar}

      <div className="nv-card">
        <div className="flex items-center justify-between gap-3 flex-wrap pb-3.5 mb-3.5 border-b border-nv-borderLight">
          <div className="flex items-center gap-3 min-w-0">
            {detalhe.user.fotoUrl ? (
              <img src={detalhe.user.fotoUrl} alt={detalhe.user.nome} className="w-11 h-11 rounded-full object-cover border border-nv-border shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-sora font-bold text-sm text-white shrink-0 bg-nv-blue">
                {iniciais}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-sora font-bold text-nv-ink truncate">{detalhe.user.nome}</p>
              <p className="text-xs text-nv-muted3 truncate">
                {detalhe.user.telefone}
                {detalhe.user.email ? ` · ${detalhe.user.email}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              {pacote && (
                <p className="text-[11px] text-nv-muted3 mb-0.5">
                  pacote atual · {pacote.sessoesUsadas}/{pacote.totalSessoes} sessões · {pacote.duracao === "MIN30" ? "30min" : "50min"}
                </p>
              )}
              <StatusCliente status={detalhe.statusCliente} mostrarLabel />
            </div>
            <button type="button" className="btn-primary !text-xs !px-3.5 !py-2 whitespace-nowrap" onClick={() => setAgendando(true)}>
              Agendar sessão
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {TABS_FICHA_CLIENTE.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAbaFicha(id)}
              className={`text-sm px-3 py-1.5 rounded-full font-semibold transition-colors ${
                abaFicha === id ? "bg-nv-blue text-white" : "bg-white text-nv-muted border border-nv-borderLight"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {abaFicha === "dados" && (
          <FichaDados detalhe={detalhe} pacote={pacote} horarioFixo={horarioFixo} onAtualizado={carregar} onMudouSituacao={onMudouSituacao} />
        )}
        {abaFicha === "prontuario" && <FichaProntuario clienteId={clienteId} relatorios={detalhe.relatorios} onNovo={carregar} />}
        {abaFicha === "financeiro" && <FichaFinanceiroCliente transacoes={detalhe.transacoes} />}
      </div>

      {agendando && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAgendando(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sora font-semibold text-nv-ink text-lg">Agendar sessão</h3>
              <button className="text-nv-muted3 hover:text-nv-ink text-2xl leading-none" onClick={() => setAgendando(false)} title="Fechar">
                ×
              </button>
            </div>
            <AgendarSessaoCliente clienteId={clienteId} clienteNome={detalhe.user.nome} />
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor, destaque }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold text-nv-muted uppercase tracking-[0.04em] mb-0.5">{label}</p>
      <p className={`text-[13.5px] font-semibold ${destaque ? "text-nv-blue" : "text-nv-ink2"}`}>{valor}</p>
    </div>
  );
}

// Fase 52 — aba "Dados": o resumo igual ao canvas (nome, WhatsApp, horário fixo, duração,
// sessões pendentes e renovação). As ações que antes eram abas separadas ficam recolhidas
// embaixo (agendar já virou o botão do topo) — registrar pacote, contato de notificação/data de
// renovação e corrigir login — pra não poluir a tela com tudo aberto de uma vez.
function FichaDados({ detalhe, pacote, horarioFixo, onAtualizado, onMudouSituacao }) {
  const [abrirMais, setAbrirMais] = useState(null); // "pacote" | "notificacao" | "login" | null

  const sessoesPendentes = pacote ? pacote.totalSessoes - pacote.sessoesUsadas : 0;
  const horarioFixoLabel = horarioFixo ? `${DIAS.find(([v]) => v === horarioFixo.diaSemana)?.[1]}s, ${horarioFixo.horaInicio}` : "Sem horário fixo";
  const renovacaoLabel = detalhe.renovarEm
    ? `Renovação prevista em ${new Date(detalhe.renovarEm).toLocaleDateString("pt-BR")}`
    : "Sem data de renovação cadastrada";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 bg-nv-bg rounded-xl p-4">
        <Campo label="Nome completo" valor={detalhe.user.nome} />
        <Campo label="WhatsApp" valor={detalhe.user.telefone || "-"} />
        <Campo label="Horário fixo" valor={horarioFixoLabel} />
        <Campo label="Duração da sessão" valor={pacote ? (pacote.duracao === "MIN30" ? "30 minutos" : "50 minutos") : "-"} />
        <Campo label="Sessões pendentes" valor={pacote ? `${sessoesPendentes} restantes do pacote atual` : "Sem pacote ativo"} />
        <Campo label="Renovação" valor={renovacaoLabel} destaque={!!detalhe.renovarEm} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          ["pacote", "Registrar pacote / renovação"],
          ["notificacao", "Contato de notificação e renovação"],
          ["login", "Corrigir login"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAbrirMais(abrirMais === id ? null : id)}
            className={`text-[12.5px] px-3 py-1.5 rounded-[8px] font-semibold border ${
              abrirMais === id ? "bg-nv-navy text-white border-nv-navy" : "bg-white text-nv-muted border-nv-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {abrirMais === "pacote" && (
        <div className="border-t border-nv-borderLight pt-3.5">
          <NovoPacoteCliente clienteId={detalhe.id} onRegistrado={onAtualizado} />
        </div>
      )}
      {abrirMais === "notificacao" && (
        <div className="border-t border-nv-borderLight pt-3.5">
          <NotificacaoCliente clienteId={detalhe.id} rotaBase="/profissional" onSalvo={onAtualizado} />
        </div>
      )}
      {abrirMais === "login" && (
        <div className="border-t border-nv-borderLight pt-3.5">
          <CorrigirLoginCliente cliente={detalhe} />
        </div>
      )}

      <SituacaoCliente clienteId={detalhe.id} rotaBase="/profissional" onMudou={onMudouSituacao} />
    </div>
  );
}

// Fase 52 — aba "Prontuário e evolução": histórico das evoluções desse cliente (mais recente
// primeiro) com um formulário pra registrar uma nova. Reaproveita o mesmo RelatorioCliente que já
// existia (POST /clientes/:id/relatorios) — só ganhou essa moldura de prontuário com a lista
// visível, que antes não existia em lugar nenhum da tela.
function FichaProntuario({ clienteId, relatorios, onNovo }) {
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [visivel, setVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  async function publicar() {
    setSalvando(true);
    setMsg("");
    try {
      await api.post(`/profissional/clientes/${clienteId}/relatorios`, { titulo, conteudo, visivelParaCliente: visivel });
      setTitulo("");
      setConteudo("");
      setVisivel(false);
      setMsg("Evolução registrada!");
      onNovo?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-nv-bg rounded-xl p-4 space-y-2.5">
        <p className="text-[12.5px] font-semibold text-nv-ink2">Nova evolução</p>
        <input className="input" placeholder="Título (ex: Sessão de 14/10)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <textarea className="input" rows={4} placeholder="Evolução da sessão..." value={conteudo} onChange={(e) => setConteudo(e.target.value)} />
        <label className="flex items-center gap-2 text-[12.5px] text-nv-muted">
          <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} />
          Tornar visível para o cliente
        </label>
        <button className="btn-primary !text-xs !px-3.5 !py-2" onClick={publicar} disabled={!titulo || !conteudo || salvando}>
          {salvando ? "Salvando..." : "Salvar evolução"}
        </button>
        {msg && <p className="text-xs text-nv-muted mt-1">{msg}</p>}
      </div>

      <div className="divide-y divide-nv-borderLight">
        {relatorios?.map((r) => (
          <div key={r.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13.5px] font-semibold text-nv-ink2">{r.titulo}</p>
              <span className="text-[10.5px] font-semibold text-nv-muted3 whitespace-nowrap">{new Date(r.criadoEm).toLocaleDateString("pt-BR")}</span>
            </div>
            <p className="text-[12.5px] text-nv-muted2 mt-0.5 whitespace-pre-wrap">{r.conteudo}</p>
            {r.visivelParaCliente && (
              <span className="inline-block mt-1 text-[10px] font-semibold text-nv-green bg-[#EFF8F3] rounded-full px-2 py-0.5">
                Visível para o cliente
              </span>
            )}
          </div>
        ))}
        {(!relatorios || relatorios.length === 0) && <p className="text-[13px] text-nv-muted py-3">Nenhuma evolução registrada ainda.</p>}
      </div>
    </div>
  );
}

const TIPO_LABEL_FICHA = {
  PACOTE_NOVO: "Contratação nova",
  RENOVACAO: "Renovação",
  SESSAO_EXTRA: "Sessão extra",
  OUTRO: "Outro",
};

// Fase 52 — aba "Financeiro": histórico de pagamentos desse cliente (o que pagou, quando, e se já
// foi repassado pra clínica) — antes essa informação não tinha nenhuma tela na ficha do cliente.
function FichaFinanceiroCliente({ transacoes }) {
  const total = (transacoes || []).reduce((s, t) => s + t.valorTotal, 0);
  return (
    <div className="space-y-3">
      <div className="bg-nv-bg rounded-xl p-3.5 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-nv-muted">Total pago por esse cliente</span>
        <span className="font-sora font-bold text-[17px] text-nv-navy tabular-nums">R$ {total.toFixed(2)}</span>
      </div>
      <div className="divide-y divide-nv-borderLight">
        {transacoes?.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-nv-ink2">{TIPO_LABEL_FICHA[t.tipo] || t.tipo}</p>
              <p className="text-[11px] text-nv-muted3">
                {new Date(t.data).toLocaleDateString("pt-BR")} ·{" "}
                {t.recebidoPor === "PROFISSIONAL" ? (t.repassado ? "repassado" : "aguardando repasse") : "recebido pela clínica"}
              </p>
            </div>
            <span className="text-[13.5px] font-bold text-nv-navy tabular-nums whitespace-nowrap">R$ {t.valorTotal.toFixed(2)}</span>
          </div>
        ))}
        {(!transacoes || transacoes.length === 0) && <p className="text-[13px] text-nv-muted py-3">Nenhum pagamento registrado ainda.</p>}
      </div>
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
function NotificacaoCliente({ clienteId, rotaBase, onSalvo }) {
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
      onSalvo?.();
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

function NovoPacoteCliente({ clienteId, onRegistrado }) {
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
      onRegistrado?.();
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
        <input
          type="number"
          min="1"
          className="input !w-36"
          placeholder="Nº de sessões"
          value={totalSessoes}
          onChange={(e) => setTotalSessoes(e.target.value)}
        />
        <input className="input !w-40" placeholder="Valor (opcional)" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
        <button className="btn-primary" onClick={registrar}>
          Registrar pacote
        </button>
      </div>
      {msg && <p className="text-sm mt-1">{msg}</p>}
    </div>
  );
}

// ---------------- FINANCEIRO ----------------
export function AbaFinanceiro() {
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
  const [renovar, setRenovar] = useState(null); // Fase 51 — { lista, receitaEmRisco30, taxaRenovacao90 }
  const [contatandoId, setContatandoId] = useState(null);

  async function carregar() {
    const [r, c] = await Promise.all([api.get("/profissional/financeiro/resumo"), api.get("/profissional/clientes")]);
    setResumo(r.data);
    setClientes(c.data);
  }
  async function carregarRenovar() {
    const { data } = await api.get("/profissional/clientes-pra-renovar");
    setRenovar(data);
  }
  useEffect(() => {
    carregar();
    carregarRenovar();
  }, []);

  async function marcarContatado(id) {
    setContatandoId(id);
    try {
      await api.put(`/profissional/clientes/${id}/marcar-contatado`);
      carregarRenovar();
    } finally {
      setContatandoId(null);
    }
  }

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
    <div className="space-y-4 font-publicSans">
      <div>
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Financeiro</h1>
        <p className="text-nv-muted text-sm mt-0.5">Repasses, comprovantes e transações do mês</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="nv-card">
          <p className="text-sm text-nv-muted">Recebido este mês</p>
          <p className="nv-num text-2xl font-bold text-nv-blue">R$ {resumo?.totalProfissional?.toFixed(2) ?? "0,00"}</p>
          <p className="text-xs text-nv-muted mt-1">Só o que é seu — não conta a parte que fica com a Renascer.</p>
        </div>
        <div className="nv-card">
          <p className="text-sm text-nv-muted">Repasse Renascer</p>
          <p className="nv-num text-2xl font-bold text-nv-ink2">R$ {resumo?.totalRenascer?.toFixed(2) ?? "0,00"}</p>
        </div>
        <div className="nv-card !border-amber-300 bg-amber-50">
          <p className="text-sm text-nv-muted">Pendente de confirmação</p>
          <p className="nv-num text-2xl font-bold text-amber-700">R$ {resumo?.totalPendenteRepassar?.toFixed(2) ?? "0,00"}</p>
          <p className="text-xs text-nv-muted mt-1">Dinheiro que você recebeu direto do cliente e ainda não repassou pra Renascer.</p>
        </div>
      </div>

      {/* Fase 51 — "Clientes pra renovar" só dela: mesma ideia da fila do Setor Financeiro, mas
          escopada aos seus próprios clientes, com botão direto pro WhatsApp já com mensagem pronta. */}
      <div className="nv-card">
        <h3 className="font-sora font-semibold text-nv-ink mb-1">Clientes pra renovar</h3>
        <p className="text-xs text-nv-muted mb-3">Base de receita recorrente em risco — acompanhe antes do pacote encerrar.</p>
        <div className="flex flex-col gap-2">
          {renovar?.lista?.map((c) => {
            const cor = c.dias <= 3 ? "#B3261E" : c.dias <= 10 ? "#B0580F" : "#1C7C54";
            return (
              <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap bg-nv-bg rounded-[10px] px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                  <div>
                    <p className="text-[13px] font-semibold text-nv-ink">{c.nome}</p>
                    <p className="text-[11.5px] text-nv-muted2">
                      {c.valorPacote != null ? `valor do pacote R$ ${c.valorPacote.toFixed(2)}` : "valor do pacote —"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[12px] font-semibold" style={{ color: cor }}>
                    {c.dias >= 0 ? `encerra em ${c.dias} dia${c.dias === 1 ? "" : "s"}` : "já encerrou"}
                  </span>
                  {c.whatsapp && (
                    <a
                      className="text-nv-green text-xs font-semibold underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Oi ${c.nome}! Seu pacote no Espaço do Renascer está acabando — bora marcar a renovação? 💙`
                      )}`}
                    >
                      Chamar no WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    className="text-nv-blue text-xs font-semibold underline disabled:opacity-50"
                    disabled={contatandoId === c.id}
                    onClick={() => marcarContatado(c.id)}
                  >
                    {contatandoId === c.id ? "Marcando..." : "Marcar como contatado"}
                  </button>
                </div>
              </div>
            );
          })}
          {renovar && renovar.lista.length === 0 && (
            <p className="text-xs text-nv-muted3">Nenhum cliente com renovação próxima cadastrada agora.</p>
          )}
        </div>
        {renovar && (
          <div className="flex gap-6 mt-4 pt-3 border-t border-nv-borderLight">
            <div>
              <p className="text-[11px] text-nv-muted">Receita em risco (30 dias)</p>
              <p className="font-sora font-bold text-lg text-amber-700">R$ {renovar.receitaEmRisco30.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] text-nv-muted">Taxa de renovação (90 dias)</p>
              <p className="font-sora font-bold text-lg text-nv-green">
                {renovar.taxaRenovacao90 != null ? `${renovar.taxaRenovacao90}%` : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="nv-card">
        <h3 className="font-sora font-semibold text-nv-ink mb-3">Calculadora rápida de repasse</h3>
        <div className="flex flex-wrap gap-2">
          <input className="input flex-1 min-w-[150px]" placeholder="Valor total recebido (ex: 170)" value={valorCalc} onChange={(e) => setValorCalc(e.target.value)} />
          <button className="btn-secondary" onClick={calcular}>
            Calcular
          </button>
        </div>
        {repasse && (
          <p className="mt-2 text-sm text-nv-ink2">
            Seu repasse: <strong>R$ {repasse.valorProfissional}</strong> · Renascer: <strong>R$ {repasse.valorRenascer}</strong>
          </p>
        )}
      </div>

      <div className="nv-card">
        <h3 className="font-sora font-semibold text-nv-ink mb-1">Anexar renovação ou pagamento</h3>
        <p className="text-xs text-nv-muted mb-3">
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
        <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files[0])} className="input-file mb-2" />
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
          <p className="text-nv-green text-sm mt-2">
            Registrado: R$ {resultado.transacao.valorTotal} (você vai receber R$ {resultado.transacao.valorProfissional})
            {resultado.transacao.reconhecidoPorIA ? " — reconhecido automaticamente pela IA." : " — valor manual."}
          </p>
        )}
      </div>

      <div className="nv-card overflow-x-auto">
        <h3 className="font-sora font-semibold text-nv-ink mb-3">Transações do mês</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-nv-muted">
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
              <tr key={t.id} className="border-t border-nv-borderLight">
                <td className="py-1 text-nv-ink2">{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                <td className="text-nv-ink2">{t.cliente?.user?.nome || "-"}</td>
                <td className="text-nv-ink2">
                  {TIPO_LABEL[t.tipo] || t.tipo}
                  {t.origem === "ATENDENTE" && (
                    <span className="block text-[10px] text-nv-muted3">fechado pela recepção</span>
                  )}
                </td>
                <td className="text-nv-ink2">R$ {t.valorTotal.toFixed(2)}</td>
                <td className="text-nv-ink2">R$ {t.valorProfissional.toFixed(2)}</td>
                <td>
                  {t.recebidoPor === "PROFISSIONAL" ? (
                    <LinhaRepasse t={t} onMudou={carregar} />
                  ) : (
                    <span className="text-nv-muted3 text-xs">recebido pela clínica</span>
                  )}
                </td>
                <td className="text-right">
                  {t.temComprovante ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button className="text-nv-blue text-xs underline" onClick={() => verComprovante(t.id)}>
                        Ver comprovante
                      </button>
                      <span className="text-[9.5px] text-nv-muted3 bg-nv-bg rounded-full px-1.5 py-0.5">registro imutável</span>
                    </span>
                  ) : (
                    <span className="text-nv-muted3 text-xs">sem comprovante</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {resumo?.transacoes?.length === 0 && <p className="text-sm text-nv-muted mt-2">Nenhuma transação neste mês.</p>}
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
          <p className="text-[11px] text-nv-muted">
            Valor no comprovante: R$ {t.repasseValorInformado.toFixed(2)}
            {!bateComEsperado && " — diferente do esperado"}
          </p>
        )}
        {t.temComprovanteRepasse && (
          <button className="text-nv-blue text-[11px] underline block" onClick={() => verComprovanteRepasse(t.id)}>
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
        <div className="bg-nv-bg border border-nv-borderLight rounded-lg p-2 space-y-1 min-w-[220px]">
          <input type="file" accept="image/*" className="input-file" onChange={(e) => setArquivo(e.target.files[0])} />
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
            <button className="text-xs text-nv-muted underline" onClick={() => setAberto(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {msg && <p className="text-[11px] mt-1 text-nv-ink2">{msg}</p>}
    </div>
  );
}

// ---------------- NOTIFICAÇÕES ----------------
// Fase 51 — igual canvas: feed de avisos com ícone colorido por categoria (cliente/financeiro/
// renovação/mensagem) em vez da lista cinza genérica de antes.
function formatarQuandoAviso(iso) {
  const d = new Date(iso);
  const agora = new Date();
  const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diaAviso = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDias = Math.round((hojeInicio - diaAviso) / 86400000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDias <= 0) return `hoje · ${hora}`;
  if (diffDias === 1) return `ontem · ${hora}`;
  return `${diffDias} dias atrás`;
}

function categoriaAviso(n) {
  const msg = (n.mensagem || "").toLowerCase();
  if (n.tipo === "financeiro" && /confirmad/.test(msg)) {
    return { cor: "#1C7C54", bg: "#E8F5EE", Icone: IconAvisoCheck };
  }
  if (n.tipo === "financeiro") return { cor: "#B0580F", bg: "#FBF0E3", Icone: IconAvisoMoeda };
  if (n.tipo === "renovacao") return { cor: "#B0580F", bg: "#FBF0E3", Icone: IconAvisoRelogio };
  if (n.tipo === "cliente") return { cor: "#0B5FA8", bg: "#EAF1FA", Icone: IconAvisoPessoa };
  if (n.tipo === "mensagem" || n.tipo === "tarefa") return { cor: "#8A4FA3", bg: "#F2E9FB", Icone: IconAvisoMensagem };
  return { cor: "#0B5FA8", bg: "#EAF1FA", Icone: IconAvisoPessoa };
}

function IconAvisoPessoa({ cor }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20c0-4 3.3-6.8 7.5-6.8s7.5 2.8 7.5 6.8" />
    </svg>
  );
}
function IconAvisoMoeda({ cor }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M9.5 9.8c0-1.3 1.1-2 2.5-2s2.5.8 2.5 1.9c0 2.6-5 1.3-5 3.9 0 1.1 1.1 1.9 2.5 1.9s2.5-.7 2.5-2" />
    </svg>
  );
}
function IconAvisoRelogio({ cor }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12.5" r="8" />
      <path d="M12 8v5l3.3 2" />
      <path d="M9 2.5h6" />
    </svg>
  );
}
function IconAvisoMensagem({ cor }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" />
    </svg>
  );
}
function IconAvisoCheck({ cor }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 12.3l2.5 2.5 5-5.2" />
    </svg>
  );
}

function AbaNotificacoes() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/comum/notificacoes").then((r) => setLista(r.data));
  }, []);
  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Avisos</h1>
        <p className="text-nv-muted text-sm mt-0.5">Novos clientes, pendências e lembretes</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {lista.map((n) => {
          const { cor, bg, Icone } = categoriaAviso(n);
          return (
            <div
              key={n.id}
              className={`bg-white rounded-2xl p-4 shadow-[0_1px_2px_rgba(14,30,54,0.05)] flex items-start gap-3 ${
                n.lida ? "" : "ring-1 ring-nv-blue/15"
              }`}
            >
              <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: bg }}>
                <Icone cor={cor} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <p className="text-[13.5px] font-semibold text-nv-ink2">{n.titulo}</p>
                  <span className="text-[11px] text-nv-muted3 whitespace-nowrap">{formatarQuandoAviso(n.criadoEm)}</span>
                </div>
                <p className="text-[12.5px] text-nv-muted2 mt-0.5">{n.mensagem}</p>
              </div>
            </div>
          );
        })}
        {lista.length === 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-[0_1px_2px_rgba(14,30,54,0.05)]">
            <p className="text-[13px] text-nv-muted2">Nenhum aviso por enquanto.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- CONFIGURAÇÃO / PERFIL + DISPONIBILIDADE ----------------
export function AbaConfig() {
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
    <div className="space-y-4 font-publicSans">
      <div>
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Configurações</h1>
      </div>
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
    <div className="nv-card space-y-3">
      <h2 className="font-sora font-semibold text-nv-ink">Seu perfil (o que a atendente e o time vê de você)</h2>
      <div className="flex items-center gap-4">
        <img
          src={foto ? URL.createObjectURL(foto) : perfil.user.fotoUrl || "https://via.placeholder.com/80?text=Foto"}
          alt="Foto de perfil"
          className="w-20 h-20 rounded-full object-cover border border-nv-border"
        />
        <div>
          <label className="text-sm text-nv-muted block mb-1">Trocar foto</label>
          <input type="file" accept="image/*" className="input-file" onChange={(e) => setFoto(e.target.files[0])} />
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
        <p className="text-sm text-nv-muted mb-1">O que você atende</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS_SUGERIDAS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => alternarCategoria(cat)}
              className={`text-sm px-3 py-1.5 rounded-full border ${
                especialidades.includes(cat) ? "bg-nv-blue text-white border-nv-blue" : "border-nv-border text-nv-ink2"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <textarea className="input" rows={3} placeholder="Bio curta" value={bio} onChange={(e) => setBio(e.target.value)} />

      <div>
        <label className="text-sm text-nv-muted block mb-1">
          Link fixo da sua sala no Google Meet (usado em todas as suas sessões)
        </label>
        <input
          className="input"
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          value={linkMeet}
          onChange={(e) => setLinkMeet(e.target.value)}
        />
        <p className="text-xs text-nv-muted mt-1">
          Pra criar: entre no Google Meet, clique em "Nova reunião" → "Iniciar uma reunião instantânea" (ou "Criar reunião para mais tarde") e copie o link gerado aqui.
        </p>
      </div>

      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar perfil"}
      </button>
      {msg && <p className="text-sm text-nv-ink2">{msg}</p>}
    </div>
  );
}

// ================================================================================================
// ---------------- MEU DIA (Fase 30) — Profissional: checklist diário + indicadores operacionais
// dela mesma (sessões de hoje, repasse pendente, tempo de resposta, clientes perto de renovar).
// Nunca o consolidado da clínica — só o que já é dela em outras abas (Agenda/Financeiro).
// ----------------
// ================================================================================================

const ITENS_CHECKLIST_HOJE_PROFISSIONAL = [
  { chave: "revisar_agenda_hoje_prof", texto: "Revisar as sessões de hoje" },
  { chave: "responder_mensagens_prof", texto: "Responder mensagens pendentes dos clientes" },
  { chave: "marcar_realizadas_prof", texto: "Marcar as sessões de hoje como realizadas (ou falta)" },
  { chave: "conferir_repasse_prof", texto: "Conferir se tem repasse pendente pra Renascer" },
];

const ITENS_CHECKLIST_IMPLANTACAO_PROFISSIONAL = [
  { chave: "completar_perfil_prof", texto: "Completar o perfil (foto, título, especialidades, bio)" },
  { chave: "configurar_disponibilidade_prof", texto: "Configurar os horários de disponibilidade" },
  { chave: "ativar_push_prof", texto: "Ativar as notificações push no seu aparelho" },
];

function hojeISOProfissional() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AbaMeuDiaProfissional() {
  const [sub, setSub] = useState("hoje");
  const SUBABAS = [
    { id: "hoje", label: "Hoje" },
    { id: "indicadores", label: "Indicadores" },
    { id: "implantacao", label: "Implantação" },
  ];
  return (
    <div className="space-y-4 font-publicSans">
      <div>
        <p className="nv-eyebrow mb-1">Painel da Profissional</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Meu dia</h1>
        <p className="text-nv-muted text-sm mt-0.5">Checklist e indicadores do seu dia a dia</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SUBABAS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              sub === s.id ? "bg-nv-blue text-white" : "bg-white text-nv-muted border border-nv-borderLight"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "hoje" && (
        <div className="nv-card space-y-3">
          <div>
            <h3 className="font-sora font-semibold text-nv-ink">Checklist de hoje</h3>
            <p className="text-xs text-nv-muted">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
          </div>
          <ChecklistMeuDia itens={ITENS_CHECKLIST_HOJE_PROFISSIONAL} data={hojeISOProfissional()} />
        </div>
      )}
      {sub === "indicadores" && <IndicadoresMeuDiaProfissional />}
      {sub === "implantacao" && (
        <div className="nv-card space-y-3">
          <div>
            <h3 className="font-sora font-semibold text-nv-ink">Checklist de implantação</h3>
            <p className="text-xs text-nv-muted">Itens de configuração inicial — marque uma vez só.</p>
          </div>
          <ChecklistMeuDia itens={ITENS_CHECKLIST_IMPLANTACAO_PROFISSIONAL} />
        </div>
      )}
    </div>
  );
}

function IndicadoresMeuDiaProfissional() {
  const [dados, setDados] = useState(null);
  async function carregar() {
    const { data } = await api.get("/profissional/meu-dia/indicadores");
    setDados(data);
  }
  useEffect(() => {
    carregar();
  }, []);
  if (!dados) return <p className="text-sm text-nv-muted">Carregando...</p>;

  return (
    <div className="nv-card space-y-4">
      <div>
        <h3 className="font-sora font-semibold text-nv-ink mb-2">Hoje</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-nv-border rounded-xl p-3">
            <p className="text-xs text-nv-muted">Sessões hoje</p>
            <p className="text-lg font-bold text-nv-ink">{dados.agendaHoje.total}</p>
          </div>
          {Object.entries(dados.agendaHoje.porStatus).map(([status, total]) => (
            <div key={status} className="border border-nv-border rounded-xl p-3">
              <p className="text-xs text-nv-muted">{status}</p>
              <p className="text-lg font-bold text-nv-ink">{total}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-nv-border rounded-xl p-3">
          <p className="text-xs text-nv-muted">Pendente de repasse</p>
          <p className="text-lg font-bold text-amber-700">R$ {dados.totalPendenteRepassar.toFixed(2)}</p>
        </div>
        <div className="border border-nv-border rounded-xl p-3">
          <p className="text-xs text-nv-muted">Taxa de faltas (mês)</p>
          <p className="text-lg font-bold text-nv-ink">
            {dados.taxaFaltasMes.taxaFaltasPercentual !== null ? `${dados.taxaFaltasMes.taxaFaltasPercentual}%` : "—"}
          </p>
        </div>
        <div className="border border-nv-border rounded-xl p-3">
          <p className="text-xs text-nv-muted">Tempo médio de resposta</p>
          <p className="text-lg font-bold text-nv-ink">
            {dados.tempoRespostaMedioMes.tempoMedioMinutos !== null ? `${dados.tempoRespostaMedioMes.tempoMedioMinutos} min` : "—"}
          </p>
        </div>
        <div className="border border-nv-border rounded-xl p-3">
          <p className="text-xs text-nv-muted">Clientes perto de renovar</p>
          <p className="text-lg font-bold text-nv-ink">{dados.clientesPertoDeRenovar}</p>
        </div>
      </div>
    </div>
  );
}
