const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const senhaPadrao = await bcrypt.hash("Renascer@2026", 10);

  // ---------- Donos (2) ----------
  const dono1 = await prisma.user.upsert({
    where: { email: "dono1@espacodorenascer.com" },
    update: {},
    create: {
      nome: "Dono 1",
      email: "dono1@espacodorenascer.com",
      senha: senhaPadrao,
      role: "DONO",
      dono: { create: {} },
    },
  });

  const dono2 = await prisma.user.upsert({
    where: { email: "dono2@espacodorenascer.com" },
    update: {},
    create: {
      nome: "Dono 2",
      email: "dono2@espacodorenascer.com",
      senha: senhaPadrao,
      role: "DONO",
      dono: { create: {} },
    },
  });

  // ---------- Atendente ----------
  const atendente = await prisma.user.upsert({
    where: { email: "atendente@espacodorenascer.com" },
    update: {},
    create: {
      nome: "Atendente",
      email: "atendente@espacodorenascer.com",
      senha: senhaPadrao,
      role: "ATENDENTE",
      atendente: { create: {} },
    },
  });

  // ---------- Profissional de teste ----------
  const profUser = await prisma.user.upsert({
    where: { email: "profissional.teste@espacodorenascer.com" },
    update: {},
    create: {
      nome: "Profissional Teste",
      email: "profissional.teste@espacodorenascer.com",
      senha: senhaPadrao,
      role: "PROFISSIONAL",
      profissional: {
        create: {
          titulo: "Psicóloga Clínica",
          registro: "CRP 00/00000 (exemplo)",
          bio: "Perfil de teste criado pelo seed para validar o sistema.",
          idade: 32,
          especialidades: ["Ansiedade", "Relacionamentos", "Autoestima"],
          abordagens: "TCC",
          percentualRepasse: 50,
          disponibilidades: {
            create: [
              { diaSemana: "SEGUNDA", horaInicio: "14:00", horaFim: "18:00" },
              { diaSemana: "QUARTA", horaInicio: "14:00", horaFim: "18:00" },
              { diaSemana: "SEXTA", horaInicio: "08:00", horaFim: "12:00" },
            ],
          },
        },
      },
    },
    include: { profissional: true },
  });

  // ---------- Cliente de teste ----------
  const clienteUser = await prisma.user.upsert({
    where: { email: "cliente.teste@espacodorenascer.com" },
    update: {},
    create: {
      nome: "Cliente Teste",
      email: "cliente.teste@espacodorenascer.com",
      senha: senhaPadrao,
      role: "CLIENTE",
      cliente: {
        create: {
          profissionalAtualId: profUser.profissional.id,
        },
      },
    },
    include: { cliente: true },
  });

  // ---------- Biblioteca de tarefas de apoio (item 17) ----------
  const tarefas = [
    { tema: "ANSIEDADE", titulo: "Respiração 4-7-8", descricao: "Inspire contando até 4, segure contando até 7, solte contando até 8. Repita 4 vezes sempre que sentir a ansiedade subir." },
    { tema: "ANSIEDADE", titulo: "Diário de preocupações", descricao: "Reserve 10 minutos do dia para escrever tudo que está te preocupando. Fora desse horário, quando uma preocupação surgir, anote e guarde para o momento reservado." },
    { tema: "DEPRESSAO", titulo: "Uma pequena vitória por dia", descricao: "Escolha uma tarefa bem pequena e alcançável para fazer hoje (tomar banho, arrumar a cama, sair de casa 5 minutos) e anote como se sentiu depois." },
    { tema: "RELACIONAMENTOS", titulo: "Comunicação não-violenta", descricao: "Na próxima conversa difícil, tente descrever o fato, o sentimento que ele te causou e o que você precisa, sem julgar a outra pessoa." },
    { tema: "AUTOESTIMA", titulo: "Lista de conquistas", descricao: "Escreva 3 coisas que você fez bem essa semana, por menores que pareçam." },
    { tema: "SONO", titulo: "Ritual antes de dormir", descricao: "Trinta minutos antes de dormir, desligue telas e faça algo calmo (leitura, alongamento, respiração)." },
  ];
  for (const t of tarefas) {
    await prisma.tarefa.upsert({
      where: { id: `seed-${t.titulo.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: { id: `seed-${t.titulo.toLowerCase().replace(/\s+/g, "-")}`, ...t, publica: true },
    });
  }

  console.log("Seed concluído.");
  console.log("Login padrão de todos os usuários de teste: senha 'Renascer@2026'");
  console.log({
    dono1: dono1.email,
    dono2: dono2.email,
    atendente: atendente.email,
    profissional: profUser.email,
    cliente: clienteUser.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
