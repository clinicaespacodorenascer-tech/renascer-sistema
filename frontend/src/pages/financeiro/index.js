import { useEffect, useState } from "react";
import LayoutNovo from "../../components/LayoutNovo";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

// ---------- SETOR FINANCEIRO (Fase 31) ----------
// Painel completo do novo papel "Setor Financeiro" (ex: Patrícia): CAC/ROI/receita/lucro de
// hoje, investimento em anúncios (alimenta CAC/ROI), calculadora de imposto, retiradas e
// pró-labore, pagamento de anúncios — mais as 3 telas de apoio que o setor também usa no dia a
// dia (clientes pra renovar, repasses das profissionais, agenda geral), reaproveitando os mesmos
// dados que o Dono/Atendente já usam.
export default function AreaFinanceiro() {
  const { user, carregando } = useAuth("FINANCEIRO");
  const [aba, setAba] = useState("painel");
  if (carregando) return null;

  const ABAS = [
    { id: "painel", label: "Painel financeiro" },
    { id: "renovar", label: "Clientes pra renovar" },
    { id: "repasses", label: "Repasses" },
    { id: "agenda", label: "Agenda geral" },
  ];

  return (
    <LayoutNovo user={user} abas={ABAS} abaAtiva={aba} onTrocarAba={setAba}>
      {aba === "painel" && <PainelFinanceiro />}
      {aba === "renovar" && <ClientesParaRenovar />}
      {aba === "repasses" && <Repasses />}
      {aba === "agenda" && <AgendaGeral />}
    </LayoutNovo>
  );
}

