const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");

const router = express.Router();

// Fase 32 — Mapas mentais: ferramenta de planejamento pessoal do Dono (estratégias, tarefas,
// ideias pro futuro), em formato de mapa mental com nós arrastáveis. Cada mapa é só do Dono que
// criou (tudo filtrado por donoId) — por enquanto não aparece pra nenhum outro papel de login.
router.use(autenticar, permitir("DONO"));

const CORES_MAPA = ["#0B5FA8", "#1C7C54", "#D6883B", "#9C6B2E", "#2563EB"];

// Fase 56 — mapa mental virou "radial": o nó novo pode nascer em qualquer uma das 4 direções a
// partir do pai (antes só nascia "pra direita"). Esses valores espelham as constantes do desenho
// no frontend (LARGURA_NO_MAPA/LARGURA_RAIZ_MAPA/ALTURA_NO_MAPA em dono/index.js) — se mudar lá,
// mudar aqui também, senão os nós novos nascem meio encostados/afastados demais do pai.
const LARGURA_NO = 170;
const LARGURA_RAIZ = 190;
const ALTURA_NO = 54;
const GAP_RAMO = 60;

// Descobre em que "lado" do pai um filho já existente está, só olhando x/y — usado pra empilhar
// corretamente os novos nós do mesmo lado (sem isso, um novo nó "pra baixo" podia nascer em cima
// de um nó "pra direita" já existente). Eixo que tiver a maior diferença decide o lado.
function direcaoDoFilho(filho, pai) {
  const dx = filho.x - pai.x;
  const dy = filho.y - pai.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "direita" : "esquerda";
  return dy >= 0 ? "baixo" : "cima";
}

function donoIdDoLogin(req) {
  return req.user?.dono?.id || null;
}

async function carregarMapaDoDono(mapaId, donoId) {
  const mapa = await prisma.mapaMental.findUnique({ where: { id: mapaId } });
  if (!mapa || mapa.donoId !== donoId) return null;
  return mapa;
}

// GET /mapas-mentais — lista os mapas do Dono logado (só o resumo, sem os nós)
router.get("/", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  if (!donoId) return res.status(403).json({ erro: "Login sem cadastro de Dono vinculado." });

  const mapas = await prisma.mapaMental.findMany({
    where: { donoId },
    orderBy: { criadoEm: "asc" },
  });

  res.json(
    mapas.map((m) => ({
      id: m.id,
      nome: m.nome,
      cor: m.cor,
      totalNos: Array.isArray(m.nodes) ? m.nodes.length : 0,
    }))
  );
});

// GET /mapas-mentais/:id — um mapa específico, com todos os nós
router.get("/:id", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  const mapa = await carregarMapaDoDono(req.params.id, donoId);
  if (!mapa) return res.status(404).json({ erro: "Mapa não encontrado." });
  res.json({ id: mapa.id, nome: mapa.nome, cor: mapa.cor, nodes: mapa.nodes });
});

// POST /mapas-mentais — cria um novo mapa, já com o nó raiz (o nome do mapa)
router.post("/", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  if (!donoId) return res.status(403).json({ erro: "Login sem cadastro de Dono vinculado." });

  const nome = (req.body?.nome || "").trim();
  if (!nome) return res.status(400).json({ erro: "Dê um nome pro mapa." });

  const totalMapas = await prisma.mapaMental.count({ where: { donoId } });
  const cor = CORES_MAPA[totalMapas % CORES_MAPA.length];
  const nodes = [{ id: "raiz", texto: nome, x: 40, y: 230, parentId: null }];

  const mapa = await prisma.mapaMental.create({ data: { nome, cor, nodes, donoId } });

  res.status(201).json({ id: mapa.id, nome: mapa.nome, cor: mapa.cor, nodes: mapa.nodes });
});

// DELETE /mapas-mentais/:id — apaga o mapa inteiro (todos os nós junto)
router.delete("/:id", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  const mapa = await carregarMapaDoDono(req.params.id, donoId);
  if (!mapa) return res.status(404).json({ erro: "Mapa não encontrado." });

  await prisma.mapaMental.delete({ where: { id: mapa.id } });
  res.json({ ok: true });
});

