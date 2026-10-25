// Fase 69 — lista de "clientes pra renovar" (nome, profissional, data, WhatsApp), reaproveitada
// em mais de um lugar: a aba "Clientes pra renovar" do Financeiro/Dono (existente desde a Fase 53/
// 57), e agora também as listas que alimentam os pop-ups que abrem sozinhos ao entrar no sistema
// (profissional vê só os clientes DELA que renovam hoje; atendente vê a clínica inteira que
// renova essa semana). Centralizado aqui pra não ter 3 ou 4 versões ligeiramente diferentes da
// mesma consulta espalhadas pelas rotas — inclusive pro mesmo motivo que já gerou bug de fuso
// horário antes: uma conta só, testada uma vez, reaproveitada em todo lugar.
const prisma = require("../lib/prisma");

// `todos`: true lista a clínica inteira (ativos), não só quem já tem data de renovação marcada —
// usado pelo botão "Ver todos os clientes" da aba Financeiro. `profissionalId`: restringe à
// carteira de uma profissional (usado pelo pop-up "hoje" dela). `ateExclusivo`: só quem renova
// ANTES dessa data (não-inclusivo) — usado pelos pop-ups "hoje"/"essa semana"; inclui também quem
// já está atrasado (sem limite inferior), porque atrasado é ainda mais urgente de ligar.
async function listarClientesParaRenovar({ todos = false, profissionalId = null, ateExclusivo = null } = {}) {
  let renovarEmFiltro;
  if (ateExclusivo) renovarEmFiltro = { not: null, lt: ateExclusivo };
  else if (!todos) renovarEmFiltro = { not: null };

  const clientes = await prisma.cliente.findMany({
    where: {
      situacao: "ATIVO",
      ...(renovarEmFiltro ? { renovarEm: renovarEmFiltro } : {}),
      ...(profissionalId ? { profissionalAtualId: profissionalId } : {}),
    },
    include: {
      user: { select: { nome: true, telefone: true } },
      profissionalAtual: { include: { user: { select: { nome: true } } } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
    },
    orderBy: [{ renovarEm: "asc" }, { user: { nome: "asc" } }],
  });

  return clientes.map((c) => ({
    id: c.id,
    nome: c.user.nome,
    // mesma ordem de prioridade usada em todo o resto do sistema pro número de WhatsApp: o
    // telefone de login primeiro, depois o que ele informou no cadastro, depois o contato
    // alternativo — null só quando nenhum dos três existe (aí o pop-up avisa "sem WhatsApp").
    whatsapp: c.user.telefone || c.whatsappCadastro || c.notifTelefone || null,
    profissionalNome: c.profissionalAtual?.user?.nome || "Sem profissional",
    valorPacote: c.pacotes[0]?.valorTotal ?? null,
    duracao: c.pacotes[0]?.duracao ?? null,
    renovarEm: c.renovarEm,
    renovarContatadoEm: c.renovarContatadoEm,
  }));
}

module.exports = { listarClientesParaRenovar };
