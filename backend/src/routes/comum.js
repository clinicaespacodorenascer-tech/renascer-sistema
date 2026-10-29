// Rotas comuns a qualquer usuário autenticado, independente do papel (notificações etc.)
const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar } = require("../middleware/auth");
const { vapidPublicKey } = require("../utils/push");
const { inicioDoDia } = require("../utils/meuDia");
const { calcularRepasse, parseValorMonetario } = require("../utils/financeiro");
const { notificar, notificarDonos } = require("../utils/notificar");

const router = express.Router();
router.use(autenticar);

// Checklist de "Meu dia" (Fase 30) — só pros 3 papéis de gestão (Dono, Atendente, Profissional).
// Cliente e usuário da Renascer IA não têm painel de gestão, então não têm checklist.
function bloquearSemPainelDeGestao(req, res, next) {
  if (req.user.role === "CLIENTE" || req.user.role === "USUARIO_IA") {
    return res.status(403).json({ erro: "Você não tem permissão para acessar isso." });
  }
  next();
}

// ---------- Notificações push (toque/vibração no aparelho) ----------
// A chave pública é a mesma pra todo mundo — é ela que o navegador usa pra criar a inscrição
// (isso não é segredo, quem guarda segredo é a chave PRIVADA, que nunca sai do backend).
router.get("/push/chave-publica", (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// Salva (ou atualiza) a inscrição desse aparelho pra esse usuário. Um mesmo usuário pode ter
// vários aparelhos inscritos (celular + computador) — cada "endpoint" é único por aparelho, por
// isso o upsert é por endpoint, não por usuário.
router.post("/push/inscrever", async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ erro: "Inscrição de notificação inválida." });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.json({ ok: true });
});

// Remove a inscrição desse aparelho (usado quando a pessoa desativa notificações).
router.delete("/push/inscrever", async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
  }
  res.json({ ok: true });
});

router.get("/notificacoes", async (req, res) => {
  const notificacoes = await prisma.notificacao.findMany({
    where: { userId: req.user.id },
    orderBy: { criadoEm: "desc" },
    take: 50,
  });
  res.json(notificacoes);
});

router.put("/notificacoes/:id/lida", async (req, res) => {
  await prisma.notificacao.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { lida: true } });
  res.json({ ok: true });
});

router.get("/notificacoes/nao-lidas/total", async (req, res) => {
  const total = await prisma.notificacao.count({ where: { userId: req.user.id, lida: false } });
  res.json({ total });
});

// Marca todas de uma vez como lidas — usado pelo pop-up que já mostra o resumo das notificações
// novas assim que a pessoa entra no app (ver AvisoEntrada no frontend do cliente); depois de
// mostrado o resumo, não faz sentido continuar contando como "não lida".
router.put("/notificacoes/marcar-todas-lidas", async (req, res) => {
  await prisma.notificacao.updateMany({ where: { userId: req.user.id, lida: false }, data: { lida: true } });
  res.json({ ok: true });
});

// Foto de perfil — qualquer papel logado (Cliente, Atendente, Dono ou Profissional) pode trocar
// a própria foto por aqui. A Profissional já tinha esse campo dentro da tela de "Perfil"
// completo dela (que também mexe em título, bio etc.); esse endpoint é só a foto, isolado, pra
// funcionar igual pros outros três papéis, que não têm uma tela de perfil própria.
router.put("/minha-foto", async (req, res) => {
  const { fotoBase64 } = req.body;
  if (!fotoBase64) return res.status(400).json({ erro: "Envie uma imagem." });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { fotoUrl: fotoBase64 }, // fase 2: subir pra storage real e salvar a URL
    select: { id: true, nome: true, fotoUrl: true },
  });
  res.json(user);
});

// Ver o comprovante anexado numa transação financeira (contratação, renovação, pacote).
// Fica guardado no banco pra sempre poder ser visto de novo depois.
// Dono e atendente podem ver qualquer comprovante; a profissional só vê os das próprias
// transações; cliente não tem acesso.
router.get("/transacoes/:id/comprovante", async (req, res) => {
  if (req.user.role === "CLIENTE") {
    return res.status(403).json({ erro: "Você não tem permissão para ver isso." });
  }

  const transacao = await prisma.transacaoFinanceira.findUnique({ where: { id: req.params.id } });
  if (!transacao || !transacao.comprovanteBase64) {
    return res.status(404).json({ erro: "Nenhum comprovante anexado nessa transação." });
  }
  if (req.user.role === "PROFISSIONAL" && transacao.profissionalId !== req.user.profissional.id) {
    return res.status(403).json({ erro: "Você não tem permissão para ver esse comprovante." });
  }

  res.json({ base64: transacao.comprovanteBase64, mimeType: transacao.comprovanteMimeType || "image/jpeg" });
});

