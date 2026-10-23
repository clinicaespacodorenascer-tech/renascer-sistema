const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { valorDoPlano, calcularRepasse, transacaoDuplicada, parseValorMonetario } = require("./financeiro");
const { notificar, notificarDonos, notificarAtendentes } = require("./notificar");
const { gerarEmailAutomatico } = require("./gerarLogin");

const DIAS_SEMANA_JS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];

// Fase 54 — cadastro de cliente COM escolha explícita de profissional, compartilhado pela
// Atendente e pelo Dono (os dois precisam escolher quem vai atender o cliente — diferente da
// Profissional, que sempre cadastra pra si mesma). A rota dela em profissional.js continua
// com a própria lógica, intocada, pra não arriscar nenhuma regressão no fluxo que já funciona.
//
// Junta num só lugar: login automático (Fase 51), pacote de sessões + dia/hora fixo com
// agendamento automático na Agenda (igual ao canvas da Profissional) e, opcionalmente, já
// lançar o pagamento recebido (igual o cadastro atual da Atendente).
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
  origemTransacao, // "ATENDENTE" | "PROFISSIONAL" — enum existente do banco, sem DONO próprio
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

  const user = await prisma.user.create({
    data: {
      nome,
      email: emailFinal,
      telefone,
      senha: hash,
      role: "CLIENTE",
      cliente: {
        create: {
          profissionalAtualId,
          cadastradoPorId: cadastradoPorId || null,
          whatsappCadastro: telefone || null,
          canalOrigem: canalOrigem || null,
        },
      },
    },
    include: { cliente: true },
  });
  const clienteId = user.cliente.id;

  // Fica registrado pra sempre no histórico do cliente quem cadastrou e quando — é isso que
  // garante que o login gerado automaticamente "fica registrado pro nosso sistema".
  await prisma.historicoCliente.create({
    data: {
      clienteId,
      tipo: "ENTROU",
      nomeCliente: nome,
      whatsapp: telefone || null,
      profissionalNome: profissional.user.nome,
      realizadoPorId: registradoPor?.id || null,
    },
  });

  const quemCadastrou = registradoPor?.nome || "alguém da equipe";
  await notificarDonos(
    { titulo: "Novo cliente cadastrado", mensagem: `${nome} foi cadastrado(a) por ${quemCadastrou}.`, tipo: "cliente" },
    registradoPor?.id || null
  );
  await notificarAtendentes(
    { titulo: "Novo cliente cadastrado", mensagem: `${nome} foi cadastrado(a).`, tipo: "cliente" },
    registradoPor?.id || null
  );
  await notificar(profissional.userId, {
    titulo: "Novo cliente pra você!",
    mensagem: `${nome} foi vinculado(a) a você por ${quemCadastrou}.`,
    tipo: "cliente",
  });

  // ---- Pacote de sessões + dia/hora fixo (igual canvas da Profissional) ----
  let pacote = null;
  let agendamento = null;
  let avisoAgenda = null;

  if (duracao && totalSessoes) {
    const total = Number(totalSessoes);
    const valorReferencia = valorDoPlano(duracao, total) || 0;
    pacote = await prisma.pacote.create({
      data: {
        clienteId,
        profissionalId: profissionalAtualId,
        duracao,
        totalSessoes: total,
        sessoesUsadas: 0,
        valorTotal: valorReferencia,
        status: "ATIVO",
      },
    });
  }

  if (diaSemanaFixo && horaFixa) {
    const indiceAlvo = DIAS_SEMANA_JS.indexOf(diaSemanaFixo);
    const hoje = new Date();
    const diffDias = (indiceAlvo - hoje.getDay() + 7) % 7;
    const dataSessao = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + diffDias);

    const conflito = await prisma.agendamento.findFirst({
      where: { profissionalId: profissionalAtualId, data: dataSessao, horaInicio: horaFixa, status: { in: ["AGENDADO", "CONFIRMADO"] } },
    });

    if (conflito) {
      avisoAgenda =
        "Já existe outra sessão marcada nesse mesmo dia e horário — não criei a sessão fixa automaticamente. Adicione manualmente na Agenda.";
    } else {
      agendamento = await prisma.agendamento.create({
        data: {
          profissionalId: profissionalAtualId,
          clienteId,
          pacoteId: pacote?.id || null,
          data: dataSessao,
          diaSemana: diaSemanaFixo,
          horaInicio: horaFixa,
          duracao: duracao || "MIN50",
        },
      });

      const slotFixo = await prisma.disponibilidade.findFirst({
        where: { profissionalId: profissionalAtualId, diaSemana: diaSemanaFixo, horaInicio: horaFixa, ativo: true },
      });
      if (slotFixo) {
        if (slotFixo.ocupadoPorClienteId && slotFixo.ocupadoPorClienteId !== clienteId) {
          avisoAgenda =
            (avisoAgenda ? avisoAgenda + " " : "") +
            "Atenção: esse horário já consta como fixo de outro cliente — confira se não vai bater com a sessão dele.";
        } else {
          await prisma.disponibilidade.updateMany({
            where: { profissionalId: profissionalAtualId, ocupadoPorClienteId: clienteId, NOT: { id: slotFixo.id } },
            data: { ocupadoPorClienteId: null, ocupadoEm: null },
          });
          await prisma.disponibilidade.update({
            where: { id: slotFixo.id },
            data: { ocupadoPorClienteId: clienteId, ocupadoEm: new Date() },
          });
        }
      }
    }
  }

  // ---- Pagamento já recebido (opcional, igual cadastro atual da Atendente) ----
  let transacao = null;
  let avisoFinanceiro = null;
  const valorFinal = valorTotal ? parseValorMonetario(valorTotal) : null;

  if (valorFinal) {
    if (!pacote) {
      pacote = await prisma.pacote.create({
        data: {
          clienteId,
          profissionalId: profissionalAtualId,
          duracao: duracao || "MIN50",
          totalSessoes: totalSessoes ? Number(totalSessoes) : 1,
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
      const { valorProfissional, valorRenascer } = calcularRepasse(valorFinal, profissional.percentualRepasse);
      transacao = await prisma.transacaoFinanceira.create({
        data: {
          profissionalId: profissionalAtualId,
          clienteId,
          tipo: tipo || "PACOTE_NOVO",
          valorTotal: valorFinal,
          valorProfissional,
          valorRenascer,
          recebidoPor: "PROFISSIONAL",
          origem: origemTransacao || "ATENDENTE",
          comprovanteBase64: imagemBase64 || null,
          comprovanteMimeType: imagemBase64 ? mimeType || "image/jpeg" : null,
          observacao: observacao || null,
        },
      });

      await notificar(profissional.userId, {
        titulo: "Lembrete de repasse",
        mensagem: `Pagamento de ${nome} registrado — você recebe direto e precisa repassar R$ ${valorRenascer.toFixed(2)} pra Renascer (anexe o comprovante na aba Financeiro assim que repassar).`,
        tipo: "financeiro",
      });
      await notificarDonos(
        {
          titulo: "Tem dinheiro na área!",
          mensagem: `Pagamento de R$ ${valorFinal.toFixed(2)} de ${nome} registrado por ${quemCadastrou} — repasse esperado da profissional: R$ ${valorRenascer.toFixed(2)}.`,
          tipo: "financeiro",
        },
        registradoPor?.id || null
      );
    }
  }

  return { user, cliente: user.cliente, senha, pacote, transacao, avisoFinanceiro, agendamento, avisoAgenda };
}

module.exports = { cadastrarClienteComProfissional, DIAS_SEMANA_JS };
