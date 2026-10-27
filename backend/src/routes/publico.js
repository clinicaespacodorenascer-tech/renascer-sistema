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

// ======================================================================================
// Fase 75 — perfis dos profissionais no site público, agora vindos do banco (ver
// PerfilSiteProfissional em schema.prisma e as rotas de edição em dono.js) em vez do objeto
// PROFISSIONAIS fixo que existia em frontend/public/site-assets/app.js. Só devolve quem está
// com ativo=true (visível no site) e com o login ainda ativo — nunca quem está pausada/removida.
// ======================================================================================

const CAMPOS_PUBLICOS_PERFIL_SITE = {
  nomeExibicao: true,
  cargoExibicao: true,
  registro: true,
  genero: true,
  bioParagrafos: true,
  tags: true,
  quote: true,
  testemunhos: true,
  fotoBase64: true,
  ordem: true,
};

function formatarPerfilPublico(perfil) {
  return {
    slug: perfil.profissional.slugSitePublico,
    nome: perfil.nomeExibicao,
    cargo: perfil.cargoExibicao,
    registro: perfil.registro,
    genero: perfil.genero,
    bio: perfil.bioParagrafos,
    tags: perfil.tags,
    quote: perfil.quote,
    testemunhos: perfil.testemunhos,
    foto: perfil.fotoBase64,
  };
}

router.get("/site/profissionais", async (req, res) => {
  const perfis = await prisma.perfilSiteProfissional.findMany({
    where: { ativo: true, profissional: { slugSitePublico: { not: null }, user: { ativo: true } } },
    select: { ...CAMPOS_PUBLICOS_PERFIL_SITE, profissional: { select: { slugSitePublico: true } } },
    orderBy: { ordem: "asc" },
  });
  res.json(perfis.map(formatarPerfilPublico));
});

router.get("/site/profissionais/:slug", async (req, res) => {
  const perfil = await prisma.perfilSiteProfissional.findFirst({
    where: { ativo: true, profissional: { slugSitePublico: req.params.slug, user: { ativo: true } } },
    select: { ...CAMPOS_PUBLICOS_PERFIL_SITE, profissional: { select: { slugSitePublico: true } } },
  });
  if (!perfil) return res.status(404).json({ erro: "Perfil não encontrado." });
  res.json(formatarPerfilPublico(perfil));
});

module.exports = router;
