const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { valorDoPlano, calcularRepasse, transacaoDuplicada, parseValorMonetario } = require("./financeiro");
const { notificar, notificarDonos, notificarAtendentes } = require("./notificar");
const { gerarEmailAutomatico } = require("./gerarLogin");

const DIAS_SEMANA_JS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];

// Fase 55 — gera as N sessões de um pacote (totalSessoes) direto na Agenda, uma por semana a
// partir da próxima ocorrência do dia escolhido — antes só a primeira sessão era criada, o resto
// "existia" só de forma implícita (o horário fixo ocupado), sem aparecer de fato no calendário.
// Usado tanto no aceite da Atendente/Dono quanto no cadastro direto da própria Profissional.
async function gerarAgendamentosRecorrentes({ profissionalId, clienteId, pacoteId, diaSemanaFixo, horaFixa, duracao, totalSessoes }) {
  const indiceAlvo = DIAS_SEMANA_JS.indexOf(diaSemanaFixo);
  const hoje = new Date();
  const diffDias = (indiceAlvo - hoje.getDay() + 7) % 7;
  const primeiraData = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + diffDias);

  const quantidade = Math.max(1, Number(totalSessoes) || 1);
  const agendamentos = [];
  let conflitos = 0;

  for (let i = 0; i < quantidade; i++) {
    const dataSessao = new Date(primeiraData);
    dataSessao.setDate(dataSessao.getDate() + i * 7);

    const conflito = await prisma.agendamento.findFirst({
      where: { profissionalId, data: dataSessao, horaInicio: horaFixa, status: { in: ["AGENDADO", "CONFIRMADO"] } },
    });
    if (conflito) {
      conflitos++;
      continue;
    }
    agendamentos.push(
      await prisma.agendamento.create({
        data: {
          profissionalId,
          clienteId,
          pacoteId: pacoteId || null,
          data: dataSessao,
          diaSemana: diaSemanaFixo,
          horaInicio: horaFixa,
          duracao: duracao || "MIN50",
        },
      })
    );
  }

  let avisoAgenda =
    conflitos > 0
      ? `${conflitos} sessão(ões) não entraram na agenda porque já tinha outro compromisso marcado no mesmo dia/horário em alguma dessas semanas — confira e ajuste manualmente.`
      : null;

  // Trava o horário fixo recorrente (além das sessões já lançadas, garante que esse dia+hora
  // continua reservado pra ele toda semana daqui pra frente).
  const slotFixo = await prisma.disponibilidade.findFirst({
    where: { profissionalId, diaSemana: diaSemanaFixo, horaInicio: horaFixa, ativo: true },
  });
  if (slotFixo) {
    if (slotFixo.ocupadoPorClienteId && slotFixo.ocupadoPorClienteId !== clienteId) {
      avisoAgenda =
        (avisoAgenda ? avisoAgenda + " " : "") +
        "Atenção: esse horário já consta como fixo de outro cliente — confira se não vai bater com a sessão dele.";
    } else {
      await prisma.disponibilidade.updateMany({
        where: { profissionalId, ocupadoPorClienteId: clienteId, NOT: { id: slotFixo.id } },
        data: { ocupadoPorClienteId: null, ocupadoEm: null },
      });
      await prisma.disponibilidade.update({
        where: { id: slotFixo.id },
        data: { ocupadoPorClienteId: clienteId, ocupadoEm: new Date() },
      });
    }
  }

  return { agendamentos, avisoAgenda };
}

