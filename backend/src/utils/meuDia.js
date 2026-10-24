// "Meu dia" (Fase 30) — cálculos compartilhados pelos 3 painéis de gestão (Dono, Atendente,
// Profissional). Mantido num arquivo só pra não duplicar a mesma conta em dono.js, atendente.js
// e profissional.js, e pra dar pra testar essas contas isoladas (sem precisar de um banco de
// dados de verdade) antes de ligar nas rotas.

const prisma = require("../lib/prisma");

// ---------- Período ----------

// Fase 59 — correção de bug: "hoje" em horário de Brasília (UTC-3, sem horário de verão desde
// 2019), não simplesmente `new Date()`. O servidor (Railway) roda em UTC, e usar o instante UTC
// puro pra decidir "qual é o dia de hoje" vira o dia 3h ANTES da meia-noite real em Brasília —
// ex: às 21h de sexta em Brasília já são 00h de sábado em UTC. Nessas 3h finais do dia (21h–24h
// em Brasília), tudo que dependia de "hoje" sem essa correção (saldo de caixa do dia, investimento
// em anúncio de hoje, "a receber hoje", etc.) passava a procurar dados do dia seguinte — que ainda
// não existem — e mostrava tudo zerado, mesmo com o dia de hoje cheio de agendamento/pagamento.
function hojeBrasil() {
  const agoraBrasil = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return new Date(agoraBrasil.getUTCFullYear(), agoraBrasil.getUTCMonth(), agoraBrasil.getUTCDate());
}

