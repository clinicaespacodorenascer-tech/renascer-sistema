const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");

const router = express.Router();

// Isolado do resto do sistema: só DONO acessa, e nenhuma dessas tabelas se relaciona
// com cliente/profissional/agendamento/transação da clínica.
router.use(autenticar, permitir("DONO"));

const DIAS_ALERTA_VENCIMENTO = 5; // "vence em breve" = vence dentro desses dias

function calcularStatusDespesa(lancamento) {
  if (lancamento.tipo !== "DESPESA") return null;
  if (lancamento.dataPagamento) return { status: "PAGO", dias: null };
  if (!lancamento.dataVencimento) return { status: "PENDENTE", dias: null };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(lancamento.dataVencimento);
  vencimento.setHours(0, 0, 0, 0);

  const diffDias = Math.round((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return { status: "ATRASADO", dias: diffDias };
  if (diffDias <= DIAS_ALERTA_VENCIMENTO) return { status: "VENCE_EM_BREVE", dias: diffDias };
  return { status: "PENDENTE", dias: diffDias };
}

function serializarLancamento(l) {
  const statusInfo = calcularStatusDespesa(l);
  return {
    ...l,
    status: statusInfo ? statusInfo.status : "PAGO",
    diasParaVencer: statusInfo ? statusInfo.dias : null,
  };
}

// ---------- Resumo (dashboard) ----------
router.get("/resumo", async (req, res) => {
  const [receitas, despesas, poupancaAportes, metas] = await Promise.all([
    prisma.lancamentoPessoal.findMany({ where: { tipo: "RECEITA" } }),
    prisma.lancamentoPessoal.findMany({ where: { tipo: "DESPESA" } }),
    prisma.poupancaAportePessoal.findMany(),
    prisma.metaPessoal.findMany({ orderBy: { criadoEm: "desc" } }),
  ]);

  const totalReceitas = receitas.reduce((s, r) => s + r.valor, 0);
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const totalPoupanca = poupancaAportes.reduce((s, a) => s + a.valor, 0);

  const despesasComStatus = despesas.map(serializarLancamento);
  const pendentes = despesasComStatus.filter((d) => d.status !== "PAGO");
  const atrasadas = pendentes.filter((d) => d.status === "ATRASADO");
  const venceEmBreve = pendentes.filter((d) => d.status === "VENCE_EM_BREVE");

  const totalPendente = pendentes.reduce((s, d) => s + d.valor, 0);
  const totalAtrasado = atrasadas.reduce((s, d) => s + d.valor, 0);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const poupancaEsteMes = poupancaAportes
    .filter((a) => new Date(a.data) >= inicioMes)
    .reduce((s, a) => s + a.valor, 0);

  res.json({
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    totalPoupanca,
    poupancaEsteMes,
    totalPendente,
    totalAtrasado,
    qtdAtrasadas: atrasadas.length,
    qtdVenceEmBreve: venceEmBreve.length,
    qtdPendentes: pendentes.length,
    proximasVencer: pendentes
      .sort((a, b) => (a.diasParaVencer ?? 9999) - (b.diasParaVencer ?? 9999))
      .slice(0, 5),
    metas: metas.slice(0, 3),
  });
});

// ---------- Histórico mensal (receitas x despesas por mês, para acompanhar evolução) ----------
router.get("/historico-mensal", async (req, res) => {
  const lancamentos = await prisma.lancamentoPessoal.findMany({
    orderBy: { criadoEm: "asc" },
  });

  const mapa = new Map(); // "AAAA-MM" -> { receitas, despesas }
  for (const l of lancamentos) {
    const d = new Date(l.criadoEm);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!mapa.has(chave)) mapa.set(chave, { receitas: 0, despesas: 0 });
    const grupo = mapa.get(chave);
    if (l.tipo === "RECEITA") grupo.receitas += l.valor;
    else grupo.despesas += l.valor;
  }

  const nomesMes = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];

  const historico = Array.from(mapa.entries())
    .map(([chave, valores]) => {
      const [ano, mes] = chave.split("-").map(Number);
      return {
        chave,
        mesAno: `${nomesMes[mes - 1]}/${ano}`,
        totalReceitas: valores.receitas,
        totalDespesas: valores.despesas,
        saldo: valores.receitas - valores.despesas,
      };
    })
    .sort((a, b) => (a.chave < b.chave ? 1 : -1)) // mais recente primeiro
    .slice(0, 12);

  res.json(historico);
});

