import { useEffect, useRef, useState } from "react";
import LayoutNovo from "../../components/LayoutNovo";
import api, { atualizarUsuarioLocal } from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { verComprovante, abrirImagem, verComprovanteRepasse } from "../../lib/comprovante";
import StatusCliente from "../../components/StatusCliente";
import TrocarProfissionalCliente from "../../components/TrocarProfissionalCliente";
import { statusSessao, CORES_STATUS_SESSAO, formatarPresenca } from "../../lib/presenca";
import ChecklistMeuDia from "../../components/ChecklistMeuDia";
// Reaproveita os mesmos componentes da área da Profissional (agenda, clientes, cadastro,
// financeiro, perfil/disponibilidade) pro Dono conseguir atender pacientes pelo próprio login,
// sem duplicar esse código todo — o backend libera as rotas de /profissional/* pra quem tem um
// cadastro de Profissional vinculado, mesmo entrando como Dono (ver PATCH em
// backend/src/middleware/auth.js).
import { AbaAgenda, AbaCadastrarCliente, AbaClientes, AbaFinanceiro, AbaConfig } from "../profissional/index";

const TIPO_LABEL = {
  PACOTE_NOVO: "Contratação nova",
  RENOVACAO: "Renovação",
  SESSAO_EXTRA: "Sessão extra",
  OUTRO: "Outro",
};

export default function AreaDono() {
  const { user, carregando } = useAuth("DONO");
  const [aba, setAba] = useState("dashboard");
  if (carregando) return null;

  const ABAS = [
    { id: "meudia", label: "Meu dia" },
    { id: "dashboard", label: "Visão geral" },
    { id: "mapas", label: "Mapas mentais" }, // Fase 32
    { id: "profissionais", label: "Profissionais" },
    { id: "agenda", label: "Agenda geral" },
    { id: "clientes", label: "Clientes" },
    { id: "reativar", label: "Reativar clientes" },
    { id: "historico", label: "Histórico" },
    { id: "financeiro", label: "Financeiro" },
    { id: "repasses", label: "Repasses" },
    { id: "usuarios", label: "Usuários" },
    { id: "suporte", label: "Suporte escalado" },
    { id: "financaPessoal", label: "Financeiro pessoal" },
    { id: "atender", label: "Atender pacientes" },
    { id: "renascerIA", label: "Renascer IA" },
    { id: "formularios", label: "Formulários" },
  ];

  return (
    <LayoutNovo user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "meudia" && <AbaMeuDia />}
      {aba === "dashboard" && <Dashboard />}
      {aba === "mapas" && <MapasMentais />}
      {aba === "profissionais" && <Profissionais />}
      {aba === "agenda" && <AgendaGeralDono />}
      {aba === "clientes" && <Clientes />}
      {aba === "reativar" && <ClientesParaReativar rotaBase="/dono" />}
      {aba === "historico" && <HistoricoClientes />}
      {aba === "financeiro" && <Financeiro />}
      {aba === "repasses" && <RepassesProfissionais />}
      {aba === "usuarios" && <Usuarios />}
      {aba === "suporte" && <SuporteEscalado />}
      {aba === "financaPessoal" && <AbaFinancaPessoal />}
      {aba === "atender" && <AbaAtenderPacientes user={user} />}
      {aba === "renascerIA" && <AbaRenascerIA />}
      {aba === "formularios" && <AbaFormularios />}
    </LayoutNovo>
  );
}

