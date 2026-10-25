import { useEffect, useState } from "react";
import LayoutNovo from "../../components/LayoutNovo";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { verComprovante, lerArquivoBase64 } from "../../lib/comprovante";
import DisponibilidadeSemanal from "../../components/DisponibilidadeSemanal";
import SituacaoCliente from "../../components/SituacaoCliente";
import TrocarProfissionalCliente from "../../components/TrocarProfissionalCliente";
import { statusSessao, CORES_STATUS_SESSAO, formatarPresenca } from "../../lib/presenca";

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
      <div className="nv-card-flat px-5">
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
// Fase 51 — mesmo padrão visual da tela "Profissionais" do Dono (grade de cartões compactos à
// esquerda, clica numa profissional e abre o painel de detalhe à direita), só que aqui o painel
// de detalhe mostra os horários dela (agrupados por dia, não mais uma parede de pílulas) e os
// botões de agendar/editar disponibilidade, que são a razão da atendente estar nessa tela.
function ProfissionaisEAgendar() {
  const [profissionais, setProfissionais] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState("");
  const [selecionadaId, setSelecionadaId] = useState(null);
  const [verHorarios, setVerHorarios] = useState(false);
  const [editando, setEditando] = useState(false);

  async function carregar() {
    const [p, c] = await Promise.all([api.get("/atendente/profissionais"), api.get("/atendente/clientes")]);
    setProfissionais(p.data);
    setClientes(c.data);
    if (p.data.length > 0) setSelecionadaId((atual) => atual || p.data[0].id);
  }
  useEffect(() => {
    carregar();
  }, []);

  const buscaLower = busca.trim().toLowerCase();
  const filtrada = profissionais.filter((p) => {
    if (!buscaLower) return true;
    const alvo = (p.user.nome + " " + (p.especialidades || []).join(" ")).toLowerCase();
    return alvo.includes(buscaLower);
  });
  const selecionada = filtrada.find((p) => p.id === selecionadaId) || filtrada[0];
  const presencaSel = selecionada ? formatarPresenca(selecionada.user.ultimoAcessoEm) : null;

  const porDiaSel = {};
  (selecionada?.disponibilidades || []).forEach((d) => {
    (porDiaSel[d.diaSemana] = porDiaSel[d.diaSemana] || []).push(d);
  });

  function selecionar(id) {
    setSelecionadaId(id);
    setVerHorarios(false);
    setEditando(false);
  }

  return (
    <div className="font-publicSans">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <p className="nv-eyebrow mb-1">Painel da Atendente</p>
          <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Profissionais e agendar</h1>
          <p className="text-nv-muted text-sm mt-0.5">Clique numa profissional pra ver os horários dela, agendar ou editar a disponibilidade</p>
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
            const cor = NV_CORES_AVATAR_ATENDENTE[i % NV_CORES_AVATAR_ATENDENTE.length];
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
                onClick={() => selecionar(p.id)}
                className={`nv-card text-left flex flex-col gap-3 ${selecionada?.id === p.id ? "!border-nv-blue" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative w-11 h-11 shrink-0">
                    {p.user.fotoUrl ? (
                      <img src={p.user.fotoUrl} alt={p.user.nome} className="w-11 h-11 rounded-full object-cover border border-nv-border" />
                    ) : (
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center font-sora font-bold text-sm text-white"
                        style={{ background: cor }}
                      >
                        {iniciais}
                      </div>
                    )}
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
                  <span>{p.disponibilidades.length} horários liberados</span>
                  <span>{presenca.online ? "visto agora" : presenca.texto.replace("Visto ", "")}</span>
                </div>
              </button>
            );
          })}
          {filtrada.length === 0 && <p className="text-sm text-nv-muted">Nenhuma profissional encontrada.</p>}
        </div>

        {selecionada && (
          <div className="flex-[1_1_340px] nv-card flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {selecionada.user.fotoUrl ? (
                <img src={selecionada.user.fotoUrl} alt={selecionada.user.nome} className="w-14 h-14 rounded-full object-cover border border-nv-border shrink-0" />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-sora font-bold text-lg text-white shrink-0"
                  style={{ background: NV_CORES_AVATAR_ATENDENTE[filtrada.indexOf(selecionada) % NV_CORES_AVATAR_ATENDENTE.length] }}
                >
                  {selecionada.user.nome
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-sora font-bold text-base text-nv-ink flex items-center gap-1.5">
                  {selecionada.user.nome}
                  {selecionada.user.role === "DONO" && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-nv-gold/15 text-nv-gold">Dono</span>
                  )}
                </p>
                <p className="text-xs text-nv-muted3 mt-0.5">
                  {selecionada.titulo}
                  {selecionada.registro ? ` · ${selecionada.registro}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-nv-green/10 rounded-lg px-3 py-2.5">
              <span className={`nv-dot ${presencaSel.online ? "nv-dot-ok" : ""}`} style={!presencaSel.online ? { background: "#B7C1D1" } : undefined} />
              <span className="text-xs font-semibold text-[#22543D]">
                {presencaSel.online ? "Ativa agora" : `Offline · ${presencaSel.texto}`}
              </span>
            </div>

            {selecionada.abordagens && <p className="text-xs text-nv-muted3">Abordagem: {selecionada.abordagens}</p>}

            {selecionada.especialidades?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-nv-muted3 uppercase tracking-[0.04em] mb-1.5">Especialidades</p>
                <div className="flex flex-wrap gap-1.5">
                  {selecionada.especialidades.map((e) => (
                    <span key={e} className="text-[11px] font-semibold text-[#3E6FA3] bg-[#EAF1FA] rounded-full px-2.5 py-1">
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-bold text-nv-muted3 uppercase tracking-[0.04em] mb-1.5">Horários liberados</p>
              {selecionada.disponibilidades.length === 0 && <p className="text-xs text-nv-muted3">Nenhum horário liberado ainda.</p>}
              <div className="flex flex-col gap-2">
                {Object.entries(DIAS_LABEL)
                  .filter(([chave]) => porDiaSel[chave]?.length > 0)
                  .map(([chave, label]) => (
                    <div key={chave}>
                      <p className="text-[11px] font-semibold text-nv-muted2 mb-1">{label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {porDiaSel[chave].map((d) => (
                          <span
                            key={d.id}
                            className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${
                              d.ocupadoPorCliente ? "bg-amber-50 text-amber-700" : "bg-nv-bg text-nv-muted2 border border-nv-borderLight"
                            }`}
                          >
                            {d.horaInicio}
                            {d.ocupadoPorCliente ? ` · fixo: ${d.ocupadoPorCliente.user.nome}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-nv-borderLight pt-3.5">
              <button className="btn-secondary text-sm" onClick={() => setVerHorarios((v) => !v)}>
                {verHorarios ? "Fechar" : "Ver horários e agendar"}
              </button>
              <button className="btn-secondary text-sm" onClick={() => setEditando((v) => !v)}>
                {editando ? "Fechar edição de horários" : "Editar horários dela"}
              </button>
            </div>

            {verHorarios && <AgendarComProfissional profissional={selecionada} clientes={clientes} onAgendado={carregar} />}
            {editando && <EditarDisponibilidadeProfissional profissional={selecionada} onSalvo={carregar} />}
          </div>
        )}
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
  const [pagamentoParcial, setPagamentoParcial] = useState(false); // Fase 59 — pagamento parcial
  const [valorPacoteTotal, setValorPacoteTotal] = useState("");
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
        valorPacoteTotal: pagamentoParcial && valorPacoteTotal ? Number(valorPacoteTotal) : undefined,
        tipo,
        imagemBase64,
        mimeType: arquivo?.type,
      });
      setMsg(
        `Registrado! A profissional recebe direto e deve repassar R$ ${data.transacao.valorRenascer.toFixed(2)} pra Renascer (vai aparecer em Repasses assim que ela mandar o comprovante).` +
          (arquivo ? " Comprovante anexado e guardado." : "") +
          (pagamentoParcial && valorPacoteTotal ? " Pagamento marcado como parcial — o restante fica pendente até ser registrado." : "")
      );
      setArquivo(null);
      setValorTotal("");
      setPagamentoParcial(false);
      setValorPacoteTotal("");
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
        <input
          className="input !w-32"
          placeholder={pagamentoParcial ? "Valor pago agora" : "Valor (opcional)"}
          value={valorTotal}
          onChange={(e) => setValorTotal(e.target.value)}
        />
      </div>
      {/* Fase 59 — pagamento parcial: ela paga só parte do valor agora e completa depois. */}
      <label className="flex items-center gap-1.5 text-xs text-nv-muted">
        <input
          type="checkbox"
          checked={pagamentoParcial}
          onChange={(e) => {
            setPagamentoParcial(e.target.checked);
            if (!e.target.checked) setValorPacoteTotal("");
          }}
        />
        Pagamento parcial — vai completar o valor depois
      </label>
      {pagamentoParcial && (
        <div>
          <input
            className="input !w-44"
            placeholder="Valor total do pacote"
            value={valorPacoteTotal}
            onChange={(e) => setValorPacoteTotal(e.target.value)}
          />
          <p className="text-[11px] text-nv-muted3 mt-1">
            A diferença pro valor total do pacote fica pendente, visível na ficha do cliente e no Financeiro.
          </p>
        </div>
      )}
      <div>
        <label className="text-xs text-nv-muted block mb-1">
          Anexar comprovante do pagamento (fica guardado no cadastro do cliente pra poder ver depois)
        </label>
        <input type="file" accept="image/*" className="input-file" onChange={(e) => setArquivo(e.target.files[0])} />
      </div>
      <button className="btn-secondary" onClick={registrar} disabled={enviando}>
        {enviando ? "Registrando..." : "Registrar pagamento"}
      </button>
      {msg && <p className="text-sm w-full text-nv-ink">{msg}</p>}
    </div>
  );
}

// Fase 51 — cadastro simplificado (igual canvas): nome + WhatsApp + valor, com login gerado
// automaticamente (sem campo de e-mail/senha manual aqui).
const FORM_CLIENTE_VAZIO = {
  nome: "",
  telefone: "",
  profissionalAtualId: "",
  tipo: "PACOTE_NOVO",
  duracao: "MIN50",
  totalSessoes: 4,
  diaSemanaFixo: "",
  horaFixa: "",
  horarioPersonalizado: false,
  valorTotal: "",
  pagamentoParcial: false,
  valorPacoteTotal: "",
  canalOrigem: "",
};

// Fase 54 — mesmo formulário visual da Profissional (canvas), com a diferença de que aqui a
// profissional é escolhida (obrigatório), não fixa. "Dia e horário fixo" preenchidos já criam a
// primeira sessão direto na Agenda, igual o cadastro da Profissional.
const DIAS_FIXOS = [
  ["SEGUNDA", "Segunda"],
  ["TERCA", "Terça"],
  ["QUARTA", "Quarta"],
  ["QUINTA", "Quinta"],
  ["SEXTA", "Sexta"],
  ["SABADO", "Sábado"],
  ["DOMINGO", "Domingo"],
];

// Fase 55 — horários livres da profissional escolhida, agrupados por dia da semana (na ordem da
// semana), só os que ainda não estão ocupados por outro cliente — em vez de ela digitar um
// horário "no escuro", escolhe entre os que a profissional realmente tem disponível.
const ORDEM_DIAS_FIXOS = DIAS_FIXOS.map(([v]) => v);
function horariosLivresPorDia(profissionais, profissionalId) {
  const prof = profissionais.find((p) => p.id === profissionalId);
  if (!prof) return [];
  const livres = (prof.disponibilidades || []).filter((d) => d.ativo && !d.ocupadoPorClienteId);
  const porDia = {};
  for (const d of livres) {
    (porDia[d.diaSemana] = porDia[d.diaSemana] || []).push(d.horaInicio);
  }
  return ORDEM_DIAS_FIXOS.filter((dia) => porDia[dia]?.length).map((dia) => ({
    dia,
    label: DIAS_FIXOS.find(([v]) => v === dia)?.[1] || dia,
    horarios: porDia[dia].sort(),
  }));
}

// "há quanto tempo" compacto pro card de "Cadastrados recentemente".
function formatarHaQuantoAtendente(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return "agora há pouco";
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return diffD === 1 ? "ontem" : `há ${diffD} dias`;
}

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
  const [sessoesExtras, setSessoesExtras] = useState(0); // local-only, decorativo (igual o mock do canvas)
  const [pacotePersonalizado, setPacotePersonalizado] = useState(false); // Fase 56 — "Personalizado" no nº de sessões do pacote
  const [horarioPersonalizadoAberto, setHorarioPersonalizadoAberto] = useState(false); // Fase 59 — painel de "Horário personalizado"
  const [arquivo, setArquivo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [nomeCadastrado, setNomeCadastrado] = useState("");
  const [msg, setMsg] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [recentes, setRecentes] = useState([]);
  const [excluindoId, setExcluindoId] = useState(null);

  async function carregar() {
    const [c, p, r] = await Promise.all([
      api.get("/atendente/clientes"),
      api.get("/atendente/profissionais"),
      api.get("/atendente/clientes/recentes"),
    ]);
    setLista(c.data);
    setProfissionais(p.data);
    setRecentes(r.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function cadastrar() {
    setMsg("");
    setResultado(null);
    setCopiado(false);
    if (!form.profissionalAtualId) {
      setMsg("Escolha a profissional que vai atender esse cliente.");
      return;
    }
    try {
      const imagemBase64 = arquivo ? await lerArquivoBase64(arquivo) : null;
      const { data } = await api.post("/atendente/clientes", {
        nome: form.nome,
        telefone: form.telefone,
        profissionalAtualId: form.profissionalAtualId,
        tipo: form.tipo,
        duracao: form.duracao,
        totalSessoes: Number(form.totalSessoes),
        diaSemanaFixo: form.diaSemanaFixo || undefined,
        horaFixa: form.horaFixa || undefined,
        horarioPersonalizado: form.horarioPersonalizado || undefined,
        valorTotal: form.valorTotal ? Number(form.valorTotal) : undefined,
        valorPacoteTotal: form.pagamentoParcial && form.valorPacoteTotal ? Number(form.valorPacoteTotal) : undefined,
        imagemBase64,
        mimeType: arquivo?.type,
        canalOrigem: form.canalOrigem || undefined,
      });
      setResultado(data);
      setNomeCadastrado(form.nome);
      setForm(FORM_CLIENTE_VAZIO);
      setSessoesExtras(0);
      setHorarioPersonalizadoAberto(false);
      setArquivo(null);
      carregar();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao cadastrar cliente.");
    }
  }

  async function excluirRecente(c) {
    if (!window.confirm(`Excluir o cadastro de ${c.nome}? Isso desfaz o cadastro por completo (e avisa o Dono).`)) return;
    setExcluindoId(c.id);
    try {
      await api.delete(`/atendente/clientes/${c.id}/recente`);
      carregar();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Não foi possível excluir esse cadastro.");
    } finally {
      setExcluindoId(null);
    }
  }

  // Fase 51 — mensagem de acesso pronta pra colar no WhatsApp do cliente (igual canvas).
  const mensagemAcesso = resultado
    ? `Olá, ${nomeCadastrado}! Seu acesso ao app do Espaço do Renascer:\nE-mail: ${resultado.email}\nSenha: ${resultado.senhaProvisoria}\nAcesse: https://renascer-sistema.vercel.app\nLá você encontra suas atividades, pode acompanhar sua evolução e pedir um relatório pro seu profissional.`
    : "";

  async function copiarAcesso() {
    try {
      await navigator.clipboard.writeText(mensagemAcesso);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch (e) {
      // clipboard pode falhar em http/sem permissão — sem problema, a mensagem já está visível pra copiar manualmente
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
        <button
          className="btn-primary text-sm"
          onClick={() => {
            setMostrarForm((v) => !v);
            setResultado(null);
          }}
        >
          {mostrarForm ? "Fechar" : "+ Cadastrar cliente"}
        </button>
      </div>

      {mostrarForm && (
        <div className="nv-card mb-4">
          <h2 className="font-sora font-semibold text-nv-ink mb-1">Cadastrar cliente</h2>
          <p className="text-xs text-nv-muted mb-3">
            Nome, WhatsApp e a profissional já bastam — o login é gerado na hora. Pacote e dia/horário fixo ficam prontos pra
            entrar na agenda assim que a profissional aceitar em "Novos pacientes".
          </p>

          <div className="grid sm:grid-cols-2 gap-2">
            <input className="input" placeholder="Nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input className="input" placeholder="WhatsApp" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>

          <div className="mt-3">
            <p className="text-xs text-nv-muted mb-1.5">Profissional que vai atender *</p>
            <select
              className="input"
              value={form.profissionalAtualId}
              onChange={(e) => setForm({ ...form, profissionalAtualId: e.target.value })}
            >
              <option value="">Escolha a profissional</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.nome}
                  {p.user.role === "DONO" ? " (Dono)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-nv-borderLight mt-4 pt-4">
            <p className="text-sm font-semibold text-nv-ink mb-2">Pacote</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-nv-muted mb-1.5">Sessões no pacote</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 4, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`nv-seg ${!pacotePersonalizado && Number(form.totalSessoes) === n ? "nv-seg-ativo" : ""}`}
                      onClick={() => {
                        setPacotePersonalizado(false);
                        setForm({ ...form, totalSessoes: n });
                      }}
                    >
                      {n} {n === 1 ? "sessão" : "sessões"}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`nv-seg ${pacotePersonalizado ? "nv-seg-ativo" : ""}`}
                    onClick={() => setPacotePersonalizado(true)}
                  >
                    Personalizado
                  </button>
                </div>
                {pacotePersonalizado && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="number"
                      min="1"
                      className="input !w-24"
                      value={form.totalSessoes}
                      onChange={(e) => setForm({ ...form, totalSessoes: Math.max(1, Number(e.target.value) || 1) })}
                    />
                    <span className="text-xs text-nv-muted3">sessões — o sistema gera a data certa de cada uma</span>
                  </div>
                )}
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
            <p className="text-sm font-semibold text-nv-ink mb-1">Dia e horário fixo</p>
            {!form.profissionalAtualId ? (
              <p className="text-xs text-nv-muted">Escolha a profissional acima pra ver os horários livres dela.</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const grupos = horariosLivresPorDia(profissionais, form.profissionalAtualId);
                  return (
                    <div className="space-y-2">
                      {form.diaSemanaFixo && (
                        <button
                          type="button"
                          className="text-xs text-nv-blue font-semibold underline"
                          onClick={() => {
                            setForm({ ...form, diaSemanaFixo: "", horaFixa: "", horarioPersonalizado: false });
                            setHorarioPersonalizadoAberto(false);
                          }}
                        >
                          Limpar seleção (sem dia fixo)
                        </button>
                      )}
                      {grupos.length === 0 ? (
                        <p className="text-xs text-nv-muted">Essa profissional não tem nenhum horário livre configurado agora.</p>
                      ) : (
                        grupos.map((g) => (
                          <div key={g.dia}>
                            <p className="text-[11.5px] text-nv-muted3 mb-1">{g.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {g.horarios.map((h) => {
                                const ativo = !form.horarioPersonalizado && form.diaSemanaFixo === g.dia && form.horaFixa === h;
                                return (
                                  <button
                                    key={h}
                                    type="button"
                                    className={`nv-seg ${ativo ? "nv-seg-ativo" : ""}`}
                                    onClick={() => {
                                      setForm({ ...form, diaSemanaFixo: g.dia, horaFixa: h, horarioPersonalizado: false });
                                      setHorarioPersonalizadoAberto(false);
                                    }}
                                  >
                                    {h}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                {/* Fase 59 — pra quando a profissional combinou um horário direto (ex: WhatsApp) mas ainda
                    não colocou na disponibilidade dela no sistema. Cria o horário na agenda dela na hora. */}
                <div className="pt-2 border-t border-nv-borderLight/70">
                  {!horarioPersonalizadoAberto ? (
                    <button
                      type="button"
                      className="text-xs text-nv-blue font-semibold underline"
                      onClick={() => setHorarioPersonalizadoAberto(true)}
                    >
                      + Horário personalizado (ela ainda não colocou esse horário no sistema)
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[11.5px] text-nv-muted3">
                        Use quando ela já confirmou o horário com você (ex: no WhatsApp) mas ainda não marcou na
                        disponibilidade dela. Esse horário entra na agenda dela automaticamente.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          className="input !w-auto"
                          value={form.horarioPersonalizado ? form.diaSemanaFixo : ""}
                          onChange={(e) => setForm({ ...form, diaSemanaFixo: e.target.value, horarioPersonalizado: true })}
                        >
                          <option value="">Dia da semana</option>
                          {DIAS_FIXOS.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          className="input !w-auto"
                          value={form.horarioPersonalizado ? form.horaFixa : ""}
                          onChange={(e) => setForm({ ...form, horaFixa: e.target.value, horarioPersonalizado: true })}
                        />
                        <button
                          type="button"
                          className="text-xs text-nv-muted3 underline"
                          onClick={() => {
                            setHorarioPersonalizadoAberto(false);
                            if (form.horarioPersonalizado) setForm({ ...form, diaSemanaFixo: "", horaFixa: "", horarioPersonalizado: false });
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-nv-borderLight mt-4 pt-4">
            <p className="text-sm font-semibold text-nv-ink mb-1">Já lançar pagamento agora (opcional)</p>
            <p className="text-xs text-nv-muted mb-2">
              Se o cliente já pagou, preencha o valor aqui — só conta de verdade no financeiro depois que a profissional
              aceitar o paciente (aba "Novos pacientes" dela).
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                <option value="PACOTE_NOVO">Contratação nova</option>
                <option value="RENOVACAO">Renovação</option>
                <option value="SESSAO_EXTRA">Sessão extra</option>
                <option value="OUTRO">Outro</option>
              </select>
              <input
                className="input"
                placeholder={form.pagamentoParcial ? "Valor pago agora" : "Valor (opcional)"}
                value={form.valorTotal}
                onChange={(e) => setForm({ ...form, valorTotal: e.target.value })}
              />
              <select className="input" value={form.canalOrigem} onChange={(e) => setForm({ ...form, canalOrigem: e.target.value })}>
                {CANAL_ORIGEM_OPCOES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fase 59 — pagamento parcial: ela paga só parte do valor agora e completa depois (ex:
                metade de um pacote de R$120). O "pendente" fica visível na ficha e no Financeiro até
                alguém registrar que o restante foi pago. */}
            <label className="flex items-center gap-1.5 mt-2 text-xs text-nv-muted">
              <input
                type="checkbox"
                checked={form.pagamentoParcial}
                onChange={(e) => setForm({ ...form, pagamentoParcial: e.target.checked, valorPacoteTotal: e.target.checked ? form.valorPacoteTotal : "" })}
              />
              Pagamento parcial — ela vai completar o valor depois
            </label>
            {form.pagamentoParcial && (
              <div className="mt-1.5">
                <input
                  className="input !w-44"
                  placeholder="Valor total do pacote"
                  value={form.valorPacoteTotal}
                  onChange={(e) => setForm({ ...form, valorPacoteTotal: e.target.value })}
                />
                <p className="text-[11px] text-nv-muted3 mt-1">
                  "Valor pago agora" acima fica registrado como já recebido; a diferença pro valor total do pacote fica
                  pendente, visível na ficha do cliente e no Financeiro, até alguém registrar que o restante foi pago.
                </p>
              </div>
            )}

            <div className="mt-2">
              <label className="text-xs text-nv-muted block mb-1">Anexar comprovante (opcional)</label>
              <input type="file" accept="image/*" className="input-file" onChange={(e) => setArquivo(e.target.files[0])} />
            </div>
          </div>

          <button className="btn-primary mt-4" onClick={cadastrar}>
            Cadastrar e gerar agenda
          </button>
          {msg && <p className="text-red-600 text-sm mt-2">{msg}</p>}
          {resultado && (
            <div className="text-sm mt-3 space-y-2">
              <div className="bg-[#F2F7FC] border border-nv-blue/20 rounded-xl p-4 space-y-2">
                <p className="text-[12.5px] font-bold text-nv-blue">Acesso criado — copie e envie pro cliente</p>
                <pre className="font-mono text-xs bg-white rounded-lg p-3 whitespace-pre-wrap text-nv-ink2">{mensagemAcesso}</pre>
                <button type="button" className="btn-secondary !text-xs" onClick={copiarAcesso}>
                  {copiado ? "Copiado!" : "Copiar login e mensagem"}
                </button>
              </div>
              {resultado.aguardandoAceite && (
                <p className="text-[#B0580F] bg-[#FBF0E3] rounded-lg px-3 py-2">
                  Enviado pra profissional aceitar — assim que ela confirmar em "Novos pacientes", a agenda e o pagamento
                  entram valendo de verdade.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {recentes.length > 0 && (
        <div className="nv-card mb-4">
          <h3 className="font-sora font-semibold text-nv-ink mb-1">Cadastrados recentemente</h3>
          <p className="text-xs text-nv-muted mb-3">Últimas 48h — dá pra desfazer se foi engano.</p>
          <div className="flex flex-col gap-2">
            {recentes.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 bg-nv-bg rounded-[10px] px-3 py-2">
                <div>
                  <p className="text-[13px] font-semibold text-nv-ink">{c.nome}</p>
                  <p className="text-[11px] text-nv-muted3">{formatarHaQuantoAtendente(c.criadoEm)}</p>
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
          </div>
        </div>
      )}

      <div className="nv-card-flat px-5">
        {ordenados.map((c) => {
          // Fase 51 — igual canvas: progresso de sessões no lugar do e-mail, e a badge de
          // "aguardando renovação" direto na linha (sem precisar abrir a ficha pra ver).
          const pacote = c.pacotes?.[0];
          const aguardandoRenovacao = pacote?.status === "AGUARDANDO_RENOVACAO";
          const sessoesTxt = pacote ? `${pacote.sessoesUsadas || 0} de ${pacote.totalSessoes} sessões` : null;
          return (
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
                    {c.aguardandoAceiteDe ? (
                      <span className="text-[#B0580F] font-semibold">aguardando {c.aguardandoAceiteDe} aceitar</span>
                    ) : (
                      <>
                        com {c.profissionalAtual?.user?.nome || "sem profissional"}
                        {c.profissionalAtual?.user?.role === "DONO" ? " (Dono)" : ""}
                      </>
                    )}
                    {sessoesTxt && ` · ${sessoesTxt}`}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2.5 shrink-0">
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
          );
        })}
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
  // Fase 59 — pagamento parcial: cada transação pode ter valorPacoteTotal > valorTotal (ficou
  // faltando pagar o resto). "quitando" controla o mini-formulário inline pra registrar o
  // restante sem precisar sair da ficha do cliente.
  const [quitando, setQuitando] = useState(null);
  const [valorQuitacao, setValorQuitacao] = useState("");
  const [msgQuitacao, setMsgQuitacao] = useState("");
  const [enviandoQuitacao, setEnviandoQuitacao] = useState(false);

  async function carregar() {
    setCarregado(false);
    const r = await api.get(`${rotaBase}/clientes/${clienteId}/transacoes`);
    setLista(r.data);
    setCarregado(true);
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, rotaBase]);

  function abrirQuitacao(t) {
    setQuitando(t.id);
    setValorQuitacao(String((t.valorPacoteTotal - t.valorTotal).toFixed(2)));
    setMsgQuitacao("");
  }

  async function confirmarQuitacao(t) {
    setEnviandoQuitacao(true);
    setMsgQuitacao("");
    try {
      await api.put(`/comum/transacoes/${t.id}/quitar`, { valor: valorQuitacao });
      setQuitando(null);
      carregar();
    } catch (e) {
      setMsgQuitacao(e?.response?.data?.erro || "Erro ao registrar a quitação.");
    } finally {
      setEnviandoQuitacao(false);
    }
  }

  return (
    <div className="bg-white border border-renascer/10 rounded-lg p-3 space-y-1">
      <p className="text-xs font-medium text-renascer-ink/60">Pagamentos registrados</p>
      {!carregado && <p className="text-xs text-renascer-ink/40">Carregando...</p>}
      {carregado && lista.length === 0 && <p className="text-xs text-renascer-ink/40">Nenhum pagamento registrado ainda.</p>}
      {lista.map((t) => {
        const pendente = t.valorPacoteTotal && !t.quitadoEm ? Number((t.valorPacoteTotal - t.valorTotal).toFixed(2)) : 0;
        return (
          <div key={t.id} className="border-t border-renascer/10 pt-1">
            <div className="flex items-center justify-between flex-wrap gap-1 text-xs">
              <span>
                {new Date(t.data).toLocaleDateString("pt-BR")} · {TIPO_LABEL[t.tipo] || t.tipo} · R$ {t.valorTotal.toFixed(2)}
                {pendente > 0 && <span className="text-[#B0580F] font-semibold"> · pendente R$ {pendente.toFixed(2)}</span>}
                {t.valorPacoteTotal && t.quitadoEm && <span className="text-nv-green font-semibold"> · quitado</span>}
              </span>
              <div className="flex items-center gap-2">
                {t.temComprovante ? (
                  <button className="text-renascer underline" onClick={() => verComprovante(t.id)}>
                    Ver comprovante
                  </button>
                ) : (
                  <span className="text-renascer-ink/30">sem comprovante</span>
                )}
                {pendente > 0 && quitando !== t.id && (
                  <button className="text-[#B0580F] underline font-semibold" onClick={() => abrirQuitacao(t)}>
                    Registrar restante
                  </button>
                )}
              </div>
            </div>
            {quitando === t.id && (
              <div className="flex flex-wrap items-center gap-2 mt-1 bg-[#FBF0E3] rounded-lg px-2 py-1.5">
                <span className="text-[11px] text-[#B0580F]">Valor pago agora:</span>
                <input
                  className="input !w-24 !py-1 !text-xs"
                  value={valorQuitacao}
                  onChange={(e) => setValorQuitacao(e.target.value)}
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-nv-green underline"
                  disabled={enviandoQuitacao}
                  onClick={() => confirmarQuitacao(t)}
                >
                  {enviandoQuitacao ? "Salvando..." : "Confirmar"}
                </button>
                <button type="button" className="text-xs text-renascer-ink/40 underline" onClick={() => setQuitando(null)}>
                  Cancelar
                </button>
                {msgQuitacao && <span className="text-[11px] text-red-600 w-full">{msgQuitacao}</span>}
              </div>
            )}
          </div>
        );
      })}
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
    // Fase 60 — correção de bug: a.data é meia-noite UTC representando o dia certo — sem fixar
    // timeZone:"UTC", o navegador (Brasília, UTC-3) jogava pro dia anterior (meia-noite UTC = 21h
    // de Brasília do dia de antes), agrupando o agendamento sob o cabeçalho de dia errado.
    const chave = new Date(a.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "UTC" });
    (porDia[chave] = porDia[chave] || []).push(a);
  }

  // Fase 56 — resumo rápido por profissional (dentro da janela trazida: ontem em diante), pra ver
  // de cara se as sessões estão sendo realizadas ou se tem muita coisa pendente/faltando.
  const resumoPorProfissional = {};
  for (const a of lista) {
    const nome = a.profissional.user.nome;
    if (!resumoPorProfissional[nome]) resumoPorProfissional[nome] = { realizadas: 0, faltou: 0, pendentes: 0 };
    if (a.status === "REALIZADO") resumoPorProfissional[nome].realizadas++;
    else if (a.status === "FALTOU") resumoPorProfissional[nome].faltou++;
    else if (a.status === "AGENDADO" || a.status === "CONFIRMADO") resumoPorProfissional[nome].pendentes++;
  }

  return (
    <div className="font-publicSans">
      <div className="mb-4">
        <p className="nv-eyebrow mb-1">Painel da Atendente</p>
        <h1 className="font-sora font-bold text-[28px] text-nv-ink leading-tight">Agenda geral</h1>
        <p className="text-nv-muted text-sm mt-0.5">Agendamentos de todas as profissionais desde ontem, em ordem cronológica</p>
      </div>

      {Object.keys(resumoPorProfissional).length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {Object.entries(resumoPorProfissional).map(([nome, r]) => (
            <div key={nome} className="nv-card !p-3.5">
              <p className="font-sora font-semibold text-[13px] text-nv-ink mb-1.5 truncate">{nome}</p>
              <div className="flex gap-2 flex-wrap text-[11.5px]">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                  {r.realizadas} realizada{r.realizadas === 1 ? "" : "s"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{r.faltou} faltou</span>
                <span className="px-2 py-0.5 rounded-full bg-nv-ink/10 text-nv-ink/60 font-semibold">{r.pendentes} pendente(s)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="nv-card-flat px-5">
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
                        {/* Fase 60 — correção de bug: a.data não carrega a hora real (é sempre meia-noite UTC,
                            só representa o dia) — a hora de verdade é a.horaInicio. */}
                        {a.horaInicio} · {a.cliente.user.nome}
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
        {lista.length === 0 && <p className="text-sm text-nv-muted py-4">Nenhum agendamento nessa janela.</p>}
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
