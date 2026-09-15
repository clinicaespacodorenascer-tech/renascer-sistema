const prisma = require("../lib/prisma");
const { enviarEmail } = require("./email");
const { notificar, notificarDonos, notificarAtendentes } = require("./notificar");

// Lembrete de sessão: 1 dia antes e ~6h antes, por e-mail E por aviso dentro do app/notificação
// push pro cliente (usa os mesmos campos de controle pra não mandar duas vezes).
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
      await notificar(ag.cliente.userId, {
        titulo: "Sua sessão é amanhã",
        mensagem: `Sua sessão com ${ag.profissional.user.nome} está marcada para ${dataFormatada} às ${ag.horaInicio}.`,
        tipo: "sessao",
      });
      await prisma.agendamento.update({ where: { id: ag.id }, data: { lembrete24hEmailEm: new Date() } });
    }

    if (!ag.lembrete6hEmailEm && horasAte <= 6 && horasAte > 0) {
      await enviarEmail(
        destino,
        "Sua sessão é daqui a pouco — Espaço do Renascer",
        `Olá, ${ag.cliente.user.nome}!\n\nSua sessão com ${ag.profissional.user.nome} é hoje às ${ag.horaInicio}. Até já!\n\nEspaço do Renascer`
      );
      await notificar(ag.cliente.userId, {
        titulo: "Sua sessão é daqui a pouco",
        mensagem: `Sua sessão com ${ag.profissional.user.nome} é hoje às ${ag.horaInicio}.`,
        tipo: "sessao",
      });
      await prisma.agendamento.update({ where: { id: ag.id }, data: { lembrete6hEmailEm: new Date() } });
    }
  }
}

// Aviso de renovação: dispara até 3 dias antes da data cadastrada em Cliente.renovarEm, pro
// cliente, pra profissional responsável E pros donos (pra poderem cobrar a profissional se
// precisar). Só uma vez por data cadastrada (renovarEmAvisoEnviado volta pra false sempre que
// uma nova data é salva).
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
      const dataFormatada = new Date(c.renovarEm).toLocaleDateString("pt-BR");

      await enviarEmail(
        destino,
        "Hora de renovar seu pacote — Espaço do Renascer",
        `Olá, ${c.user.nome}!\n\nSeu pacote está perto da data de renovação. Fale com a gente pra continuar seus atendimentos sem interrupção.\n\nEspaço do Renascer`
      );
      await notificar(c.userId, {
        titulo: "Hora de renovar seu pacote",
        mensagem: "Seu pacote está perto da data de renovação. Fale com a gente pra continuar sem interrupção.",
        tipo: "renovacao",
      });

      if (c.profissionalAtual?.user) {
        await enviarEmail(
          c.profissionalAtual.user.email,
          "Cliente perto de renovar",
          `Olá! Seu cliente ${c.user.nome} está perto da data prevista de renovação (${dataFormatada}). Que tal chamar pra confirmar?`
        );
        await notificar(c.profissionalAtual.user.id, {
          titulo: "Cliente perto de renovar",
          mensagem: `${c.user.nome} está perto da data prevista de renovação (${dataFormatada}). Que tal chamar pra confirmar?`,
          tipo: "renovacao",
        });
      }

      await notificarDonos({
        titulo: "Cliente perto de renovar",
        mensagem: `${c.user.nome} (profissional: ${c.profissionalAtual?.user?.nome || "sem profissional"}) está perto da data prevista de renovação (${dataFormatada}).`,
        tipo: "renovacao",
      });

      await prisma.cliente.update({ where: { id: c.id }, data: { renovarEmAvisoEnviado: true } });
    }
  }
}

