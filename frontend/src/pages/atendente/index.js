import { useEffect, useState } from "react";
import LayoutNovo from "../../components/LayoutNovo";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { verComprovante, lerArquivoBase64 } from "../../lib/comprovante";
import DisponibilidadeSemanal from "../../components/DisponibilidadeSemanal";
import SituacaoCliente from "../../components/SituacaoCliente";
import TrocarProfissionalCliente from "../../components/TrocarProfissionalCliente";
import IndicadorPresenca from "../../components/IndicadorPresenca";
import { statusSessao, CORES_STATUS_SESSAO } from "../../lib/presenca";

const TIPO_LABEL = {
  PACOTE_NOVO: "Contratação nova",
  RENOVACAO: "Renovação",
  SESSAO_EXTRA: "Sessão extra",
  OUTRO: "Outro",
};

export default function AreaAtendente() {
  const { user, carregando } = useAuth("ATENDENTE");
  const [aba, setAba] = useState("clientes");
  if (carregando) return null;

  const ABAS = [
    { id: "clientes", label: "Clientes" },
    { id: "profissionais", label: "Profissionais e agendar" },
    { id: "reativar", label: "Reativar clientes" },
    { id: "agenda", label: "Agenda geral" },
    { id: "suporte", label: "Suporte escalado" },
  ];

  return (
    <LayoutNovo user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "clientes" && <Clientes />}
      {aba === "profissionais" && <ProfissionaisEAgendar />}
      {aba === "reativar" && <ClientesParaReativar rotaBase="/atendente" />}
      {aba === "agenda" && <AgendaGeral />}
      {aba === "suporte" && <SuporteEscalado />}
    </LayoutNovo>
  );
}

// Fila de clientes marcados como "não renovou" por alguma profissional (ou pela própria
// recepção) — dá pra chamar no WhatsApp com o número que ele informou no cadastro e, se ele
// voltar, vincular de novo com uma profissional direto por aqui.
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
        <p className="nv-eyebrow mb-1">Painel da Atendente</p>
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

