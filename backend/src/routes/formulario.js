// Formulários (pesquisas com link público): o Dono cria um formulário com perguntas, o sistema
// gera um link único, e qualquer pessoa que receber o link responde sem precisar ter login no
// sistema — nome, e-mail e as respostas. As rotas públicas (ver/responder pelo link) ficam ANTES
// do `router.use(autenticar, permitir("DONO"))`, igual ao padrão já usado em `ia.js` pro cadastro
// público da Renascer IA; tudo que vem depois dessa linha só o Dono acessa.

const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");

const router = express.Router();

function serializarPerguntas(perguntas) {
  return perguntas
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => ({
      id: p.id,
      texto: p.texto,
      tipo: p.tipo,
      obrigatoria: p.obrigatoria,
      opcoes:
        p.tipo === "MULTIPLA_ESCOLHA" && p.opcoes
          ? p.opcoes.split("|").map((o) => o.trim()).filter(Boolean)
          : p.tipo === "ESCALA" && p.opcoes
          ? (() => {
              const [min, max] = p.opcoes.split("-").map((n) => Number(n.trim()));
              return { min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 10 };
            })()
          : null,
    }));
}

// ---------------- PÚBLICO (sem login) ----------------

// Busca a estrutura do formulário pelo link, pra desenhar a tela de preenchimento.
router.get("/publico/:token", async (req, res) => {
  const formulario = await prisma.formulario.findUnique({
    where: { linkToken: req.params.token },
    include: { perguntas: true },
  });
  if (!formulario || !formulario.ativo) {
    return res.status(404).json({ erro: "Este formulário não está disponível no momento." });
  }
  res.json({
    titulo: formulario.titulo,
    descricao: formulario.descricao,
    perguntas: serializarPerguntas(formulario.perguntas),
  });
});

// Envia as respostas. Corpo esperado: { nome, email, respostas: [{ perguntaId, texto }] }.
router.post("/publico/:token/responder", async (req, res) => {
  const { nome, email, respostas } = req.body;

  const formulario = await prisma.formulario.findUnique({
    where: { linkToken: req.params.token },
    include: { perguntas: true },
  });
  if (!formulario || !formulario.ativo) {
    return res.status(404).json({ erro: "Este formulário não está disponível no momento." });
  }

  if (!nome?.trim() || !email?.trim()) {
    return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
  }
  if (!Array.isArray(respostas)) {
    return res.status(400).json({ erro: "Respostas inválidas." });
  }

  const porId = new Map(respostas.map((r) => [r.perguntaId, (r.texto || "").toString().trim()]));
  for (const pergunta of formulario.perguntas) {
    if (pergunta.obrigatoria && !porId.get(pergunta.id)) {
      return res.status(400).json({ erro: `Falta responder: "${pergunta.texto}"` });
    }
  }

  await prisma.respostaFormulario.create({
    data: {
      formularioId: formulario.id,
      nomeRespondente: nome.trim(),
      emailRespondente: email.trim(),
      respostasJson: JSON.stringify(
        formulario.perguntas.map((p) => ({
          perguntaId: p.id,
          pergunta: p.texto,
          resposta: porId.get(p.id) || "",
        }))
      ),
    },
  });

  res.json({ ok: true });
});

// ---------------- SÓ O DONO (criar formulários, ver respostas) ----------------
router.use(autenticar, permitir("DONO"));

router.get("/", async (req, res) => {
  const formularios = await prisma.formulario.findMany({
    orderBy: { criadoEm: "desc" },
    include: { _count: { select: { respostas: true } } },
  });
  res.json(
    formularios.map((f) => ({
      id: f.id,
      titulo: f.titulo,
      descricao: f.descricao,
      ativo: f.ativo,
      linkToken: f.linkToken,
      criadoEm: f.criadoEm,
      totalRespostas: f._count.respostas,
    }))
  );
});

