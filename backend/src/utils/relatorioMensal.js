// Fase 70 — "Fazendo as contas do Renascer": relatório mensal de CAC (custo de aquisição por
// cliente), leads/conversão e lucro vs. perda, pedido pelo Elismael pra enxergar a matemática real
// do negócio — quanto custa trazer um paciente (anúncio + equipe) e se isso compensa frente ao que
// ele paga na primeira compra, sabendo que o lucro de verdade só aparece quando ele renova.
//
// Os números vêm de dados que o sistema já tinha (nenhum dado novo manual, além do custo dos
// funcionários):
//   - leads/investimento/conversões lançados: soma de InvestimentoAnuncioDiario no mês (já é
//     lançado todo dia pelo Setor Financeiro — Fase 30/51).
//   - clientes novos "de verdade" / renovações / saídas: contagem de HistoricoCliente (ENTROU /
//     RENOVOU / EXCLUIDO) no mês — serve pra "bater certo" com o número de conversões que foi
//     lançado manualmente (podem não ser idênticos: lançamento é por estimativa do dia, histórico é
//     o que o sistema registrou de verdade quando o cadastro foi aceito).
//   - custo de funcionários: soma de CustoFuncionario ativos (configuração atual, não histórico
//     mês a mês — ver comentário no schema).
//   - faturamento do mês: soma de TransacaoFinanceira (igual ao "Faturamento do mês" que já existe
//     no dashboard do Dono).
const prisma = require("../lib/prisma");
const { periodoDoMes } = require("./meuDia");

async function gerarRelatorioMensal({ mes, ano } = {}) {
  const { inicio, fim, mes: mesResolvido, ano: anoResolvido } = periodoDoMes(mes, ano);

  const [
    lancamentosAnuncio,
    funcionariosAtivos,
    novosClientesMes,
    renovaramMes,
    sairamMes,
    faturamentoMes,
  ] = await Promise.all([
    prisma.investimentoAnuncioDiario.findMany({
      where: { data: { gte: inicio, lt: fim } },
      select: { investido: true, leads: true, conversoes: true },
    }),
    prisma.custoFuncionario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
    prisma.historicoCliente.count({ where: { tipo: "ENTROU", criadoEm: { gte: inicio, lt: fim } } }),
    prisma.historicoCliente.count({ where: { tipo: "RENOVOU", criadoEm: { gte: inicio, lt: fim } } }),
    prisma.historicoCliente.count({ where: { tipo: "EXCLUIDO", criadoEm: { gte: inicio, lt: fim } } }),
    prisma.transacaoFinanceira.aggregate({
      where: { data: { gte: inicio, lt: fim } },
      _sum: { valorTotal: true },
    }),
  ]);

  const investimentoAnuncioMes = Number(lancamentosAnuncio.reduce((s, l) => s + l.investido, 0).toFixed(2));
  const leadsMes = lancamentosAnuncio.reduce((s, l) => s + l.leads, 0);
  const conversoesLancadasMes = lancamentosAnuncio.reduce((s, l) => s + l.conversoes, 0);

  const custoFuncionariosMes = Number(funcionariosAtivos.reduce((s, f) => s + f.valorMensal, 0).toFixed(2));
  const custoTotalAquisicao = Number((investimentoAnuncioMes + custoFuncionariosMes).toFixed(2));

  // Base pro CAC: prioriza o número REAL de clientes novos (HistoricoCliente ENTROU) — é o que
  // de fato aconteceu no sistema. Só cai pro número lançado manualmente (conversões do dia a dia
  // do anúncio) se ainda não tiver nenhum ENTROU registrado no período (ex: mês muito no início).
  const basePagantes = novosClientesMes > 0 ? novosClientesMes : conversoesLancadasMes;
  const cac = custoTotalAquisicao > 0 && basePagantes > 0 ? Number((custoTotalAquisicao / basePagantes).toFixed(2)) : null;

  const taxaConversaoLeads = leadsMes > 0 ? Number(((conversoesLancadasMes / leadsMes) * 100).toFixed(1)) : null;
  const custoPorLead = leadsMes > 0 ? Number((investimentoAnuncioMes / leadsMes).toFixed(2)) : null;

  const baseRenovacao = renovaramMes + sairamMes;
  const taxaRenovacaoMes = baseRenovacao > 0 ? Number(((renovaramMes / baseRenovacao) * 100).toFixed(1)) : null;

  const receitaMes = faturamentoMes._sum.valorTotal || 0;
  const lucroVsPerdaMes = Number((receitaMes - custoTotalAquisicao).toFixed(2));

  return {
    periodo: { mes: mesResolvido, ano: anoResolvido },
    leads: {
      totalLeads: leadsMes,
      conversoesLancadas: conversoesLancadasMes,
      taxaConversaoLeads,
      custoPorLead,
    },
    clientesReais: {
      novos: novosClientesMes,
      renovaram: renovaramMes,
      sairam: sairamMes,
      taxaRenovacaoMes,
      // avisa quando o número lançado manualmente (conversões do anúncio) não bate com o que o
      // sistema de fato registrou como cliente novo — pra ajudar a "bater certo" como foi pedido.
      conversoesBatemComHistorico: conversoesLancadasMes === novosClientesMes,
    },
    custos: {
      investimentoAnuncioMes,
      funcionarios: funcionariosAtivos.map((f) => ({ id: f.id, nome: f.nome, cargo: f.cargo, valorMensal: f.valorMensal })),
      custoFuncionariosMes,
      custoTotalAquisicao,
    },
    cac,
    receitaMes,
    lucroVsPerdaMes,
  };
}

module.exports = { gerarRelatorioMensal };