// ---------- Lançamentos (receitas e despesas) ----------
router.get("/lancamentos", async (req, res) => {
  const { tipo, status } = req.query;
  const where = {};
  if (tipo === "RECEITA" || tipo === "DESPESA") where.tipo = tipo;

  const lancamentos = await prisma.lancamentoPessoal.findMany({ where, orderBy: { criadoEm: "desc" } });
  let resultado = lancamentos.map(serializarLancamento);

  if (status) {
    resultado = resultado.filter((l) => l.status === status);
  }

  // despesas não pagas primeiro, ordenadas pela data de vencimento mais próxima
  resultado.sort((a, b) => {
    if (a.tipo === "DESPESA" && b.tipo === "DESPESA") {
      const aAberta = a.status !== "PAGO";
      const bAberta = b.status !== "PAGO";
      if (aAberta && !bAberta) return -1;
      if (!aAberta && bAberta) return 1;
      if (aAberta && bAberta) {
        const aData = a.dataVencimento ? new Date(a.dataVencimento).getTime() : Infinity;
        const bData = b.dataVencimento ? new Date(b.dataVencimento).getTime() : Infinity;
        return aData - bData;
      }
    }
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });

  res.json(resultado);
});

router.post("/lancamentos", async (req, res) => {
  try {
    const {
      tipo,
      categoria,
      descricao,
      pessoa,
      valor,
      parcelaAtual,
      totalParcelas,
      dataVencimento,
      dataPagamento,
      observacao,
    } = req.body;

    if (!tipo || !categoria || valor === undefined || valor === null) {
      return res.status(400).json({ erro: "Preencha tipo, categoria e valor." });
    }

    const lancamento = await prisma.lancamentoPessoal.create({
      data: {
        tipo,
        categoria,
        descricao: descricao || null,
        pessoa: pessoa || null,
        valor: Number(valor),
        parcelaAtual: parcelaAtual ? Number(parcelaAtual) : null,
        totalParcelas: totalParcelas ? Number(totalParcelas) : null,
        dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
        dataPagamento: dataPagamento ? new Date(dataPagamento) : null,
        observacao: observacao || null,
      },
    });

    res.status(201).json(serializarLancamento(lancamento));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao criar lançamento." });
  }
});

router.put("/lancamentos/:id", async (req, res) => {
  try {
    const {
      tipo,
      categoria,
      descricao,
      pessoa,
      valor,
      parcelaAtual,
      totalParcelas,
      dataVencimento,
      dataPagamento,
      observacao,
    } = req.body;

    const lancamento = await prisma.lancamentoPessoal.update({
      where: { id: req.params.id },
      data: {
        ...(tipo !== undefined && { tipo }),
        ...(categoria !== undefined && { categoria }),
        ...(descricao !== undefined && { descricao: descricao || null }),
        ...(pessoa !== undefined && { pessoa: pessoa || null }),
        ...(valor !== undefined && { valor: Number(valor) }),
        ...(parcelaAtual !== undefined && { parcelaAtual: parcelaAtual ? Number(parcelaAtual) : null }),
        ...(totalParcelas !== undefined && { totalParcelas: totalParcelas ? Number(totalParcelas) : null }),
        ...(dataVencimento !== undefined && { dataVencimento: dataVencimento ? new Date(dataVencimento) : null }),
        ...(dataPagamento !== undefined && { dataPagamento: dataPagamento ? new Date(dataPagamento) : null }),
        ...(observacao !== undefined && { observacao: observacao || null }),
      },
    });

    res.json(serializarLancamento(lancamento));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao atualizar lançamento." });
  }
});

router.put("/lancamentos/:id/pagar", async (req, res) => {
  try {
    const lancamento = await prisma.lancamentoPessoal.update({
      where: { id: req.params.id },
      data: { dataPagamento: new Date() },
    });
    res.json(serializarLancamento(lancamento));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao marcar como pago." });
  }
});

router.put("/lancamentos/:id/desmarcar-pago", async (req, res) => {
  try {
    const lancamento = await prisma.lancamentoPessoal.update({
      where: { id: req.params.id },
      data: { dataPagamento: null },
    });
    res.json(serializarLancamento(lancamento));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao desmarcar pagamento." });
  }
});

