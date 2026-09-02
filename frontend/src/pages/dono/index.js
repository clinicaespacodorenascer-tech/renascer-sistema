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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cartoes.map(([label, valor]) => (
        <div key={label} className="card">
          <p className="text-sm text-renascer-ink/60">{label}</p>
          <p className="text-2xl font-bold text-renascer">{valor}</p>
        </div>
      ))}
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
  useEffect(() => {
    api.get("/dono/clientes").then((r) => setLista(r.data));
  }, []);
  return (
    <div className="card overflow-x-auto">
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
          {lista.map((c) => (
            <tr key={c.id} className="border-t border-renascer/10">
              <td className="py-1">{c.user.nome}</td>
              <td>{c.profissionalAtual?.user?.nome || "-"}</td>
              <td>{c.pacotes[0] ? `${c.pacotes[0].sessoesUsadas}/${c.pacotes[0].totalSessoes}` : "-"}</td>
              <td>{c.pacotes[0]?.status || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-renascer-ink/50">
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className="border-t border-renascer/10">
                <td className="py-1">{u.nome}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.ativo ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div className="flex gap-2">
            <input
              className="input"
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