// Fase 54/55 — cadastro de cliente COM escolha explícita de profissional, compartilhado pela
// Atendente e pelo Dono (os dois precisam escolher quem vai atender o cliente — diferente da
// Profissional, que sempre cadastra pra si mesma). A rota dela em profissional.js continua com a
// própria lógica (só passou a usar gerarAgendamentosRecorrentes acima também).
//
// Fase 55 — o cliente já ganha login na hora (continua podendo repassar o acesso pro cliente de
// imediato), mas NÃO entra direto na agenda/financeiro da profissional: fica como uma
// "SolicitacaoNovoPaciente" pendente, visível pra ela na aba "Novos pacientes". Só quando ela
// aceita (aceitarSolicitacaoNovoPaciente, abaixo) é que o pacote é criado, as sessões entram na
// Agenda e o pagamento (se informado) vira receita de verdade pra clínica/repasse dela.
async function cadastrarClienteComProfissional({
  nome,
  email,
  telefone,
  senhaProvisoria,
  profissionalAtualId,
  duracao,
  totalSessoes,
  diaSemanaFixo,
  horaFixa,
  valorTotal,
  tipo,
  imagemBase64,
  mimeType,
  observacao,
  canalOrigem,
  cadastradoPorId, // id de Atendente, opcional — fica null quando quem cadastra é o Dono
  registradoPor, // { id, nome } de quem está logado (req.user), pro histórico e avisos
}) {
  if (!nome || !nome.trim()) {
    const erro = new Error("Informe o nome do cliente.");
    erro.status = 400;
    throw erro;
  }
  if (!profissionalAtualId) {
    const erro = new Error("Escolha a profissional que vai atender esse cliente.");
    erro.status = 400;
    throw erro;
  }

  const profissional = await prisma.profissional.findUnique({
    where: { id: profissionalAtualId },
    include: { user: { select: { nome: true } } },
  });
  if (!profissional) {
    const erro = new Error("Profissional não encontrada.");
    erro.status = 400;
    throw erro;
  }

  // Fase 51 — igual canvas: login não é mais digitado à mão, é gerado sozinho a partir do nome.
  let emailFinal = email ? email.toLowerCase().trim() : null;
  if (emailFinal) {
    const existente = await prisma.user.findUnique({ where: { email: emailFinal } });
    if (existente) {
      const erro = new Error("Já existe um usuário com esse e-mail.");
      erro.status = 400;
      throw erro;
    }
  } else {
    emailFinal = await gerarEmailAutomatico(nome);
  }

  const senha = senhaProvisoria || Math.random().toString(36).slice(-8);
  const hash = await bcrypt.hash(senha, 10);

  // Fase 55 — profissionalAtualId só é preenchido no aceite: até lá o cliente existe (login já
  // funciona), mas ainda não "pertence" a nenhuma profissional de fato.
  const user = await prisma.user.create({
    data: {
      nome,
      email: emailFinal,
      telefone,
      senha: hash,
      role: "CLIENTE",
      cliente: {
        create: {
          cadastradoPorId: cadastradoPorId || null,
          whatsappCadastro: telefone || null,
          canalOrigem: canalOrigem || null,
        },
      },
    },
    include: { cliente: true },
  });
  const clienteId = user.cliente.id;

  await prisma.historicoCliente.create({
    data: {
      clienteId,
      tipo: "ENTROU",
      nomeCliente: nome,
      whatsapp: telefone || null,
      profissionalNome: profissional.user.nome,
      motivo: "Aguardando aceite da profissional.",
      realizadoPorId: registradoPor?.id || null,
    },
  });

  const solicitacao = await prisma.solicitacaoNovoPaciente.create({
    data: {
      clienteId,
      profissionalId: profissionalAtualId,
      duracao: duracao || null,
      totalSessoes: totalSessoes ? Number(totalSessoes) : null,
      diaSemanaFixo: diaSemanaFixo || null,
      horaFixa: horaFixa || null,
      valorTotal: valorTotal ? parseValorMonetario(valorTotal) : null,
      tipo: tipo || null,
      comprovanteBase64: imagemBase64 || null,
      comprovanteMimeType: imagemBase64 ? mimeType || "image/jpeg" : null,
      observacao: observacao || null,
      criadoPorNome: registradoPor?.nome || "alguém da equipe",
      criadoPorId: registradoPor?.id || null,
    },
  });

  const quemCadastrou = registradoPor?.nome || "alguém da equipe";
  await notificarDonos(
    { titulo: "Novo cliente cadastrado", mensagem: `${nome} foi cadastrado(a) por ${quemCadastrou} — aguardando ${profissional.user.nome} aceitar.`, tipo: "cliente" },
    registradoPor?.id || null
  );
  await notificarAtendentes(
    { titulo: "Novo cliente cadastrado", mensagem: `${nome} foi cadastrado(a) — aguardando ${profissional.user.nome} aceitar.`, tipo: "cliente" },
    registradoPor?.id || null
  );
  await notificar(profissional.userId, {
    titulo: "Novo paciente aguardando seu aceite!",
    mensagem: `${nome} foi cadastrado(a) por ${quemCadastrou} pra você atender. Confira em "Novos pacientes" e aceite pra confirmar na sua agenda.`,
    tipo: "cliente",
    referenciaTipo: "CLIENTE",
    referenciaId: clienteId,
  });

  return { user, cliente: user.cliente, senha, solicitacao };
}

