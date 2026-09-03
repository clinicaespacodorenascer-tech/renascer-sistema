// Calcula o "semáforo" de cada cliente — mostrado como uma bolinha pulsante na agenda da
// profissional e nas listas de cliente (profissional, atendente e dono). É 100% automático,
// ninguém edita direto:
//   VERDE    -> cliente em dia (1ª/2ª sessão do pacote, ou ainda sem pacote registrado)
//   AMARELO  -> terminou a penúltima sessão do pacote (ex: a 3ª de um pacote de 4) — hora de
//               começar a falar de renovação
//   VERMELHO -> terminou todas as sessões do pacote sem renovar, OU a data de
//               renovação/pagamento combinada já passou (o que vier primeiro)
function calcularStatusCliente({ pacote, renovarEm }) {
  if (renovarEm && new Date(renovarEm).getTime() < Date.now()) return "VERMELHO";
  if (!pacote) return "VERDE";

  const { sessoesUsadas, totalSessoes } = pacote;
  const restantes = totalSessoes - sessoesUsadas;
  if (restantes <= 0) return "VERMELHO";
  if (totalSessoes > 1 && restantes === 1) return "AMARELO";
  return "VERDE";
}

module.exports = { calcularStatusCliente };
