import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

export default function AreaAtendente() {
  const { user, carregando } = useAuth("ATENDENTE");
  const [aba, setAba] = useState("clientes");
  if (carregando) return null;

  const ABAS = [
    { id: "clientes", label: "Clientes" },
    { id: "profissionais", label: "Profissionais e agendar" },
    { id: "agenda", label: "Agenda geral" },
    { id: "suporte", label: "Suporte escalado" },
  ];

  return (
    <Layout user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "clientes" && <Clientes />}
      {aba === "profissionais" && <ProfissionaisEAgendar />}
      {aba === "agenda" && <AgendaGeral />}
      {aba === "suporte" && <SuporteEscalado />}
    </Layout>
  );
}

const DIAS_LABEL = {
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

// ---------------- PROFISSIONAIS: perfil completo + agendar exatamente o que o cliente quer ----------------
function ProfissionaisEAgendar() {
  const [profissionais, setProfissionais] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);

  async function carregar() {
    const [p, c] = await Promise.all([api.get("/atendente/profissionais"), api.get("/atendente/clientes")]);
    setProfissionais(p.data);
    setClientes(c.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {profissionais.map((p) => (
        <div key={p.id} className="card">
          <div className="flex gap-3">
            <img
              src={p.user.fotoUrl || "https://via.placeholder.com/72?text=Foto"}
              alt={p.user.nome}
              className="w-16 h-16 rounded-full object-cover border border-renascer/20"
            />
            <div className="flex-1">
              <p className="font-semibold">
                {p.user.nome} {p.idade ? `· ${p.idade} anos` : ""}
              </p>
              <p className="text-sm text-renascer-ink/60">{p.titulo}{p.registro ? ` · ${p.registro}` : ""}</p>
              {p.abordagens && <p className="text-xs text-renascer-ink/50">Abordagem: {p.abordagens}</p>}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {(p.especialidades || []).map((e) => (
              <span key={e} className="badge bg-renascer-light text-renascer">
                {e}
              </span>
            ))}
          </div>

          <div className="text-xs text-renascer-ink/50 mt-2">
            {p.disponibilidades.length === 0 && "Nenhum horário liberado ainda."}
            {p.disponibilidades.map((d) => (
              <span key={d.id} className="inline-block mr-2">
                {DIAS_LABEL[d.diaSemana]} {d.horaInicio}–{d.horaFim}
              </span>
            ))}
          </div>

          <button className="btn-secondary mt-3 text-sm" onClick={() => setSelecionada(selecionada?.id === p.id ? null : p)}>
            {selecionada?.id === p.id ? "Fechar" : "Ver horários e agendar"}
          </button>

          {selecionada?.id === p.id && <AgendarComProfissional profissional={p} clientes={clientes} onAgendado={carregar} />}
        </div>
      ))}
      {profissionais.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhuma profissional cadastrada ainda.</p>}
    </div>
  );
}

function AgendarComProfissional({ profissional, clientes, onAgendado }) {
  const [clienteId, setClienteId] = useState("");
  const [data, setData] = useState("");
  const [duracao, setDuracao] = useState("MIN50");
  const [horarios, setHorarios] = useState(null);
  const [horaEscolhida, setHoraEscolhida] = useState("");
  const [msg, setMsg] = useState("");

  async function buscarHorarios() {
    if (!data) return;
    setMsg("");
    setHoraEscolhida("");
    const { data: resp } = await api.get(`/atendente/profissionais/${profissional.id}/horarios`, { params: { data, duracao } });
    setHorarios(resp);
  }

  async function confirmar() {
    if (!clienteId || !data || !horaEscolhida) {
      setMsg("Escolha o cliente, a data e o horário.");
      return;
    }
    try {
      await api.post("/atendente/agendamentos", { clienteId, profissionalId: profissional.id, data, horaInicio: horaEscolhida, duracao });
      setMsg("Sessão agendada com sucesso!");
      setHoraEscolhida("");
      onAgendado();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao agendar.");
    }
  }

  return (
    <div className="mt-3 border-t border-renascer/10 pt-3 space-y-2">
      <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
        <option value="">Escolha o cliente</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.user.nome}
          </option>
        ))}
      </select>
            <div className="flex flex-wrap gap-2">
        <input type="date" className="input flex-1 min-w-[150px]" value={data} onChange={(e) => setData(e.target.value)} />
        <select className="input !w-40" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
          <option value="MIN30">30 minutos</option>
          <option value="MIN50">50 minutos</option>
        </select>
        <button className="btn-secondary whitespace-nowrap" onClick={buscarHorarios}>
          Ver horários livres
        </button>
      </div>

      {horarios && (
        <div className="flex flex-wrap gap-2">
          {horarios.livres.length === 0 && <p className="text-sm text-amber-700">Nenhum horário livre nesse dia ({horarios.diaSemana}).</p>}
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
      )}

      <button className="btn-primary" onClick={confirmar} disabled={!horaEscolhida}>
        Confirmar agendamento
      </button>
      {msg && <p className="text-sm">{msg}</p>}

      <details className="text-sm mt-2">
        <summary className="cursor-pointer text-renascer">O cliente ainda não tem pacote pago com essa profissional?</summary>
        <RegistrarPacote clienteId={clienteId} onRegistrado={() => setMsg("Pacote registrado! Agora já pode escolher o horário.")} />
      </details>
    </div>
  );
}