// POST /mapas-mentais/:id/nos — adiciona um nó filho a um nó existente do mapa
router.post("/:id/nos", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  const mapa = await carregarMapaDoDono(req.params.id, donoId);
  if (!mapa) return res.status(404).json({ erro: "Mapa não encontrado." });

  const { parentId, direcao: direcaoPedida } = req.body || {};
  const nodes = Array.isArray(mapa.nodes) ? mapa.nodes : [];
  const pai = nodes.find((n) => n.id === parentId);
  if (!pai) return res.status(404).json({ erro: "Nó pai não encontrado." });

  const direcao = ["direita", "esquerda", "cima", "baixo"].includes(direcaoPedida) ? direcaoPedida : "direita";
  const larguraPai = pai.parentId ? LARGURA_NO : LARGURA_RAIZ;

  // Só conta os irmãos que já estão do MESMO lado pedido, pra empilhar certinho sem bater em cima
  // de um ramo que já existe de outra direção.
  const filhosMesmoLado = nodes.filter((n) => n.parentId === parentId && direcaoDoFilho(n, pai) === direcao);
  const qtd = filhosMesmoLado.length;

  let x, y;
  if (direcao === "direita") {
    x = pai.x + larguraPai + GAP_RAMO;
    y = pai.y + qtd * 80 - (qtd ? 20 : 0);
  } else if (direcao === "esquerda") {
    x = pai.x - LARGURA_NO - GAP_RAMO;
    y = pai.y + qtd * 80 - (qtd ? 20 : 0);
  } else if (direcao === "baixo") {
    x = pai.x + qtd * (LARGURA_NO + 40) - (qtd ? (LARGURA_NO + 40) / 2 : 0);
    y = pai.y + ALTURA_NO + GAP_RAMO;
  } else {
    // cima
    x = pai.x + qtd * (LARGURA_NO + 40) - (qtd ? (LARGURA_NO + 40) / 2 : 0);
    y = pai.y - ALTURA_NO - GAP_RAMO;
  }

  const novoId = "no-" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  const novoNode = { id: novoId, texto: "Novo tópico", x, y, parentId };

  const novosNodes = [...nodes, novoNode];
  const atualizado = await prisma.mapaMental.update({
    where: { id: mapa.id },
    data: { nodes: novosNodes },
  });

  res.status(201).json({ nodes: atualizado.nodes, novoId });
});

// PATCH /mapas-mentais/:id/nos/:nodeId — atualiza texto e/ou posição (x, y) de um nó
router.patch("/:id/nos/:nodeId", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  const mapa = await carregarMapaDoDono(req.params.id, donoId);
  if (!mapa) return res.status(404).json({ erro: "Mapa não encontrado." });

  const nodes = Array.isArray(mapa.nodes) ? mapa.nodes : [];
  const idx = nodes.findIndex((n) => n.id === req.params.nodeId);
  if (idx === -1) return res.status(404).json({ erro: "Nó não encontrado." });

  const { texto, x, y } = req.body || {};
  const novoNode = { ...nodes[idx] };
  if (typeof texto === "string") novoNode.texto = texto;
  // Fase 56 — não trava mais em 0: um ramo "esquerda"/"cima" perto da raiz é posição lógica
  // negativa de propósito (o desenho no frontend desloca tudo pelo PAD_X_MAPA/PAD_Y_MAPA antes de
  // mostrar na tela, então isso nunca aparece "fora" da área visível).
  if (typeof x === "number" && Number.isFinite(x)) novoNode.x = x;
  if (typeof y === "number" && Number.isFinite(y)) novoNode.y = y;

  const novosNodes = [...nodes];
  novosNodes[idx] = novoNode;

  const atualizado = await prisma.mapaMental.update({
    where: { id: mapa.id },
    data: { nodes: novosNodes },
  });

  res.json({ nodes: atualizado.nodes });
});

// DELETE /mapas-mentais/:id/nos/:nodeId — apaga o nó e toda a ramificação dele.
// Não deixa apagar o nó raiz (ele representa o próprio mapa) — pra isso existe o
// DELETE /mapas-mentais/:id, que apaga o mapa inteiro.
router.delete("/:id/nos/:nodeId", async (req, res) => {
  const donoId = donoIdDoLogin(req);
  const mapa = await carregarMapaDoDono(req.params.id, donoId);
  if (!mapa) return res.status(404).json({ erro: "Mapa não encontrado." });

  const nodes = Array.isArray(mapa.nodes) ? mapa.nodes : [];
  const alvo = nodes.find((n) => n.id === req.params.nodeId);
  if (!alvo) return res.status(404).json({ erro: "Nó não encontrado." });
  if (!alvo.parentId) {
    return res.status(400).json({ erro: "Não é possível excluir o nó raiz do mapa (exclua o mapa inteiro, se for o caso)." });
  }

  const idsParaRemover = new Set([alvo.id]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    nodes.forEach((n) => {
      if (n.parentId && idsParaRemover.has(n.parentId) && !idsParaRemover.has(n.id)) {
        idsParaRemover.add(n.id);
        mudou = true;
      }
    });
  }

  const novosNodes = nodes.filter((n) => !idsParaRemover.has(n.id));
  const atualizado = await prisma.mapaMental.update({
    where: { id: mapa.id },
    data: { nodes: novosNodes },
  });

  res.json({ nodes: atualizado.nodes });
});

module.exports = router;
