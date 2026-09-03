const prisma = require("../lib/prisma");
const { enviarEmail } = require("./email");

// Lembrete de sessão: 1 dia antes e ~6h antes, por e-mail (pra quem já cruzou a
// janela e ainda não recebeu aquele aviso especificamente).
async function verificarLembretesDeSessao() {
  const agora = Date.now();
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      status: { in: ["AGENDADO", "CONFIRMADO"] },
      data: { gte: new Date() },
      OR: [{ lembrete24hEmailEm: null }, { lembrete6hEmailEm: null }],
    },
    include: {
      cliente: { include: { user: true } },
      profissional: { include: { user: true } },
    },
  });

  for (const ag of agendamentos) {
    const horasAte = (new Date(ag.data).getTime() - agora) / 1000 / 60 / 60;
    const destino = ag.cliente.notifEmail || ag.cliente.user.email;
    const dataFormatada = new Date(ag.data).toLocaleDateString("pt-BR");

    if (!ag.lembrete24hEmailEm && horasAte <= 24 && horasAte > 0) {
      await enviarEmail(
        destino,
        "Sua sessão é amanhã — Espaço do Renascer",
        `Olá, ${ag.cliente.user.nome}!\n\nPassando pra lembrar que sua sessão com ${ag.profissional.user.nome} está marcada para ${dataFormatada} às ${ag.horaInicio}.\n\nAté lá!\nEspaço do Renascer`
      );
      await prisma.agendamento.update({ where: { id: ag.id }, data: { lembrete24hEmailEm: new Date() } });
    }

    if (!ag.lembrete6hEmailEm && horasAte <= 6 && horasAte > 0) {
      await enviarEmail(
        destino,
        "Sua sessão é daqui a pouco — Espaço do Renascer",
        `Olá, ${ag.cliente.user.nome}!\n\nSua sessão com ${ag.profissional.user.nome} é hoje às ${ag.horaInicio}. Até já!\n\nEspaço do Renascer`
      );
      await prisma.agendamento.update({ where: { id: ag.id }, data: { lembrete6hEmailEm: new Date() } });
    }
  }
}

// Aviso de renovação: dispara até 3 dias antes da data cadastrada em Cliente.renovarEm,
// tanto pro cliente quanto pra profissional responsável. Só uma vez por data cadastrada
// (renovarEmAvisoEnviado volta pra false sempre que uma nova data é salva).
async function verificarLembretesDeRenovacao() {
  const agora = Date.now();
  const clientes = await prisma.cliente.findMany({
    where: { renovarEm: { not: null }, renovarEmAvisoEnviado: false },
    include: { user: true, profissionalAtual: { include: { user: true } } },
  });

  for (const c of clientes) {
    const diasAte = (new Date(c.renovarEm).getTime() - agora) / 1000 / 60 / 60 / 24;
    if (diasAte <= 3 && diasAte > -1) {
      const destino = c.notifEmail || c.user.email;
      await enviarEmail(
        destino,
        "Hora de renovar seu pacote — Espaço do Renascer",
        `Olá, ${c.user.nome}!\n\nSeu pacote está perto da data de renovação. Fale com a gente pra continuar seus atendimentos sem interrupção.\n\nEspaço do Renascer`
      );
      if (c.profissionalAtual?.user?.email) {
        await enviarEmail(
          c.profissionalAtual.user.email,
          "Cliente perto de renovar",
          `Olá! Seu cliente ${c.user.nome} está perto da data prevista de renovação (${new Date(c.renovarEm).toLocaleDateString("pt-BR")}). Que tal chamar pra confirmar?`
        );
      }
      await prisma.cliente.update({ where: { id: c.id }, data: { renovarEmAvisoEnviado: true } });
    }
  }
}

async function verificarLembretes() {
  try {
    await verificarLembretesDeSessao();
  } catch (e) {
    console.error("Erro ao verificar lembretes de sessão:", e);
  }
  try {
    await verificarLembretesDeRenovacao();
  } catch (e) {
    console.error("Erro ao verificar lembretes de renovação:", e);
  }
}

module.exports = { verificarLembretes };