const DIAS_LABEL = {
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

const NV_CORES_AVATAR_ATENDENTE = ["#0B5FA8", "#1C7C54", "#8A4FA3", "#B4622E"];

// ---------------- PROFISSIONAIS: perfil completo + agendar exatamente o que o cliente quer ----------------
function ProfissionaisEAgendar() {
  const [profissionais, setProfissionais] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selecionada, setSelecionada] = useState(null);
  const [editando, setEditando] = useState(null);

  async function carregar() {
    const [p, c] = await Promise.all([api.get("/atendente/profissionais"), api.get("/atendente/clientes")]);
    setProfissionais(p.data);
    setClientes(c.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel da Atendente</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Profissionais e agendar</h1>
        <p className="text-nv-muted text-sm mt-0.5">Veja os horários de cada profissional, agende uma sessão ou ajuste a disponibilidade dela</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {profissionais.map((p, i) => {
          const cor = NV_CORES_AVATAR_ATENDENTE[i % NV_CORES_AVATAR_ATENDENTE.length];
          const iniciais = p.user.nome
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase();
          return (
            <div key={p.id} className="nv-card">
              <div className="flex gap-3">
                {p.user.fotoUrl ? (
                  <img src={p.user.fotoUrl} alt={p.user.nome} className="w-14 h-14 rounded-full object-cover border border-nv-border shrink-0" />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center font-sora font-bold text-base text-white shrink-0"
                    style={{ background: cor }}
                  >
                    {iniciais}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-sora font-semibold text-nv-ink flex items-center gap-1.5 flex-wrap">
                    {p.user.nome} {p.idade ? <span className="font-publicSans font-normal text-nv-muted3">· {p.idade} anos</span> : ""}
                    {p.user.role === "DONO" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-nv-gold/15 text-nv-gold">Dono</span>
                    )}
                  </p>
                  <p className="text-sm text-nv-muted2">
                    {p.titulo}
                    {p.registro ? ` · ${p.registro}` : ""}
                  </p>
                  {p.abordagens && <p className="text-xs text-nv-muted3">Abordagem: {p.abordagens}</p>}
                  <IndicadorPresenca ultimoAcessoEm={p.user.ultimoAcessoEm} className="mt-0.5" />
                </div>
              </div>

              {p.especialidades?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {p.especialidades.map((e) => (
                    <span key={e} className="text-[11px] font-semibold text-[#3E6FA3] bg-[#EAF1FA] rounded-full px-2.5 py-1">
                      {e}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2.5 border-t border-nv-borderLight pt-2.5">
                {p.disponibilidades.length === 0 && <span className="text-xs text-nv-muted3">Nenhum horário liberado ainda.</span>}
                {p.disponibilidades.map((d) => (
                  <span
                    key={d.id}
                    className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${
                      d.ocupadoPorCliente ? "bg-amber-50 text-amber-700" : "bg-nv-bg text-nv-muted2 border border-nv-borderLight"
                    }`}
                  >
                    {DIAS_LABEL[d.diaSemana]} {d.horaInicio}
                    {d.ocupadoPorCliente ? ` · fixo: ${d.ocupadoPorCliente.user.nome}` : ""}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                <button className="btn-secondary text-sm" onClick={() => setSelecionada(selecionada?.id === p.id ? null : p)}>
                  {selecionada?.id === p.id ? "Fechar" : "Ver horários e agendar"}
                </button>
                <button className="btn-secondary text-sm" onClick={() => setEditando(editando === p.id ? null : p.id)}>
                  {editando === p.id ? "Fechar edição de horários" : "Editar horários dela"}
                </button>
              </div>

              {selecionada?.id === p.id && <AgendarComProfissional profissional={p} clientes={clientes} onAgendado={carregar} />}
              {editando === p.id && <EditarDisponibilidadeProfissional profissional={p} onSalvo={carregar} />}
            </div>
          );
        })}
        {profissionais.length === 0 && <p className="text-sm text-nv-muted">Nenhuma profissional cadastrada ainda.</p>}
      </div>
    </div>
  );
}

// A atendente também pode ajustar os horários exatos que uma profissional atende (a pedido
// dela) — mesmo componente e mesma regra da tela da própria profissional, pra recepção,
// profissional e cliente sempre enxergarem exatamente os mesmos horários (sem faixa "8h às
// 18h" que deixaria parecer livre um horário que ela na verdade não atende).
function EditarDisponibilidadeProfissional({ profissional, onSalvo }) {
  const [disponibilidades, setDisponibilidades] = useState(
    (profissional.disponibilidades || []).map((d) => ({ diaSemana: d.diaSemana, horaInicio: d.horaInicio }))
  );
  const ocupados = (profissional.disponibilidades || [])
    .filter((d) => d.ocupadoPorCliente)
    .map((d) => ({ diaSemana: d.diaSemana, horaInicio: d.horaInicio, nome: d.ocupadoPorCliente.user.nome }));

  return (
    <div className="mt-3 border-t border-nv-borderLight pt-3">
      <DisponibilidadeSemanal
        disponibilidades={disponibilidades}
        setDisponibilidades={setDisponibilidades}
        ocupados={ocupados}
        aviso={`Horários que ${profissional.user.nome} atende — o que você salvar aqui aparece igual pra ela e pro cliente.`}
        salvar={async (disp) => {
          await api.put(`/atendente/profissionais/${profissional.id}/disponibilidades`, { disponibilidades: disp });
          onSalvo?.();
        }}
      />
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
    const { data: resp } = await api.get(`/atendente/profissionais/${profissional.id}/horarios`, {
      params: { data, duracao, clienteId: clienteId || undefined },
    });
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
    <div className="mt-3 border-t border-nv-borderLight pt-3 space-y-2">
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
          {horarios.livres.length === 0 && (
            <p className="text-sm text-[#B0580F]">Nenhum horário livre nesse dia ({horarios.diaSemana}).</p>
          )}
          {horarios.livres.map((h) => (
            <button
              key={h}
              onClick={() => setHoraEscolhida(h)}
              className={`text-sm px-3 py-1.5 rounded-full border ${
                horaEscolhida === h ? "bg-nv-blue text-white border-nv-blue" : "border-nv-border text-nv-ink2"
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
      {msg && <p className="text-sm text-nv-ink">{msg}</p>}

      <details className="text-sm mt-2">
        <summary className="cursor-pointer text-nv-blue font-semibold">Registrar contratação, pagamento ou renovação</summary>
        <RegistrarPacote clienteId={clienteId} onRegistrado={() => setMsg("Pagamento registrado! Agora já pode escolher o horário.")} />
      </details>
    </div>
  );
}

// Registro de contratação/pagamento/renovação — aqui a atendente anexa o comprovante,
// que fica guardado no cadastro do cliente pra poder ser visto depois. O sistema já
// calcula e contabiliza automaticamente quanto vai pra profissional e quanto fica pra
// Renascer (aparece na hora no painel "a receber hoje" do Dono).
function RegistrarPacote({ clienteId, onRegistrado }) {
  const [tipo, setTipo] = useState("PACOTE_NOVO");
  const [duracao, setDuracao] = useState("MIN50");
  const [totalSessoes, setTotalSessoes] = useState(4);
  const [valorTotal, setValorTotal] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  async function registrar() {
    if (!clienteId) {
      setMsg("Escolha o cliente acima primeiro.");
      return;
    }
    setEnviando(true);
    setMsg("");
    try {
      const imagemBase64 = arquivo ? await lerArquivoBase64(arquivo) : null;
      const { data } = await api.post(`/atendente/clientes/${clienteId}/pacotes`, {
        duracao,
        totalSessoes: Number(totalSessoes),
        valorTotal: valorTotal ? Number(valorTotal) : undefined,
        tipo,
        imagemBase64,
        mimeType: arquivo?.type,
      });
      setMsg(
        `Registrado! A profissional recebe direto e deve repassar R$ ${data.transacao.valorRenascer.toFixed(2)} pra Renascer (vai aparecer em Repasses assim que ela mandar o comprovante).` +
          (arquivo ? " Comprovante anexado e guardado." : "")
      );
      setArquivo(null);
      setValorTotal("");
      onRegistrado?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao registrar pagamento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2 mt-2">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input !w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="PACOTE_NOVO">Contratação nova</option>
          <option value="RENOVACAO">Renovação</option>
          <option value="SESSAO_EXTRA">Sessão extra</option>
          <option value="OUTRO">Outro</option>
        </select>
        <select className="input !w-auto" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
          <option value="MIN30">30 minutos</option>
          <option value="MIN50">50 minutos</option>
        </select>
        <input
          type="number"
          min="1"
          className="input !w-32"
          placeholder="Nº de sessões"
          value={totalSessoes}
          onChange={(e) => setTotalSessoes(e.target.value)}
        />
        <input className="input !w-32" placeholder="Valor (opcional)" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-nv-muted block mb-1">
          Anexar comprovante do pagamento (fica guardado no cadastro do cliente pra poder ver depois)
        </label>
        <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files[0])} />
      </div>
      <button className="btn-secondary" onClick={registrar} disabled={enviando}>
        {enviando ? "Registrando..." : "Registrar pagamento"}
      </button>
      {msg && <p className="text-sm w-full text-nv-ink">{msg}</p>}
    </div>
  );
}

const FORM_CLIENTE_VAZIO = {
  nome: "",
  email: "",
  telefone: "",
  senhaProvisoria: "",
  profissionalAtualId: "",
  tipo: "PACOTE_NOVO",
  duracao: "MIN50",
  totalSessoes: 4,
  valorTotal: "",
  canalOrigem: "",
};

// De onde o cliente veio (Fase 30) — opcional, só pra alimentar os indicadores reais de
// marketing (leads/novos clientes por canal, CAC) no Meu dia do Dono.
const CANAL_ORIGEM_OPCOES = [
  { valor: "", label: "De onde veio? (opcional)" },
  { valor: "INSTAGRAM", label: "Instagram" },
  { valor: "FACEBOOK", label: "Facebook" },
  { valor: "GOOGLE", label: "Google" },
  { valor: "INDICACAO", label: "Indicação" },
  { valor: "OUTRO", label: "Outro" },
];

function PontoStatus({ status }) {
  const classe = status === "VERMELHO" ? "nv-dot-urgente" : status === "AMARELO" ? "nv-dot-atencao" : "nv-dot-ok";
  return <span className={`nv-dot ${classe}`} />;
}

function Clientes() {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [form, setForm] = useState(FORM_CLIENTE_VAZIO);
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [msg, setMsg] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

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
      const imagemBase64 = arquivo ? await lerArquivoBase64(arquivo) : null;
      const { data } = await api.post("/atendente/clientes", {
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        senhaProvisoria: form.senhaProvisoria || undefined,
        profissionalAtualId: form.profissionalAtualId || undefined,
        tipo: form.tipo,
        duracao: form.duracao,
        totalSessoes: Number(form.totalSessoes),
        valorTotal: form.valorTotal ? Number(form.valorTotal) : undefined,
        imagemBase64,
        mimeType: arquivo?.type,
        canalOrigem: form.canalOrigem || undefined,
      });
      setResultado(data);
      setForm(FORM_CLIENTE_VAZIO);
      setArquivo(null);
      carregar();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao cadastrar cliente.");
    }
  }

  const ordenados = [...lista].sort((a, b) => a.user.nome.localeCompare(b.user.nome));

  return (
    <div className="font-publicSans">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="nv-eyebrow mb-1">Painel da Atendente</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Clientes</h1>
          <p className="text-nv-muted text-sm mt-0.5">{lista.length} clientes cadastrados, em ordem alfabética</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? "Fechar" : "+ Novo cliente"}
        </button>
      </div>

      {mostrarForm && (
        <div className="nv-card mb-4">
          <h2 className="font-sora font-semibold text-nv-ink mb-3">Cadastrar novo cliente</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="input" placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input className="input" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="input" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            <input
              className="input"
              placeholder="Senha do login (opcional, senão é gerada uma)"
              value={form.senhaProvisoria}
              onChange={(e) => setForm({ ...form, senhaProvisoria: e.target.value })}
            />
            <select className="input" value={form.profissionalAtualId} onChange={(e) => setForm({ ...form, profissionalAtualId: e.target.value })}>
              <option value="">Vincular profissional (opcional)</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.nome}
                  {p.user.role === "DONO" ? " (Dono)" : ""}
                </option>
              ))}
            </select>
            <select className="input" value={form.canalOrigem} onChange={(e) => setForm({ ...form, canalOrigem: e.target.value })}>
              {CANAL_ORIGEM_OPCOES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-nv-borderLight mt-4 pt-4">
            <p className="text-sm font-semibold text-nv-ink mb-1">Já lançar pagamento agora (opcional)</p>
            <p className="text-xs text-nv-muted mb-2">
              Se o cliente já pagou, preencha o valor aqui — escolha a profissional acima antes: isso já cria o pacote e
              conta na hora no financeiro (aparece no "A receber hoje" do Dono).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="PACOTE_NOVO">Contratação nova</option>
                <option value="RENOVACAO">Renovação</option>
                <option value="SESSAO_EXTRA">Sessão extra</option>
                <option value="OUTRO">Outro</option>
              </select>
              <select className="input" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })}>
                <option value="MIN30">30 minutos</option>
                <option value="MIN50">50 minutos</option>
              </select>
              <input
                type="number"
                min="1"
                className="input"
                placeholder="Nº de sessões"
                value={form.totalSessoes}
                onChange={(e) => setForm({ ...form, totalSessoes: e.target.value })}
              />
              <input
                className="input"
                placeholder="Valor (opcional)"
                value={form.valorTotal}
                onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
              />
            </div>
            <div className="mt-2">
              <label className="text-xs text-nv-muted block mb-1">Anexar comprovante (opcional)</label>
              <input type="file" accept="image/*" onChange={(e) => setArquivo(e.target.files[0])} />
            </div>
          </div>

          <button className="btn-primary mt-4" onClick={cadastrar}>
            Cadastrar
          </button>
          {msg && <p className="text-red-600 text-sm mt-2">{msg}</p>}
          {resultado && (
            <div className="text-sm mt-2 space-y-1">
              <p className="text-nv-green">
                Cliente criado! Senha provisória: <strong>{resultado.senhaProvisoria}</strong> (repasse isso pro cliente por um
                canal seguro)
              </p>
              {resultado.transacao && (
                <p className="text-nv-green">
                  Pagamento contabilizado! A profissional recebe direto e deve repassar R${" "}
                  {resultado.transacao.valorRenascer.toFixed(2)} pra Renascer (vai aparecer em Repasses assim que ela mandar o
                  comprovante).
                </p>
              )}
              {resultado.avisoFinanceiro && <p className="text-amber-700">{resultado.avisoFinanceiro}</p>}
            </div>
          )}
        </div>
      )}

      <div className="nv-card !p-0 px-5">
        {ordenados.map((c) => (
          <div key={c.id}>
            <div
              className="flex items-center justify-between gap-3 py-3 border-t border-nv-borderLight first:border-t-0 cursor-pointer"
              onClick={() => setExpandido(expandido === c.id ? null : c.id)}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <PontoStatus status={c.statusCliente} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-nv-ink2 truncate">{c.user.nome}</span>
                  <span className="block text-xs text-nv-muted3 truncate">
                    {c.user.email} · com {c.profissionalAtual?.user?.nome || "sem profissional"}
                    {c.profissionalAtual?.user?.role === "DONO" ? " (Dono)" : ""}
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold text-nv-blue shrink-0 whitespace-nowrap">
                {expandido === c.id ? "Fechar ficha" : "Ver ficha"}
              </span>
            </div>
            {expandido === c.id && (
              <div className="pb-4 space-y-3 bg-nv-bg -mx-5 px-5 pt-3">
                <MetricasCliente clienteId={c.id} rotaBase="/atendente" />
                <NotificacaoECliente cliente={c} rotaBase="/atendente" onExcluido={carregar} podeExcluir />
                <HistoricoPagamentos clienteId={c.id} rotaBase="/atendente" />
                <SituacaoCliente clienteId={c.id} rotaBase="/atendente" onMudou={carregar} />
                <TrocarProfissionalCliente
                  clienteId={c.id}
                  profissionalAtualNome={
                    c.profissionalAtual?.user?.nome &&
                    c.profissionalAtual.user.nome + (c.profissionalAtual.user.role === "DONO" ? " (Dono)" : "")
                  }
                  profissionais={profissionais}
                  rotaBase="/atendente"
                  onTrocou={carregar}
                />
              </div>
            )}
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-nv-muted py-4">Nenhum cliente cadastrado ainda.</p>}
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
            {new Date(t.data).toLocaleDateString("pt-BR")} · {TIPO_LABEL[t.tipo] || t.tipo} · R$ {t.valorTotal.toFixed(2)}
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

// Cor estável por profissional (mesma lógica da Fase 38 no painel do Dono) — a mesma profissional
// sempre com a mesma cor, mesmo a lista mudando de ordem.
function corPorNomeAtendente(nome) {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i);
  return NV_CORES_AVATAR_ATENDENTE[soma % NV_CORES_AVATAR_ATENDENTE.length];
}

function AgendaGeral() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/atendente/agenda-geral").then((r) => setLista(r.data));
  }, []);

  const porDia = {};
  for (const a of lista) {
    const chave = new Date(a.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    (porDia[chave] = porDia[chave] || []).push(a);
  }

  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel da Atendente</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Agenda geral</h1>
        <p className="text-nv-muted text-sm mt-0.5">Próximos agendamentos de todas as profissionais, em ordem cronológica</p>
      </div>
      <div className="nv-card !p-0 px-5">
        {Object.entries(porDia).map(([dia, agendamentos]) => (
          <div key={dia}>
            <p className="text-[11.5px] font-bold text-nv-muted2 uppercase tracking-wide pt-4 pb-1.5 capitalize">{dia}</p>
            {agendamentos.map((a) => {
              const sessao = statusSessao(a);
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-nv-borderLight">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: corPorNomeAtendente(a.profissional.user.nome) }} />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-nv-ink2">
                        {new Date(a.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {a.cliente.user.nome}
                      </p>
                      <p className="text-xs text-nv-muted3">com {a.profissional.user.nome}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${CORES_STATUS_SESSAO[sessao.cor]}`}>
                    {sessao.texto}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        {lista.length === 0 && <p className="text-sm text-nv-muted py-4">Nenhum agendamento futuro.</p>}
      </div>
    </div>
  );
}

function SuporteEscalado() {
  const [tickets, setTickets] = useState([]);
  useEffect(() => {
    api.get("/atendente/suporte-gerencia").then((r) => setTickets(r.data));
  }, []);
  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel da Atendente</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Suporte escalado</h1>
        <p className="text-nv-muted text-sm mt-0.5">Você pode visualizar os chamados escalados; a resposta cabe à gerência (donos)</p>
      </div>
      <div className="flex flex-col gap-3">
        {tickets.map((t) => (
          <div key={t.id} className="nv-card">
            <p className="text-[13.5px] font-semibold text-nv-ink">{t.assunto}</p>
            <p className="text-xs text-nv-muted2 mt-0.5 mb-2">Cliente: {t.cliente.user.nome}</p>
            <div className="space-y-1.5">
              {t.mensagens.map((m) => (
                <p key={m.id} className="text-[13.5px] text-nv-ink bg-nv-bg rounded-[10px] px-3 py-2.5">
                  {m.texto}
                </p>
              ))}
            </div>
          </div>
        ))}
        {tickets.length === 0 && <p className="text-sm text-nv-muted">Nenhum chamado escalado.</p>}
      </div>
    </div>
  );
}
