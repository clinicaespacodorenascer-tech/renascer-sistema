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

// Converte o que a atendente/profissional digitou no campo de valor num número de verdade,
// aceitando os jeitos que elas realmente digitam: "85", "85,00", "R$ 85,00", "R$85,00",
// "1.234,56" (formato BR com separador de milhar). Antes disso só "85" puro funcionava —
// qualquer "R$" ou vírgula fazia o Number() nativo falhar (virava NaN) e o lançamento
// era rejeitado ou, pior, silenciosamente ignorado.
function parseValorMonetario(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isNaN(valor) ? null : valor;

  let texto = String(valor).trim();
  if (!texto) return null;

  texto = texto
    .replace(/r\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.\-]/g, "");
  if (!texto) return null;

  if (texto.includes(",") && texto.includes(".")) {
    // "1.234,56" -> tira os pontos de milhar e troca a vírgula decimal por ponto
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    // "85,00" -> "85.00"
    texto = texto.replace(",", ".");
  }
  // só ponto (ou nenhum separador) já fica pronto pro Number(), ex: "85.00" ou "85"

  const numero = Number(texto);
  return Number.isNaN(numero) ? null : numero;
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

module.exports = { calcularRepasse, PLANOS, valorDoPlano, transacaoDuplicada, parseValorMonetario };