// Fase 55 — a profissional aceita um pedido pendente: só aqui o cliente de fato passa a ser
// dela (profissionalAtualId), o pacote é criado, as sessões entram na Agenda (dia/hora fixo, se
// combinado) e o pagamento já recebido (se informado no cadastro) vira transação financeira de
// verdade, com o repasse calculado.
async function aceitarSolicitacaoNovoPaciente({ solicitacaoId, profissionalId }) {
  const solicitacao = await prisma.solicitacaoNovoPaciente.findFirst({
    where: { id: solicitacaoId, profissionalId, status: "PENDENTE" },
    include: {
      cliente: { include: { user: { select: { nome: true } } } },
      profissional: { include: { user: { select: { nome: true } } } },
    },
  });
  if (!solicitacao) {
    const erro = new Error("Esse pedido não existe mais ou já foi respondido.");
    erro.status = 404;
    throw erro;
  }

  const clienteId = solicitacao.clienteId;
  const nome = solicitacao.cliente.user.nome;
  const nomeProfissional = solicitacao.profissional.user.nome;

  await prisma.cliente.update({ where: { id: clienteId }, data: { profissionalAtualId: profissionalId } });

  let pacote = null;
  if (solicitacao.duracao && solicitacao.totalSessoes) {
    const valorReferencia = valorDoPlano(solicitacao.duracao, solicitacao.totalSessoes) || 0;
    pacote = await prisma.pacote.create({
      data: {
        clienteId,
        profissionalId,
        duracao: solicitacao.duracao,
        totalSessoes: solicitacao.totalSessoes,
        sessoesUsadas: 0,
        valorTotal: valorReferencia,
        status: "ATIVO",
      },
    });
  }

  let agendamentos = [];
  let avisoAgenda = null;
  if (solicitacao.diaSemanaFixo && solicitacao.horaFixa) {
    const resultado = await gerarAgendamentosRecorrentes({
      profissionalId,
      clienteId,
      pacoteId: pacote?.id || null,
      diaSemanaFixo: solicitacao.diaSemanaFixo,
      horaFixa: solicitacao.horaFixa,
      duracao: solicitacao.duracao,
      totalSessoes: solicitacao.totalSessoes || 1,
    });
    agendamentos = resultado.agendamentos;
    avisoAgenda = resultado.avisoAgenda;
  }

  let transacao = null;
  let avisoFinanceiro = null;
  const valorFinal = solicitacao.valorTotal || null;
  if (valorFinal) {
    if (!pacote) {
      pacote = await prisma.pacote.create({
        data: {
          clienteId,
          profissionalId,
          duracao: solicitacao.duracao || "MIN50",
          totalSessoes: solicitacao.totalSessoes || 1,
          sessoesUsadas: 0,
          valorTotal: valorFinal,
          status: "ATIVO",
        },
      });
    } else if (pacote.valorTotal !== valorFinal) {
      pacote = await prisma.pacote.update({ where: { id: pacote.id }, data: { valorTotal: valorFinal } });
    }

    const duplicada = await transacaoDuplicada(prisma, clienteId, valorFinal);
    if (duplicada) {
      avisoFinanceiro =
        "Já existe um pagamento desse mesmo valor pra esse cliente registrado hoje — não lancei de novo pra não duplicar o repasse.";
    } else {
      const { valorProfissional, valorRenascer } = calcularRepasse(valorFinal, solicitacao.profissional.percentualRepasse);
      transacao = await prisma.transacaoFinanceira.create({
        data: {
          profissionalId,
          clienteId,
          tipo: solicitacao.tipo || "PACOTE_NOVO",
          valorTotal: valorFinal,
          valorProfissional,
          valorRenascer,
          recebidoPor: "PROFISSIONAL",
          origem: "ATENDENTE",
          comprovanteBase64: solicitacao.comprovanteBase64 || null,
          comprovanteMimeType: solicitacao.comprovanteMimeType || null,
          observacao: solicitacao.observacao || null,
        },
      });

      await notificarDonos({
        titulo: "Tem dinheiro na área!",
        mensagem: `${nomeProfissional} aceitou ${nome} e confirmou o pagamento de R$ ${valorFinal.toFixed(2)} — repasse esperado: R$ ${valorRenascer.toFixed(2)}.`,
        tipo: "financeiro",
      });
    }
  }

  await prisma.solicitacaoNovoPaciente.update({
    where: { id: solicitacaoId },
    data: { status: "ACEITA", respondidoEm: new Date() },
  });

  await prisma.historicoCliente.create({
    data: {
      clienteId,
      tipo: "TROCOU_PROFISSIONAL",
      nomeCliente: nome,
      profissionalNome: nomeProfissional,
      motivo: `Aceito(a) por ${nomeProfissional} — passou a ser paciente dela.`,
      realizadoPorId: null,
    },
  });

  await notificarDonos({
    titulo: "Paciente aceito",
    mensagem: `${nomeProfissional} aceitou ${nome} como paciente — já confirmado na agenda dela.`,
    tipo: "cliente",
  });
  await notificarAtendentes({
    titulo: "Paciente aceito",
    mensagem: `${nomeProfissional} aceitou ${nome} como paciente — já confirmado na agenda dela.`,
    tipo: "cliente",
  });

  return { cliente: solicitacao.cliente, pacote, agendamentos, avisoAgenda, transacao, avisoFinanceiro };
}

module.exports = {
  cadastrarClienteComProfissional,
  aceitarSolicitacaoNovoPaciente,
  gerarAgendamentosRecorrentes,
  DIAS_SEMANA_JS,
};