router.post("/", async (req, res) => {
  const { titulo, descricao, perguntas } = req.body;
  if (!titulo?.trim()) return res.status(400).json({ erro: "O formulário precisa de um título." });
  if (!Array.isArray(perguntas) || perguntas.length === 0) {
    return res.status(400).json({ erro: "Adicione pelo menos uma pergunta." });
  }
  for (const p of perguntas) {
    if (!p.texto?.trim()) return res.status(400).json({ erro: "Toda pergunta precisa de um texto." });
    if (!["TEXTO_CURTO", "TEXTO_LONGO", "MULTIPLA_ESCOLHA", "ESCALA"].includes(p.tipo)) {
      return res.status(400).json({ erro: `Tipo de pergunta inválido: "${p.tipo}".` });
    }
  }

  const formulario = await prisma.formulario.create({
    data: {
      titulo: titulo.trim(),
      descricao: descricao?.trim() || null,
      criadoPorId: req.user.id,
      perguntas: {
        create: perguntas.map((p, i) => ({
          ordem: i,
          texto: p.texto.trim(),
          tipo: p.tipo,
          obrigatoria: p.obrigatoria !== false,
          opcoes: p.opcoes || null,
        })),
      },
    },
    include: { perguntas: true },
  });

  res.status(201).json(formulario);
});

router.get("/:id", async (req, res) => {
  const formulario = await prisma.formulario.findUnique({
    where: { id: req.params.id },
    include: { perguntas: { orderBy: { ordem: "asc" } } },
  });
  if (!formulario) return res.status(404).json({ erro: "Formulário não encontrado." });
  res.json(formulario);
});

// Substitui título/descrição/status e a lista inteira de perguntas (apaga as antigas e cria as
// novas, numa transação) — mais simples e seguro do que tentar casar pergunta por pergunta numa
// edição, e as respostas já recebidas não são afetadas (ficam com o texto da pergunta de quando
// foram enviadas, guardado dentro de `respostasJson`).
router.put("/:id", async (req, res) => {
  const { titulo, descricao, ativo, perguntas } = req.body;
  const existente = await prisma.formulario.findUnique({ where: { id: req.params.id } });
  if (!existente) return res.status(404).json({ erro: "Formulário não encontrado." });

  const dados = {};
  if (titulo !== undefined) {
    if (!titulo.trim()) return res.status(400).json({ erro: "O formulário precisa de um título." });
    dados.titulo = titulo.trim();
  }
  if (descricao !== undefined) dados.descricao = descricao?.trim() || null;
  if (ativo !== undefined) dados.ativo = Boolean(ativo);

  await prisma.$transaction(async (tx) => {
    if (Array.isArray(perguntas)) {
      await tx.perguntaFormulario.deleteMany({ where: { formularioId: req.params.id } });
      dados.perguntas = {
        create: perguntas.map((p, i) => ({
          ordem: i,
          texto: p.texto.trim(),
          tipo: p.tipo,
          obrigatoria: p.obrigatoria !== false,
          opcoes: p.opcoes || null,
        })),
      };
    }
    await tx.formulario.update({ where: { id: req.params.id }, data: dados });
  });

  const atualizado = await prisma.formulario.findUnique({
    where: { id: req.params.id },
    include: { perguntas: { orderBy: { ordem: "asc" } } },
  });
  res.json(atualizado);
});

router.delete("/:id", async (req, res) => {
  const existente = await prisma.formulario.findUnique({ where: { id: req.params.id } });
  if (!existente) return res.status(404).json({ erro: "Formulário não encontrado." });
  await prisma.formulario.delete({ where: { id: req.params.id } }); // cascata apaga perguntas e respostas
  res.json({ ok: true });
});

router.get("/:id/respostas", async (req, res) => {
  const formulario = await prisma.formulario.findUnique({ where: { id: req.params.id } });
  if (!formulario) return res.status(404).json({ erro: "Formulário não encontrado." });

  const respostas = await prisma.respostaFormulario.findMany({
    where: { formularioId: req.params.id },
    orderBy: { enviadoEm: "desc" },
  });

  res.json(
    respostas.map((r) => ({
      id: r.id,
      nome: r.nomeRespondente,
      email: r.emailRespondente,
      enviadoEm: r.enviadoEm,
      respostas: JSON.parse(r.respostasJson),
    }))
  );
});

module.exports = router;
