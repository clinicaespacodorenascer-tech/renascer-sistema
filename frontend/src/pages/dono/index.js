import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { verComprovante, abrirImagem, verComprovanteRepasse } from "../../lib/comprovante";
import StatusCliente from "../../components/StatusCliente";

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
    { id: "dashboard", label: "Visão geral" },
    { id: "profissionais", label: "Profissionais" },
    { id: "clientes", label: "Clientes" },
    { id: "reativar", label: "Reativar clientes" },
    { id: "historico", label: "Histórico" },
    { id: "financeiro", label: "Financeiro" },
    { id: "repasses", label: "Repasses" },
    { id: "usuarios", label: "Usuários" },
    { id: "suporte", label: "Suporte escalado" },
    { id: "financaPessoal", label: "Financeiro pessoal" },
  ];

  return (
    <Layout user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "dashboard" && <Dashboard />}
      {aba === "profissionais" && <Profissionais />}
      {aba === "clientes" && <Clientes />}
      {aba === "reativar" && <ClientesParaReativar rotaBase="/dono" />}
      {aba === "historico" && <HistoricoClientes />}
      {aba === "financeiro" && <Financeiro />}
      {aba === "repasses" && <RepassesProfissionais />}
      {aba === "usuarios" && <Usuarios />}
      {aba === "suporte" && <SuporteEscalado />}
      {aba === "financaPessoal" && <AbaFinancaPessoal />}
    </Layout>
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

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Clientes pra reativar</h2>
      <p className="text-xs text-renascer-ink/50 mb-3">
        Clientes que alguma profissional marcou como "não renovou". Chama no WhatsApp com o número que ele
        deixou no cadastro e, se ele topar voltar, vincula de novo com uma profissional aqui mesmo.
      </p>
      <div className="space-y-2">
        {lista.map((c) => {
          const linkReativar = c.whatsapp
            ? "https://wa.me/" +
              c.whatsapp.replace(/\D/g, "") +
              "?text=" +
              encodeURIComponent(
                "Olá, " + c.nome + "! Aqui é do Espaço do Renascer. Sentimos sua falta, quer voltar a agendar suas sessões?"
              )
            : null;
          return (
          <div key={c.id} className="border border-renascer/10 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{c.nome}</p>
              <p className="text-xs text-renascer-ink/50">
                {c.pacoteResumo || "pacote não registrado"} · saiu em{" "}
                {c.excluidoEm ? new Date(c.excluidoEm).toLocaleDateString("pt-BR") : "-"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {linkReativar && (
                <button className="btn-secondary text-sm" onClick={() => window.open(linkReativar, "_blank")}>
                  💬 Chamar no WhatsApp
                </button>
              )}
              <select
                className="input !w-auto !py-1.5 text-sm"
                value={escolha[c.id] || ""}
                onChange={(e) => setEscolha({ ...escolha, [c.id]: e.target.value })}
              >
                <option value="">Reativar com...</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.user.nome}
                  </option>
                ))}
              </select>
              <button className="btn-primary text-sm" onClick={() => reativar(c.id)} disabled={!escolha[c.id]}>
                Reativar
              </button>
            </div>
          </div>
          );
        })}
        {lista.length === 0 && <p className="text-sm text-renascer-ink/50">Ninguém na fila de reativação agora.</p>}
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
const TIPO_HISTORICO_COR = {
  ENTROU: "bg-blue-100 text-blue-700",
  RENOVOU: "bg-emerald-100 text-emerald-700",
  EXCLUIDO: "bg-red-100 text-red-700",
  REATIVADO: "bg-renascer-light text-renascer",
};