router.delete("/lancamentos/:id", async (req, res) => {
  try {
    await prisma.lancamentoPessoal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir lançamento." });
  }
});

// ---------- Metas ----------
router.get("/metas", async (req, res) => {
  const metas = await prisma.metaPessoal.findMany({ orderBy: { criadoEm: "desc" } });
  res.json(metas);
});

router.post("/metas", async (req, res) => {
  try {
    const { titulo, valorMeta, valorAtual, dataAlvo } = req.body;
    if (!titulo || !valorMeta) {
      return res.status(400).json({ erro: "Preencha título e valor da meta." });
    }
    const meta = await prisma.metaPessoal.create({
      data: {
        titulo,
        valorMeta: Number(valorMeta),
        valorAtual: valorAtual ? Number(valorAtual) : 0,
        dataAlvo: dataAlvo ? new Date(dataAlvo) : null,
      },
    });
    res.status(201).json(meta);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao criar meta." });
  }
});

router.put("/metas/:id", async (req, res) => {
  try {
    const { titulo, valorMeta, dataAlvo } = req.body;
    const meta = await prisma.metaPessoal.update({
      where: { id: req.params.id },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(valorMeta !== undefined && { valorMeta: Number(valorMeta) }),
        ...(dataAlvo !== undefined && { dataAlvo: dataAlvo ? new Date(dataAlvo) : null }),
      },
    });
    res.json(meta);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao atualizar meta." });
  }
});

router.put("/metas/:id/adicionar", async (req, res) => {
  try {
    const { valor } = req.body;
    if (!valor) return res.status(400).json({ erro: "Informe o valor a adicionar." });
    const meta = await prisma.metaPessoal.update({
      where: { id: req.params.id },
      data: { valorAtual: { increment: Number(valor) } },
    });
    res.json(meta);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao adicionar valor à meta." });
  }
});

router.delete("/metas/:id", async (req, res) => {
  try {
    await prisma.metaPessoal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir meta." });
  }
});

// ---------- Poupança ----------
router.get("/poupanca", async (req, res) => {
  const aportes = await prisma.poupancaAportePessoal.findMany({ orderBy: { data: "desc" } });
  const total = aportes.reduce((s, a) => s + a.valor, 0);
  res.json({ total, aportes });
});

router.post("/poupanca/aportes", async (req, res) => {
  try {
    const { valor, observacao, data } = req.body;
    if (valor === undefined || valor === null) {
      return res.status(400).json({ erro: "Informe o valor do aporte (use valor negativo para retirada)." });
    }
    const aporte = await prisma.poupancaAportePessoal.create({
      data: {
        valor: Number(valor),
        observacao: observacao || null,
        data: data ? new Date(data) : new Date(),
      },
    });
    res.status(201).json(aporte);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao registrar aporte." });
  }
});

router.delete("/poupanca/aportes/:id", async (req, res) => {
  try {
    await prisma.poupancaAportePessoal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir aporte." });
  }
});

// ---------- Notas / lista de pendências ----------
router.get("/notas", async (req, res) => {
  const notas = await prisma.notaPessoal.findMany({ orderBy: [{ resolvido: "asc" }, { criadoEm: "desc" }] });
  res.json(notas);
});

router.post("/notas", async (req, res) => {
  try {
    const { texto, local } = req.body;
    if (!texto) return res.status(400).json({ erro: "Escreva o texto da anotação." });
    const nota = await prisma.notaPessoal.create({ data: { texto, local: local || null } });
    res.status(201).json(nota);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao criar anotação." });
  }
});

router.put("/notas/:id", async (req, res) => {
  try {
    const { texto, local, resolvido } = req.body;
    const nota = await prisma.notaPessoal.update({
      where: { id: req.params.id },
      data: {
        ...(texto !== undefined && { texto }),
        ...(local !== undefined && { local: local || null }),
        ...(resolvido !== undefined && { resolvido: Boolean(resolvido) }),
      },
    });
    res.json(nota);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao atualizar anotação." });
  }
});

router.delete("/notas/:id", async (req, res) => {
  try {
    await prisma.notaPessoal.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "Erro ao excluir anotação." });
  }
});

module.exports = router;
