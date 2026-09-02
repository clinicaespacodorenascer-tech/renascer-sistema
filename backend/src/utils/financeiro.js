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

module.exports = { calcularRepasse, PLANOS, valorDoPlano };