// Resumo diário da agenda pra cada profissional: lista os clientes e horários de hoje. Manda só
// uma vez por dia (confere se já existe um aviso desse tipo criado hoje pra ela antes de mandar
// de novo) — roda dentro do mesmo ciclo de 15 em 15 minutos dos outros lembretes, não precisa de
// nenhum agendador novo.
async function verificarResumoDiarioProfissionais() {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioAmanha = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  const profissionais = await prisma.profissional.findMany({ select: { id: true, userId: true } });

  for (const prof of profissionais) {
    const agendamentosHoje = await prisma.agendamento.findMany({
      where: {
        profissionalId: prof.id,
        status: { in: ["AGENDADO", "CONFIRMADO"] },
        data: { gte: inicioHoje, lt: inicioAmanha },
      },
      include: { cliente: { include: { user: true } } },
      orderBy: { horaInicio: "asc" },
    });

    if (agendamentosHoje.length === 0) continue;

    const jaAvisouHoje = await prisma.notificacao.findFirst({
      where: { userId: prof.userId, tipo: "resumo_diario", criadoEm: { gte: inicioHoje, lt: inicioAmanha } },
    });
    if (jaAvisouHoje) continue;

    const lista = agendamentosHoje.map((ag) => `${ag.horaInicio} - ${ag.cliente.user.nome}`).join(" · ");
    await notificar(prof.userId, {
      titulo: `Sua agenda de hoje: ${agendamentosHoje.length} sessão(ões)`,
      mensagem: lista,
      tipo: "resumo_diario",
    });
  }
}

// Aviso pro dono e pra atendente quando uma profissional não inicia a sessão marcada — "iniciar"
// aqui é o mesmo momento em que ela entra na videochamada (rota /agenda/:id/iniciar-chamada, que
// já existia desde antes) e cria/atualiza o registro de ChamadaVideo com `iniciadaEm`. Dá uma
// margem de tolerância (GRACE_MINUTOS) antes de considerar "não iniciou", pra não avisar por
// atraso de 2 minutos ou algo assim; e só manda uma vez por agendamento
// (`avisoNaoIniciadoEnviado`).
const GRACE_MINUTOS_SESSAO_NAO_INICIADA = 15;

async function verificarSessoesNaoIniciadas() {
  const agora = new Date();
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioAmanha = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  const candidatos = await prisma.agendamento.findMany({
    where: {
      status: { in: ["AGENDADO", "CONFIRMADO"] },
      avisoNaoIniciadoEnviado: false,
      data: { gte: inicioHoje, lt: inicioAmanha },
    },
    include: {
      profissional: { include: { user: true } },
      cliente: { include: { user: true } },
      chamadaVideo: true,
    },
  });

  for (const ag of candidatos) {
    if (ag.chamadaVideo?.iniciadaEm) continue; // já iniciou — nada a avisar

    const [hora, minuto] = ag.horaInicio.split(":").map(Number);
    const horarioMarcado = new Date(ag.data);
    horarioMarcado.setHours(hora, minuto, 0, 0);
    const minutosDeAtraso = (agora.getTime() - horarioMarcado.getTime()) / 1000 / 60;

    if (minutosDeAtraso < GRACE_MINUTOS_SESSAO_NAO_INICIADA) continue;

    const mensagem = `${ag.profissional.user.nome} não iniciou a sessão de ${ag.cliente.user.nome}, marcada para ${ag.horaInicio} (já passou ${Math.round(minutosDeAtraso)} min).`;
    await notificarDonos({ titulo: "Sessão não iniciada", mensagem, tipo: "sistema" });
    await notificarAtendentes({ titulo: "Sessão não iniciada", mensagem, tipo: "sistema" });
    await prisma.agendamento.update({ where: { id: ag.id }, data: { avisoNaoIniciadoEnviado: true } });
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
  try {
    await verificarResumoDiarioProfissionais();
  } catch (e) {
    console.error("Erro ao verificar resumo diário das profissionais:", e);
  }
  try {
    await verificarSessoesNaoIniciadas();
  } catch (e) {
    console.error("Erro ao verificar sessões não iniciadas:", e);
  }
}

module.exports = { verificarLembretes };
