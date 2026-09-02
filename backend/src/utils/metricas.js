const prisma = require("../lib/prisma");

// Métricas de retenção/valor de um cliente, usadas pelo Dono e pela Atendente
// pra acompanhar tempo de casa e renovações (CAC em R$ fica pra uma fase futura,
// quando o sistema passar a registrar gasto com anúncios).
async function calcularMetricasCliente(clienteId) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      user: { select: { nome: true, email: true } },
      profissionalAtual: { include: { user: { select: { nome: true } } } },
      pacotes: { orderBy: { iniciadoEm: "asc" } },
    },
  });
  if (!cliente) return null;

  const agora = new Date();
  const diasDeCasa = Math.floor((agora.getTime() - cliente.criadoEm.getTime()) / (1000 * 60 * 60 * 24));

  const totalPacotes = cliente.pacotes.length;
  const renovacoes = Math.max(totalPacotes - 1, 0);
  const pacoteAtual = cliente.pacotes[cliente.pacotes.length - 1] || null;

  const [sessoesRealizadas, somaTransacoes] = await Promise.all([
    prisma.agendamento.count({ where: { clienteId, status: "REALIZADO" } }),
    prisma.transacaoFinanceira.aggregate({ where: { clienteId }, _sum: { valorTotal: true } }),
  ]);

  return {
    clienteId,
    nome: cliente.user.nome,
    email: cliente.user.email,
    profissionalAtual: cliente.profissionalAtual?.user?.nome || null,
    clienteDesde: cliente.criadoEm,
    diasDeCasa,
    totalPacotesContratados: totalPacotes,
    renovacoes,
    sessoesRealizadas,
    valorTotalPago: somaTransacoes._sum.valorTotal || 0,
    pacoteAtual: pacoteAtual
      ? {
          status: pacoteAtual.status,
          totalSessoes: pacoteAtual.totalSessoes,
          sessoesUsadas: pacoteAtual.sessoesUsadas,
          iniciadoEm: pacoteAtual.iniciadoEm,
        }
      : null,
  };
}

module.exports = { calcularMetricasCliente };
