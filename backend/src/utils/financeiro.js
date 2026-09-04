// Regras de cálculo financeiro do Espaço do Renascer.
// Regra padrão: tudo que entra é dividido 50%/50% entre a profissional e a Renascer,
// salvo se a profissional tiver um percentualRepasse customizado cadastrado.
// Ex: recebeu R$170 -> R$85 pra profissional, R$85 pra Renascer.

function calcularRepasse(valorTotal, percentualRepasse = 50) {
  const valorProfissional = Number((valorTotal * (percentualRepasse / 100)).toFixed(2));
  const valorRenascer = Number((valorTotal - valorProfissional).toFixed(2));
  return { valorProfissional, valorRenascer };
}

// Tabela oficial de planos do site (referência pra validar/whitelist no backend)
const PLANOS = {
  MIN30: {
    1: 60,
    2: 100,
    4: 170,
  },
  MIN50: {
    1: 110,
    2: 180,
    4: 320,
  },
};

function valorDoPlano(duracao, totalSessoes) {
  const tabela = PLANOS[duracao];
  if (!tabela) return null;
  return tabela[totalSessoes] ?? null;
}

// Trava de segurança: antes de criar uma transação financeira nova, checa se já não existe
// uma igual pra esse mesmo cliente, no mesmo dia (hoje), com o mesmo valor — pra não contar o
// mesmo pagamento duas vezes se a atendente e a profissional (ou a atendente duas vezes)
// registrarem o mesmo comprovante sem perceber. Critério: mesmo cliente + mesmo valor + mesmo dia.
async function transacaoDuplicada(prisma, clienteId, valorTotal) {
  if (!clienteId || !valorTotal) return null;
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioAmanha = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  return prisma.transacaoFinanceira.findFirst({
    where: {
      clienteId,
      valorTotal: Number(valorTotal),
      data: { gte: inicioHoje, lt: inicioAmanha },
    },
    orderBy: { criadoEm: "desc" },
  });
}

module.exports = { calcularRepasse, PLANOS, valorDoPlano, transacaoDuplicada };