// Ver o comprovante do REPASSE (diferente do comprovante do pagamento do cliente acima) — a
// profissional anexa quando manda a parte da Renascer pra clínica, e o dono confere aqui antes
// de confirmar. Mesma regra de permissão do comprovante normal.
router.get("/transacoes/:id/repasse-comprovante", async (req, res) => {
  if (req.user.role === "CLIENTE") {
    return res.status(403).json({ erro: "Você não tem permissão para ver isso." });
  }

  const transacao = await prisma.transacaoFinanceira.findUnique({ where: { id: req.params.id } });
  if (!transacao || !transacao.repasseComprovanteBase64) {
    return res.status(404).json({ erro: "Nenhum comprovante de repasse anexado nessa transação." });
  }
  if (req.user.role === "PROFISSIONAL" && transacao.profissionalId !== req.user.profissional.id) {
    return res.status(403).json({ erro: "Você não tem permissão para ver esse comprovante." });
  }

  res.json({ base64: transacao.repasseComprovanteBase64, mimeType: transacao.repasseComprovanteMimeType || "image/jpeg" });
});

// ---------- Fase 59 — Pagamentos parciais (pendências) ----------
// Quando um cliente paga só parte do valor combinado agora e completa depois (ex: metade de um
// pacote de R$120), o lançamento original fica marcado com valorPacoteTotal > valorTotal. Essas
// duas rotas são comuns a Dono/Atendente/Financeiro (veem tudo) e Profissional (só o que é dela)
// — mesma regra de permissão já usada nos comprovantes acima.
router.get("/transacoes/pendentes", async (req, res) => {
  if (req.user.role === "CLIENTE" || req.user.role === "USUARIO_IA") {
    return res.status(403).json({ erro: "Você não tem permissão para acessar isso." });
  }

  const pendentes = await prisma.transacaoFinanceira.findMany({
    where: {
      valorPacoteTotal: { not: null },
      quitadoEm: null,
      ...(req.user.role === "PROFISSIONAL" ? { profissionalId: req.user.profissional.id } : {}),
    },
    select: {
      id: true,
      tipo: true,
      valorTotal: true,
      valorPacoteTotal: true,
      data: true,
      observacao: true,
      cliente: { select: { id: true, user: { select: { nome: true } } } },
      profissional: { select: { id: true, user: { select: { nome: true } } } },
    },
    orderBy: { data: "desc" },
  });

  res.json(
    pendentes.map((t) => ({
      ...t,
      valorPendente: Number((t.valorPacoteTotal - t.valorTotal).toFixed(2)),
    }))
  );
});

