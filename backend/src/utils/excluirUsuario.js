const prisma = require("../lib/prisma");

// Exclusão de logins, respeitando a hierarquia:
// - Atendente só pode excluir CLIENTES (ver rota DELETE /atendente/clientes/:id)
// - Dono pode excluir qualquer login (cliente, profissional, atendente ou outro dono)
// Cada função apaga primeiro tudo que está ligado àquele registro (mensagens, agendamentos,
// pacotes etc.) e só depois apaga o próprio login, pra não travar por causa de dados presos.

async function excluirCliente(clienteId) {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) throw new Error("Cliente não encontrado.");

  await prisma.$transaction([
    prisma.mensagem.deleteMany({ where: { ticket: { clienteId } } }),
    prisma.ticketSuporte.deleteMany({ where: { clienteId } }),
    prisma.mensagemInterna.deleteMany({ where: { clienteId } }),
    prisma.recadoDiario.deleteMany({ where: { clienteId } }),
    prisma.checkinDiario.deleteMany({ where: { clienteId } }),
    prisma.tarefaCliente.deleteMany({ where: { clienteId } }),
    prisma.relatorioCliente.deleteMany({ where: { clienteId } }),
    prisma.transacaoFinanceira.deleteMany({ where: { clienteId } }),
    prisma.agendamento.deleteMany({ where: { clienteId } }),
    prisma.user.delete({ where: { id: cliente.userId } }), // cascateia Cliente, Pacotes e Contrato
  ]);
}

async function excluirProfissional(profissionalId) {
  const profissional = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  if (!profissional) throw new Error("Profissional não encontrada.");

  await prisma.$transaction([
    prisma.cliente.updateMany({ where: { profissionalAtualId: profissionalId }, data: { profissionalAtualId: null } }),
    prisma.tarefa.updateMany({ where: { criadaPorId: profissionalId }, data: { criadaPorId: null } }),
    prisma.mensagemInterna.deleteMany({ where: { profissionalId } }),
    prisma.relatorioCliente.deleteMany({ where: { profissionalId } }),
    prisma.transacaoFinanceira.deleteMany({ where: { profissionalId } }),
    prisma.agendamento.deleteMany({ where: { profissionalId } }),
    prisma.user.delete({ where: { id: profissional.userId } }), // cascateia Profissional e Disponibilidades
  ]);
}

async function excluirAtendente(atendenteId) {
  const atendente = await prisma.atendente.findUnique({ where: { id: atendenteId } });
  if (!atendente) throw new Error("Atendente não encontrada.");

  await prisma.$transaction([
    prisma.cliente.updateMany({ where: { cadastradoPorId: atendenteId }, data: { cadastradoPorId: null } }),
    prisma.user.delete({ where: { id: atendente.userId } }),
  ]);
}

async function excluirDono(donoId) {
  const totalDonos = await prisma.dono.count();
  if (totalDonos <= 1) {
    throw new Error("Não é possível excluir o último login de dono do sistema.");
  }
  const dono = await prisma.dono.findUnique({ where: { id: donoId } });
  if (!dono) throw new Error("Dono não encontrado.");
  await prisma.user.delete({ where: { id: dono.userId } });
}

async function excluirUsuarioPorId(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { cliente: true, profissional: true, atendente: true, dono: true },
  });
  if (!user) throw new Error("Usuário não encontrado.");

  if (user.role === "CLIENTE" && user.cliente) return excluirCliente(user.cliente.id);
  if (user.role === "PROFISSIONAL" && user.profissional) return excluirProfissional(user.profissional.id);
  if (user.role === "ATENDENTE" && user.atendente) return excluirAtendente(user.atendente.id);
  if (user.role === "DONO" && user.dono) return excluirDono(user.dono.id);
  throw new Error("Papel de usuário desconhecido.");
}

module.exports = { excluirUsuarioPorId, excluirCliente, excluirProfissional, excluirAtendente, excluirDono };