// Meia-noite do dia informado (ou de hoje, se não vier nada) — usado como chave de dia em
// ChecklistConclusao e ConferenciaCaixa, e como início do filtro "hoje" em várias contas abaixo.
function inicioDoDia(dataStr) {
  if (!dataStr) return hojeBrasil();
  const base = new Date(`${dataStr}T00:00:00`);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function fimDoDia(dataStr) {
  const inicio = inicioDoDia(dataStr);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

// Início/fim do mês de uma data (ou do mês atual) — mesmo padrão já usado em dono.js/financeiro.
function periodoDoMes(mes, ano) {
  const hoje = new Date();
  const m = mes ? Number(mes) - 1 : hoje.getMonth();
  const a = ano ? Number(ano) : hoje.getFullYear();
  return { inicio: new Date(a, m, 1), fim: new Date(a, m + 1, 1), mes: m + 1, ano: a };
}

// Trimestre atual no formato "2026-T4", usado como valor padrão de MetaTrimestre.
function trimestreAtual(data = new Date()) {
  const trimestre = Math.floor(data.getMonth() / 3) + 1;
  return `${data.getFullYear()}-T${trimestre}`;
}

// ---------- Configuração financeira da clínica (custo fixo / reserva de caixa) ----------

async function obterConfiguracaoFinanceiraClinica() {
  let config = await prisma.configuracaoFinanceiraClinica.findUnique({ where: { id: "config" } });
  if (!config) {
    config = await prisma.configuracaoFinanceiraClinica.create({ data: { id: "config" } });
  }
  return config;
}

// ---------- Indicadores de processo (não dependem de nenhum campo novo — já existem no sistema) ----------

// Taxa de faltas: sessões marcadas FALTOU / total de sessões que já deviam ter acontecido
// (REALIZADO + FALTOU + CANCELADO não entra, porque cancelamento é outra coisa) no período.
// `profissionalId` é opcional — quando vem, limita a uma profissional só (visão dela mesma).
async function calcularTaxaFaltas({ inicio, fim, profissionalId }) {
  const where = { data: { gte: inicio, lt: fim }, status: { in: ["REALIZADO", "FALTOU"] } };
  if (profissionalId) where.profissionalId = profissionalId;

  const [total, faltas] = await Promise.all([
    prisma.agendamento.count({ where }),
    prisma.agendamento.count({ where: { ...where, status: "FALTOU" } }),
  ]);

  return {
    totalSessoes: total,
    faltas,
    taxaFaltasPercentual: total > 0 ? Number(((faltas / total) * 100).toFixed(1)) : null,
  };
}

// Tempo médio de resposta: pra cada mensagem do CLIENTE, procura a próxima resposta da
// PROFISSIONAL na mesma conversa e mede quanto tempo passou. Só conta mensagens que já tiveram
// resposta (uma pendente ainda não entra na média, porque ainda não tem "tempo de resposta").
async function calcularTempoRespostaMedio({ inicio, fim, profissionalId }) {
  const where = { criadoEm: { gte: inicio, lt: fim } };
  if (profissionalId) where.profissionalId = profissionalId;

  const todasOrdenadas = await prisma.mensagemInterna.findMany({
    where,
    select: { clienteId: true, profissionalId: true, autor: true, criadoEm: true },
    orderBy: { criadoEm: "asc" },
  });

  const porConversa = {};
  for (const m of todasOrdenadas) {
    const chave = `${m.profissionalId}|${m.clienteId}`;
    (porConversa[chave] = porConversa[chave] || []).push(m);
  }

  const temposMs = [];
  for (const lista of Object.values(porConversa)) {
    for (let i = 0; i < lista.length; i++) {
      if (lista[i].autor !== "CLIENTE") continue;
      for (let j = i + 1; j < lista.length; j++) {
        if (lista[j].autor === "PROFISSIONAL") {
          temposMs.push(lista[j].criadoEm.getTime() - lista[i].criadoEm.getTime());
          break;
        }
      }
    }
  }

  if (temposMs.length === 0) return { mensagensRespondidas: 0, tempoMedioMinutos: null };
  const mediaMs = temposMs.reduce((s, t) => s + t, 0) / temposMs.length;
  return { mensagensRespondidas: temposMs.length, tempoMedioMinutos: Math.round(mediaMs / 60000) };
}

// ---------- Indicadores de marketing (dependem dos registros novos da Fase 30) ----------

// Gasto com anúncio no período, agrupado por canal (só MovimentoCaixa categoria "Anúncio"
// preenche canalOrigem) — base pra CAC/ROI por canal.
async function calcularGastoAnuncioPorCanal({ inicio, fim }) {
  const gastos = await prisma.movimentoCaixa.findMany({
    where: { tipo: "SAIDA", canalOrigem: { not: null }, data: { gte: inicio, lt: fim } },
    select: { canalOrigem: true, valor: true },
  });
  const porCanal = {};
  for (const g of gastos) {
    porCanal[g.canalOrigem] = (porCanal[g.canalOrigem] || 0) + g.valor;
  }
  const totalGastoAnuncios = gastos.reduce((s, g) => s + g.valor, 0);
  return { porCanal, totalGastoAnuncios };
}

// Clientes novos no período, agrupados por canalOrigem (preenchido opcionalmente no cadastro) —
// base de "leads por canal" real (na prática, clientes convertidos — o sistema não tem hoje
// nenhuma captura de lead que não virou cliente, só isso mesmo já é um dado novo).
async function calcularClientesNovosPorCanal({ inicio, fim }) {
  const clientes = await prisma.cliente.findMany({
    where: { criadoEm: { gte: inicio, lt: fim } },
    select: { canalOrigem: true },
  });
  const porCanal = {};
  for (const c of clientes) {
    const chave = c.canalOrigem || "NAO_INFORMADO";
    porCanal[chave] = (porCanal[chave] || 0) + 1;
  }
  return { totalClientesNovos: clientes.length, porCanal };
}

// CAC (custo de aquisição por cliente) e ROI aproximado por canal pago — só combina com canais
// que tiveram gasto E cliente novo no mesmo período; qualquer outro canal fica sem CAC calculado
// (nunca inventa número com base zero).
async function calcularCACPorCanal({ inicio, fim }) {
  const [{ porCanal: gastoPorCanal, totalGastoAnuncios }, { porCanal: clientesPorCanal, totalClientesNovos }] =
    await Promise.all([calcularGastoAnuncioPorCanal({ inicio, fim }), calcularClientesNovosPorCanal({ inicio, fim })]);

  const canais = new Set([...Object.keys(gastoPorCanal), ...Object.keys(clientesPorCanal)]);
  const porCanal = {};
  for (const canal of canais) {
    if (canal === "NAO_INFORMADO") continue;
    const gasto = gastoPorCanal[canal] || 0;
    const clientesNovos = clientesPorCanal[canal] || 0;
    porCanal[canal] = {
      gasto,
      clientesNovos,
      cac: gasto > 0 && clientesNovos > 0 ? Number((gasto / clientesNovos).toFixed(2)) : null,
    };
  }
  return { porCanal, totalGastoAnuncios, totalClientesNovos };
}

// ---------- Fechamento de caixa ----------

// Saldo que o SISTEMA calcula pra um dia: tudo que a clínica recebeu direto de cliente nesse dia
// (TransacaoFinanceira com recebidoPor=CLINICA) + movimentos de caixa soltos (entradas - saídas).
// Não entra o que a profissional recebeu direto (isso é repasse, outra conta) — "caixa" aqui é
// só o dinheiro que passou pela mão da clínica mesmo.
async function calcularSaldoCaixaDoDia(dataStr) {
  const inicio = inicioDoDia(dataStr);
  const fim = fimDoDia(dataStr);

  const [entradasClientes, movimentos] = await Promise.all([
    prisma.transacaoFinanceira.aggregate({
      where: { recebidoPor: "CLINICA", data: { gte: inicio, lt: fim } },
      _sum: { valorTotal: true },
    }),
    prisma.movimentoCaixa.findMany({ where: { data: { gte: inicio, lt: fim } } }),
  ]);

  const totalEntradasClientes = entradasClientes._sum.valorTotal || 0;
  const totalEntradasExtra = movimentos.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + m.valor, 0);
  const totalSaidas = movimentos.filter((m) => m.tipo === "SAIDA").reduce((s, m) => s + m.valor, 0);
  const saldoSistema = Number((totalEntradasClientes + totalEntradasExtra - totalSaidas).toFixed(2));

  return {
    data: inicio,
    totalEntradasClientes,
    totalEntradasExtra,
    totalSaidas,
    saldoSistema,
    movimentos,
  };
}

module.exports = {
  hojeBrasil,
  inicioDoDia,
  fimDoDia,
  periodoDoMes,
  trimestreAtual,
  obterConfiguracaoFinanceiraClinica,
  calcularTaxaFaltas,
  calcularTempoRespostaMedio,
  calcularGastoAnuncioPorCanal,
  calcularClientesNovosPorCanal,
  calcularCACPorCanal,
  calcularSaldoCaixaDoDia,
};