// Registra que o restante de um pagamento parcial foi pago. NÃO edita o lançamento original
// (cada transação financeira continua um registro imutável) — cria uma segunda transação (o
// complemento, com seu próprio repasse calculado só em cima desse valor) referenciando a
// original, e só então marca a original como quitada.
router.put("/transacoes/:id/quitar", async (req, res) => {
  if (req.user.role === "CLIENTE" || req.user.role === "USUARIO_IA") {
    return res.status(403).json({ erro: "Você não tem permissão para acessar isso." });
  }

  const original = await prisma.transacaoFinanceira.findUnique({ where: { id: req.params.id } });
  if (!original) return res.status(404).json({ erro: "Pagamento não encontrado." });
  if (req.user.role === "PROFISSIONAL" && original.profissionalId !== req.user.profissional.id) {
    return res.status(403).json({ erro: "Você não tem permissão para mexer nesse pagamento." });
  }
  if (!original.valorPacoteTotal) {
    return res.status(400).json({ erro: "Esse pagamento não tem valor pendente." });
  }
  if (original.quitadoEm) {
    return res.status(400).json({ erro: "Esse pagamento já foi quitado." });
  }

  const pendente = Number((original.valorPacoteTotal - original.valorTotal).toFixed(2));
  const { valor, imagemBase64, mimeType, observacao } = req.body;
  const valorQuitacao = valor ? parseValorMonetario(valor) : pendente;
  if (!valorQuitacao || valorQuitacao <= 0) {
    return res.status(400).json({ erro: "Informe um valor válido pra quitação." });
  }

  const profissional = await prisma.profissional.findUnique({
    where: { id: original.profissionalId },
    include: { user: { select: { nome: true } } },
  });
  const cliente = await prisma.cliente.findUnique({
    where: { id: original.clienteId },
    include: { user: { select: { nome: true } } },
  });

  const { valorProfissional, valorRenascer } = calcularRepasse(valorQuitacao, profissional.percentualRepasse);
  const complemento = await prisma.transacaoFinanceira.create({
    data: {
      profissionalId: original.profissionalId,
      clienteId: original.clienteId,
      tipo: original.tipo,
      valorTotal: valorQuitacao,
      valorProfissional,
      valorRenascer,
      recebidoPor: original.recebidoPor,
      origem: req.user.role === "PROFISSIONAL" ? "PROFISSIONAL" : "ATENDENTE",
      comprovanteBase64: imagemBase64 || null,
      comprovanteMimeType: imagemBase64 ? mimeType || "image/jpeg" : null,
      observacao: observacao || `Complemento do pagamento parcial de ${new Date(original.data).toLocaleDateString("pt-BR")}.`,
      complementoDeId: original.id,
    },
  });

  await prisma.transacaoFinanceira.update({ where: { id: original.id }, data: { quitadoEm: new Date() } });

  await notificarDonos({
    titulo: "Pagamento pendente quitado",
    mensagem: `${cliente?.user?.nome || "Um cliente"} completou o pagamento pendente de R$ ${valorQuitacao.toFixed(2)} — repasse esperado: R$ ${valorRenascer.toFixed(2)}.`,
    tipo: "financeiro",
  });
  if (req.user.role !== "PROFISSIONAL") {
    await notificar(profissional.userId, {
      titulo: "Pendência quitada",
      mensagem: `O restante do pagamento de ${cliente?.user?.nome || "um cliente"} foi registrado — R$ ${valorQuitacao.toFixed(2)} a mais, repasse de R$ ${valorRenascer.toFixed(2)}.`,
      tipo: "financeiro",
      referenciaTipo: "TRANSACAO",
      referenciaId: complemento.id,
    });
  }

  res.json({ original: { ...original, quitadoEm: new Date() }, complemento });
});

// ---------- Checklist de "Meu dia" (Fase 30) ----------
// Serve tanto o checklist DIÁRIO ("Hoje" — manda `data`) quanto o PERMANENTE ("Implantação" —
// não manda `data`, marca uma vez só e nunca mais reaparece). Cada papel define sua própria
// lista de itens (itemChave) no frontend; aqui só guarda o que já foi marcado.
router.get("/meu-dia/checklist", bloquearSemPainelDeGestao, async (req, res) => {
  const { data } = req.query; // YYYY-MM-DD, opcional (sem isso = itens permanentes)
  const concluidos = await prisma.checklistConclusao.findMany({
    where: { userId: req.user.id, data: data ? inicioDoDia(data) : null },
    select: { itemChave: true, concluidoEm: true },
  });
  res.json({ itensConcluidos: concluidos.map((c) => c.itemChave), detalhes: concluidos });
});

router.post("/meu-dia/checklist/alternar", bloquearSemPainelDeGestao, async (req, res) => {
  const { itemChave, data } = req.body;
  if (!itemChave) return res.status(400).json({ erro: "Informe o item do checklist." });
  const diaOuNulo = data ? inicioDoDia(data) : null;

  const existente = await prisma.checklistConclusao.findFirst({
    where: { userId: req.user.id, itemChave, data: diaOuNulo },
  });

  if (existente) {
    await prisma.checklistConclusao.delete({ where: { id: existente.id } });
    return res.json({ concluido: false });
  }

  await prisma.checklistConclusao.create({
    data: { userId: req.user.id, itemChave, data: diaOuNulo },
  });
  res.json({ concluido: true });
});

// Fase 77 — lista de campanhas ativas pra preencher o seletor "Campanha" no cadastro de cliente
// (Atendente e Dono). Só o cadastro/CRUD de verdade (criar/editar/relatório) é exclusivo do Dono
// (fica em dono.js) — aqui é só leitura, pra qualquer papel com painel de gestão poder escolher
// uma campanha já cadastrada ao registrar um lead.
router.get("/campanhas-ativas", bloquearSemPainelDeGestao, async (req, res) => {
  const campanhas = await prisma.campanha.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, publico: true },
  });
  res.json(campanhas);
});

module.exports = router;