function HistoricoClientes() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/dono/historico-clientes").then((r) => setLista(r.data));
  }, []);

  return (
    <div className="card overflow-x-auto">
      <h2 className="font-semibold mb-1">Histórico de clientes</h2>
      <p className="text-xs text-renascer-ink/50 mb-3">
        Só você vê essa aba — todo mundo que entrou, renovou, saiu (não renovou) ou foi reativado.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-renascer-ink/50">
            <th className="py-1">Data</th>
            <th>Cliente</th>
            <th>Evento</th>
            <th>Pacote</th>
            <th>Profissional</th>
            <th>WhatsApp</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((h) => (
            <tr key={h.id} className="border-t border-renascer/10">
              <td className="py-1">{new Date(h.criadoEm).toLocaleDateString("pt-BR")}</td>
              <td>{h.nomeCliente}</td>
              <td>
                <span className={`badge ${TIPO_HISTORICO_COR[h.tipo]}`}>{TIPO_HISTORICO_LABEL[h.tipo] || h.tipo}</span>
              </td>
              <td>{h.pacoteResumo || "-"}</td>
              <td>{h.profissionalNome || "-"}</td>
              <td>{h.whatsapp || "-"}</td>
            </tr>
          ))}
          {lista.length === 0 && (
            <tr>
              <td colSpan={6} className="text-renascer-ink/50 py-2">
                Nenhum evento registrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/dono/dashboard").then((r) => setD(r.data));
  }, []);
  if (!d) return <p>Carregando...</p>;
  const cartoes = [
    ["Profissionais ativas", d.totalProfissionais],
    ["Clientes cadastrados", d.totalClientes],
    ["Pacotes ativos", d.pacotesAtivos],
    ["Recebido no mês (total)", `R$ ${d.faturamentoMes.toFixed(2)}`],
    ["Repasse às profissionais no mês", `R$ ${d.repasseProfissionaisMes.toFixed(2)}`],
    ["Receita da Renascer no mês", `R$ ${d.receitaRenascerMes.toFixed(2)}`],
  ];
  const profissionaisHoje = Object.entries(d.porProfissionalHoje || {});
  return (
    <div className="space-y-4">
      <div className="card !border-renascer/30 bg-renascer-light/30">
        <h3 className="font-semibold mb-1">A receber hoje</h3>
        <p className="text-xs text-renascer-ink/50 mb-3">
          Tudo que a atendente fechou hoje (contratação nova, renovação, sessão extra ou qualquer outro pagamento). O que
          a própria profissional registra sozinha (renovação/sessão extra dela) não conta aqui — só aparece nas
          pendências de repasse abaixo. Esse número reinicia sozinho todo dia — amanhã começa do zero de novo.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-renascer-ink/50">Total registrado hoje</p>
            <p className="text-xl font-bold text-renascer">R$ {d.hoje.totalRecebido.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-renascer-ink/50">Vai pras profissionais</p>
            <p className="text-xl font-bold text-renascer-ink/70">R$ {d.hoje.valorProfissional.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-renascer-ink/50">Você vai receber hoje</p>
            <p className="text-xl font-bold text-emerald-600">R$ {d.hoje.valorRenascer.toFixed(2)}</p>
          </div>
        </div>
        {profissionaisHoje.length > 0 && (
          <div className="border-t border-renascer/10 pt-2 space-y-1">
            <p className="text-xs font-medium text-renascer-ink/60">Quanto você vai receber de cada profissional hoje</p>
            {profissionaisHoje.map(([nome, v]) => (
              <div key={nome} className="flex items-center justify-between text-sm">
                <span>{nome}</span>
                <span className="font-semibold text-emerald-600">R$ {v.valorRenascer.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
        {profissionaisHoje.length === 0 && <p className="text-xs text-renascer-ink/40">Nada registrado hoje ainda.</p>}
      </div>

      {d.totalPendenteRepasseProfissionais > 0 && (
        <div className="card !border-amber-300 bg-amber-50">
          <h3 className="font-semibold mb-1">Repasses pendentes das profissionais</h3>
          <p className="text-xs text-renascer-ink/50 mb-2">
            Dinheiro que as profissionais receberam direto dos clientes e ainda não te repassaram. Veja o detalhe na aba
            "Repasses".
          </p>
          <p className="text-2xl font-bold text-amber-700">R$ {d.totalPendenteRepasseProfissionais.toFixed(2)}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cartoes.map(([label, valor]) => (
          <div key={label} className="card">
            <p className="text-sm text-renascer-ink/60">{label}</p>
            <p className="text-2xl font-bold text-renascer">{valor}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Clientes por profissional</h3>
        <p className="text-xs text-renascer-ink/50 mb-3">
          Conta tanto os clientes cadastrados pela recepção quanto os que a própria profissional cadastrou na aba dela.
        </p>
        <div className="space-y-1">
          {d.clientesPorProfissional.map((p) => (
            <div key={p.nome} className="flex items-center justify-between border-t border-renascer/10 py-1.5 text-sm">
              <span>{p.nome}</span>
              <span className="font-semibold text-renascer">{p.total}</span>
            </div>
          ))}
          {d.clientesPorProfissional.length === 0 && (
            <p className="text-sm text-renascer-ink/50">Nenhuma profissional cadastrada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Profissionais() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/dono/profissionais").then((r) => setLista(r.data));
  }, []);
  return (
    <div className="space-y-3">
      {lista.map((p) => (
        <div key={p.id} className="card">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold">{p.user.nome}</p>
              <p className="text-sm text-renascer-ink/60">{p.titulo} · {p._count.clientes} clientes · {p._count.agendamentos} sessões</p>
            </div>
            <span className={`badge ${p.user.ativo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {p.user.ativo ? "Ativa" : "Inativa"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {p.clientes.map((c) => (
              <span key={c.id} className="badge bg-renascer-light text-renascer">
                {c.user.nome}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Clientes() {
  const [lista, setLista] = useState([]);
  const [expandido, setExpandido] = useState(null);

  async function carregar() {
    const { data } = await api.get("/dono/clientes");
    setLista(data);
  }
  useEffect(() => {
    carregar();
  }, []);
  return (
    <div className="card overflow-x-auto">
      <p className="text-xs text-renascer-ink/50 mb-2">Clique num cliente pra ver tempo de casa e renovações.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-renascer-ink/50">
            <th className="py-1">Cliente</th>
            <th>Profissional</th>
            <th>Pacote atual</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {lista.flatMap((c) => {
            const linhas = [
              <tr
                key={c.id}
                className="border-t border-renascer/10 cursor-pointer hover:bg-renascer-light/30"
                onClick={() => setExpandido(expandido === c.id ? null : c.id)}
              >
                <td className="py-1 flex items-center gap-1.5">
                  <StatusCliente status={c.statusCliente} />
                  {c.user.nome}
                </td>
                <td>{c.profissionalAtual?.user?.nome || "-"}</td>
                <td>{c.pacotes[0] ? `${c.pacotes[0].sessoesUsadas}/${c.pacotes[0].totalSessoes}` : "-"}</td>
                <td>{c.pacotes[0]?.status || "-"}</td>
              </tr>,
            ];
            if (expandido === c.id) {
              linhas.push(
                <tr key={`${c.id}-metricas`} className="border-t border-renascer/10 bg-renascer-light/20">
                  <td colSpan={4} className="py-2 space-y-3">
                    <MetricasCliente clienteId={c.id} rotaBase="/dono" />
                    <ContratoCliente clienteId={c.id} />
                    <NotificacaoECliente cliente={c} onExcluido={carregar} />
                    <HistoricoPagamentos clienteId={c.id} rotaBase="/dono" />
                  </td>
                </tr>
              );
            }
            return linhas;
          })}
        </tbody>
      </table>
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
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", role: "PROFISSIONAL", profissionalAtualId: "" });
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState(null);

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
      setForm({ nome: "", email: "", telefone: "", senha: "", role: "PROFISSIONAL", profissionalAtualId: "" });
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
                </option>
              ))}
            </select>
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
