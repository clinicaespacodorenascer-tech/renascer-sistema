const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../lib/prisma");
const { diaSemanaDeData, horariosLivres } = require("../utils/horarios");
const { hojeBrasil } = require("../utils/meuDia");

// Fase 62 — rotas públicas (sem login) usadas pelo site institucional em /site. Pensadas pra
// expor só o estritamente necessário pra alguém de fora marcar um horário: a disponibilidade
// real de uma profissional específica, já vinculada ao card dela no site (ver
// Profissional.slugSitePublico) — nunca dados de clientes, de outras profissionais, ou de
// qualquer outra parte do sistema.
const router = express.Router();

// Freio próprio (mais folgado que o de formulário, já que aqui qualquer um navegando pelo site
// pode disparar várias consultas rápidas ao trocar de profissional/duração no popup).
const freioSitePublico = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(freioSitePublico);

const DIAS_A_FRENTE = 7;

// Horários realmente livres de uma profissional vinculada ao site público, pros próximos 7
// dias — mesma lógica (horariosLivres) já usada no painel interno pra atendente/profissional
// marcarem sessão, só que sem exigir login e sem devolver nenhum dado de cliente (nunca quem
// ocupa um horário — só se está livre ou não).
router.get("/site/horarios/:slug", async (req, res) => {
  const duracao = req.query.duracao === "MIN30" ? "MIN30" : "MIN50";

  const profissional = await prisma.profissional.findFirst({
    where: { slugSitePublico: req.params.slug, user: { ativo: true } },
    select: { id: true, titulo: true, user: { select: { nome: true } } },
  });
  if (!profissional) return res.status(404).json({ erro: "Profissional não encontrada." });

  // "Agora" em horário de Brasília (mesmo cálculo de hojeBrasil/meuDia.js) — usado só pra não
  // oferecer, no dia de hoje, um horário que já passou.
  const agoraBrasil = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const agoraHHmm = `${String(agoraBrasil.getUTCHours()).padStart(2, "0")}:${String(agoraBrasil.getUTCMinutes()).padStart(2, "0")}`;

  const hoje = hojeBrasil();
  const dias = [];
  for (let i = 0; i < DIAS_A_FRENTE; i++) {
    const dataDia = new Date(hoje.getTime() + i * 24 * 60 * 60 * 1000);
    const dataISO = dataDia.toISOString().slice(0, 10);
    const diaSemana = diaSemanaDeData(dataISO);

    const [disponibilidadesDoDia, agendamentosDoDia] = await Promise.all([
      prisma.disponibilidade.findMany({
        where: { profissionalId: profissional.id, diaSemana, ativo: true, ocupadoPorClienteId: null },
      }),
      prisma.agendamento.findMany({
        where: {
          profissionalId: profissional.id,
          status: { in: ["AGENDADO", "CONFIRMADO", "REALIZADO"] },
          data: { gte: new Date(`${dataISO}T00:00:00`), lt: new Date(`${dataISO}T23:59:59`) },
        },
        select: { horaInicio: true, duracao: true },
      }),
    ]);

    let livres = horariosLivres({ disponibilidadesDoDia, agendamentosDoDia, duracao });
    if (i === 0) livres = livres.filter((h) => h > agoraHHmm);

    if (livres.length > 0) dias.push({ data: dataISO, diaSemana, horarios: livres });
  }

  res.json({ profissional: { nome: profissional.user.nome, titulo: profissional.titulo }, duracao, dias });
});

module.exports = router;