export function formatarMoeda(v) {
  return (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ================================================================================================
// ---------------- Painel financeiro ----------------
// ================================================================================================

// Fase 51 — exportado pra ser reaproveitado direto na aba "Financeiro" do Dono (ver dono/index.js):
// o mesmo painel de CAC/ROI/investimento/imposto/retiradas que o Setor Financeiro usa, já que as
// rotas /financeiro/* sempre liberaram tanto FINANCEIRO quanto DONO (middleware desta rota, acima).
export function PainelFinanceiro() {
  const [dados, setDados] = useState(null);

  const [investidoForm, setInvestidoForm] = useState("");
  const [leadsForm, setLeadsForm] = useState("");
  const [conversoesForm, setConversoesForm] = useState("");
  const [msgInvestimento, setMsgInvestimento] = useState("");

  const [valorDigitado, setValorDigitado] = useState("");
  const [pctDigitado, setPctDigitado] = useState("");
  const [msgImposto, setMsgImposto] = useState("");

  const [nomeForm, setNomeForm] = useState("");
  const [valorForm, setValorForm] = useState("");
  const [msgRetirada, setMsgRetirada] = useState("");
  const [retiradas, setRetiradas] = useState([]);
  const [filtroRetirada, setFiltroRetirada] = useState("dia");

  async function carregarPainel() {
    const { data } = await api.get("/financeiro/painel");
    setDados(data);
    if (data.investimentoHojeForm) {
      setInvestidoForm(String(data.investimentoHojeForm.investido));
      setLeadsForm(String(data.investimentoHojeForm.leads));
      setConversoesForm(String(data.investimentoHojeForm.conversoes));
    }
  }
  async function carregarRetiradas(filtro) {
    const { data } = await api.get(`/financeiro/retiradas?filtro=${filtro}`);
    setRetiradas(data);
  }
  useEffect(() => {
    carregarPainel();
    carregarRetiradas(filtroRetirada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    carregarRetiradas(filtroRetirada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroRetirada]);

  async function lancarInvestimento() {
    setMsgInvestimento("");
    try {
      await api.post("/financeiro/investimento-anuncio", { investido: investidoForm, leads: leadsForm, conversoes: conversoesForm });
      carregarPainel();
    } catch (e) {
      setMsgInvestimento(e?.response?.data?.erro || "Erro ao lançar o dia.");
    }
  }

  async function lancarImposto() {
    setMsgImposto("");
    try {
      await api.post("/financeiro/imposto", { valorRecebido: valorDigitado, percentual: pctDigitado });
      setMsgImposto("Lançado no caixa.");
    } catch (e) {
      setMsgImposto(e?.response?.data?.erro || "Erro ao lançar o imposto.");
    }
  }

  async function lancarRetirada() {
    setMsgRetirada("");
    try {
      await api.post("/financeiro/retiradas", { nome: nomeForm, valor: valorForm });
      setNomeForm("");
      setValorForm("");
      carregarRetiradas(filtroRetirada);
    } catch (e) {
      setMsgRetirada(e?.response?.data?.erro || "Erro ao lançar a retirada.");
    }
  }

  async function alternarPagoAnuncio(canal) {
    await api.put("/financeiro/anuncio-pago", { canal });
    carregarPainel();
  }

  if (!dados) return <p className="text-sm text-nv-muted">Carregando...</p>;

  const valor = parseFloat((valorDigitado || "0").replace(",", ".")) || 0;
  const pct = parseFloat((pctDigitado || "0").replace(",", ".")) || 0;
  const impostoCalculado = (valor * pct) / 100;

  const porData = {};
  retiradas.forEach((r) => {
    const chave = new Date(r.data).toLocaleDateString("pt-BR");
    (porData[chave] = porData[chave] || []).push(r);
  });
  const gruposPorData = Object.entries(porData).map(([data, itens]) => ({ data, itens }));
  const totalPeriodo = retiradas.reduce((s, r) => s + r.valor, 0);

  return (
    <>
      <div>
        <p className="font-sora text-[11px] font-bold uppercase tracking-[0.09em] text-nv-gold mb-1.5">Setor Financeiro</p>
        <h1 className="font-sora font-bold text-[26px] md:text-[29px] text-nv-navy mb-1">Painel financeiro</h1>
        <p className="text-[14px] text-nv-muted">Lançamentos e indicadores de hoje</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CardStat
          titulo="CAC"
          sub="Custo de Aquisição de Cliente — quanto custa, em média, trazer um cliente novo"
          valor={`R$ ${formatarMoeda(dados.cac)}`}
        />
        <CardStat
          titulo="ROI"
          sub="Retorno sobre Investimento — quanto volta pra cada real gasto em anúncio"
          valor={`${dados.roi.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}x`}
          cor="text-nv-green"
        />
        <CardStat titulo="Receita de hoje" sub="Total recebido no caixa até agora" valor={`R$ ${formatarMoeda(dados.receitaHoje)}`} />
        <CardStat
          titulo="Lucro de hoje"
          sub="Receita menos custos e repasses já descontados"
          valor={`R$ ${formatarMoeda(dados.lucroHoje)}`}
          cor="text-nv-green"
        />
      </div>

      <div className="bg-white rounded-2xl p-5 md:p-[22px] shadow-[0_1px_2px_rgba(14,30,54,0.05)] flex flex-col gap-4">
        <div>
          <p className="font-sora font-semibold text-[15px] text-nv-navy">Investimento em anúncios — análise diária</p>
          <p className="text-[12.5px] text-nv-muted2 mt-0.5">
            Lance todos os dias: quanto foi investido, quantos leads chegaram no WhatsApp e quantos converteram — isso
            alimenta o CAC e o ROI lá no topo
          </p>
        </div>
        <div className="flex gap-2.5 items-end flex-wrap bg-nv-bg rounded-xl p-3.5">
          <CampoNv label="Investido hoje (R$)" value={investidoForm} onChange={setInvestidoForm} largura="150px" />
          <CampoNv label="Leads no WhatsApp" value={leadsForm} onChange={setLeadsForm} largura="150px" />
          <CampoNv label="Conversões hoje" value={conversoesForm} onChange={setConversoesForm} largura="140px" />
          <BotaoNv onClick={lancarInvestimento}>Lançar dia</BotaoNv>
        </div>
        {msgInvestimento && <p className="text-sm text-red-600">{msgInvestimento}</p>}

        <div className="flex flex-col gap-0.5">
          <div className="flex gap-2.5 text-[11px] font-bold text-nv-muted2 uppercase tracking-[0.03em] pb-1.5">
            <span className="w-[76px] shrink-0">Data</span>
            <span className="flex-1">Investido</span>
            <span className="flex-1">Leads</span>
            <span className="flex-1">Conversões</span>
            <span className="flex-1">Custo/lead</span>
            <span className="flex-1">CAC</span>
          </div>
          {dados.historicoInvestimento.map((h, idx) => (
            <div key={idx} className="flex gap-2.5 items-center py-2 border-t border-nv-borderLight text-[13px]">
              <span className="w-[76px] shrink-0 font-semibold text-nv-ink2">{h.data}</span>
              <span className="flex-1 tabular-nums text-nv-ink2">R$ {formatarMoeda(h.investido)}</span>
              <span className="flex-1 tabular-nums text-nv-ink2">{h.leads}</span>
              <span className="flex-1 tabular-nums text-nv-ink2">{h.conversoes}</span>
              <span className="flex-1 tabular-nums text-nv-ink2">R$ {formatarMoeda(h.custoPorLead)}</span>
              <span
                className={`flex-1 tabular-nums font-bold ${
                  h.corCac === "vermelho" ? "text-nv-red" : h.corCac === "verde" ? "text-nv-green" : "text-nv-navy"
                }`}
              >
                R$ {formatarMoeda(h.cac)}
              </span>
            </div>
          ))}
          {dados.historicoInvestimento.length === 0 && (
            <p className="text-[13px] text-nv-muted2 pt-2">Nenhum lançamento ainda.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 md:p-[22px] shadow-[0_1px_2px_rgba(14,30,54,0.05)] flex flex-col gap-3 max-w-[480px]">
        <div>
          <p className="font-sora font-semibold text-[15px] text-nv-navy">Calculadora de imposto</p>
          <p className="text-[12.5px] text-nv-muted2 mt-0.5">Digite o valor recebido e a % do imposto</p>
        </div>
        <div className="flex gap-2.5 items-end flex-wrap">
          <CampoNv label="Valor recebido (R$)" value={valorDigitado} onChange={setValorDigitado} largura="130px" />
          <CampoNv label="Imposto (%)" value={pctDigitado} onChange={setPctDigitado} largura="80px" />
        </div>
        <div className="bg-[#F2F7FC] rounded-[10px] p-3.5 flex items-center justify-between">
          <span className="text-[12.5px] font-semibold text-nv-blue">Imposto a pagar</span>
          <span className="font-sora font-bold text-[18px] text-nv-navy tabular-nums">R$ {formatarMoeda(impostoCalculado)}</span>
        </div>
        <BotaoNv onClick={lancarImposto} className="self-start">
          Lançar esse valor
        </BotaoNv>
        {msgImposto && <p className="text-sm text-nv-muted">{msgImposto}</p>}
      </div>

      <div className="bg-white rounded-2xl p-5 md:p-[22px] shadow-[0_1px_2px_rgba(14,30,54,0.05)] flex flex-col gap-4">
        <div>
          <p className="font-sora font-semibold text-[15px] text-nv-navy">Retiradas e pró-labore</p>
          <p className="text-[12.5px] text-nv-muted2 mt-0.5">
            Não existe valor padrão — cada retirada é lançada aqui, na hora, por quem está retirando
          </p>
        </div>
        <div className="flex gap-2.5 items-end flex-wrap bg-nv-bg rounded-xl p-3.5">
          <CampoNv
            label="Quem está retirando"
            value={nomeForm}
            onChange={setNomeForm}
            placeholder="Ex: Maria, Patrícia, Pró-labore · Elismael"
            flex
          />
          <CampoNv label="Valor (R$)" value={valorForm} onChange={setValorForm} largura="130px" />
          <BotaoNv onClick={lancarRetirada}>Lançar retirada</BotaoNv>
        </div>
        {msgRetirada && <p className="text-sm text-red-600">{msgRetirada}</p>}

        <div className="flex gap-1.5 flex-wrap">
          {[
            ["dia", "Hoje"],
            ["semana", "Essa semana"],
            ["mes", "Este mês"],
            ["todos", "Histórico completo"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFiltroRetirada(id)}
              className={`border rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold ${
                filtroRetirada === id ? "bg-nv-blue text-white border-nv-blue" : "bg-white text-nv-muted border-nv-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          {gruposPorData.map((g) => (
            <div key={g.data} className="mb-1.5">
              <p className="text-[11px] font-bold text-nv-muted2 uppercase tracking-[0.04em] mt-3.5 mb-0.5">{g.data}</p>
              {g.itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-t border-nv-borderLight">
                  <span className="text-[13px] font-semibold text-nv-ink2">{item.nome}</span>
                  <span className="text-[13px] font-bold text-nv-navy tabular-nums">R$ {formatarMoeda(item.valor)}</span>
                </div>
              ))}
            </div>
          ))}
          {gruposPorData.length === 0 && <p className="text-[13px] text-nv-muted2 mt-2.5">Nenhum lançamento nesse período.</p>}
        </div>

        <div className="flex items-center justify-between border-t border-nv-border pt-3">
          <span className="text-[12.5px] font-semibold text-nv-muted">Total no período selecionado</span>
          <span className="font-sora font-bold text-[17px] text-nv-navy tabular-nums">R$ {formatarMoeda(totalPeriodo)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 md:p-[22px] shadow-[0_1px_2px_rgba(14,30,54,0.05)] flex flex-col gap-1">
        <p className="font-sora font-semibold text-[15px] text-nv-navy mb-2">Pagamento de anúncios de hoje</p>
        {dados.anuncios.map((a) => (
          <div key={a.canal} className="flex items-center justify-between py-2.5 border-t border-nv-borderLight">
            <span className="text-[13.5px] font-semibold text-nv-ink2">{a.nome}</span>
            <button
              onClick={() => alternarPagoAnuncio(a.canal)}
              className={`border rounded-[9px] px-3.5 py-1.5 text-[12.5px] font-semibold ${
                a.pago ? "border-nv-green bg-[#EFF8F3] text-nv-green" : "border-nv-border bg-white text-nv-muted"
              }`}
            >
              {a.pago ? "Pago hoje" : "Marcar como pago"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function CardStat({ titulo, sub, valor, cor }) {
  return (
    <div className="bg-white rounded-2xl p-[18px] shadow-[0_1px_2px_rgba(14,30,54,0.05)]">
      <p className="text-[12px] font-bold text-nv-muted mb-0.5">{titulo}</p>
      <p className="text-[10.5px] text-nv-muted3 mb-2">{sub}</p>
      <p className={`font-sora font-bold text-[20px] md:text-[22px] ${cor || "text-nv-navy"} tabular-nums`}>{valor}</p>
    </div>
  );
}

function CampoNv({ label, value, onChange, largura, placeholder, flex }) {
  return (
    <label
      className={`flex flex-col gap-1 text-[11.5px] font-semibold text-nv-muted ${flex ? "flex-1 min-w-[180px]" : ""}`}
      style={!flex ? { width: largura } : undefined}
    >
      {label}
      <input
        className="border border-nv-border rounded-[9px] px-3 py-2 text-[13.5px] font-publicSans text-nv-ink2 focus:outline-none focus:ring-2 focus:ring-nv-blue/30"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function BotaoNv({ children, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-nv-blue hover:bg-nv-blueDark text-white rounded-[9px] px-4 py-2 text-[13px] font-semibold whitespace-nowrap ${
        className || ""
      }`}
    >
      {children}
    </button>
  );
}

// ================================================================================================
// ---------------- Clientes pra renovar (mesma fila que Dono/Atendente usam) ----------------
// ================================================================================================

function ClientesParaRenovar() {
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [escolha, setEscolha] = useState({});

  async function carregar() {
    const [r, p] = await Promise.all([api.get("/financeiro/clientes-reativar"), api.get("/financeiro/profissionais")]);
    setLista(r.data);
    setProfissionais(p.data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function reativar(id) {
    const profissionalId = escolha[id];
    if (!profissionalId) return;
    await api.put(`/financeiro/clientes/${id}/reativar`, { profissionalId });
    carregar();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-sora text-[11px] font-bold uppercase tracking-[0.09em] text-nv-gold mb-1.5">Setor Financeiro</p>
        <h1 className="font-sora font-bold text-[26px] text-nv-navy mb-1">Clientes pra renovar</h1>
        <p className="text-[14px] text-nv-muted">Fila de quem saiu e ainda não voltou — chame no WhatsApp e vincule de novo com uma profissional.</p>
      </div>
      {lista.map((c) => (
        <div key={c.id} className="bg-white rounded-2xl p-[18px] shadow-[0_1px_2px_rgba(14,30,54,0.05)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-nv-ink2">{c.nome}</p>
            <p className="text-[12.5px] text-nv-muted2">{c.pacoteResumo || "—"} · saiu em {c.excluidoEm ? new Date(c.excluidoEm).toLocaleDateString("pt-BR") : "—"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {c.whatsapp && (
              <a
                className="text-[12.5px] text-nv-green font-semibold underline"
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}`}
              >
                Chamar no WhatsApp
              </a>
            )}
            <select
              className="border border-nv-border rounded-[9px] px-2 py-1.5 text-[12.5px]"
              value={escolha[c.id] || ""}
              onChange={(e) => setEscolha({ ...escolha, [c.id]: e.target.value })}
            >
              <option value="">Vincular com...</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.user.nome}
                </option>
              ))}
            </select>
            <BotaoNv onClick={() => reativar(c.id)}>Reativar</BotaoNv>
          </div>
        </div>
      ))}
      {lista.length === 0 && <p className="text-[13px] text-nv-muted2">Nenhum cliente esperando reativação agora.</p>}
    </div>
  );
}

// ================================================================================================
// ---------------- Repasses das profissionais (mesma lógica da visão do Dono) ----------------
// ================================================================================================

function Repasses() {
  const [dados, setDados] = useState(null);
  const [aberto, setAberto] = useState(null);

  async function carregar() {
    const { data } = await api.get("/financeiro/repasses-pendentes");
    setDados(data);
  }
  useEffect(() => {
    carregar();
  }, []);

  async function marcar(id) {
    await api.put(`/financeiro/repasses/${id}/marcar`);
    carregar();
  }

  if (!dados) return <p className="text-sm text-nv-muted">Carregando...</p>;
  const profissionais = Object.entries(dados.porProfissional || {});

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-sora text-[11px] font-bold uppercase tracking-[0.09em] text-nv-gold mb-1.5">Setor Financeiro</p>
        <h1 className="font-sora font-bold text-[26px] text-nv-navy mb-1">Repasses</h1>
        <p className="text-[14px] text-nv-muted">
          Dinheiro que uma profissional recebeu direto do cliente e ainda deve repassar a parte da clínica.
        </p>
      </div>

      {profissionais.length === 0 && (
        <div className="bg-white rounded-2xl p-[18px] shadow-[0_1px_2px_rgba(14,30,54,0.05)]">
          <p className="text-[13px] text-nv-muted2">Nenhuma pendência de repasse no momento — tudo em dia.</p>
        </div>
      )}

      {profissionais.map(([nome, info]) => (
        <div key={nome} className="bg-white rounded-2xl p-[18px] shadow-[0_1px_2px_rgba(14,30,54,0.05)]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-nv-ink2">{nome}</p>
              <p className="text-[12.5px] text-nv-muted2">{info.transacoes.length} pagamento(s) pendente(s)</p>
            </div>
            <p className="font-sora text-[18px] font-bold text-nv-gold">R$ {formatarMoeda(info.totalPendente)}</p>
          </div>
          <button
            className="text-[12.5px] text-nv-blue underline mt-2"
            onClick={() => setAberto(aberto === nome ? null : nome)}
          >
            {aberto === nome ? "Fechar lista" : "Ver pagamentos"}
          </button>
          {aberto === nome && (
            <div className="mt-3 flex flex-col gap-2">
              {info.transacoes.map((t) => (
                <div key={t.id} className="flex items-center justify-between flex-wrap gap-2 text-[13px] border-t border-nv-borderLight pt-2">
                  <span>
                    {new Date(t.data).toLocaleDateString("pt-BR")} · {t.cliente?.user?.nome || "cliente"} · você recebe R${" "}
                    {formatarMoeda(t.valorRenascer)}
                  </span>
                  <BotaoNv onClick={() => marcar(t.id)}>Marcar repassado</BotaoNv>
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
// ---------------- Agenda geral ----------------
// ================================================================================================

function AgendaGeral() {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    api.get("/financeiro/agenda-geral").then((r) => setLista(r.data));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-sora text-[11px] font-bold uppercase tracking-[0.09em] text-nv-gold mb-1.5">Setor Financeiro</p>
        <h1 className="font-sora font-bold text-[26px] text-nv-navy mb-1">Agenda geral</h1>
      </div>
      <div className="bg-white rounded-2xl p-[18px] shadow-[0_1px_2px_rgba(14,30,54,0.05)] overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-nv-muted">
              <th className="pb-2">Data</th>
              <th className="pb-2">Profissional</th>
              <th className="pb-2">Cliente</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a) => (
              <tr key={a.id} className="border-t border-nv-borderLight">
                <td className="py-1.5">{new Date(a.data).toLocaleString("pt-BR")}</td>
                <td>{a.profissional.user.nome}</td>
                <td>{a.cliente.user.nome}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="text-[13px] text-nv-muted2 py-2">Nenhum agendamento futuro.</p>}
      </div>
    </div>
  );
}