function RegistrarPacote({ clienteId, onRegistrado }) {
  const [duracao, setDuracao] = useState("MIN50");
  const [totalSessoes, setTotalSessoes] = useState(4);
  const [valorTotal, setValorTotal] = useState("");
  const [msg, setMsg] = useState("");

  async function registrar() {
    if (!clienteId) {
      setMsg("Escolha o cliente acima primeiro.");
      return;
    }
    try {
      await api.post(`/atendente/clientes/${clienteId}/pacotes`, {
        duracao,
        totalSessoes: Number(totalSessoes),
        valorTotal: valorTotal ? Number(valorTotal) : undefined,
      });
      setMsg("Pacote registrado com sucesso!");
      onRegistrado?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao registrar pacote.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2 items-center">
      <select className="input !w-auto" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
        <option value="MIN30">30 minutos</option>
        <option value="MIN50">50 minutos</option>
      </select>
      <select className="input !w-auto" value={totalSessoes} onChange={(e) => setTotalSessoes(e.target.value)}>
        <option value={1}>1 sessão</option>
        <option value={2}>2 sessões</option>
        <option value={4}>4 sessões</option>
      </select>
      <input className="input !w-32" placeholder="Valor (opcional)" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
      <button className="btn-secondary" onClick={registrar}>
        Registrar pacote
      </button>
      {msg && <p className="text-sm w-full">{msg}</p>}
    </div>
  );
}
function Clientes() {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", profissionalAtualId: "" });
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState("");
  const [expandido, setExpandido] = useState(null);

  async function carregar() {
    const [c, p] = await Promise.all([api.get("/atendente/clientes"), api.get("/atendente/profissionais")]);
    setLista(c.data);
    setProfissionais(p.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function cadastrar() {
    setMsg("");
    setResultado(null);
    try {
      const { data } = await api.post("/atendente/clientes", form);
      setResultado(data);
      setForm({ nome: "", email: "", telefone: "", profissionalAtualId: "" });
      carregar();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao cadastrar cliente.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="font-semibold mb-3">Cadastrar novo cliente</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <input className="input" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className="input" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <select className="input" value={form.profissionalAtualId} onChange={(e) => setForm({ ...form, profissionalAtualId: e.target.value })}>
            <option value="">Vincular profissional (opcional)</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>
                {p.user.nome}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary mt-3" onClick={cadastrar}>
          Cadastrar
        </button>
        {msg && <p className="text-red-600 text-sm mt-2">{msg}</p>}
        {resultado && (
          <p className="text-emerald-600 text-sm mt-2">
            Cliente criado! Senha provisória: <strong>{resultado.senhaProvisoria}</strong> (repasse isso pro cliente por um canal seguro)
          </p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-2">Clientes cadastrados</h2>
        <p className="text-xs text-renascer-ink/50 mb-2">Clique num cliente pra ver tempo de casa e renovações.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th>Nome</th>
              <th>E-mail</th>
              <th>Profissional</th>
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
                  <td className="py-1">{c.user.nome}</td>
                  <td>{c.user.email}</td>
                  <td>{c.profissionalAtual?.user?.nome || "-"}</td>
                </tr>,
              ];
                            if (expandido === c.id) {
                linhas.push(
                  <tr key={`${c.id}-metricas`} className="border-t border-renascer/10 bg-renascer-light/20">
                    <td colSpan={3} className="py-2 space-y-3">
                      <MetricasCliente clienteId={c.id} rotaBase="/atendente" />
                      <NotificacaoECliente cliente={c} rotaBase="/atendente" onExcluido={carregar} podeExcluir />
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

// Contato de notificação (e-mail/telefone + data de renovação) e, quando permitido,
// exclusão do login — a atendente só pode excluir CLIENTES (nunca outros papéis).
function NotificacaoECliente({ cliente, rotaBase, onExcluido, podeExcluir }) {
  const [notifEmail, setNotifEmail] = useState(cliente.notifEmail || "");
  const [notifTelefone, setNotifTelefone] = useState(cliente.notifTelefone || "");
  const [renovarEm, setRenovarEm] = useState(cliente.renovarEm ? new Date(cliente.renovarEm).toISOString().slice(0, 10) : "");
  const [msg, setMsg] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  async function salvar() {
    setMsg("");
    try {
      await api.put(`${rotaBase}/clientes/${cliente.id}/notificacao`, {
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
      await api.delete(`${rotaBase}/clientes/${cliente.id}`);
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
        {podeExcluir && (
          <button className="text-red-600 text-sm underline" onClick={excluir} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Excluir login deste cliente"}
          </button>
        )}
      </div>
      {msg && <p className="text-sm">{msg}</p>}
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

function AgendaGeral() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/atendente/agenda-geral").then((r) => setLista(r.data));
  }, []);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-renascer-ink/50">
            <th>Data</th>
            <th>Profissional</th>
            <th>Cliente</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((a) => (
            <tr key={a.id} className="border-t border-renascer/10">
              <td className="py-1">{new Date(a.data).toLocaleString("pt-BR")}</td>
              <td>{a.profissional.user.nome}</td>
              <td>{a.cliente.user.nome}</td>
              <td>{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuporteEscalado() {
  const [tickets, setTickets] = useState([]);
  useEffect(() => {
    api.get("/atendente/suporte-gerencia").then((r) => setTickets(r.data));
  }, []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-renascer-ink/50">Você pode visualizar os chamados escalados; a resposta cabe à gerência (donos).</p>
      {tickets.map((t) => (
        <div key={t.id} className="card">
          <p className="font-semibold">{t.assunto}</p>
          <p className="text-xs text-renascer-ink/50 mb-2">Cliente: {t.cliente.user.nome}</p>
          {t.mensagens.map((m) => (
            <p key={m.id} className="text-sm">
              {m.texto}
            </p>
          ))}
        </div>
      ))}
      {tickets.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhum chamado escalado.</p>}
    </div>
  );
}
