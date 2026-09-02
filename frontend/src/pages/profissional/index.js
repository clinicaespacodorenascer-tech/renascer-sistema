import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../../components/Layout";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

const DIAS = [
  ["SEGUNDA", "Segunda"],
  ["TERCA", "Terça"],
  ["QUARTA", "Quarta"],
  ["QUINTA", "Quinta"],
  ["SEXTA", "Sexta"],
  ["SABADO", "Sábado"],
  ["DOMINGO", "Domingo"],
];

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
    { id: "financeiro", label: "Financeiro" },
    { id: "notificacoes", label: "Avisos" },
    { id: "config", label: "Disponibilidade" },
  ];

  return (
    <Layout user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "agenda" && <AbaAgenda />}
      {aba === "clientes" && <AbaClientes />}
      {aba === "financeiro" && <AbaFinanceiro />}
      {aba === "notificacoes" && <AbaNotificacoes />}
      {aba === "config" && <AbaConfig />}
    </Layout>
  );
}

// ---------------- AGENDA (estilo Trello por dia) ----------------
function AbaAgenda() {
  const [colunas, setColunas] = useState(null);

  async function carregar() {
    const { data } = await api.get("/profissional/agenda");
    setColunas(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function mudarStatus(id, status) {
    await api.put(`/profissional/agenda/${id}/status`, { status });
    carregar();
  }

  if (!colunas) return <p>Carregando agenda...</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Sua semana</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {DIAS.map(([chave, label]) => (
          <div key={chave} className="card !p-3 min-h-[200px]">
            <h3 className="font-semibold text-renascer mb-3 text-sm">{label}</h3>
            <div className="space-y-2">
              {colunas[chave]?.length === 0 && <p className="text-xs text-renascer-ink/40">Sem sessões</p>}
              {colunas[chave]?.map((ag) => (
                <div key={ag.id} className="border border-renascer/10 rounded-lg p-2 bg-renascer-light/40">
                  <p className="text-sm font-medium">{ag.horaInicio} · {ag.cliente.user.nome}</p>
                  <span className={`badge mt-1 ${STATUS_COR[ag.status]}`}>{ag.status}</span>
                  {ag.status !== "REALIZADO" && ag.status !== "CANCELADO" && (
                    <>
                      <Link
                        href={`/profissional/videochamada/${ag.id}`}
                        className="block text-xs text-renascer underline mt-2"
                      >
                        🎥 Entrar na videochamada
                      </Link>
                      <div className="flex gap-1 mt-1">
                        <button className="text-xs text-emerald-700 underline" onClick={() => mudarStatus(ag.id, "REALIZADO")}>
                          Realizada
                        </button>
                        <button className="text-xs text-red-600 underline" onClick={() => mudarStatus(ag.id, "CANCELADO")}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- CLIENTES (lista + chat + relatórios) ----------------
function AbaClientes() {
  const [clientes, setClientes] = useState([]);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    api.get("/profissional/clientes").then((r) => setClientes(r.data));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card md:col-span-1">
        <h2 className="font-semibold mb-3">Meus clientes</h2>
        <div className="space-y-2">
          {clientes.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelecionado(c)}
              className={`w-full text-left px-3 py-2 rounded-lg border ${
                selecionado?.id === c.id ? "border-renascer bg-renascer-light" : "border-renascer/10"
              }`}
            >
              <p className="font-medium">{c.user.nome}</p>
              <p className="text-xs text-renascer-ink/50">
                {c.pacotes[0] ? `${c.pacotes[0].sessoesUsadas}/${c.pacotes[0].totalSessoes} sessões` : "sem pacote ativo"}
              </p>
            </button>
          ))}
          {clientes.length === 0 && <p className="text-sm text-renascer-ink/50">Nenhum cliente ainda.</p>}
        </div>
      </div>
      <div className="md:col-span-2">
        {selecionado ? <DetalheCliente cliente={selecionado} /> : <p className="text-renascer-ink/50">Selecione um cliente.</p>}
      </div>
    </div>
  );
}

function DetalheCliente({ cliente }) {
  const [sub, setSub] = useState("chat");
  return (
    <div className="card">
      <h2 className="font-semibold text-lg">{cliente.user.nome}</h2>
      <div className="flex gap-2 my-3 flex-wrap">
        {[
          ["chat", "Chat / recados"],
          ["relatorios", "Relatórios"],
          ["pacote", "Pacote / pagamento"],
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
      {sub === "relatorios" && <RelatoriosCliente clienteId={cliente.id} />}
      {sub === "pacote" && <NovoPacoteCliente clienteId={cliente.id} />}
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
      setMsg(`Pacote registrado! ${data.totalSessoes} sessão(ões) de ${data.duracao === "MIN30" ? "30min" : "50min"} liberadas.`);
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

  async function carregar() {
    const { data } = await api.get(`/profissional/clientes/${clienteId}/mensagens`);
    setMensagens(data);
  }
  useEffect(() => {
    carregar();
  }, [clienteId]);

  async function enviar() {
    if (!texto.trim()) return;
    if (tipo === "recado_diario") {
      await api.post(`/profissional/clientes/${clienteId}/recado`, { texto });
    } else {
      await api.post(`/profissional/clientes/${clienteId}/mensagens`, { texto, tipo });
    }
    setTexto("");
    carregar();
  }

  return (
    <div>
      <div className="h-56 overflow-y-auto border border-renascer/10 rounded-lg p-3 space-y-2 mb-3 bg-renascer-light/30">
        {mensagens.map((m) => (
          <div key={m.id} className={`text-sm ${m.autor === "PROFISSIONAL" ? "text-right" : ""}`}>
            <span className="inline-block bg-white px-3 py-1.5 rounded-lg border border-renascer/10">{m.texto}</span>
          </div>
        ))}
        {mensagens.length === 0 && <p className="text-xs text-renascer-ink/40">Sem mensagens ainda.</p>}
      </div>
      <div className="flex gap-2">
        <select className="input !w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="mensagem">Mensagem</option>
          <option value="recado_diario">Recado do dia (imprevisto / o que vai trabalhar)</option>
        </select>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva..." />
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
  const [valorCalc, setValorCalc] = useState("");
  const [repasse, setRepasse] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [valorManual, setValorManual] = useState("");
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);

  async function carregar() {
    const { data } = await api.get("/profissional/financeiro/resumo");
    setResumo(data);
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Faturado no mês</p>
          <p className="text-2xl font-bold text-renascer">R$ {resumo?.totalRecebido?.toFixed(2) ?? "0,00"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Seu repasse</p>
          <p className="text-2xl font-bold text-emerald-600">R$ {resumo?.totalProfissional?.toFixed(2) ?? "0,00"}</p>
        </div>
        <div className="card">
          <p className="text-sm text-renascer-ink/60">Repasse Renascer</p>
          <p className="text-2xl font-bold text-renascer-ink/70">R$ {resumo?.totalRenascer?.toFixed(2) ?? "0,00"}</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Calculadora rápida de repasse</h3>
        <div className="flex gap-2">
          <input className="input" placeholder="Valor total recebido (ex: 170)" value={valorCalc} onChange={(e) => setValorCalc(e.target.value)} />
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
        <h3 className="font-semibold mb-3">Anexar comprovante de pagamento</h3>
        <p className="text-xs text-renascer-ink/50 mb-3">
          A IA tenta reconhecer o valor e o tipo de transação automaticamente. Se não conseguir, você confirma o valor manualmente.
        </p>
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
            Registrado: R$ {resultado.transacao.valorTotal} (seu repasse R$ {resultado.transacao.valorProfissional})
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
            </tr>
          </thead>
          <tbody>
            {resumo?.transacoes?.map((t) => (
              <tr key={t.id} className="border-t border-renascer/10">
                <td className="py-1">{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                <td>{t.cliente?.user?.nome || "-"}</td>
                <td>{t.tipo}</td>
                <td>R$ {t.valorTotal.toFixed(2)}</td>
                <td>R$ {t.valorProfissional.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {resumo?.transacoes?.length === 0 && <p className="text-sm text-renascer-ink/50 mt-2">Nenhuma transação neste mês.</p>}
      </div>
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
    setDisponibilidades(r.data.disponibilidades.map((d) => ({ diaSemana: d.diaSemana, horaInicio: d.horaInicio, horaFim: d.horaFim })));
  }
  useEffect(() => {
    carregarPerfil();
  }, []);

  function addLinha() {
    setDisponibilidades([...disponibilidades, { diaSemana: "SEGUNDA", horaInicio: "08:00", horaFim: "12:00" }]);
  }
  function atualizar(i, campo, valor) {
    const copia = [...disponibilidades];
    copia[i][campo] = valor;
    setDisponibilidades(copia);
  }
  function remover(i) {
    setDisponibilidades(disponibilidades.filter((_, idx) => idx !== i));
  }
  async function salvar() {
    await api.put("/profissional/disponibilidades", { disponibilidades });
    alert("Disponibilidade atualizada!");
  }

  if (!perfil) return <p>Carregando...</p>;

  return (
    <div className="space-y-4">
      <PerfilCompleto perfil={perfil} onAtualizado={carregarPerfil} />
      <DisponibilidadeSemanal disponibilidades={disponibilidades} setDisponibilidades={setDisponibilidades} />
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

      <button className="btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar perfil"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}

function DisponibilidadeSemanal({ disponibilidades, setDisponibilidades }) {
  function addLinha() {
    setDisponibilidades([...disponibilidades, { diaSemana: "SEGUNDA", horaInicio: "08:00", horaFim: "12:00" }]);
  }
  function atualizar(i, campo, valor) {
    const copia = [...disponibilidades];
    copia[i][campo] = valor;
    setDisponibilidades(copia);
  }
  function remover(i) {
    setDisponibilidades(disponibilidades.filter((_, idx) => idx !== i));
  }
  async function salvar() {
    await api.put("/profissional/disponibilidades", { disponibilidades });
    alert("Disponibilidade atualizada!");
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Sua disponibilidade semanal (libere seus horários)</h2>
      <p className="text-xs text-renascer-ink/50">
        É com base nesses horários que a atendente (e, no futuro, você mesma) vai enxergar exatamente quando você está livre pra marcar sessões.
      </p>
      {disponibilidades.map((d, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select className="input !w-40" value={d.diaSemana} onChange={(e) => atualizar(i, "diaSemana", e.target.value)}>
            {DIAS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input className="input !w-28" value={d.horaInicio} onChange={(e) => atualizar(i, "horaInicio", e.target.value)} placeholder="08:00" />
          <span>até</span>
          <input className="input !w-28" value={d.horaFim} onChange={(e) => atualizar(i, "horaFim", e.target.value)} placeholder="12:00" />
          <button className="text-red-600 text-sm" onClick={() => remover(i)}>
            remover
          </button>
        </div>
      ))}
      <button className="btn-secondary" onClick={addLinha}>
        + adicionar horário
      </button>
      <button className="btn-primary block" onClick={salvar}>
        Salvar disponibilidade
      </button>
    </div>
  );
}
