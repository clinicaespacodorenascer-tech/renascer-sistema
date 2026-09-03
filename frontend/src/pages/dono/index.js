import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

export default function AreaDono() {
  const { user, carregando } = useAuth("DONO");
  const [aba, setAba] = useState("dashboard");
  if (carregando) return null;

  const ABAS = [
    { id: "dashboard", label: "Visão geral" },
    { id: "profissionais", label: "Profissionais" },
    { id: "clientes", label: "Clientes" },
    { id: "financeiro", label: "Financeiro" },
    { id: "usuarios", label: "Usuários" },
    { id: "suporte", label: "Suporte escalado" },
  ];

  return (
    <Layout user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "dashboard" && <Dashboard />}
      {aba === "profissionais" && <Profissionais />}
      {aba === "clientes" && <Clientes />}
      {aba === "financeiro" && <Financeiro />}
      {aba === "usuarios" && <Usuarios />}
      {aba === "suporte" && <SuporteEscalado />}
    </Layout>
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
    ["Faturamento do mês", `R$ ${d.faturamentoMes.toFixed(2)}`],
    ["Repasse às profissionais", `R$ ${d.repasseProfissionaisMes.toFixed(2)}`],
    ["Receita da Renascer", `R$ ${d.receitaRenascerMes.toFixed(2)}`],
  ];
    return (
    <div className="space-y-4">
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
                <td className="py-1">{c.user.nome}</td>
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
                    <NotificacaoECliente cliente={c} onExcluido={carregar} />
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
  useEffect(() => {
    api.get("/dono/financeiro").then((r) => setF(r.data));
  }, []);
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Usuarios() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "", role: "PROFISSIONAL" });
  const [msg, setMsg] = useState("");
  const [editando, setEditando] = useState(null);

  async function carregar() {
    const { data } = await api.get("/dono/usuarios");
    setLista(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar() {
    setMsg("");
    try {
      await api.post("/dono/usuarios", form);
      setMsg("Usuário criado com sucesso!");
      setForm({ nome: "", email: "", telefone: "", senha: "", role: "PROFISSIONAL" });
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
          </select>
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