// ---------------- ATENDER PACIENTES (Dono que também é profissional/terapeuta) ----------------
// Dá pro Dono ganhar uma agenda própria de atendimento sem precisar de um segundo login: ele
// ativa uma vez (cria o cadastro de Profissional vinculado ao mesmo login) e passa a ver, aqui
// dentro da própria área de Dono, exatamente as mesmas ferramentas que uma profissional tem —
// agenda, cadastro de cliente, lista de clientes e financeiro. A recepção também passa a ver
// esse Dono na lista de profissionais pra agendar clientes com ele, automaticamente.
function AbaAtenderPacientes({ user }) {
  const [temPerfil, setTemPerfil] = useState(!!user?.profissional);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");
  const [sub, setSub] = useState("agenda");

  async function ativar() {
    setAtivando(true);
    setErro("");
    try {
      const { data } = await api.post(`/dono/usuarios/${user.id}/tornar-profissional`, {});
      atualizarUsuarioLocal({ profissional: data.profissional });
      setTemPerfil(true);
    } catch (e) {
      setErro(e?.response?.data?.erro || "Não foi possível ativar o atendimento agora.");
    } finally {
      setAtivando(false);
    }
  }

  if (!temPerfil) {
    return (
      <div className="card max-w-xl">
        <h2 className="font-semibold mb-2">Você também atende pacientes?</h2>
        <p className="text-sm text-renascer-ink/60 mb-4">
          Ative essa opção pra ganhar uma agenda própria de atendimento, igual a qualquer
          profissional — poder cadastrar seus pacientes, ver seus horários e seu financeiro, tudo
          sem sair do seu login de dono. A recepção também vai passar a te ver na lista de
          profissionais pra poder agendar clientes com você.
        </p>
        <button className="btn-primary" onClick={ativar} disabled={ativando}>
          {ativando ? "Ativando..." : "Ativar minha agenda de atendimento"}
        </button>
        {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
      </div>
    );
  }

  const SUB_ABAS = [
    { id: "agenda", label: "Agenda" },
    { id: "cadastrar", label: "Cadastrar cliente" },
    { id: "clientes", label: "Clientes" },
    { id: "financeiro", label: "Financeiro" },
    { id: "config", label: "Disponibilidade" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-renascer/10 pb-1">
        {SUB_ABAS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              sub === s.id ? "text-renascer bg-renascer-light/60" : "text-renascer-ink/55 hover:text-renascer-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "agenda" && <AbaAgenda />}
      {sub === "cadastrar" && <AbaCadastrarCliente />}
      {sub === "clientes" && <AbaClientes />}
      {sub === "financeiro" && <AbaFinanceiro />}
      {sub === "config" && <AbaConfig />}
    </div>
  );
}

// Fila de clientes marcados como "não renovou" por alguma profissional — dá pra chamar no
// WhatsApp com o número que ele deixou no cadastro e, se ele voltar, vincular de novo com
// uma profissional direto por aqui (mesma função que a recepção tem).
function ClientesParaReativar({ rotaBase }) {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [escolha, setEscolha] = useState({});

  async function carregar() {
    const [r, p] = await Promise.all([api.get(`${rotaBase}/clientes-reativar`), api.get(`${rotaBase}/profissionais`)]);
    setLista(r.data);
    setProfissionais(p.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function reativar(id) {
    const profissionalId = escolha[id];
    if (!profissionalId) return;
    await api.put(`${rotaBase}/clientes/${id}/reativar`, { profissionalId });
    carregar();
  }

  const ordenada = [...lista].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel do Dono · também usado pela Atendente</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Reativar clientes</h1>
        <p className="text-nv-muted text-sm mt-0.5">
          Clientes pausados, em ordem alfabética — chama no WhatsApp e, se topar voltar, vincula com uma profissional.
        </p>
      </div>
      <div className="nv-card !p-0 px-5">
        {ordenada.map((c) => {
          const linkReativar = c.whatsapp
            ? "https://wa.me/" +
              c.whatsapp.replace(/\D/g, "") +
              "?text=" +
              encodeURIComponent(
                "Olá, " + c.nome + "! Aqui é do Espaço do Renascer. Sentimos sua falta, quer voltar a agendar suas sessões?"
              )
            : null;
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 border-t border-nv-borderLight first:border-t-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-nv-ink2">{c.nome}</p>
                <p className="text-xs text-nv-muted3 mt-0.5">
                  {c.pacoteResumo || "pacote não registrado"} · saiu em{" "}
                  {c.excluidoEm ? new Date(c.excluidoEm).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {linkReativar && (
                  <button
                    className="text-xs font-semibold text-nv-green border border-nv-green/30 bg-nv-green/5 rounded-lg px-3 py-1.5 hover:bg-nv-green/10"
                    onClick={() => window.open(linkReativar, "_blank")}
                  >
                    💬 Chamar no WhatsApp
                  </button>
                )}
                <select
                  className="border border-nv-border rounded-lg px-2.5 py-1.5 text-xs text-nv-ink2 bg-white"
                  value={escolha[c.id] || ""}
                  onChange={(e) => setEscolha({ ...escolha, [c.id]: e.target.value })}
                >
                  <option value="">Reativar com...</option>
                  {profissionais.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.user.nome}
                      {p.user.role === "DONO" ? " (Dono)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  className="text-xs font-semibold text-white bg-nv-blue rounded-lg px-3.5 py-1.5 hover:bg-nv-blueDark disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => reativar(c.id)}
                  disabled={!escolha[c.id]}
                >
                  Reativar
                </button>
              </div>
            </div>
          );
        })}
        {ordenada.length === 0 && <p className="text-sm text-nv-muted py-4">Ninguém na fila de reativação agora.</p>}
      </div>
    </div>
  );
}

// Linha do tempo completa de clientes (entrou, renovou, saiu/não renovou, foi reativado) —
// essa aba só o dono enxerga.
const TIPO_HISTORICO_LABEL = {
  ENTROU: "Entrou",
  RENOVOU: "Renovou",
  EXCLUIDO: "Saiu / não renovou",
  REATIVADO: "Reativado",
};
const TIPO_HISTORICO_COR_NV = {
  ENTROU: "#0B5FA8",
  RENOVOU: "#1C7C54",
  EXCLUIDO: "#D94F4F",
  REATIVADO: "#9C6B2E",
};
const TIPO_HISTORICO_VERBO = {
  ENTROU: "entrou",
  RENOVOU: "renovou o pacote",
  EXCLUIDO: "saiu (não renovou)",
  REATIVADO: "foi reativado(a)",
};
const FILTROS_HISTORICO = [
  { id: "todos", label: "Todos" },
  { id: "ENTROU", label: "Entradas" },
  { id: "RENOVOU", label: "Renovações" },
  { id: "EXCLUIDO", label: "Saídas" },
  { id: "REATIVADO", label: "Reativações" },
];

function HistoricoClientes() {
  const [lista, setLista] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  useEffect(() => {
    api.get("/dono/historico-clientes").then((r) => setLista(r.data));
  }, []);

  const eventos = filtro === "todos" ? lista : lista.filter((h) => h.tipo === filtro);

  return (
    <div className="font-publicSans">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="nv-eyebrow mb-1">Painel do Dono</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Histórico</h1>
          <p className="text-nv-muted text-sm mt-0.5">Entradas, renovações e saídas de clientes</p>
        </div>
        <div>
          {FILTROS_HISTORICO.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`nv-seg ${filtro === f.id ? "nv-seg-ativo" : ""}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="nv-card !p-0 px-6 py-1">
        {eventos.map((h) => {
          const detalhes = [h.profissionalNome && `com ${h.profissionalNome}`, h.pacoteResumo, h.whatsapp && `WhatsApp: ${h.whatsapp}`]
            .filter(Boolean)
            .join(" · ");
          return (
            <div key={h.id} className="flex gap-3 py-3 border-t border-nv-borderLight first:border-t-0">
              <span
                className="w-[9px] h-[9px] rounded-full shrink-0 mt-1.5"
                style={{ background: TIPO_HISTORICO_COR_NV[h.tipo] || "#96A2B6" }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-nv-ink2">
                  {h.nomeCliente} {TIPO_HISTORICO_VERBO[h.tipo] || (TIPO_HISTORICO_LABEL[h.tipo] || h.tipo).toLowerCase()}
                </p>
                <p className="text-xs text-nv-muted3 mt-0.5">
                  {new Date(h.criadoEm).toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
                  {detalhes && ` · ${detalhes}`}
                </p>
              </div>
            </div>
          );
        })}
        {eventos.length === 0 && <p className="text-sm text-nv-muted py-4">Nenhum evento registrado ainda.</p>}
      </div>
    </div>
  );
}

// ---- Ícones de linha (18x18) usados nos cartões de número da Visão geral (Fase 35) ----
function IconProfissionais() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5FA8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <circle cx="17" cy="7.5" r="2.4" />
      <path d="M15.5 13.3c2.4.3 4 2.2 4 4.7" />
    </svg>
  );
}
function IconClientes() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5FA8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20c0-4 3.3-6.8 7.5-6.8s7.5 2.8 7.5 6.8" />
    </svg>
  );
}
function IconCalendarioCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5FA8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="2.2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8.3 14l2.2 2.2 4.5-4.6" />
    </svg>
  );
}
function IconTendencia() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B5FA8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 16.5l5.2-5.3 3.6 3.4 7.2-7.5" />
      <path d="M15 6.6h4.5v4.5" />
    </svg>
  );
}

function PontoStatus({ status }) {
  const classe = status === "VERMELHO" ? "nv-dot-urgente" : status === "AMARELO" ? "nv-dot-atencao" : "nv-dot-ok";
  return <span className={`nv-dot ${classe}`} />;
}

function Dashboard() {
  const [d, setD] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(() => {
    const diaSemanaHoje = new Date().getDay(); // 0=dom..6=sáb
    const idx = diaSemanaHoje === 0 ? 5 : diaSemanaHoje - 1;
    return Math.min(Math.max(idx, 0), 5);
  });

  useEffect(() => {
    api.get("/dono/dashboard").then((r) => setD(r.data));
  }, []);

  if (!d) {
    return (
      <div className="flex items-center gap-2 text-nv-muted font-publicSans text-sm">
        <span className="nv-dot nv-dot-ok" /> Carregando a visão geral...
      </div>
    );
  }

  const profissionaisHoje = Object.entries(d.porProfissionalHoje || {});
  const resultadoSemana = d.resultadoSemana || [];
  const maxFaturamento = Math.max(...resultadoSemana.map((dia) => dia.faturamento), 1);
  const diaAtivo = resultadoSemana[diaSelecionado] || resultadoSemana[0];

  const pacotes = d.pacotesPorStatus || { ativos: 0, aRenovar: 0, encerrados: 0, total: 0 };
  const totalPacotes = pacotes.total || 0;
  const pctAtivos = totalPacotes > 0 ? (pacotes.ativos / totalPacotes) * 100 : 0;
  const pctARenovar = totalPacotes > 0 ? (pacotes.aRenovar / totalPacotes) * 100 : 0;
  const pctEncerrados = totalPacotes > 0 ? (pacotes.encerrados / totalPacotes) * 100 : 0;
  const raio = 70;
  const circunferencia = 2 * Math.PI * raio;
  const segAtivos = (pctAtivos / 100) * circunferencia;
  const segARenovar = (pctARenovar / 100) * circunferencia;
  const segEncerrados = (pctEncerrados / 100) * circunferencia;

  return (
    <div className="space-y-5 font-publicSans">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="nv-eyebrow mb-1">Painel do Dono</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Visão geral</h1>
          <p className="text-nv-muted text-sm mt-0.5">Painel geral do Espaço do Renascer</p>
        </div>
        <span className="inline-flex items-center gap-2 bg-white border border-nv-border rounded-full px-3.5 py-1.5 text-xs font-semibold text-nv-ink2 shadow-sm">
          <span className="nv-dot nv-dot-ok" /> Atualizado agora
        </span>
      </div>

      {/* 4 cartões de número */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nv-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-nv-muted">Profissionais ativos</p>
            <IconProfissionais />
          </div>
          <p className="nv-num font-sora font-bold text-[28px] text-nv-ink">{d.totalProfissionais}</p>
        </div>
        <div className="nv-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-nv-muted">Clientes cadastrados</p>
            <IconClientes />
          </div>
          <p className="nv-num font-sora font-bold text-[28px] text-nv-ink">{d.totalClientes}</p>
        </div>
        <div className="nv-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-nv-muted">Sessões essa semana</p>
            <IconCalendarioCheck />
          </div>
          <p className="nv-num font-sora font-bold text-[28px] text-nv-ink">{d.sessoesSemana ?? 0}</p>
        </div>
        <div className="nv-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-nv-muted">Taxa de renovação</p>
            <IconTendencia />
          </div>
          <p className="nv-num font-sora font-bold text-[28px] text-nv-ink">
            {d.taxaRenovacao != null ? `${d.taxaRenovacao}%` : "—"}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Resultado da semana */}
        <div className="nv-card flex-[1_1_420px]">
          <h3 className="font-sora font-semibold text-nv-ink">Resultado da semana</h3>
          <p className="text-xs text-nv-muted mt-0.5 mb-4">Segunda a sábado · clique num dia pra ver o detalhe financeiro</p>
          <div className="flex items-end gap-2 h-28 mb-3">
            {resultadoSemana.map((dia, i) => {
              const altura = Math.max((dia.faturamento / maxFaturamento) * 100, 4);
              const selecionado = i === diaSelecionado;
              return (
                <button
                  key={dia.label}
                  onClick={() => setDiaSelecionado(i)}
                  className="flex-1 flex flex-col items-center gap-1.5 group"
                  style={{ opacity: selecionado ? 1 : 0.45 }}
                >
                  <div className="w-full flex items-end h-20">
                    <div
                      className="w-full rounded-t-md bg-nv-blue transition-all duration-200"
                      style={{ height: `${altura}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-semibold ${selecionado ? "text-nv-ink" : "text-nv-muted3"}`}>
                    {dia.label}
                  </span>
                </button>
              );
            })}
          </div>
          {diaAtivo && (
            <div className="bg-nv-bg rounded-xl p-4">
              <p className="text-xs font-semibold text-nv-ink2 mb-3">
                {diaAtivo.label} · {new Date(diaAtivo.data).toLocaleDateString("pt-BR")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-nv-muted">Faturamento</p>
                  <p className="nv-num font-semibold text-nv-ink">R$ {diaAtivo.faturamento.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-nv-muted">Agendamentos</p>
                  <p className="nv-num font-semibold text-nv-ink">{diaAtivo.agendamentos}</p>
                </div>
                <div>
                  <p className="text-[11px] text-nv-muted">Investido em anúncio</p>
                  <p className="nv-num font-semibold text-nv-ink">R$ {diaAtivo.investimento.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-nv-muted">Conversões</p>
                  <p className="nv-num font-semibold text-nv-green">{diaAtivo.conversoes}</p>
                </div>
                <div>
                  <p className="text-[11px] text-nv-muted">CAC do dia</p>
                  <p className="nv-num font-semibold text-nv-ink">{diaAtivo.cac != null ? `R$ ${diaAtivo.cac.toFixed(2)}` : "—"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pacotes por status */}
        <div className="nv-card flex-[1_1_300px]">
          <h3 className="font-sora font-semibold text-nv-ink">Pacotes por status</h3>
          <p className="text-xs text-nv-muted mt-0.5 mb-4">Situação atual de todos os pacotes do sistema</p>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-[136px] h-[136px]">
              <svg width="136" height="136" viewBox="0 0 180 180" className="-rotate-90">
                <circle cx="90" cy="90" r={raio} fill="none" stroke="#EEF1F7" strokeWidth="20" />
                {totalPacotes > 0 && (
                  <>
                    <circle
                      cx="90" cy="90" r={raio} fill="none" stroke="#0B5FA8" strokeWidth="20"
                      strokeDasharray={`${segAtivos} ${circunferencia - segAtivos}`} strokeLinecap="round"
                    />
                    <circle
                      cx="90" cy="90" r={raio} fill="none" stroke="#9C6B2E" strokeWidth="20"
                      strokeDasharray={`${segARenovar} ${circunferencia - segARenovar}`}
                      strokeDashoffset={-segAtivos} strokeLinecap="round"
                    />
                    <circle
                      cx="90" cy="90" r={raio} fill="none" stroke="#96A2B6" strokeWidth="20"
                      strokeDasharray={`${segEncerrados} ${circunferencia - segEncerrados}`}
                      strokeDashoffset={-(segAtivos + segARenovar)} strokeLinecap="round"
                    />
                  </>
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="nv-num font-sora font-bold text-xl text-nv-ink">{Math.round(pctAtivos)}%</span>
                <span className="text-[11px] text-nv-muted">ativos</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Ativos", cor: "#0B5FA8", valor: pacotes.ativos, pct: pctAtivos },
              { label: "A renovar", cor: "#9C6B2E", valor: pacotes.aRenovar, pct: pctARenovar },
              { label: "Encerrados", cor: "#96A2B6", valor: pacotes.encerrados, pct: pctEncerrados },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm px-2 py-1.5 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.cor }} />
                  {item.label}
                </span>
                <span className="text-nv-muted text-xs">
                  {item.valor} · {totalPacotes > 0 ? Math.round(item.pct) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clientes para renovar */}
      <div className="nv-card">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-sora font-semibold text-nv-ink">Clientes para renovar</h3>
        </div>
        <p className="text-xs text-nv-muted mb-3">Data de renovação combinada mais próxima primeiro</p>
        <div>
          {(d.clientesParaRenovar || []).map((c, i) => (
            <div key={`${c.nome}-${i}`} className="flex items-center justify-between py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid #EEF1F7" }}>
              <span className="flex items-center gap-2.5">
                <PontoStatus status={c.status} />
                <span>
                  <span className="block text-sm font-semibold text-nv-ink2">{c.nome}</span>
                  {c.profissional && <span className="block text-xs text-nv-muted3">com {c.profissional}</span>}
                </span>
              </span>
              <span className="text-xs font-medium bg-nv-bg text-[#4B5B73] rounded-full px-3 py-1 whitespace-nowrap">
                {c.dias < 0 ? `venceu há ${Math.abs(c.dias)} dia(s)` : c.dias === 0 ? "renova hoje" : `renova em ${c.dias} dia(s)`}
              </span>
            </div>
          ))}
          {(!d.clientesParaRenovar || d.clientesParaRenovar.length === 0) && (
            <p className="text-sm text-nv-muted py-2">Nenhum cliente com data de renovação cadastrada no momento.</p>
          )}
        </div>
      </div>

      {/* A receber hoje — operacional, mantido da versão anterior */}
      <div className="nv-card !border-nv-blue/20 bg-nv-blue/[0.03]">
        <h3 className="font-sora font-semibold text-nv-ink mb-1">A receber hoje</h3>
        <p className="text-xs text-nv-muted mb-3">
          Tudo que a atendente fechou hoje (contratação nova, renovação, sessão extra ou qualquer outro pagamento). O que
          a própria profissional registra sozinha não conta aqui — só aparece nas pendências de repasse. Reinicia sozinho
          todo dia.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-nv-muted">Total registrado hoje</p>
            <p className="nv-num text-xl font-bold text-nv-blue">R$ {d.hoje.totalRecebido.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-nv-muted">Vai pras profissionais</p>
            <p className="nv-num text-xl font-bold text-nv-ink2">R$ {d.hoje.valorProfissional.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-nv-muted">Você vai receber hoje</p>
            <p className="nv-num text-xl font-bold text-nv-green">R$ {d.hoje.valorRenascer.toFixed(2)}</p>
          </div>
        </div>
        {profissionaisHoje.length > 0 && (
          <div className="border-t border-nv-border pt-2 space-y-1">
            <p className="text-xs font-medium text-nv-muted">Quanto você vai receber de cada profissional hoje</p>
            {profissionaisHoje.map(([nome, v]) => (
              <div key={nome} className="flex items-center justify-between text-sm">
                <span className="text-nv-ink2">{nome}</span>
                <span className="nv-num font-semibold text-nv-green">R$ {v.valorRenascer.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        {profissionaisHoje.length === 0 && <p className="text-xs text-nv-muted3">Nada registrado hoje ainda.</p>}
      </div>

      {d.totalPendenteRepasseProfissionais > 0 && (
        <div className="nv-card !border-nv-gold/30" style={{ background: "#FBF4EA" }}>
          <h3 className="font-sora font-semibold text-nv-ink mb-1">Repasses pendentes das profissionais</h3>
          <p className="text-xs text-nv-muted mb-2">
            Dinheiro que as profissionais receberam direto dos clientes e ainda não te repassaram. Veja o detalhe na aba
            "Repasses".
          </p>
          <p className="nv-num text-2xl font-bold text-nv-gold">R$ {d.totalPendenteRepasseProfissionais.toFixed(2)}</p>
        </div>
      )}

      <div className="nv-card">
        <h3 className="font-sora font-semibold text-nv-ink mb-1">Clientes por profissional</h3>
        <p className="text-xs text-nv-muted mb-3">
          Conta tanto os clientes cadastrados pela recepção quanto os que a própria profissional cadastrou na aba dela.
        </p>
        <div>
          {d.clientesPorProfissional.map((p, i) => (
            <div key={p.nome} className="flex items-center justify-between py-1.5 text-sm" style={{ borderTop: i === 0 ? "none" : "1px solid #EEF1F7" }}>
              <span className="text-nv-ink2">{p.nome}</span>
              <span className="nv-num font-semibold text-nv-blue">{p.total}</span>
            </div>
          ))}
          {d.clientesPorProfissional.length === 0 && (
            <p className="text-sm text-nv-muted">Nenhuma profissional cadastrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const NV_CORES_AVATAR = ["#0B5FA8", "#1C7C54", "#8A4FA3", "#B4622E"];

function Profissionais() {
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [selecionadaId, setSelecionadaId] = useState(null);
  useEffect(() => {
    api.get("/dono/profissionais").then((r) => {
      setLista(r.data);
      if (r.data.length > 0) setSelecionadaId((atual) => atual || r.data[0].id);
    });
  }, []);

  const buscaLower = busca.trim().toLowerCase();
  const filtrada = lista.filter((p) => {
    if (!buscaLower) return true;
    const alvo = (p.user.nome + " " + (p.especialidades || []).join(" ")).toLowerCase();
    return alvo.includes(buscaLower);
  });

  const selecionada = filtrada.find((p) => p.id === selecionadaId) || filtrada[0];
  const presencaSel = selecionada ? formatarPresenca(selecionada.user.ultimoAcessoEm) : null;

  return (
    <div className="font-publicSans">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="nv-eyebrow mb-1">Painel do Dono</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Profissionais</h1>
          <p className="text-nv-muted text-sm mt-0.5">Clique numa profissional para abrir a ficha completa</p>
        </div>
        <label className="flex items-center gap-2 bg-white border border-nv-border rounded-lg px-3.5 py-2 min-w-[230px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8392A8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome ou especialidade"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="border-none outline-none text-sm text-nv-ink2 w-full"
          />
        </label>
      </div>

      <div className="flex gap-5 flex-wrap items-start">
        <div className="flex-[2_1_420px] grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {filtrada.map((p, i) => {
            const presenca = formatarPresenca(p.user.ultimoAcessoEm);
            const cor = NV_CORES_AVATAR[i % NV_CORES_AVATAR.length];
            const iniciais = p.user.nome
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase();
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelecionadaId(p.id)}
                className={`nv-card text-left flex flex-col gap-3 ${selecionada?.id === p.id ? "!border-nv-blue" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative w-11 h-11 shrink-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center font-sora font-bold text-sm text-white"
                      style={{ background: cor }}
                    >
                      {iniciais}
                    </div>
                    <span
                      className={`nv-dot absolute -right-0.5 -bottom-0.5 ring-2 ring-white ${presenca.online ? "nv-dot-ok" : ""}`}
                      style={!presenca.online ? { background: "#B7C1D1" } : undefined}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-nv-ink2 truncate flex items-center gap-1.5">
                      {p.user.nome}
                      {p.user.role === "DONO" && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-nv-gold/15 text-nv-gold">Dono</span>
                      )}
                    </p>
                    <p className="text-xs text-nv-muted3 truncate">{p.titulo}</p>
                  </div>
                </div>
                {p.especialidades?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.especialidades.slice(0, 2).map((esp) => (
                      <span key={esp} className="text-[11px] font-semibold text-[#3E6FA3] bg-[#EAF1FA] rounded-full px-2.5 py-1">
                        {esp}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-nv-muted3 border-t border-nv-borderLight pt-2.5">
                  <span>{p._count.clientes} clientes ativos</span>
                  <span>{presenca.online ? "visto agora" : presenca.texto.replace("Visto ", "")}</span>
                </div>
              </button>
            );
          })}
          {filtrada.length === 0 && <p className="text-sm text-nv-muted">Nenhuma profissional encontrada.</p>}
        </div>

        {selecionada && (
          <div className="flex-[1_1_320px]">
            <div className="nv-card flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-sora font-bold text-lg text-white shrink-0"
                  style={{ background: NV_CORES_AVATAR[filtrada.indexOf(selecionada) % NV_CORES_AVATAR.length] }}
                >
                  {selecionada.user.nome
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <p className="font-sora font-bold text-base text-nv-ink">{selecionada.user.nome}</p>
                  <p className="text-xs text-nv-muted3 mt-0.5">{selecionada.titulo}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-nv-green/10 rounded-lg px-3 py-2.5">
                <span className={`nv-dot ${presencaSel.online ? "nv-dot-ok" : ""}`} style={!presencaSel.online ? { background: "#B7C1D1" } : undefined} />
                <span className="text-xs font-semibold text-[#22543D]">
                  {presencaSel.online ? "Ativa agora" : `Offline · ${presencaSel.texto}`}
                </span>
              </div>

              {selecionada.bio && <p className="text-[13px] leading-relaxed text-nv-ink2">{selecionada.bio}</p>}

              {selecionada.especialidades?.length > 0 && (
                <div>
                  <p className="text-[11.5px] font-bold text-nv-muted2 uppercase tracking-wide mb-1.5">Especialidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selecionada.especialidades.map((esp) => (
                      <span key={esp} className="text-[11px] font-semibold text-[#3E6FA3] bg-[#EAF1FA] rounded-full px-2.5 py-1">
                        {esp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 border-t border-nv-borderLight pt-3.5">
                <div>
                  <p className="font-sora font-bold text-lg text-nv-ink">{selecionada._count.clientes}</p>
                  <p className="text-[11px] text-nv-muted3 mt-0.5">clientes ativos</p>
                </div>
                <div>
                  <p className="font-sora font-bold text-lg text-nv-ink">
                    {selecionada.taxaRenovacao != null ? `${selecionada.taxaRenovacao}%` : "—"}
                  </p>
                  <p className="text-[11px] text-nv-muted3 mt-0.5">taxa de renovação</p>
                </div>
              </div>

              {selecionada.clientes?.length > 0 && (
                <div className="border-t border-nv-borderLight pt-3.5">
                  <p className="text-[11.5px] font-bold text-nv-muted2 uppercase tracking-wide mb-1.5">Clientes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selecionada.clientes.map((c) => (
                      <span key={c.id} className="text-[11px] font-semibold text-nv-blue bg-nv-blue/10 rounded-full px-2.5 py-1">
                        {c.user.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- AGENDA GERAL (todas as profissionais) ----------------
// Mesma ideia da agenda geral que a atendente já tem — o dono também consegue ver, sessão por
// sessão, se a profissional já entrou na videochamada (sessão de fato em andamento), se já
// terminou, ou se já passou da hora marcada sem ter iniciado (⚠️ Não iniciada — o mesmo critério
// do aviso automático que a gente manda pra ele e pra recepção).
const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

// Cor estável por profissional (mesma profissional sempre com a mesma cor, mesmo mudando a
// ordem da lista entre meses) — soma o código de cada letra do nome e escolhe dentro da mesma
// paleta de 4 cores já usada na tela "Profissionais" (Fase 37).
function corPorNome(nome) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return NV_CORES_AVATAR[soma % NV_CORES_AVATAR.length];
}

function AgendaGeralDono() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());
  const [lista, setLista] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(
    hoje.getFullYear() === ano && hoje.getMonth() === mesIndex ? hoje.getDate() : 1
  );

  useEffect(() => {
    api.get(`/dono/agenda-geral?mes=${mesIndex + 1}&ano=${ano}`).then((r) => setLista(r.data));
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

  const porDia = {};
  for (const a of lista) {
    const dt = new Date(a.data);
    const dia = dt.getDate();
    (porDia[dia] = porDia[dia] || []).push(a);
  }

  const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay();
  const diasNoMes = new Date(ano, mesIndex + 1, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);
  while (celulas.length % 7 !== 0) celulas.push(null);

  const profissionaisDoMes = [...new Set(lista.map((a) => a.profissional.user.nome))].sort();
  const agendamentosDoDia = (porDia[diaSelecionado] || []).sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <div className="font-publicSans">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="nv-eyebrow mb-1">Painel do Dono</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Agenda geral</h1>
          <p className="text-nv-muted text-sm mt-0.5">{NOMES_MES[mesIndex]} de {ano} · clique num dia pra ver os agendamentos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="nv-seg rounded-lg" onClick={() => mudarMes(-1)}>
            ← Mês anterior
          </button>
          <button className="nv-seg rounded-lg" onClick={() => mudarMes(1)}>
            Próximo mês →
          </button>
          {profissionaisDoMes.map((nome) => (
            <span key={nome} className="text-[10.5px] font-semibold text-white rounded-md px-2 py-1 whitespace-nowrap" style={{ background: corPorNome(nome) }}>
              {nome.split(" ").slice(0, 2).join(" ")}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        <div className="flex-[3_1_560px] nv-card">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {DIAS_SEMANA_CURTO.map((d) => (
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
                  {chips.map((a) => (
                    <span
                      key={a.id}
                      className="text-[10px] font-semibold text-white rounded px-1.5 py-0.5 truncate"
                      style={{ background: corPorNome(a.profissional.user.nome) }}
                    >
                      {new Date(a.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {a.cliente.user.nome}
                    </span>
                  ))}
                  {doDia.length > 2 && <span className="text-[10px] text-nv-muted3 font-semibold">+{doDia.length - 2} mais</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-[1_1_280px] nv-card self-start">
          <p className="font-sora font-semibold text-sm text-nv-ink mb-2">
            Dia {diaSelecionado} · {NOMES_MES[mesIndex]}
          </p>
          {agendamentosDoDia.map((a) => {
            const sessao = statusSessao(a);
            return (
              <div key={a.id} className="flex items-start gap-2.5 py-2.5 border-t border-nv-borderLight first:border-t-0">
                <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: corPorNome(a.profissional.user.nome) }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-nv-ink2">
                    {new Date(a.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {a.cliente.user.nome}
                  </p>
                  <p className="text-xs text-nv-muted3 mt-0.5">com {a.profissional.user.nome}</p>
                  <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${CORES_STATUS_SESSAO[sessao.cor]}`}>
                    {sessao.texto}
                  </span>
                </div>
              </div>
            );
          })}
          {agendamentosDoDia.length === 0 && <p className="text-[13px] text-nv-muted3 mt-2">Nenhum agendamento nesse dia.</p>}
        </div>
      </div>
    </div>
  );
}

function formatarDataCurta(data) {
  if (!data) return null;
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function Clientes() {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [modo, setModo] = useState("todos"); // "todos" | "porProfissional"

  async function carregar() {
    const [c, p] = await Promise.all([api.get("/dono/clientes"), api.get("/dono/profissionais")]);
    setLista(c.data);
    setProfissionais(p.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  const ordenados = [...lista].sort((a, b) => a.user.nome.localeCompare(b.user.nome));

  function nomeProfissional(c) {
    if (!c.profissionalAtual?.user?.nome) return "Sem profissional";
    return c.profissionalAtual.user.nome + (c.profissionalAtual.user.role === "DONO" ? " (Dono)" : "");
  }

  function LinhaCliente({ c }) {
    const pacote = c.pacotes[0];
    const contratadoEm = formatarDataCurta(pacote?.iniciadoEm);
    const encerraEm = formatarDataCurta(c.renovarEm || pacote?.encerradoEm);
    const aguardandoRenovacao = pacote?.status === "AGUARDANDO_RENOVACAO";
    return (
      <div>
        <div
          className="flex items-center justify-between gap-3 py-3 border-t border-nv-borderLight cursor-pointer"
          onClick={() => setExpandido(expandido === c.id ? null : c.id)}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <PontoStatus status={c.statusCliente} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-nv-ink2 truncate">{c.user.nome}</span>
              <span className="block text-xs text-nv-muted3 truncate">
                com {nomeProfissional(c)}
                {contratadoEm && ` · contratado em ${contratadoEm}`}
                {encerraEm && ` · encerra em ${encerraEm}`}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-3.5 shrink-0">
            {aguardandoRenovacao && (
              <span className="text-[11px] font-semibold text-[#B0580F] bg-[#FBF0E3] rounded-full px-2.5 py-1 whitespace-nowrap">
                aguardando renovação
              </span>
            )}
            <span className="text-xs font-semibold text-nv-blue whitespace-nowrap">
              {expandido === c.id ? "Fechar ficha" : "Ver ficha"}
            </span>
          </span>
        </div>
        {expandido === c.id && (
          <div className="pb-4 space-y-3 bg-nv-bg -mx-5 px-5 pt-3">
            <MetricasCliente clienteId={c.id} rotaBase="/dono" />
            <ContratoCliente clienteId={c.id} />
            <NotificacaoECliente cliente={c} onExcluido={carregar} />
            <HistoricoPagamentos clienteId={c.id} rotaBase="/dono" />
            <TrocarProfissionalCliente
              clienteId={c.id}
              profissionalAtualNome={c.profissionalAtual?.user?.nome && nomeProfissional(c)}
              profissionais={profissionais}
              rotaBase="/dono"
              onTrocou={carregar}
            />
          </div>
        )}
      </div>
    );
  }

  const grupos = (() => {
    const porProf = {};
    for (const c of ordenados) {
      const chave = nomeProfissional(c);
      (porProf[chave] = porProf[chave] || []).push(c);
    }
    return Object.keys(porProf)
      .sort()
      .map((nome) => ({ nome, clientes: porProf[nome] }));
  })();

  return (
    <div className="font-publicSans">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="nv-eyebrow mb-1">Painel do Dono</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Clientes</h1>
          <p className="text-nv-muted text-sm mt-0.5">{lista.length} clientes, em ordem alfabética</p>
        </div>
        <div>
          <button type="button" className={`nv-seg ${modo === "todos" ? "nv-seg-ativo" : ""}`} onClick={() => setModo("todos")}>
            Todos
          </button>
          <button
            type="button"
            className={`nv-seg ${modo === "porProfissional" ? "nv-seg-ativo" : ""}`}
            onClick={() => setModo("porProfissional")}
          >
            Por profissional
          </button>
        </div>
      </div>

      <div className="nv-card !p-0 px-5">
        {modo === "todos" &&
          ordenados.map((c) => <LinhaCliente key={c.id} c={c} />)}
        {modo === "porProfissional" &&
          grupos.map((g) => (
            <div key={g.nome}>
              <p className="text-[11.5px] font-bold text-nv-muted2 uppercase tracking-wide pt-4 pb-1.5">{g.nome}</p>
              {g.clientes.map((c) => (
                <LinhaCliente key={c.id} c={c} />
              ))}
            </div>
          ))}
        {lista.length === 0 && <p className="text-sm text-nv-muted py-4">Nenhum cliente cadastrado ainda.</p>}
      </div>
    </div>
  );
}

// Contrato assinado do cliente — nome/CPF informados, data do aceite e as fotos (documento e
// rosto) que ele anexou na hora de aceitar. Fica aqui pra conferência/auditoria do dono, direto
// na ficha do cliente, sem precisar procurar em outro lugar.
function ContratoCliente({ clienteId }) {
  const [contrato, setContrato] = useState(undefined);

  useEffect(() => {
    setContrato(undefined);
    api.get(`/dono/clientes/${clienteId}/contrato`).then((r) => setContrato(r.data));
  }, [clienteId]);

  if (contrato === undefined) {
    return <div className="bg-white border border-renascer/10 rounded-lg p-3 text-sm text-renascer-ink/50">Carregando contrato...</div>;
  }

  if (!contrato) {
    return (
      <div className="bg-white border border-renascer/10 rounded-lg p-3 text-sm text-amber-700">
        Esse cliente ainda não aceitou o contrato (nenhum registro encontrado).
      </div>
    );
  }

  return (
    <div className="bg-white border border-renascer/10 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-renascer-ink/60">Contrato aceito</p>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <p>
          <span className="text-renascer-ink/50">Nome informado:</span> {contrato.nomeCompleto}
        </p>
        <p>
          <span className="text-renascer-ink/50">CPF:</span> {contrato.cpf}
        </p>
        <p className="sm:col-span-2">
          <span className="text-renascer-ink/50">Aceito em:</span>{" "}
          {contrato.aceitoEm ? new Date(contrato.aceitoEm).toLocaleString("pt-BR") : "-"}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          className="flex flex-col items-center gap-1"
          onClick={() => abrirImagem(contrato.fotoDocumentoUrl, `Documento — ${contrato.nomeCompleto}`)}
          title="Ver em tamanho grande"
        >
          <img src={contrato.fotoDocumentoUrl} alt="Foto do documento" className="w-20 h-20 object-cover rounded-lg border border-renascer/20" />
          <span className="text-xs text-renascer underline">Foto do documento</span>
        </button>
        {contrato.fotoRostoUrl ? (
          <button
            type="button"
            className="flex flex-col items-center gap-1"
            onClick={() => abrirImagem(contrato.fotoRostoUrl, `Rosto — ${contrato.nomeCompleto}`)}
            title="Ver em tamanho grande"
          >
            <img src={contrato.fotoRostoUrl} alt="Foto do rosto" className="w-20 h-20 object-cover rounded-lg border border-renascer/20" />
            <span className="text-xs text-renascer underline">Foto do rosto</span>
          </button>
        ) : (
          <p className="text-xs text-renascer-ink/40 self-center">Sem foto do rosto (era opcional).</p>
        )}
      </div>
    </div>
  );
}

// Contato de notificação (e-mail/telefone + data de renovação) e exclusão do login —
// o dono pode excluir qualquer cliente diretamente por aqui.
function NotificacaoECliente({ cliente, onExcluido }) {
  const [notifEmail, setNotifEmail] = useState(cliente.notifEmail || "");
  const [notifTelefone, setNotifTelefone] = useState(cliente.notifTelefone || "");
  const [renovarEm, setRenovarEm] = useState(cliente.renovarEm ? new Date(cliente.renovarEm).toISOString().slice(0, 10) : "");
  const [msg, setMsg] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  async function salvar() {
    setMsg("");
    try {
      await api.put(`/dono/clientes/${cliente.id}/notificacao`, {
        notifEmail: notifEmail || null,
        notifTelefone: notifTelefone || null,
        renovarEm: renovarEm || null,
      });
      setMsg("Salvo! O sistema vai usar esses dados pra mandar os avisos automáticos.");
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar.");
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o login de ${cliente.user.nome}? Isso apaga sessões, mensagens e pacotes dele. Não tem como desfazer.`)) return;
    setExcluindo(true);
    setMsg("");
    try {
      await api.delete(`/dono/clientes/${cliente.id}`);
      onExcluido?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao excluir cliente.");
      setExcluindo(false);
    }
  }

  return (
    <div className="bg-white border border-renascer/10 rounded-lg p-3 space-y-2">
      <p className="text-xs text-renascer-ink/50">
        Contato pra avisos automáticos (sessão/renovação) — pode ser diferente do login — e a data prevista de renovação.
      </p>
      <div className="grid sm:grid-cols-3 gap-2">
        <input className="input" placeholder="E-mail para notificação" value={notifEmail} onChange={(e) => setNotifEmail(e.target.value)} />
        <input className="input" placeholder="Telefone para notificação" value={notifTelefone} onChange={(e) => setNotifTelefone(e.target.value)} />
        <input type="date" className="input" value={renovarEm} onChange={(e) => setRenovarEm(e.target.value)} />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button className="btn-secondary text-sm" onClick={salvar}>
          Salvar
        </button>
        <button className="text-red-600 text-sm underline" onClick={excluir} disabled={excluindo}>
          {excluindo ? "Excluindo..." : "Excluir login deste cliente"}
        </button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

// Histórico de pagamentos do cliente (contratações, renovações, sessões extra) — os
// comprovantes anexados ficam guardados aqui pra sempre poder ver de novo.
function HistoricoPagamentos({ clienteId, rotaBase }) {
  const [lista, setLista] = useState([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setCarregado(false);
    api.get(`${rotaBase}/clientes/${clienteId}/transacoes`).then((r) => {
      setLista(r.data);
      setCarregado(true);
    });
  }, [clienteId, rotaBase]);

  return (
    <div className="bg-white border border-renascer/10 rounded-lg p-3 space-y-1">
      <p className="text-xs font-medium text-renascer-ink/60">Pagamentos registrados</p>
      {!carregado && <p className="text-xs text-renascer-ink/40">Carregando...</p>}
      {carregado && lista.length === 0 && <p className="text-xs text-renascer-ink/40">Nenhum pagamento registrado ainda.</p>}
      {lista.map((t) => (
        <div key={t.id} className="flex items-center justify-between flex-wrap gap-1 text-xs border-t border-renascer/10 pt-1">
          <span>
            {new Date(t.data).toLocaleDateString("pt-BR")} · {t.profissional?.user?.nome} · {TIPO_LABEL[t.tipo] || t.tipo} · R${" "}
            {t.valorTotal.toFixed(2)}
          </span>
          {t.temComprovante ? (
            <button className="text-renascer underline" onClick={() => verComprovante(t.id)}>
              Ver comprovante
            </button>
          ) : (
            <span className="text-renascer-ink/30">sem comprovante</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MetricasCliente({ clienteId, rotaBase }) {
  const [m, setM] = useState(null);
  useEffect(() => {
    api.get(`${rotaBase}/clientes/${clienteId}/metricas`).then((r) => setM(r.data));
  }, [clienteId, rotaBase]);

  if (!m) return <p className="text-xs text-renascer-ink/40">Carregando métricas...</p>;

  const cartoes = [
    ["Cliente desde", new Date(m.clienteDesde).toLocaleDateString("pt-BR")],
    ["Tempo de casa", `${m.diasDeCasa} dia(s)`],
    ["Pacotes contratados", m.totalPacotesContratados],
    ["Renovações", m.renovacoes],
    ["Sessões realizadas", m.sessoesRealizadas],
    ["Total pago", `R$ ${m.valorTotalPago.toFixed(2)}`],
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {cartoes.map(([label, valor]) => (
        <div key={label} className="bg-white border border-renascer/10 rounded-lg p-2">
          <p className="text-xs text-renascer-ink/50">{label}</p>
          <p className="font-semibold text-renascer">{valor}</p>
        </div>
      ))}
    </div>
  );
}

function Financeiro() {
  const [f, setF] = useState(null);
  async function carregar() {
    const r = await api.get("/dono/financeiro");
    setF(r.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function reclassificar(id) {
    if (!window.confirm("Confirma que foi a profissional quem recebeu esse pagamento direto do cliente? Isso passa a contar como pendência de repasse dela.")) return;
    await api.put(`/dono/transacoes/${id}/reclassificar-profissional`);
    carregar();
  }

  if (!f) return <p>Carregando...</p>;
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">Por profissional (mês atual)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th>Profissional</th>
              <th>Total recebido</th>
              <th>Repasse profissional</th>
              <th>Receita Renascer</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(f.porProfissional).map(([nome, v]) => (
              <tr key={nome} className="border-t border-renascer/10">
                <td className="py-1">{nome}</td>
                <td>R$ {v.totalRecebido.toFixed(2)}</td>
                <td>R$ {v.valorProfissional.toFixed(2)}</td>
                <td>R$ {v.valorRenascer.toFixed(2)}</td>
              </tr>
            ))}
            {Object.keys(f.porProfissional).length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-renascer-ink/50">
                  Nenhuma transação neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">Todas as transações do mês</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th className="py-1">Data</th>
              <th>Profissional</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Total</th>
              <th>Recebido por</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {f.transacoes.map((t) => (
              <tr key={t.id} className="border-t border-renascer/10">
                <td className="py-1">{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                <td>{t.profissional.user.nome}</td>
                <td>{t.cliente?.user?.nome || "-"}</td>
                <td>{TIPO_LABEL[t.tipo] || t.tipo}</td>
                <td>R$ {t.valorTotal.toFixed(2)}</td>
                <td>
                  {t.recebidoPor === "PROFISSIONAL" ? (
                    t.repassado ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Profissional (repassado)</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700">Profissional (pendente)</span>
                    )
                  ) : (
                    <div className="space-y-0.5">
                      <span className="badge bg-renascer-light text-renascer">Clínica</span>
                      <button
                        className="block text-[11px] text-amber-700 underline"
                        onClick={() => reclassificar(t.id)}
                        title="Use se souber que, na prática, foi a profissional quem recebeu esse pagamento direto"
                      >
                        Corrigir: foi a profissional
                      </button>
                    </div>
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
            {f.transacoes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-2 text-renascer-ink/50">
                  Nenhuma transação neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Dinheiro que as profissionais receberam direto dos clientes (fora da clínica) e ainda devem
// repassar a parte da Renascer. Dá pra lançar um valor recebido (baixa as pendências mais
// antigas dela automaticamente) ou marcar uma transação específica na mão.
function RepassesProfissionais() {
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [valorLancar, setValorLancar] = useState({});
  const [msg, setMsg] = useState({});

  async function carregar() {
    const { data } = await api.get("/dono/repasses-pendentes");
    setDados(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function marcar(id) {
    await api.put(`/dono/repasses/${id}/marcar`);
    carregar();
  }

  async function lancar(nome, profissionalId) {
    const valor = valorLancar[nome];
    if (!valor) return;
    try {
      const { data } = await api.post(`/dono/repasses/${profissionalId}/lancar`, { valor: Number(valor) });
      setMsg({
        ...msg,
        [nome]: data.aviso || `${data.marcadas} pagamento(s) marcado(s) como recebido(s) (R$ ${data.valorConsiderado.toFixed(2)}).`,
      });
      setValorLancar({ ...valorLancar, [nome]: "" });
      carregar();
    } catch (e) {
      setMsg({ ...msg, [nome]: e?.response?.data?.erro || "Erro ao lançar recebimento." });
    }
  }

  if (!dados) return <p>Carregando...</p>;

  const profissionais = Object.entries(dados.porProfissional || {});

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold mb-1">Repasses das profissionais</h2>
        <p className="text-xs text-renascer-ink/50">
          Quando uma profissional recebe o pagamento direto do cliente (fora da clínica), ela fica devendo pra Renascer a
          parte que é sua. Aqui você lança quanto recebeu de cada uma — ou marca um pagamento específico como recebido —
          e a pendência baixa sozinha.
        </p>
      </div>

      {profissionais.length === 0 && (
        <div className="card">
          <p className="text-sm text-renascer-ink/50">Nenhuma pendência de repasse no momento — tudo em dia.</p>
        </div>
      )}

      {profissionais.map(([nome, info]) => {
        const aguardandoConfirmacao = info.transacoes.filter((t) => t.repasseSolicitadoEm).length;
        return (
        <div key={nome} className="card">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold">{nome}</p>
              <p className="text-xs text-renascer-ink/50">
                {info.transacoes.length} pagamento(s) pendente(s)
                {aguardandoConfirmacao > 0 && (
                  <span className="text-amber-700"> · {aguardandoConfirmacao} com comprovante aguardando sua confirmação</span>
                )}
              </p>
            </div>
            <p className="text-xl font-bold text-amber-700">R$ {info.totalPendente.toFixed(2)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3 border-t border-renascer/10 pt-3">
            <input
              className="input !w-auto flex-1 min-w-[150px]"
              placeholder="Valor que você recebeu dela"
              value={valorLancar[nome] || ""}
              onChange={(e) => setValorLancar({ ...valorLancar, [nome]: e.target.value })}
            />
            <button className="btn-primary text-sm" onClick={() => lancar(nome, info.profissionalId)}>
              Lançar recebimento
            </button>
            <button className="btn-secondary text-sm" onClick={() => setAberto(aberto === nome ? null : nome)}>
              {aberto === nome ? "Fechar lista" : "Ver pagamentos"}
            </button>
          </div>
          {msg[nome] && <p className="text-sm mt-2">{msg[nome]}</p>}

          {aberto === nome && (
            <div className="mt-3 space-y-2">
              {info.transacoes.map((t) => (
                <div key={t.id} className="flex items-center justify-between flex-wrap gap-2 text-sm border-t border-renascer/10 pt-2">
                  <div>
                    <p>
                      {new Date(t.data).toLocaleDateString("pt-BR")} · {t.cliente?.user?.nome || "cliente"} · {TIPO_LABEL[t.tipo] || t.tipo} · você
                      recebe R$ {t.valorRenascer.toFixed(2)}
                    </p>
                    {t.repasseSolicitadoEm ? (
                      <p className="text-xs mt-0.5">
                        <span className="badge bg-amber-100 text-amber-700">Comprovante enviado — aguardando você</span>
                        {t.repasseValorInformado != null && (
                          <span className={t.bateComEsperado ? "text-emerald-700 ml-1" : "text-red-600 ml-1"}>
                            {t.bateComEsperado
                              ? `Valor bate certinho: R$ ${t.repasseValorInformado.toFixed(2)}`
                              : `Atenção: valor no comprovante é R$ ${t.repasseValorInformado.toFixed(2)} (esperado R$ ${t.valorRenascer.toFixed(2)})`}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-renascer-ink/40 mt-0.5">Ainda não enviou comprovante desse repasse.</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.temComprovanteRepasse && (
                      <button className="text-renascer text-xs underline" onClick={() => verComprovanteRepasse(t.id)}>
                        Ver comprovante
                      </button>
                    )}
                    <button
                      className={`text-xs underline ${t.repasseSolicitadoEm ? "text-emerald-700" : "text-renascer"}`}
                      onClick={() => marcar(t.id)}
                    >
                      {t.repasseSolicitadoEm ? "Confirmar repasse" : "Marcar como recebido (sem comprovante)"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

function Usuarios() {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    senha: "",
    role: "PROFISSIONAL",
    profissionalAtualId: "",
    tambemProfissional: false,
  });
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState(null);
  const [ativandoId, setAtivandoId] = useState(null);
  const [supervisionandoId, setSupervisionandoId] = useState(null); // Fase 33 — Secretaria/Supervisão

  async function carregar() {
    const [u, p] = await Promise.all([api.get("/dono/usuarios"), api.get("/dono/profissionais")]);
    setLista(u.data);
    setProfissionais(p.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    setMsg("");
    try {
      await api.post("/dono/usuarios", form);
      setMsg("Usuário criado com sucesso!");
      setForm({
        nome: "",
        email: "",
        telefone: "",
        senha: "",
        role: "PROFISSIONAL",
        profissionalAtualId: "",
        tambemProfissional: false,
      });
      carregar();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao criar usuário.");
    }
  }

  async function excluir(u) {
    if (!window.confirm(`Excluir o login de ${u.nome} (${u.role})? Isso apaga tudo ligado a esse login. Não tem como desfazer.`)) return;
    try {
      await api.delete(`/dono/usuarios/${u.id}`);
      carregar();
    } catch (e) {
      alert(e?.response?.data?.erro || "Erro ao excluir usuário.");
    }
  }

  // Ativa a agenda de atendimento pra outro Dono (mesma ação que o próprio Dono usa na aba
  // "Atender pacientes" pra ativar no login dele) — usado aqui pra ativar no login de OUTRO
  // dono direto pela lista de usuários, sem precisar entrar com o login dele.
  async function ativarAtendimento(u) {
    setAtivandoId(u.id);
    try {
      await api.post(`/dono/usuarios/${u.id}/tornar-profissional`, {});
      carregar();
    } catch (e) {
      alert(e?.response?.data?.erro || "Não foi possível ativar o atendimento pra esse login.");
    } finally {
      setAtivandoId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-3">Criar novo login</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="input" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <input className="input" placeholder="Senha provisória" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="PROFISSIONAL">Profissional</option>
            <option value="ATENDENTE">Atendente</option>
            <option value="DONO">Dono</option>
            <option value="CLIENTE">Cliente</option>
            <option value="FINANCEIRO">Setor Financeiro</option>
          </select>
          {form.role === "CLIENTE" && (
            <select
              className="input"
              value={form.profissionalAtualId}
              onChange={(e) => setForm({ ...form, profissionalAtualId: e.target.value })}
            >
              <option value="">Vincular profissional (opcional)</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.nome}
                  {p.user.role === "DONO" ? " (Dono)" : ""}
                </option>
              ))}
            </select>
          )}
          {form.role === "DONO" && (
            <label className="flex items-center gap-2 text-sm text-renascer-ink/70 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.tambemProfissional}
                onChange={(e) => setForm({ ...form, tambemProfissional: e.target.checked })}
              />
              Esse dono também atende pacientes (ganha uma agenda própria de profissional, sem repasse)
            </label>
          )}
        </div>
        <button className="btn-primary mt-3" onClick={criar}>
          Criar login
        </button>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">Todos os usuários</h2>
        <p className="text-xs text-renascer-ink/50 mb-2">
          Como dono, você pode editar ou excluir qualquer login (cliente, profissional, atendente ou outro dono).
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.flatMap((u) => {
              const linhas = [
                <tr key={u.id} className="border-t border-renascer/10">
                  <td className="py-1">{u.nome}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="text-right whitespace-nowrap">
                    {u.role === "DONO" && !u.profissional && (
                      <button
                        className="text-renascer text-xs underline mr-3"
                        disabled={ativandoId === u.id}
                        onClick={() => ativarAtendimento(u)}
                      >
                        {ativandoId === u.id ? "Ativando..." : "Ativar atendimento"}
                      </button>
                    )}
                    {u.role === "DONO" && u.profissional && (
                      <span className="text-xs text-renascer-ink/40 mr-3">também atende pacientes</span>
                    )}
                    {u.role === "ATENDENTE" && (
                      <button
                        className="text-renascer text-xs underline mr-3"
                        onClick={() => setSupervisionandoId(supervisionandoId === u.id ? null : u.id)}
                      >
                        {supervisionandoId === u.id ? "Fechar supervisão" : "Supervisão"}
                      </button>
                    )}
                    <button className="text-renascer text-xs underline mr-3" onClick={() => setEditando(editando === u.id ? null : u.id)}>
                      {editando === u.id ? "Fechar" : "Editar"}
                    </button>
                    <button className="text-red-600 text-xs underline" onClick={() => excluir(u)}>
                      Excluir
                    </button>
                  </td>
                </tr>,
              ];
              if (editando === u.id) {
                linhas.push(
                  <tr key={`${u.id}-editar`} className="border-t border-renascer/10 bg-renascer-light/20">
                    <td colSpan={5} className="py-2">
                      <EditarUsuario usuario={u} onSalvo={() => { setEditando(null); carregar(); }} />
                    </td>
                  </tr>
                );
              }
              if (supervisionandoId === u.id) {
                linhas.push(
                  <tr key={`${u.id}-supervisao`} className="border-t border-renascer/10 bg-renascer-light/20">
                    <td colSpan={5} className="py-3">
                      <SupervisaoSecretaria usuarioId={u.id} nome={u.nome} />
                    </td>
                  </tr>
                );
              }
              return linhas;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditarUsuario({ usuario, onSalvo }) {
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [telefone, setTelefone] = useState(usuario.telefone || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [msg, setMsg] = useState("");

  async function salvar() {
    setMsg("");
    try {
      await api.put(`/dono/usuarios/${usuario.id}`, { nome, email, telefone, novaSenha: novaSenha || undefined });
      setMsg("Salvo!");
      setNovaSenha("");
      onSalvo?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar.");
    }
  }

  return (
    <div className="bg-white border border-renascer/10 rounded-lg p-3 space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <input className="input" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input className="input" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <input className="input" placeholder="Nova senha (deixe em branco pra não trocar)" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
      </div>
      <button className="btn-primary text-sm" onClick={salvar}>
        Salvar alterações
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

// ---------- Secretaria — Supervisão de setor (Fase 33) ----------
// Painel do Dono acompanhando um login da recepção: presença (online agora/tempo online hoje),
// indicadores do dia (cadastros, reativações, suportes) e um gráfico dos últimos 7 dias. Aberto
// direto da lista de Usuários, clicando em "Supervisão" na linha de um login Atendente.

function formatarTempoOnline(segundos) {
  const totalMin = Math.round((segundos || 0) / 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min}min`;
  return `${h}h ${min}min`;
}

function formatarHaQuanto(iso) {
  if (!iso) return "";
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 60) return `há ${minutos}min`;
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  return `há ${h}h ${min}min`;
}

function SupervisaoSecretaria({ usuarioId, nome }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    setDados(null);
    setErro("");
    api
      .get(`/dono/usuarios/${usuarioId}/supervisao`)
      .then(({ data }) => {
        if (ativo) setDados(data);
      })
      .catch((e) => {
        if (ativo) setErro(e?.response?.data?.erro || "Não foi possível carregar a supervisão.");
      });
    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  if (erro) return <p className="text-sm text-red-600">{erro}</p>;
  if (!dados) return <p className="text-sm text-renascer-ink/50">Carregando supervisão de {nome}...</p>;

  const { presenca, indicadores, cadastrosPorDia, atividades } = dados;
  const maxCadastro = Math.max(1, ...cadastrosPorDia.map((d) => d.total));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold">Supervisão de {nome}</p>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            presenca.onlineAgora ? "bg-emerald-100 text-emerald-700" : "bg-renascer-ink/10 text-renascer-ink/50"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${presenca.onlineAgora ? "bg-emerald-500 animate-pulse" : "bg-renascer-ink/30"}`} />
          {presenca.onlineAgora ? `Online agora · ${formatarHaQuanto(presenca.onlineDesde)}` : "Offline no momento"}
        </span>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <div className="bg-white border border-renascer/10 rounded-lg p-3">
          <p className="text-xs text-renascer-ink/50 mb-1">Tempo online hoje</p>
          <p className="font-semibold text-lg tabular-nums">{formatarTempoOnline(presenca.tempoOnlineHojeSegundos)}</p>
        </div>
        <div className="bg-white border border-renascer/10 rounded-lg p-3">
          <p className="text-xs text-renascer-ink/50 mb-1">Clientes cadastrados hoje</p>
          <p className="font-semibold text-lg tabular-nums">{indicadores.clientesCadastradosHoje}</p>
        </div>
        <div className="bg-white border border-renascer/10 rounded-lg p-3">
          <p className="text-xs text-renascer-ink/50 mb-1">Reativações hoje</p>
          <p className="font-semibold text-lg tabular-nums">{indicadores.reativacoesHoje}</p>
        </div>
        <div className="bg-white border border-renascer/10 rounded-lg p-3">
          <p className="text-xs text-renascer-ink/50 mb-1">Suportes atendidos</p>
          <p className="font-semibold text-lg tabular-nums">{indicadores.suportesAtendidosHoje}</p>
        </div>
      </div>

      <div className="bg-white border border-renascer/10 rounded-lg p-3">
        <p className="text-sm font-semibold mb-2">Cadastros por dia — últimos 7 dias</p>
        <div className="flex items-end gap-2 h-24">
          {cadastrosPorDia.map((d) => (
            <div key={d.data} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full max-w-[26px] bg-renascer rounded-t"
                style={{ height: `${Math.max(4, (d.total / maxCadastro) * 100)}%` }}
                title={`${d.total} cadastro(s)`}
              />
              <span className="text-[10px] text-renascer-ink/50 font-semibold">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-renascer/10 rounded-lg p-3">
        <p className="text-sm font-semibold mb-2">Atividade de hoje</p>
        {atividades.length === 0 && (
          <p className="text-xs text-renascer-ink/40">Nenhuma atividade registrada hoje ainda.</p>
        )}
        {atividades.map((a, i) => (
          <div key={i} className="flex justify-between py-1.5 border-t border-renascer/10 first:border-t-0">
            <span className="text-sm text-renascer-ink/80">{a.texto}</span>
            <span className="text-xs text-renascer-ink/40">{a.hora}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuporteEscalado() {
  const [tickets, setTickets] = useState([]);
  const [resposta, setResposta] = useState({});

  async function carregar() {
    const { data } = await api.get("/dono/suporte-gerencia");
    setTickets(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function responder(id) {
    if (!resposta[id]) return;
    await api.post(`/dono/suporte-gerencia/${id}/responder`, { texto: resposta[id] });
    setResposta({ ...resposta, [id]: "" });
    carregar();
  }

  async function resolver(id) {
    await api.put(`/dono/suporte-gerencia/${id}/resolver`);
    carregar();
  }

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <div key={t.id} className="card">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold">{t.assunto}</p>
              <p className="text-xs text-renascer-ink/50">
                Cliente: {t.cliente.user.nome} · Profissional: {t.cliente.profissionalAtual?.user?.nome || "-"}
              </p>
            </div>
            <span className="badge bg-red-100 text-red-700">{t.status}</span>
          </div>
          <div className="my-2 space-y-1">
            {t.mensagens.map((m) => (
              <p key={m.id} className="text-sm">
                {m.texto}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="input flex-1 min-w-[150px]"
              placeholder="Responder..."
              value={resposta[t.id] || ""}
              onChange={(e) => setResposta({ ...resposta, [t.id]: e.target.value })}
            />
            <button className="btn-secondary" onClick={() => responder(t.id)}>
              Enviar
            </button>
            <button className="btn-primary" onClick={() => resolver(t.id)}>
              Resolver
            </button>
          </div>
        </div>
      ))}
      {tickets.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhum chamado escalado no momento.</p>}
    </div>
  );
}

// ========== Financeiro pessoal (privado — só o dono vê; totalmente isolado do financeiro da clínica) ==========

const CATEGORIA_PESSOAL_LABEL = {
  TURBINE: "Turbine",
  RENASCER: "Renascer",
  ATENDIMENTO: "Atendimento/Consulta",
  CARTAO: "Cartão",
  CASA: "Casa",
  ALIMENTOS: "Alimentos",
  FARMACIA: "Farmácia",
  ESPOSA: "Esposa",
  FILHOS: "Filhos",
  PENSAO: "Pensão",
  PESSOA: "Pessoa",
  OUTROS: "Outros",
};
const CATEGORIAS_RECEITA_PESSOAL = ["TURBINE", "RENASCER", "ATENDIMENTO", "OUTROS"];
const CATEGORIAS_DESPESA_PESSOAL = ["CARTAO", "CASA", "ALIMENTOS", "FARMACIA", "ESPOSA", "FILHOS", "PENSAO", "PESSOA", "OUTROS"];
const STATUS_DESPESA_PESSOAL = {
  ATRASADO: { label: "Atrasado", cls: "bg-red-100 text-red-700" },
  VENCE_EM_BREVE: { label: "Vence em breve", cls: "bg-amber-100 text-amber-700" },
  PENDENTE: { label: "Pendente", cls: "bg-renascer-light text-renascer" },
  PAGO: { label: "Pago", cls: "bg-emerald-100 text-emerald-700" },
};

function AbaFinancaPessoal() {
  const [subaba, setSubaba] = useState("resumo");
  const SUBABAS = [
    { id: "resumo", label: "Resumo" },
    { id: "lancamentos", label: "Lançamentos" },
    { id: "metas", label: "Metas" },
    { id: "poupanca", label: "Poupança" },
    { id: "notas", label: "Anotações" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-renascer-ink">Financeiro pessoal</h2>
        <p className="text-xs text-renascer-ink/50">Só você vê esta aba. Não afeta o financeiro da clínica nem dos profissionais.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {SUBABAS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubaba(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              subaba === s.id ? "bg-renascer text-white" : "bg-renascer-light text-renascer"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {subaba === "resumo" && <ResumoFinancaPessoal />}
      {subaba === "lancamentos" && <LancamentosFinancaPessoal />}
      {subaba === "metas" && <MetasFinancaPessoal />}
      {subaba === "poupanca" && <PoupancaFinancaPessoal />}
      {subaba === "notas" && <NotasFinancaPessoal />}
    </div>
  );
}

function KpiCardPessoal({ label, valor, cor }) {
  const cores = {
    emerald: "text-emerald-700",
    red: "text-red-600",
    renascer: "text-renascer",
  };
  return (
    <div className="card">
      <p className="text-xs text-renascer-ink/50 mb-1">{label}</p>
      <p className={`text-xl font-bold ${cores[cor] || "text-renascer-ink"}`}>R$ {valor.toFixed(2)}</p>
    </div>
  );
}

function BarraMetaPessoal({ meta, onAdicionar, onExcluir }) {
  const pct = meta.valorMeta > 0 ? Math.min(100, (meta.valorAtual / meta.valorMeta) * 100) : 0;
  return (
    <div className="border border-renascer/10 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium">{meta.titulo}</p>
        {onExcluir && (
          <button className="text-xs text-red-600 underline" onClick={onExcluir}>
            Excluir
          </button>
        )}
      </div>
      <div className="h-2 rounded-full bg-renascer-light overflow-hidden">
        <div className="h-full bg-renascer" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1 text-xs text-renascer-ink/60">
        <span>
          R$ {meta.valorAtual.toFixed(2)} de R$ {meta.valorMeta.toFixed(2)} ({pct.toFixed(0)}%)
        </span>
        {meta.dataAlvo && <span>até {new Date(meta.dataAlvo).toLocaleDateString("pt-BR")}</span>}
      </div>
      {onAdicionar && (
        <button className="btn-secondary text-xs mt-2" onClick={onAdicionar}>
          + Adicionar valor
        </button>
      )}
    </div>
  );
}

function ResumoFinancaPessoal() {
  const [dados, setDados] = useState(null);
  const [historico, setHistorico] = useState([]);

  async function carregar() {
    const [r1, r2] = await Promise.all([
      api.get("/financa-pessoal/resumo"),
      api.get("/financa-pessoal/historico-mensal"),
    ]);
    setDados(r1.data);
    setHistorico(r2.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  if (!dados) return <p>Carregando...</p>;

  const maxHistorico = Math.max(1, ...historico.map((h) => Math.max(h.totalReceitas, h.totalDespesas)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCardPessoal label="Total entrado" valor={dados.totalReceitas} cor="emerald" />
        <KpiCardPessoal label="Total de despesas" valor={dados.totalDespesas} cor="red" />
        <KpiCardPessoal label="Saldo" valor={dados.saldo} cor={dados.saldo >= 0 ? "emerald" : "red"} />
        <KpiCardPessoal label="Poupança total" valor={dados.totalPoupanca} cor="renascer" />
      </div>

      {(dados.qtdAtrasadas > 0 || dados.qtdVenceEmBreve > 0) && (
        <div className="card border border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            {dados.qtdAtrasadas > 0 && (
              <>
                ⚠ {dados.qtdAtrasadas} despesa(s) atrasada(s), totalizando R$ {dados.totalAtrasado.toFixed(2)}.{" "}
              </>
            )}
            {dados.qtdVenceEmBreve > 0 && <>{dados.qtdVenceEmBreve} despesa(s) vencem em breve.</>}
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-2">Próximas a vencer</h3>
        <div className="space-y-2">
          {dados.proximasVencer.map((d) => {
            const st = STATUS_DESPESA_PESSOAL[d.status];
            return (
              <div key={d.id} className="flex items-center justify-between text-sm border-t border-renascer/10 pt-2 first:border-0 first:pt-0">
                <div>
                  <p className="font-medium">
                    {CATEGORIA_PESSOAL_LABEL[d.categoria]}
                    {d.descricao ? ` — ${d.descricao}` : ""}
                    {d.pessoa ? ` (${d.pessoa})` : ""}
                  </p>
                  <p className="text-xs text-renascer-ink/50">
                    {d.dataVencimento ? new Date(d.dataVencimento).toLocaleDateString("pt-BR") : "sem data"}
                    {d.diasParaVencer !== null && (
                      <> · {d.diasParaVencer < 0 ? `${Math.abs(d.diasParaVencer)} dia(s) atrasado` : `em ${d.diasParaVencer} dia(s)`}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">R$ {d.valor.toFixed(2)}</span>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
          {dados.proximasVencer.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma despesa pendente.</p>}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">Histórico mensal — quanto recebi por mês</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th className="py-1">Mês</th>
              <th>Recebido</th>
              <th>Gasto</th>
              <th>Saldo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {historico.map((h) => (
              <tr key={h.chave} className="border-t border-renascer/10">
                <td className="py-2 whitespace-nowrap">{h.mesAno}</td>
                <td className="text-emerald-700 whitespace-nowrap">R$ {h.totalReceitas.toFixed(2)}</td>
                <td className="text-red-600 whitespace-nowrap">R$ {h.totalDespesas.toFixed(2)}</td>
                <td className={`whitespace-nowrap ${h.saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}>R$ {h.saldo.toFixed(2)}</td>
                <td className="w-1/3 min-w-[100px]">
                  <div className="h-1.5 rounded-full bg-red-100 overflow-hidden mb-1">
                    <div className="h-full bg-emerald-500" style={{ width: `${(h.totalReceitas / maxHistorico) * 100}%` }} />
                  </div>
                  <div className="h-1.5 rounded-full bg-renascer-light overflow-hidden">
                    <div className="h-full bg-red-400" style={{ width: `${(h.totalDespesas / maxHistorico) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
            {historico.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-renascer-ink/50">
                  Nenhum lançamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dados.metas.length > 0 && (
        <div className="card space-y-3">
          <h3 className="font-semibold">Metas</h3>
          {dados.metas.map((m) => (
            <BarraMetaPessoal key={m.id} meta={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function FormLancamentoPessoal({ inicial, onSalvo, onCancelar }) {
  const ehEdicao = !!inicial;
  const [tipo, setTipo] = useState(inicial?.tipo || "RECEITA");
  const [categoria, setCategoria] = useState(inicial?.categoria || "TURBINE");
  const [descricao, setDescricao] = useState(inicial?.descricao || "");
  const [pessoa, setPessoa] = useState(inicial?.pessoa || "");
  const [valor, setValor] = useState(inicial?.valor !== undefined ? String(inicial.valor) : "");
  const [parcelaAtual, setParcelaAtual] = useState(inicial?.parcelaAtual ? String(inicial.parcelaAtual) : "");
  const [totalParcelas, setTotalParcelas] = useState(inicial?.totalParcelas ? String(inicial.totalParcelas) : "");
  const [dataVencimento, setDataVencimento] = useState(inicial?.dataVencimento ? inicial.dataVencimento.slice(0, 10) : "");
  const [observacao, setObservacao] = useState(inicial?.observacao || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const opcoes = tipo === "RECEITA" ? CATEGORIAS_RECEITA_PESSOAL : CATEGORIAS_DESPESA_PESSOAL;
    if (!opcoes.includes(categoria)) setCategoria(opcoes[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  async function salvar() {
    if (!valor) {
      setErro("Informe o valor.");
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const payload = {
        tipo,
        categoria,
        descricao: descricao || null,
        pessoa: tipo === "DESPESA" && categoria === "PESSOA" ? pessoa || null : null,
        valor: Number(valor),
        parcelaAtual: parcelaAtual ? Number(parcelaAtual) : null,
        totalParcelas: totalParcelas ? Number(totalParcelas) : null,
        dataVencimento: tipo === "DESPESA" && dataVencimento ? dataVencimento : null,
        observacao: observacao || null,
      };
      if (ehEdicao) {
        await api.put(`/financa-pessoal/lancamentos/${inicial.id}`, payload);
      } else {
        await api.post("/financa-pessoal/lancamentos", payload);
      }
      onSalvo();
    } catch (e) {
      setErro(e?.response?.data?.erro || "Erro ao salvar lançamento.");
    } finally {
      setSalvando(false);
    }
  }

  const opcoesCategoria = tipo === "RECEITA" ? CATEGORIAS_RECEITA_PESSOAL : CATEGORIAS_DESPESA_PESSOAL;

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">{ehEdicao ? "Editar lançamento" : "Novo lançamento"}</h3>
      <div className="flex gap-2">
        <button className={tipo === "RECEITA" ? "btn-primary" : "btn-secondary"} onClick={() => setTipo("RECEITA")}>
          Recebimento
        </button>
        <button className={tipo === "DESPESA" ? "btn-primary" : "btn-secondary"} onClick={() => setTipo("DESPESA")}>
          Despesa
        </button>
      </div>
      <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {opcoesCategoria.map((c) => (
          <option key={c} value={c}>
            {CATEGORIA_PESSOAL_LABEL[c]}
          </option>
        ))}
      </select>
      {categoria === "OUTROS" && (
        <input
          className="input"
          placeholder={tipo === "RECEITA" ? "De onde veio esse valor?" : "Pra onde foi esse valor?"}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      )}
      {tipo === "DESPESA" && categoria === "PESSOA" && (
        <input className="input" placeholder="Nome da pessoa" value={pessoa} onChange={(e) => setPessoa(e.target.value)} />
      )}
      <input className="input" type="number" step="0.01" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
      {tipo === "DESPESA" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input"
              type="number"
              placeholder="Parcela atual (ex: 2)"
              value={parcelaAtual}
              onChange={(e) => setParcelaAtual(e.target.value)}
            />
            <input
              className="input"
              type="number"
              placeholder="Total de parcelas (ex: 6)"
              value={totalParcelas}
              onChange={(e) => setTotalParcelas(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-renascer-ink/50">Data para pagar</label>
            <input className="input" type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
          </div>
        </>
      )}
      <textarea
        className="input"
        placeholder="Observação (opcional)"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
      />
      {erro && <p className="text-red-600 text-sm">{erro}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button className="btn-secondary" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function LancamentosFinancaPessoal() {
  const [lista, setLista] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [editando, setEditando] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function carregar() {
    const params = filtroTipo ? { tipo: filtroTipo } : {};
    const r = await api.get("/financa-pessoal/lancamentos", { params });
    setLista(r.data);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTipo]);

  async function excluir(id) {
    if (!window.confirm("Excluir este lançamento?")) return;
    await api.delete(`/financa-pessoal/lancamentos/${id}`);
    carregar();
  }
  async function marcarPago(id) {
    await api.put(`/financa-pessoal/lancamentos/${id}/pagar`);
    carregar();
  }
  async function desmarcarPago(id) {
    await api.put(`/financa-pessoal/lancamentos/${id}/desmarcar-pago`);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold">Lançamentos</h3>
          <button
            className="btn-primary"
            onClick={() => {
              setEditando(null);
              setMostrarForm(true);
            }}
          >
            + Novo lançamento
          </button>
        </div>
        <div className="flex gap-2 mb-3">
          {[
            { id: "", label: "Todos" },
            { id: "RECEITA", label: "Recebimentos" },
            { id: "DESPESA", label: "Despesas" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltroTipo(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filtroTipo === f.id ? "bg-renascer text-white" : "bg-renascer-light text-renascer"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-renascer-ink/50">
                <th className="py-1">Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Vencimento / status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => {
                const st = l.tipo === "DESPESA" ? STATUS_DESPESA_PESSOAL[l.status] : null;
                return (
                  <tr key={l.id} className="border-t border-renascer/10 align-top">
                    <td className="py-2 whitespace-nowrap">{new Date(l.criadoEm).toLocaleDateString("pt-BR")}</td>
                    <td>
                      <span className={`badge ${l.tipo === "RECEITA" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {l.tipo === "RECEITA" ? "Recebimento" : "Despesa"}
                      </span>
                    </td>
                    <td>
                      {CATEGORIA_PESSOAL_LABEL[l.categoria]}
                      {l.descricao ? ` — ${l.descricao}` : ""}
                      {l.pessoa ? ` (${l.pessoa})` : ""}
                      {l.totalParcelas ? (
                        <div className="text-xs text-renascer-ink/50">
                          parcela {l.parcelaAtual || "?"}/{l.totalParcelas}
                        </div>
                      ) : null}
                      {l.observacao && <div className="text-xs text-renascer-ink/40">{l.observacao}</div>}
                    </td>
                    <td className="font-semibold whitespace-nowrap">R$ {l.valor.toFixed(2)}</td>
                    <td className="whitespace-nowrap">
                      {l.tipo === "DESPESA" ? (
                        <div className="space-y-1">
                          <div>{l.dataVencimento ? new Date(l.dataVencimento).toLocaleDateString("pt-BR") : "sem data"}</div>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      {l.tipo === "DESPESA" && l.status === "PAGO" && (
                        <button className="text-xs text-amber-700 underline" onClick={() => desmarcarPago(l.id)}>
                          Desmarcar pago
                        </button>
                      )}
                      {l.tipo === "DESPESA" && l.status !== "PAGO" && (
                        <button className="text-xs text-emerald-700 underline" onClick={() => marcarPago(l.id)}>
                          Marcar pago
                        </button>
                      )}
                      <button
                        className="text-xs text-renascer underline"
                        onClick={() => {
                          setEditando(l);
                          setMostrarForm(true);
                        }}
                      >
                        Editar
                      </button>
                      <button className="text-xs text-red-600 underline" onClick={() => excluir(l.id)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-renascer-ink/50">
                    Nenhum lançamento ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {mostrarForm && (
        <FormLancamentoPessoal
          inicial={editando}
          onSalvo={() => {
            setMostrarForm(false);
            setEditando(null);
            carregar();
          }}
          onCancelar={() => {
            setMostrarForm(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function MetasFinancaPessoal() {
  const [metas, setMetas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [valorMeta, setValorMeta] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");

  async function carregar() {
    const r = await api.get("/financa-pessoal/metas");
    setMetas(r.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    if (!titulo || !valorMeta) return;
    await api.post("/financa-pessoal/metas", { titulo, valorMeta: Number(valorMeta), dataAlvo: dataAlvo || null });
    setTitulo("");
    setValorMeta("");
    setDataAlvo("");
    setMostrarForm(false);
    carregar();
  }
  async function adicionar(id) {
    const valor = window.prompt("Quanto deseja adicionar a essa meta?");
    if (!valor || isNaN(Number(valor))) return;
    await api.put(`/financa-pessoal/metas/${id}/adicionar`, { valor: Number(valor) });
    carregar();
  }
  async function excluir(id) {
    if (!window.confirm("Excluir esta meta?")) return;
    await api.delete(`/financa-pessoal/metas/${id}`);
    carregar();
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Metas</h3>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          + Nova meta
        </button>
      </div>
      {mostrarForm && (
        <div className="space-y-2 p-3 rounded-xl bg-renascer-light/40">
          <input
            className="input"
            placeholder="Nome da meta (ex: Viagem, Reserva de emergência)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="Valor da meta (R$)"
            value={valorMeta}
            onChange={(e) => setValorMeta(e.target.value)}
          />
          <input className="input" type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
          <button className="btn-primary" onClick={criar}>
            Salvar meta
          </button>
        </div>
      )}
      <div className="space-y-3">
        {metas.map((m) => (
          <BarraMetaPessoal key={m.id} meta={m} onAdicionar={() => adicionar(m.id)} onExcluir={() => excluir(m.id)} />
        ))}
        {metas.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma meta cadastrada.</p>}
      </div>
    </div>
  );
}

function PoupancaFinancaPessoal() {
  const [dados, setDados] = useState(null);
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");

  async function carregar() {
    const r = await api.get("/financa-pessoal/poupanca");
    setDados(r.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function adicionar() {
    if (!valor || isNaN(Number(valor))) return;
    await api.post("/financa-pessoal/poupanca/aportes", { valor: Number(valor), observacao: observacao || null });
    setValor("");
    setObservacao("");
    carregar();
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este movimento?")) return;
    await api.delete(`/financa-pessoal/poupanca/aportes/${id}`);
    carregar();
  }

  if (!dados) return <p>Carregando...</p>;
  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-xs text-renascer-ink/50 mb-1">Total em poupança</p>
        <p className="text-2xl font-bold text-renascer">R$ {dados.total.toFixed(2)}</p>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">Adicionar movimento</h3>
        <p className="text-xs text-renascer-ink/50">Para registrar uma retirada, use um valor negativo.</p>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" step="0.01" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
          <input className="input" placeholder="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={adicionar}>
          Salvar
        </button>
      </div>
      <div className="card overflow-x-auto">
        <h3 className="font-semibold mb-2">Movimentos</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th className="py-1">Data</th>
              <th>Valor</th>
              <th>Observação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {dados.aportes.map((a) => (
              <tr key={a.id} className="border-t border-renascer/10">
                <td className="py-1">{new Date(a.data).toLocaleDateString("pt-BR")}</td>
                <td className={a.valor >= 0 ? "text-emerald-700" : "text-red-600"}>R$ {a.valor.toFixed(2)}</td>
                <td>{a.observacao || "-"}</td>
                <td className="text-right">
                  <button className="text-xs text-red-600 underline" onClick={() => excluir(a.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {dados.aportes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-renascer-ink/50">
                  Nenhum movimento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotasFinancaPessoal() {
  const [notas, setNotas] = useState([]);
  const [texto, setTexto] = useState("");
  const [local, setLocal] = useState("");

  async function carregar() {
    const r = await api.get("/financa-pessoal/notas");
    setNotas(r.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    if (!texto) return;
    await api.post("/financa-pessoal/notas", { texto, local: local || null });
    setTexto("");
    setLocal("");
    carregar();
  }
  async function alternar(nota) {
    await api.put(`/financa-pessoal/notas/${nota.id}`, { resolvido: !nota.resolvido });
    carregar();
  }
  async function excluir(id) {
    await api.delete(`/financa-pessoal/notas/${id}`);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h3 className="font-semibold">Nova anotação / item da lista</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            className="input md:col-span-2"
            placeholder="Ex: Comprar fralda, pagar boleto da luz..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <input className="input" placeholder="Local (Casa, Trabalho, Bebê...)" value={local} onChange={(e) => setLocal(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={criar}>
          Adicionar
        </button>
      </div>
      <div className="card">
        <h3 className="font-semibold mb-2">Pendências</h3>
        <div className="space-y-2">
          {notas.map((n) => (
            <div
              key={n.id}
              className={`flex items-center justify-between p-2 rounded-lg border border-renascer/10 ${n.resolvido ? "opacity-50" : ""}`}
            >
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input type="checkbox" checked={n.resolvido} onChange={() => alternar(n)} />
                <span className={n.resolvido ? "line-through" : ""}>{n.texto}</span>
                {n.local && <span className="badge bg-renascer-light text-renascer">{n.local}</span>}
              </label>
              <button className="text-xs text-red-600 underline" onClick={() => excluir(n.id)}>
                Excluir
              </button>
            </div>
          ))}
          {notas.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma anotação ainda.</p>}
        </div>
      </div>
    </div>
  );
}

// ---------------- RENASCER IA (etapa 1 — base grátis): gasto, usuários e travas de custo ----------------
// Mostra só o que já existe nesta etapa: quanto já foi gasto com a IA no mês (contra o teto), quantos
// usuários grátis já baixaram o app, e os campos pra editar as travas (teto mensal, limite diário do
// grátis e do assinante). "Assinantes" e "Assinaturas no mês" aparecem zerados por enquanto — a
// assinatura (plano completo pago) é uma etapa futura da Renascer IA, ainda não construída.
function AbaRenascerIA() {
  const [dados, setDados] = useState(null);
  const [erroCarregar, setErroCarregar] = useState("");
  const [teto, setTeto] = useState("");
  const [limiteGratis, setLimiteGratis] = useState("");
  const [limiteAssinante, setLimiteAssinante] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  const linkCadastroIA = typeof window !== "undefined" ? `${window.location.origin}/ia/cadastro` : "";

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setErroCarregar("");
    try {
      const { data } = await api.get("/dono/renascer-ia");
      setDados(data);
      setTeto(String(data.tetoMensalReais));
      setLimiteGratis(String(data.limiteGratisDia));
      setLimiteAssinante(String(data.limiteAssinanteDia));
    } catch (e) {
      setErroCarregar(e?.response?.data?.erro || "Não foi possível carregar os dados da Renascer IA agora.");
    }
  }

  function copiarLinkIA() {
    if (!linkCadastroIA) return;
    navigator.clipboard
      .writeText(linkCadastroIA)
      .then(() => {
        setLinkCopiado(true);
        setTimeout(() => setLinkCopiado(false), 2500);
      })
      .catch(() => setMensagem("Não deu pra copiar automaticamente — copie o link manualmente."));
  }

  async function salvar() {
    setSalvando(true);
    setMensagem("");
    try {
      await api.put("/dono/renascer-ia/configuracao", {
        tetoMensalReais: Number(teto),
        limiteGratisDia: Number(limiteGratis),
        limiteAssinanteDia: Number(limiteAssinante),
      });
      setMensagem("Limites salvos.");
      carregar();
    } catch (e) {
      setMensagem(e?.response?.data?.erro || "Não foi possível salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (!dados && erroCarregar) {
    return (
      <div className="space-y-3 max-w-xl">
        <h2 className="text-lg font-bold text-renascer-ink">Renascer IA</h2>
        <div className="card space-y-3 border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{erroCarregar}</p>
          <button className="btn-primary" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (!dados) return <p className="text-renascer-ink/50">Carregando...</p>;

  const percentualGasto = dados.tetoMensalReais > 0 ? Math.min(100, (dados.gastoMesAtualReais / dados.tetoMensalReais) * 100) : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-renascer-ink">Renascer IA</h2>
        <p className="text-sm text-renascer-ink/60">Gasto, usuários e travas de custo deste mês.</p>
      </div>

      <div className="card space-y-2">
        <p className="font-semibold text-sm text-renascer-ink">Link para divulgar a Renascer IA</p>
        <p className="text-xs text-renascer-ink/55">
          Mande esse link pra qualquer pessoa conhecer e se cadastrar na Renascer IA — não precisa já ser cliente da clínica.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs sm:text-sm bg-renascer-light px-3 py-2 rounded-lg break-all text-renascer-ink/80">
            {linkCadastroIA}
          </code>
          <button className="btn-primary !py-1.5" onClick={copiarLinkIA} type="button">
            {linkCopiado ? "Copiado!" : "Copiar link"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card space-y-2">
          <p className="text-xs font-bold text-renascer-ink/60">Gasto com a IA no mês</p>
          <p className="text-2xl font-extrabold text-renascer-ink">
            R$ {dados.gastoMesAtualReais.toFixed(2)}{" "}
            <span className="text-sm font-semibold text-renascer-ink/50">de R$ {dados.tetoMensalReais.toFixed(2)}</span>
          </p>
          <div className="h-2 rounded-full bg-renascer-light overflow-hidden">
            <div className="h-full bg-renascer" style={{ width: `${percentualGasto}%` }} />
          </div>
        </div>
        <div className="card space-y-1">
          <p className="text-xs font-bold text-renascer-ink/60">Usuários grátis</p>
          <p className="text-2xl font-extrabold text-renascer-ink">{dados.usuariosGratis}</p>
        </div>
        <div className="card space-y-1 opacity-60">
          <p className="text-xs font-bold text-renascer-ink/60">Assinantes</p>
          <p className="text-2xl font-extrabold text-renascer-ink">—</p>
          <p className="text-xs text-renascer-ink/50">Chega na próxima etapa (assinatura)</p>
        </div>
        <div className="card space-y-1 opacity-60">
          <p className="text-xs font-bold text-renascer-ink/60">Assinaturas no mês</p>
          <p className="text-2xl font-extrabold text-renascer-ink">—</p>
          <p className="text-xs text-renascer-ink/50">Chega na próxima etapa (assinatura)</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-sm text-renascer-ink">Teto mensal de gasto com a IA</p>
            <p className="text-xs text-renascer-ink/55">Ao atingir, o grátis cai para o limite reduzido até o mês virar.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold">R$</span>
            <input className="input !w-28" value={teto} onChange={(e) => setTeto(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-renascer-ink/[0.06] pt-4">
          <div>
            <p className="font-semibold text-sm text-renascer-ink">Limite de mensagens por dia</p>
            <p className="text-xs text-renascer-ink/55">O limite do assinante ainda não é usado nesta etapa.</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              Grátis
              <input className="input !w-20" value={limiteGratis} onChange={(e) => setLimiteGratis(e.target.value)} />
            </label>
            <label className="flex items-center gap-1.5 text-sm font-semibold">
              Assinante
              <input className="input !w-20" value={limiteAssinante} onChange={(e) => setLimiteAssinante(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-renascer-ink/[0.06] pt-4">
          <div>
            <p className="font-semibold text-sm text-renascer-ink">Uma conta por WhatsApp e por e-mail</p>
            <p className="text-xs text-renascer-ink/55">O mesmo WhatsApp ou e-mail não consegue criar duas contas.</p>
          </div>
          <span className="badge bg-green-100 text-green-800">Ativa</span>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap border-t border-renascer-ink/[0.06] pt-4">
          <div>
            <p className="font-semibold text-sm text-renascer-ink">Tamanho máximo de cada resposta</p>
            <p className="text-xs text-renascer-ink/55">Nenhuma resposta da IA sai muito grande, pra não sair caro.</p>
          </div>
          <span className="badge bg-green-100 text-green-800">Ativa</span>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar limites"}
          </button>
          {mensagem && <span className="text-sm text-renascer-ink/60">{mensagem}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------------- FORMULÁRIOS (pesquisas com link público) (Fase 28) ----------------
// O Dono cria um formulário com perguntas, o sistema gera um link único (ex: Estudo de clima,
// pesquisa de satisfação do cliente) que pode ser mandado pra qualquer pessoa — profissional ou
// cliente, sem precisar de login — e as respostas aparecem aqui, agrupadas por formulário.
const TIPO_PERGUNTA_LABEL = {
  TEXTO_CURTO: "Resposta curta",
  TEXTO_LONGO: "Texto longo",
  MULTIPLA_ESCOLHA: "Múltipla escolha",
  ESCALA: "Escala (nota)",
};

function novaPerguntaVazia() {
  return { texto: "", tipo: "TEXTO_LONGO", obrigatoria: true, opcoesTexto: "0-10" };
}

function AbaFormularios() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [criarAberto, setCriarAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perguntas, setPerguntas] = useState([novaPerguntaVazia()]);
  const [criando, setCriando] = useState(false);
  const [erroCriar, setErroCriar] = useState("");

  const [linkCopiadoId, setLinkCopiadoId] = useState(null);
  const [verRespostasId, setVerRespostasId] = useState(null);
  const [respostas, setRespostas] = useState([]);
  const [carregandoRespostas, setCarregandoRespostas] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setErroCarregar("");
    try {
      const { data } = await api.get("/formularios");
      setLista(data);
    } catch (e) {
      setErroCarregar(e?.response?.data?.erro || "Não foi possível carregar os formulários agora.");
    } finally {
      setCarregando(false);
    }
  }

  function linkPublico(f) {
    return typeof window !== "undefined" ? `${window.location.origin}/formularios/${f.linkToken}` : "";
  }

  function copiarLink(f) {
    navigator.clipboard
      .writeText(linkPublico(f))
      .then(() => {
        setLinkCopiadoId(f.id);
        setTimeout(() => setLinkCopiadoId(null), 2500);
      })
      .catch(() => setMensagem("Não deu pra copiar automaticamente — copie o link manualmente."));
  }

  function atualizarPergunta(i, patch) {
    setPerguntas((atual) => atual.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function adicionarPergunta() {
    setPerguntas((atual) => [...atual, novaPerguntaVazia()]);
  }
  function removerPergunta(i) {
    setPerguntas((atual) => atual.filter((_, idx) => idx !== i));
  }

  async function criarFormulario() {
    setErroCriar("");
    if (!titulo.trim()) {
      setErroCriar("Dê um título ao formulário (ex: Estudo de clima).");
      return;
    }
    if (perguntas.length === 0 || perguntas.some((p) => !p.texto.trim())) {
      setErroCriar("Toda pergunta precisa de um texto. Remova as perguntas em branco.");
      return;
    }
    setCriando(true);
    try {
      await api.post("/formularios", {
        titulo,
        descricao,
        perguntas: perguntas.map((p) => ({
          texto: p.texto,
          tipo: p.tipo,
          obrigatoria: p.obrigatoria,
          opcoes:
            p.tipo === "MULTIPLA_ESCOLHA"
              ? p.opcoesTexto.split(",").map((o) => o.trim()).filter(Boolean).join("|")
              : p.tipo === "ESCALA"
              ? p.opcoesTexto.trim() || "0-10"
              : null,
        })),
      });
      setTitulo("");
      setDescricao("");
      setPerguntas([novaPerguntaVazia()]);
      setCriarAberto(false);
      setMensagem("Formulário criado com sucesso!");
      carregar();
    } catch (e) {
      setErroCriar(e?.response?.data?.erro || "Não foi possível criar o formulário agora.");
    } finally {
      setCriando(false);
    }
  }

  async function alternarAtivo(f) {
    try {
      await api.put(`/formularios/${f.id}`, { ativo: !f.ativo });
      carregar();
    } catch (e) {
      setMensagem(e?.response?.data?.erro || "Não foi possível atualizar o formulário agora.");
    }
  }

  async function excluir(f) {
    if (!window.confirm(`Excluir o formulário "${f.titulo}"? Isso apaga também todas as respostas já recebidas. Não tem como desfazer.`))
      return;
    try {
      await api.delete(`/formularios/${f.id}`);
      if (verRespostasId === f.id) setVerRespostasId(null);
      carregar();
    } catch (e) {
      setMensagem(e?.response?.data?.erro || "Não foi possível excluir o formulário agora.");
    }
  }

  async function abrirRespostas(f) {
    if (verRespostasId === f.id) {
      setVerRespostasId(null);
      return;
    }
    setVerRespostasId(f.id);
    setCarregandoRespostas(true);
    try {
      const { data } = await api.get(`/formularios/${f.id}/respostas`);
      setRespostas(data);
    } catch (e) {
      setMensagem(e?.response?.data?.erro || "Não foi possível carregar as respostas agora.");
    } finally {
      setCarregandoRespostas(false);
    }
  }

  if (carregando) return <p className="text-renascer-ink/50">Carregando...</p>;

  if (erroCarregar && lista.length === 0) {
    return (
      <div className="space-y-3 max-w-xl">
        <h2 className="text-lg font-bold text-renascer-ink">Formulários</h2>
        <div className="card space-y-3 border border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{erroCarregar}</p>
          <button className="btn-primary" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-renascer-ink">Formulários</h2>
          <p className="text-sm text-renascer-ink/60">
            Crie uma pesquisa (ex: estudo de clima, satisfação do cliente) e gere um link pra qualquer pessoa responder,
            sem precisar de login.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCriarAberto((v) => !v)}>
          {criarAberto ? "Cancelar" : "Criar novo formulário"}
        </button>
      </div>

      {mensagem && <p className="text-sm text-renascer-ink/60">{mensagem}</p>}

      {criarAberto && (
        <div className="card space-y-4">
          <div className="space-y-3">
            <input className="input" placeholder="Título (ex: Estudo de clima)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <textarea
              className="input"
              rows={3}
              placeholder="Texto de introdução (opcional) — mostrado antes das perguntas"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {perguntas.map((p, i) => (
              <div key={i} className="border border-renascer-ink/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-renascer-ink/50">Pergunta {i + 1}</p>
                  {perguntas.length > 1 && (
                    <button type="button" className="text-xs text-red-600 underline" onClick={() => removerPergunta(i)}>
                      Remover
                    </button>
                  )}
                </div>
                <input
                  className="input"
                  placeholder="Texto da pergunta"
                  value={p.texto}
                  onChange={(e) => atualizarPergunta(i, { texto: e.target.value })}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <select className="input !w-auto" value={p.tipo} onChange={(e) => atualizarPergunta(i, { tipo: e.target.value })}>
                    {Object.entries(TIPO_PERGUNTA_LABEL).map(([valor, label]) => (
                      <option key={valor} value={valor}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-renascer-ink/70">
                    <input
                      type="checkbox"
                      checked={p.obrigatoria}
                      onChange={(e) => atualizarPergunta(i, { obrigatoria: e.target.checked })}
                    />
                    Obrigatória
                  </label>
                  {p.tipo === "MULTIPLA_ESCOLHA" && (
                    <input
                      className="input !w-auto flex-1 min-w-[200px]"
                      placeholder="Opções separadas por vírgula"
                      value={p.opcoesTexto}
                      onChange={(e) => atualizarPergunta(i, { opcoesTexto: e.target.value })}
                    />
                  )}
                  {p.tipo === "ESCALA" && (
                    <input
                      className="input !w-28"
                      placeholder="0-10"
                      value={p.opcoesTexto}
                      onChange={(e) => atualizarPergunta(i, { opcoesTexto: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
            <button type="button" className="btn-secondary text-sm" onClick={adicionarPergunta}>
              + Adicionar pergunta
            </button>
          </div>

          {erroCriar && <p className="text-red-600 text-sm">{erroCriar}</p>}

          <button className="btn-primary" onClick={criarFormulario} disabled={criando}>
            {criando ? "Criando..." : "Criar formulário"}
          </button>
        </div>
      )}

      {lista.length === 0 && (
        <div className="card">
          <p className="text-sm text-renascer-ink/50">Nenhum formulário criado ainda.</p>
        </div>
      )}

      {lista.map((f) => (
        <div key={f.id} className="card space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-renascer-ink">{f.titulo}</p>
              <p className="text-xs text-renascer-ink/50">
                {f.totalRespostas} resposta(s) · criado em {new Date(f.criadoEm).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <span className={`badge ${f.ativo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
              {f.ativo ? "Ativo" : "Desativado"}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs sm:text-sm bg-renascer-light px-3 py-2 rounded-lg break-all text-renascer-ink/80">
              {linkPublico(f)}
            </code>
            <button className="btn-primary !py-1.5" onClick={() => copiarLink(f)} type="button">
              {linkCopiadoId === f.id ? "Copiado!" : "Copiar link"}
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-sm border-t border-renascer-ink/[0.06] pt-3">
            <button className="btn-secondary" onClick={() => abrirRespostas(f)}>
              {verRespostasId === f.id ? "Fechar respostas" : "Ver respostas"}
            </button>
            <button className="text-renascer-ink/60 underline" onClick={() => alternarAtivo(f)}>
              {f.ativo ? "Desativar" : "Reativar"}
            </button>
            <button className="text-red-600 underline" onClick={() => excluir(f)}>
              Excluir
            </button>
          </div>

          {verRespostasId === f.id && (
            <div className="border-t border-renascer-ink/[0.06] pt-3 space-y-3">
              {carregandoRespostas && <p className="text-sm text-renascer-ink/50">Carregando respostas...</p>}
              {!carregandoRespostas && respostas.length === 0 && (
                <p className="text-sm text-renascer-ink/50">Ainda não tem nenhuma resposta.</p>
              )}
              {!carregandoRespostas &&
                respostas.map((r) => (
                  <div key={r.id} className="border border-renascer-ink/10 rounded-xl p-3 space-y-1.5">
                    <p className="text-sm font-semibold text-renascer-ink">
                      {r.nome} <span className="text-renascer-ink/50 font-normal">· {r.email}</span>
                    </p>
                    <p className="text-xs text-renascer-ink/40">{new Date(r.enviadoEm).toLocaleString("pt-BR")}</p>
                    <div className="space-y-1.5 pt-1">
                      {r.respostas.map((item, idx) => (
                        <p key={idx} className="text-sm text-renascer-ink/80">
                          <span className="font-semibold text-renascer-ink/60">{item.pergunta}:</span> {item.resposta || "—"}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ================================================================================================
// ---------------- MEU DIA (Fase 30) — Dono: checklist diário, indicadores reais, marketing,
// gestão de pessoas, fechamento de caixa, diário de decisões e metas do trimestre. ----------------
// ================================================================================================

const ITENS_CHECKLIST_HOJE_DONO = [
  { chave: "ver_dashboard", texto: "Conferir a visão geral (faturamento do dia, repasses pendentes)" },
  { chave: "revisar_agenda_geral", texto: "Revisar a agenda geral do dia" },
  { chave: "lancar_caixa", texto: "Lançar as entradas e saídas de hoje no Fechamento de caixa" },
  { chave: "conferir_banco", texto: "Comparar o saldo do sistema com o saldo do banco/Pix" },
  { chave: "registrar_marketing_dia", texto: "Registrar o que foi postado/respondido hoje no marketing (se houver)" },
  { chave: "registrar_decisao_dia", texto: "Anotar alguma decisão ou ideia importante do dia (se houver)" },
];

const ITENS_CHECKLIST_IMPLANTACAO_DONO = [
  { chave: "config_financeira", texto: "Configurar o custo fixo mensal e a reserva de caixa da clínica" },
  { chave: "primeira_meta", texto: "Cadastrar a primeira meta do trimestre" },
  { chave: "revisar_repasses_implantacao", texto: "Revisar o percentual de repasse de cada profissional" },
  { chave: "ativar_push_implantacao", texto: "Ativar as notificações push no seu aparelho" },
];

const TIPO_MARKETING_LABEL = { POST: "Post", STORIES: "Stories", RESPOSTA: "Resposta", AVALIACAO: "Avaliação", OUTRO: "Outro" };
const TIPO_PESSOAS_LABEL = { ALINHAMENTO: "Alinhamento", FEEDBACK: "Feedback", DIFICULDADE: "Dificuldade", TREINAMENTO: "Treinamento", OUTRO: "Outro" };
const CANAL_LABEL = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", GOOGLE: "Google", INDICACAO: "Indicação", OUTRO: "Outro", NAO_INFORMADO: "Não informado" };

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AbaMeuDia() {
  const [sub, setSub] = useState("hoje");
  const SUBABAS = [
    { id: "hoje", label: "Hoje" },
    { id: "indicadores", label: "Indicadores" },
    { id: "marketing", label: "Marketing" },
    { id: "pessoas", label: "Gestão de pessoas" },
    { id: "caixa", label: "Fechamento de caixa" },
    { id: "decisoes", label: "Diário de decisões" },
    { id: "metas", label: "Metas do trimestre" },
    { id: "implantacao", label: "Implantação" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SUBABAS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              sub === s.id ? "bg-gold-light text-gold-dark" : "bg-white text-renascer-ink/60 border border-renascer-ink/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "hoje" && <MeuDiaHoje />}
      {sub === "indicadores" && <MeuDiaIndicadores />}
      {sub === "marketing" && <MeuDiaMarketing />}
      {sub === "pessoas" && <MeuDiaPessoas />}
      {sub === "caixa" && <MeuDiaCaixa />}
      {sub === "decisoes" && <MeuDiaDecisoes />}
      {sub === "metas" && <MeuDiaMetas />}
      {sub === "implantacao" && <MeuDiaImplantacao />}
    </div>
  );
}

function MeuDiaHoje() {
  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold">Checklist de hoje</h3>
        <p className="text-xs text-renascer-ink/50">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} — os números completos
          estão na aba Indicadores.
        </p>
      </div>
      <ChecklistMeuDia itens={ITENS_CHECKLIST_HOJE_DONO} data={hojeISO()} />
    </div>
  );
}

function MeuDiaImplantacao() {
  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold">Checklist de implantação</h3>
        <p className="text-xs text-renascer-ink/50">Itens de configuração inicial — marque uma vez só, não voltam a aparecer.</p>
      </div>
      <ChecklistMeuDia itens={ITENS_CHECKLIST_IMPLANTACAO_DONO} />
    </div>
  );
}

function CardIndicador({ titulo, valor, destaque, aviso }) {
  return (
    <div className="border border-renascer/10 rounded-xl p-3">
      <p className="text-xs text-renascer-ink/50">{titulo}</p>
      <p className={`text-lg font-bold ${destaque || "text-renascer-ink"}`}>{valor}</p>
      {aviso && <p className="text-[11px] text-renascer-ink/40 mt-0.5">{aviso}</p>}
    </div>
  );
}

function MeuDiaIndicadores() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    setErro("");
    try {
      const { data } = await api.get("/dono/meu-dia/indicadores");
      setDados(data);
    } catch (e) {
      setErro("Não consegui carregar os indicadores agora. Tente de novo em alguns segundos.");
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  if (erro) {
    return (
      <div className="card space-y-2">
        <p className="text-sm text-red-600">{erro}</p>
        <button className="btn-secondary" onClick={carregar}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!dados) return <p className="text-sm text-renascer-ink/50">Carregando...</p>;

  const semDadoSuficiente = "ainda sem dado suficiente este mês";

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">Financeiro</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CardIndicador titulo="Saldo de caixa hoje" valor={`R$ ${dados.financeiro.saldoCaixaHoje.toFixed(2)}`} destaque="text-renascer" />
          <CardIndicador titulo="Faturamento do mês" valor={`R$ ${dados.financeiro.faturamentoMes.toFixed(2)}`} />
          <CardIndicador titulo="Repasse às profissionais (mês)" valor={`R$ ${dados.financeiro.repasseProfissionaisMes.toFixed(2)}`} />
          <CardIndicador titulo="Receita Renascer (mês)" valor={`R$ ${dados.financeiro.receitaRenascerMes.toFixed(2)}`} destaque="text-emerald-600" />
        </div>
        {dados.financeiro.totalPendenteRepasseProfissionais > 0 && (
          <p className="text-xs text-amber-700">
            R$ {dados.financeiro.totalPendenteRepasseProfissionais.toFixed(2)} ainda pendente de repasse das profissionais.
          </p>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Crescimento</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CardIndicador titulo="Clientes novos (mês)" valor={dados.crescimento.novosClientesMes} />
          <CardIndicador titulo="Clientes que saíram (mês)" valor={dados.crescimento.churnMes} />
          <CardIndicador titulo="Clientes ativos hoje" valor={dados.crescimento.clientesAtivos} />
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Marketing</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CardIndicador
            titulo="Registros de marketing (mês)"
            valor={dados.marketing.registrosMarketingMes.reduce((s, r) => s + r.total, 0)}
            aviso={dados.marketing.registrosMarketingMes.length === 0 ? "nada lançado ainda este mês" : null}
          />
          <CardIndicador titulo="Gasto com anúncios (mês)" valor={`R$ ${dados.marketing.totalGastoAnunciosMes.toFixed(2)}`} />
          <CardIndicador titulo="Clientes novos no mês" valor={dados.marketing.totalClientesNovosMes} />
        </div>
        <div>
          <p className="text-xs text-renascer-ink/50 mb-1">Custo por cliente novo (CAC), por canal</p>
          {Object.keys(dados.marketing.cacPorCanal).length === 0 ? (
            <p className="text-sm text-renascer-ink/40">
              {semDadoSuficiente} — lance gastos de anúncio no Fechamento de caixa e informe o canal dos clientes novos no
              cadastro, pra esse número aparecer.
            </p>
          ) : (
            <div className="space-y-1">
              {Object.entries(dados.marketing.cacPorCanal).map(([canal, info]) => (
                <div key={canal} className="flex items-center justify-between text-sm border-b border-renascer-ink/5 py-1">
                  <span>{CANAL_LABEL[canal] || canal}</span>
                  <span className="text-renascer-ink/70">
                    R$ {info.gasto.toFixed(2)} gasto · {info.clientesNovos} cliente(s) novo(s)
                    {info.cac !== null ? ` · CAC R$ ${info.cac.toFixed(2)}` : " · CAC ainda sem dado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Processos</h3>
        <div className="grid grid-cols-2 gap-3">
          <CardIndicador
            titulo="Taxa de faltas (mês)"
            valor={dados.processos.taxaFaltasMes.taxaFaltasPercentual !== null ? `${dados.processos.taxaFaltasMes.taxaFaltasPercentual}%` : "—"}
            aviso={dados.processos.taxaFaltasMes.totalSessoes === 0 ? semDadoSuficiente : `${dados.processos.taxaFaltasMes.faltas} de ${dados.processos.taxaFaltasMes.totalSessoes} sessões`}
          />
          <CardIndicador
            titulo="Tempo médio de resposta"
            valor={dados.processos.tempoRespostaMedioMes.tempoMedioMinutos !== null ? `${dados.processos.tempoRespostaMedioMes.tempoMedioMinutos} min` : "—"}
            aviso={dados.processos.tempoRespostaMedioMes.mensagensRespondidas === 0 ? semDadoSuficiente : `${dados.processos.tempoRespostaMedioMes.mensagensRespondidas} resposta(s) no mês`}
          />
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Pessoas (sessões realizadas no mês)</h3>
        <div className="space-y-1">
          {dados.pessoas.sessoesRealizadasPorProfissional.map((p) => (
            <div key={p.profissionalId} className="flex items-center justify-between text-sm border-b border-renascer-ink/5 py-1">
              <span>{p.nome}</span>
              <span className="font-semibold">{p.sessoesRealizadas}</span>
            </div>
          ))}
          {dados.pessoas.sessoesRealizadasPorProfissional.length === 0 && (
            <p className="text-sm text-renascer-ink/40">Nenhuma sessão realizada este mês ainda.</p>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Estratégia</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CardIndicador titulo="Ponto de equilíbrio (custo fixo/mês)" valor={`R$ ${dados.estrategia.pontoDeEquilibrioReais.toFixed(2)}`} />
          <CardIndicador
            titulo="Lucro do mês"
            valor={`R$ ${dados.estrategia.lucroMes.toFixed(2)}`}
            destaque={dados.estrategia.lucroMes >= 0 ? "text-emerald-600" : "text-red-600"}
          />
          <CardIndicador
            titulo="Meses de reserva"
            valor={dados.estrategia.mesesDeReserva !== null ? dados.estrategia.mesesDeReserva : "—"}
            aviso={dados.estrategia.custoFixoMensalReais === 0 ? "configure o custo fixo mensal" : null}
          />
        </div>
        <p className="text-xs text-renascer-ink/50">
          Custo fixo e reserva de caixa são configurados na aba Fechamento de caixa.
        </p>
        {dados.estrategia.metasTrimestreAtual.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-xs text-renascer-ink/50">Metas deste trimestre</p>
            {dados.estrategia.metasTrimestreAtual.map((m) => (
              <BarraMetaTrimestre key={m.id} meta={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MeuDiaMarketing() {
  const [lista, setLista] = useState([]);
  const [tipo, setTipo] = useState("POST");
  const [descricao, setDescricao] = useState("");
  const [link, setLink] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await api.get("/dono/meu-dia/marketing");
    setLista(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function registrar() {
    if (!descricao.trim()) return;
    setSalvando(true);
    try {
      await api.post("/dono/meu-dia/marketing", { tipo, descricao, link: link || undefined });
      setDescricao("");
      setLink("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este registro?")) return;
    await api.delete(`/dono/meu-dia/marketing/${id}`);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">Registrar ação de marketing</h3>
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(TIPO_MARKETING_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <textarea className="input" rows={2} placeholder="O que foi feito?" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <input className="input" placeholder="Link (opcional)" value={link} onChange={(e) => setLink(e.target.value)} />
        <button className="btn-primary" onClick={registrar} disabled={salvando || !descricao.trim()}>
          {salvando ? "Salvando..." : "Registrar"}
        </button>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Histórico</h3>
        {lista.map((r) => (
          <div key={r.id} className="border-b border-renascer-ink/5 py-2 flex items-start justify-between gap-2">
            <div>
              <span className="badge-gold">{TIPO_MARKETING_LABEL[r.tipo] || r.tipo}</span>
              <p className="text-sm mt-1">{r.descricao}</p>
              {r.link && (
                <a href={r.link} target="_blank" rel="noreferrer" className="text-xs text-renascer underline">
                  {r.link}
                </a>
              )}
              <p className="text-[11px] text-renascer-ink/40 mt-0.5">{new Date(r.data).toLocaleString("pt-BR")}</p>
            </div>
            <button className="text-xs text-red-600 underline shrink-0" onClick={() => excluir(r.id)}>
              Excluir
            </button>
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-renascer-ink/40">Nenhum registro ainda.</p>}
      </div>
    </div>
  );
}

function MeuDiaPessoas() {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [profissionalId, setProfissionalId] = useState("");
  const [tipo, setTipo] = useState("ALINHAMENTO");
  const [anotacao, setAnotacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const [r, p] = await Promise.all([api.get("/dono/meu-dia/pessoas"), api.get("/dono/profissionais")]);
    setLista(r.data);
    setProfissionais(p.data);
    if (!profissionalId && p.data.length > 0) setProfissionalId(p.data[0].id);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registrar() {
    if (!profissionalId || !anotacao.trim()) return;
    setSalvando(true);
    try {
      await api.post("/dono/meu-dia/pessoas", { profissionalId, tipo, anotacao });
      setAnotacao("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }
  async function excluir(id) {
    if (!window.confirm("Excluir esta anotação?")) return;
    await api.delete(`/dono/meu-dia/pessoas/${id}`);
    carregar();
  }

  const nomePorId = Object.fromEntries(profissionais.map((p) => [p.id, p.user.nome]));

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">Nova anotação</h3>
        <select className="input" value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)}>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.user.nome}
            </option>
          ))}
        </select>
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {Object.entries(TIPO_PESSOAS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <textarea className="input" rows={2} placeholder="Anotação" value={anotacao} onChange={(e) => setAnotacao(e.target.value)} />
        <button className="btn-primary" onClick={registrar} disabled={salvando || !anotacao.trim()}>
          {salvando ? "Salvando..." : "Registrar"}
        </button>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Histórico</h3>
        {lista.map((r) => (
          <div key={r.id} className="border-b border-renascer-ink/5 py-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {nomePorId[r.profissionalId] || "—"} <span className="badge-gold ml-1">{TIPO_PESSOAS_LABEL[r.tipo] || r.tipo}</span>
              </p>
              <p className="text-sm mt-1">{r.anotacao}</p>
              <p className="text-[11px] text-renascer-ink/40 mt-0.5">{new Date(r.data).toLocaleString("pt-BR")}</p>
            </div>
            <button className="text-xs text-red-600 underline shrink-0" onClick={() => excluir(r.id)}>
              Excluir
            </button>
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-renascer-ink/40">Nenhuma anotação ainda.</p>}
      </div>
    </div>
  );
}

const CATEGORIAS_MOVIMENTO_SAIDA = ["Anúncio", "Repasse pago", "Aluguel", "Conta", "Material", "Outro"];
const CATEGORIAS_MOVIMENTO_ENTRADA = ["Outro recebimento", "Ajuste de caixa"];

function MeuDiaCaixa() {
  const [dataSelecionada, setDataSelecionada] = useState(hojeISO());
  const [dados, setDados] = useState(null);
  const [tipo, setTipo] = useState("SAIDA");
  const [categoria, setCategoria] = useState("Anúncio");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [canalOrigem, setCanalOrigem] = useState("");
  const [saldoBanco, setSaldoBanco] = useState("");
  const [observacaoConferencia, setObservacaoConferencia] = useState("");
  const [config, setConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    const [c, cfg] = await Promise.all([
      api.get("/dono/meu-dia/caixa", { params: { data: dataSelecionada } }),
      api.get("/dono/meu-dia/configuracao-financeira"),
    ]);
    setDados(c.data);
    setConfig(cfg.data);
    if (c.data.conferencia) setSaldoBanco(String(c.data.conferencia.saldoBancoInformado));
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSelecionada]);

  async function lancarMovimento() {
    if (!valor) return;
    setSalvando(true);
    try {
      await api.post("/dono/meu-dia/caixa/movimentos", {
        tipo,
        categoria,
        valor: Number(valor),
        descricao: descricao || undefined,
        canalOrigem: categoria === "Anúncio" && canalOrigem ? canalOrigem : undefined,
        data: dataSelecionada,
      });
      setValor("");
      setDescricao("");
      setCanalOrigem("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function excluirMovimento(id) {
    if (!window.confirm("Excluir este lançamento?")) return;
    await api.delete(`/dono/meu-dia/caixa/movimentos/${id}`);
    carregar();
  }

  async function conferir() {
    if (!saldoBanco) return;
    setMensagem("");
    const { data } = await api.post("/dono/meu-dia/caixa/conferir", {
      data: dataSelecionada,
      saldoBancoInformado: Number(saldoBanco),
      observacao: observacaoConferencia || undefined,
    });
    setMensagem(Math.abs(data.diferenca) < 0.01 ? "Bateu certinho! ✓" : `Diferença de R$ ${Math.abs(data.diferenca).toFixed(2)}.`);
    carregar();
  }

  async function salvarConfig(campo, valorCampo) {
    const payload = { [campo]: Number(valorCampo) };
    const { data } = await api.put("/dono/meu-dia/configuracao-financeira", payload);
    setConfig(data);
  }

  if (!dados || !config) return <p className="text-sm text-renascer-ink/50">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Fechamento de caixa</h3>
          <input className="input !w-auto" type="date" value={dataSelecionada} onChange={(e) => setDataSelecionada(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <CardIndicador titulo="Entradas de clientes" valor={`R$ ${dados.totalEntradasClientes.toFixed(2)}`} />
          <CardIndicador titulo="Entradas/saídas extra" valor={`+R$ ${dados.totalEntradasExtra.toFixed(2)} / -R$ ${dados.totalSaidas.toFixed(2)}`} />
          <CardIndicador titulo="Saldo do sistema" valor={`R$ ${dados.saldoSistema.toFixed(2)}`} destaque="text-renascer" />
        </div>

        <div className="pt-2 border-t border-renascer-ink/5 space-y-1">
          {dados.movimentos.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm py-1">
              <span>
                {m.tipo === "ENTRADA" ? "+ " : "- "}
                {m.categoria}
                {m.descricao ? ` — ${m.descricao}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <span className={m.tipo === "ENTRADA" ? "text-emerald-600" : "text-red-600"}>R$ {m.valor.toFixed(2)}</span>
                <button className="text-xs text-red-600 underline" onClick={() => excluirMovimento(m.id)}>
                  Excluir
                </button>
              </span>
            </div>
          ))}
          {dados.movimentos.length === 0 && <p className="text-sm text-renascer-ink/40">Nenhum lançamento extra nesse dia.</p>}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Novo lançamento</h3>
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="SAIDA">Saída</option>
            <option value="ENTRADA">Entrada</option>
          </select>
          <select className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {(tipo === "SAIDA" ? CATEGORIAS_MOVIMENTO_SAIDA : CATEGORIAS_MOVIMENTO_ENTRADA).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {tipo === "SAIDA" && categoria === "Anúncio" && (
          <select className="input" value={canalOrigem} onChange={(e) => setCanalOrigem(e.target.value)}>
            <option value="">Canal (opcional, pra calcular CAC)</option>
            {["INSTAGRAM", "FACEBOOK", "GOOGLE", "OUTRO"].map((c) => (
              <option key={c} value={c}>
                {CANAL_LABEL[c]}
              </option>
            ))}
          </select>
        )}
        <input className="input" type="number" step="0.01" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
        <input className="input" placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <button className="btn-primary" onClick={lancarMovimento} disabled={salvando || !valor}>
          {salvando ? "Salvando..." : "Lançar"}
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Conferir com o banco/Pix</h3>
        <input
          className="input"
          type="number"
          step="0.01"
          placeholder="Saldo informado do banco/Pix nesse dia"
          value={saldoBanco}
          onChange={(e) => setSaldoBanco(e.target.value)}
        />
        <input
          className="input"
          placeholder="Observação (opcional)"
          value={observacaoConferencia}
          onChange={(e) => setObservacaoConferencia(e.target.value)}
        />
        <button className="btn-primary" onClick={conferir} disabled={!saldoBanco}>
          Conferir
        </button>
        {mensagem && <p className="text-sm font-medium">{mensagem}</p>}
        {dados.conferencia && (
          <p className="text-xs text-renascer-ink/50">
            Última conferência desse dia: sistema R$ {dados.conferencia.saldoSistema.toFixed(2)} vs. banco R${" "}
            {dados.conferencia.saldoBancoInformado.toFixed(2)} (diferença R$ {Math.abs(dados.conferencia.diferenca).toFixed(2)}).
          </p>
        )}
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Configuração financeira da clínica</h3>
        <p className="text-xs text-renascer-ink/50">Usada só pros indicadores de ponto de equilíbrio, lucro e meses de reserva.</p>
        <label className="block text-sm">
          Custo fixo mensal (R$)
          <input
            className="input mt-1"
            type="number"
            step="0.01"
            defaultValue={config.custoFixoMensalReais}
            onBlur={(e) => salvarConfig("custoFixoMensalReais", e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Reserva de caixa atual (R$)
          <input
            className="input mt-1"
            type="number"
            step="0.01"
            defaultValue={config.reservaCaixaReais}
            onBlur={(e) => salvarConfig("reservaCaixaReais", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function MeuDiaDecisoes() {
  const [lista, setLista] = useState([]);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await api.get("/dono/meu-dia/decisoes");
    setLista(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function registrar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await api.post("/dono/meu-dia/decisoes", { texto });
      setTexto("");
      carregar();
    } finally {
      setSalvando(false);
    }
  }
  async function excluir(id) {
    if (!window.confirm("Excluir este registro?")) return;
    await api.delete(`/dono/meu-dia/decisoes/${id}`);
    carregar();
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">Nova decisão ou ideia</h3>
        <textarea className="input" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button className="btn-primary" onClick={registrar} disabled={salvando || !texto.trim()}>
          {salvando ? "Salvando..." : "Registrar"}
        </button>
      </div>
      <div className="card space-y-2">
        <h3 className="font-semibold">Diário</h3>
        {lista.map((d) => (
          <div key={d.id} className="border-b border-renascer-ink/5 py-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm">{d.texto}</p>
              <p className="text-[11px] text-renascer-ink/40 mt-0.5">{new Date(d.data).toLocaleString("pt-BR")}</p>
            </div>
            <button className="text-xs text-red-600 underline shrink-0" onClick={() => excluir(d.id)}>
              Excluir
            </button>
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-renascer-ink/40">Nenhuma decisão registrada ainda.</p>}
      </div>
    </div>
  );
}

function BarraMetaTrimestre({ meta, onAtualizar, onExcluir }) {
  const pct = meta.valorMeta > 0 ? Math.min(100, (meta.valorAtual / meta.valorMeta) * 100) : 0;
  const formatar = (v) => (meta.unidade === "reais" ? `R$ ${v.toFixed(2)}` : meta.unidade === "percentual" ? `${v}%` : v);
  return (
    <div className="border border-renascer/10 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium">{meta.titulo}</p>
        {onExcluir && (
          <button className="text-xs text-red-600 underline" onClick={onExcluir}>
            Excluir
          </button>
        )}
      </div>
      <div className="h-2 rounded-full bg-renascer-light overflow-hidden">
        <div className="h-full bg-renascer" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1 text-xs text-renascer-ink/60">
        <span>
          {formatar(meta.valorAtual)} de {formatar(meta.valorMeta)} ({pct.toFixed(0)}%)
        </span>
        {meta.observacao && <span>{meta.observacao}</span>}
      </div>
      {onAtualizar && (
        <button className="btn-secondary text-xs mt-2" onClick={onAtualizar}>
          Atualizar valor atual
        </button>
      )}
    </div>
  );
}

function MeuDiaMetas() {
  const [metas, setMetas] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [unidade, setUnidade] = useState("reais");
  const [valorMeta, setValorMeta] = useState("");
  const [observacao, setObservacao] = useState("");

  async function carregar() {
    const { data } = await api.get("/dono/meu-dia/metas");
    setMetas(data.metas);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    if (!titulo || !valorMeta) return;
    await api.post("/dono/meu-dia/metas", { titulo, unidade, valorMeta: Number(valorMeta), observacao: observacao || undefined });
    setTitulo("");
    setValorMeta("");
    setObservacao("");
    setMostrarForm(false);
    carregar();
  }
  async function atualizar(meta) {
    const valor = window.prompt("Novo valor atual:", String(meta.valorAtual));
    if (valor === null || isNaN(Number(valor))) return;
    await api.put(`/dono/meu-dia/metas/${meta.id}`, { valorAtual: Number(valor) });
    carregar();
  }
  async function excluir(id) {
    if (!window.confirm("Excluir esta meta?")) return;
    await api.delete(`/dono/meu-dia/metas/${id}`);
    carregar();
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Metas do trimestre</h3>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          + Nova meta
        </button>
      </div>
      {mostrarForm && (
        <div className="space-y-2 p-3 rounded-xl bg-renascer-light/40">
          <input className="input" placeholder="Título (ex: Faturamento do trimestre)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <select className="input" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
            <option value="reais">Reais (R$)</option>
            <option value="numero">Número</option>
            <option value="percentual">Percentual (%)</option>
          </select>
          <input className="input" type="number" step="0.01" placeholder="Meta" value={valorMeta} onChange={(e) => setValorMeta(e.target.value)} />
          <input className="input" placeholder="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          <button className="btn-primary" onClick={criar}>
            Salvar meta
          </button>
        </div>
      )}
      <div className="space-y-3">
        {metas.map((m) => (
          <BarraMetaTrimestre key={m.id} meta={m} onAtualizar={() => atualizar(m)} onExcluir={() => excluir(m.id)} />
        ))}
        {metas.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma meta cadastrada neste trimestre.</p>}
      </div>
    </div>
  );
}

// ---------------- MAPAS MENTAIS (planejamento do Dono: estratégias, tarefas, ideias) ----------------
// Fase 32. Cada mapa fica salvo com os nós (posição e texto) direto no banco, então o Dono pode
// sair e voltar que tudo continua do jeito que deixou. Arrastar um nó só grava a posição final
// quando solta o mouse (não a cada pixel de movimento), pra não sobrecarregar o servidor.
const LARGURA_NO_MAPA = 170;
const LARGURA_RAIZ_MAPA = 190;
const ALTURA_NO_MAPA = 54;

function MapasMentais() {
  const [mapas, setMapas] = useState([]);
  const [mapaAtivoId, setMapaAtivoId] = useState(null);
  const [mapaAtual, setMapaAtual] = useState(null); // { id, nome, cor, nodes }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarNovoMapa, setMostrarNovoMapa] = useState(false);
  const [novoMapaNome, setNovoMapaNome] = useState("");
  const [noSelecionadoId, setNoSelecionadoId] = useState(null);

  const arrasteRef = useRef(null); // { nodeId, startX, startY, origX, origY, moveu }
  const textoTimeoutRef = useRef(null);

  useEffect(() => {
    carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarLista() {
    setCarregando(true);
    setErro("");
    try {
      const { data } = await api.get("/mapas-mentais");
      setMapas(data);
      if (data.length > 0) {
        await selecionarMapa(data[0].id);
      } else {
        setMapaAtivoId(null);
        setMapaAtual(null);
      }
    } catch (e) {
      setErro("Não foi possível carregar os mapas mentais agora.");
    } finally {
      setCarregando(false);
    }
  }

  async function selecionarMapa(id) {
    setNoSelecionadoId(null);
    const { data } = await api.get(`/mapas-mentais/${id}`);
    setMapaAtivoId(id);
    setMapaAtual(data);
  }

  async function criarMapa() {
    const nome = novoMapaNome.trim();
    if (!nome) return;
    const { data } = await api.post("/mapas-mentais", { nome });
    setMostrarNovoMapa(false);
    setNovoMapaNome("");
    const { data: lista } = await api.get("/mapas-mentais");
    setMapas(lista);
    setMapaAtivoId(data.id);
    setMapaAtual(data);
    setNoSelecionadoId(null);
  }

  async function excluirMapaAtual() {
    if (!mapaAtual) return;
    if (!window.confirm(`Excluir o mapa "${mapaAtual.nome}" e todos os nós dele? Essa ação não pode ser desfeita.`)) return;
    await api.delete(`/mapas-mentais/${mapaAtual.id}`);
    await carregarLista();
  }

  function iniciarArraste(nodeId, origX, origY, e) {
    e.preventDefault();
    arrasteRef.current = { nodeId, startX: e.clientX, startY: e.clientY, origX, origY, moveu: false };
    setNoSelecionadoId(nodeId);
  }

  function moverArraste(e) {
    const a = arrasteRef.current;
    if (!a) return;
    const dx = e.clientX - a.startX;
    const dy = e.clientY - a.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) a.moveu = true;
    const novoX = Math.max(0, a.origX + dx);
    const novoY = Math.max(0, a.origY + dy);
    setMapaAtual((m) => (m ? { ...m, nodes: m.nodes.map((n) => (n.id !== a.nodeId ? n : { ...n, x: novoX, y: novoY })) } : m));
  }

  async function soltarArraste() {
    const a = arrasteRef.current;
    arrasteRef.current = null;
    if (!a || !a.moveu) return;
    setMapaAtual((atual) => {
      const no = atual?.nodes.find((n) => n.id === a.nodeId);
      if (no) {
        api.patch(`/mapas-mentais/${atual.id}/nos/${no.id}`, { x: no.x, y: no.y }).catch(() => {});
      }
      return atual;
    });
  }

  function atualizarTextoNo(nodeId, texto) {
    setMapaAtual((m) => (m ? { ...m, nodes: m.nodes.map((n) => (n.id !== nodeId ? n : { ...n, texto })) } : m));
    clearTimeout(textoTimeoutRef.current);
    textoTimeoutRef.current = setTimeout(() => {
      if (mapaAtivoId) api.patch(`/mapas-mentais/${mapaAtivoId}/nos/${nodeId}`, { texto }).catch(() => {});
    }, 500);
  }

  async function adicionarNoFilho() {
    if (!noSelecionadoId || !mapaAtual) return;
    const { data } = await api.post(`/mapas-mentais/${mapaAtual.id}/nos`, { parentId: noSelecionadoId });
    setMapaAtual((m) => ({ ...m, nodes: data.nodes }));
    setNoSelecionadoId(data.novoId);
    setMapas((lista) => lista.map((mm) => (mm.id === mapaAtual.id ? { ...mm, totalNos: data.nodes.length } : mm)));
  }

  async function excluirNoSelecionado() {
    if (!noSelecionadoId || !mapaAtual) return;
    const { data } = await api.delete(`/mapas-mentais/${mapaAtual.id}/nos/${noSelecionadoId}`);
    setMapaAtual((m) => ({ ...m, nodes: data.nodes }));
    setNoSelecionadoId(null);
    setMapas((lista) => lista.map((mm) => (mm.id === mapaAtual.id ? { ...mm, totalNos: data.nodes.length } : mm)));
  }

  if (carregando) return <p className="text-sm text-renascer-ink/60">Carregando mapas mentais...</p>;

  const noSelecionado = (mapaAtual?.nodes || []).find((n) => n.id === noSelecionadoId) || null;

  const linhas = [];
  if (mapaAtual) {
    mapaAtual.nodes.forEach((n) => {
      if (!n.parentId) return;
      const pai = mapaAtual.nodes.find((p) => p.id === n.parentId);
      if (!pai) return;
      const larguraPai = pai.parentId ? LARGURA_NO_MAPA : LARGURA_RAIZ_MAPA;
      linhas.push({
        key: n.id,
        x1: pai.x + larguraPai / 2,
        y1: pai.y + ALTURA_NO_MAPA / 2,
        x2: n.x + LARGURA_NO_MAPA / 2,
        y2: n.y + ALTURA_NO_MAPA / 2,
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Mapas mentais</h2>
        <p className="text-sm text-renascer-ink/60">
          Arraste os nós para organizar, crie quantos mapas quiser — estratégias, tarefas, ideias pra o futuro.
        </p>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-4 flex-wrap items-start">
        <div className="card w-full md:w-56 flex flex-col gap-2 shrink-0">
          <p className="font-semibold text-sm">Meus mapas</p>
          <div className="flex flex-col gap-1">
            {mapas.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selecionarMapa(m.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                  m.id === mapaAtivoId ? "bg-renascer-light/60 text-renascer" : "text-renascer-ink/70 hover:bg-renascer-light/30"
                }`}
              >
                <span className="flex items-center gap-2 overflow-hidden">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.cor }} />
                  <span className="truncate">{m.nome}</span>
                </span>
                <span className="text-xs font-bold shrink-0">{m.totalNos}</span>
              </button>
            ))}
            {mapas.length === 0 && <p className="text-xs text-renascer-ink/50">Nenhum mapa ainda.</p>}
          </div>

          {mostrarNovoMapa ? (
            <div className="flex flex-col gap-2 pt-2 border-t border-renascer-ink/10">
              <input
                className="input"
                placeholder="Nome do novo mapa"
                value={novoMapaNome}
                onChange={(e) => setNovoMapaNome(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" className="btn-primary flex-1 !py-2 text-sm" onClick={criarMapa}>
                  Criar
                </button>
                <button
                  type="button"
                  className="btn-secondary !py-2 text-sm"
                  onClick={() => {
                    setMostrarNovoMapa(false);
                    setNovoMapaNome("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-secondary text-sm" onClick={() => setMostrarNovoMapa(true)}>
              + Novo mapa mental
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {!mapaAtual ? (
            <div className="card text-sm text-renascer-ink/60">
              Crie seu primeiro mapa mental pra começar a organizar estratégias, tarefas ou ideias.
            </div>
          ) : (
            <>
              <div className="card flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold">{mapaAtual.nome}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-renascer-ink/50">Clique em um nó pra selecionar · arraste pra reorganizar</p>
                    <button type="button" onClick={excluirMapaAtual} className="text-xs font-medium text-red-600 hover:text-red-700">
                      Excluir mapa
                    </button>
                  </div>
                </div>
                <div
                  className="relative rounded-xl border border-renascer-ink/10 overflow-auto"
                  style={{
                    height: 500,
                    backgroundColor: "#FAFBFD",
                    backgroundImage: "radial-gradient(circle, #E1E8F2 1.4px, transparent 1.4px)",
                    backgroundSize: "22px 22px",
                  }}
                  onMouseMove={moverArraste}
                  onMouseUp={soltarArraste}
                  onMouseLeave={soltarArraste}
                >
                  <div className="relative" style={{ width: 1200, height: 760 }}>
                    <svg width={1200} height={760} className="absolute top-0 left-0 pointer-events-none">
                      {linhas.map((l) => (
                        <line
                          key={l.key}
                          x1={l.x1}
                          y1={l.y1}
                          x2={l.x2}
                          y2={l.y2}
                          stroke={mapaAtual.cor}
                          strokeWidth={2}
                          strokeLinecap="round"
                        />
                      ))}
                    </svg>
                    {mapaAtual.nodes.map((n) => {
                      const ehRaiz = !n.parentId;
                      const selecionado = n.id === noSelecionadoId;
                      return (
                        <div
                          key={n.id}
                          onMouseDown={(e) => iniciarArraste(n.id, n.x, n.y, e)}
                          onClick={() => setNoSelecionadoId(n.id)}
                          className="absolute rounded-lg px-3 py-2 text-xs leading-tight select-none cursor-grab active:cursor-grabbing"
                          style={{
                            left: n.x,
                            top: n.y,
                            width: ehRaiz ? LARGURA_RAIZ_MAPA : LARGURA_NO_MAPA,
                            background: ehRaiz ? mapaAtual.cor : "#fff",
                            color: ehRaiz ? "#fff" : "#1A2740",
                            borderLeft: ehRaiz ? "4px solid transparent" : `4px solid ${mapaAtual.cor}`,
                            fontWeight: ehRaiz ? 700 : 600,
                            boxShadow: selecionado
                              ? "0 0 0 2px #0D1B30, 0 3px 8px rgba(14,30,54,0.18)"
                              : "0 2px 6px rgba(14,30,54,0.12)",
                          }}
                        >
                          {n.texto}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="card flex flex-col gap-3">
                {noSelecionado ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-renascer-ink/50">Nó selecionado</p>
                    <input
                      className="input"
                      value={noSelecionado.texto}
                      onChange={(e) => atualizarTextoNo(noSelecionado.id, e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                      <button type="button" className="btn-primary !py-2 text-sm" onClick={adicionarNoFilho}>
                        + Nó filho
                      </button>
                      {noSelecionado.parentId && (
                        <button
                          type="button"
                          onClick={excluirNoSelecionado}
                          className="text-sm font-medium text-red-600 hover:text-red-700 px-3"
                        >
                          Excluir nó
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-renascer-ink/60">
                    Clique em um nó no mapa acima pra editar o texto, adicionar um nó filho ou excluir.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
