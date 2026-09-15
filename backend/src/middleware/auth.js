const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// Verifica o token JWT e carrega o usuário (com seu perfil de papel) em req.user
async function autenticar(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ erro: "Token não enviado." });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        profissional: true,
        cliente: true,
        atendente: true,
        dono: true,
      },
    });

    if (!user || !user.ativo) {
      return res.status(401).json({ erro: "Usuário inválido ou inativo." });
    }

    req.user = user;

    // Presença ("online agora" / "visto há X min"): atualiza o carimbo de último acesso em
    // praticamente toda request autenticada, sem precisar de nenhuma chamada nova no frontend —
    // o sininho de notificações (Layout.js) já faz uma chamada a cada 60s pra todo mundo
    // logado, então isso já funciona como um "heartbeat" de presença de graça. Limitado a 1x por
    // minuto por usuário pra não gerar um UPDATE a cada request; e nunca bloqueia a resposta —
    // dispara e segue, sem `await` e sem derrubar a request se falhar.
    if (!user.ultimoAcessoEm || Date.now() - user.ultimoAcessoEm.getTime() > 60 * 1000) {
      prisma.user.update({ where: { id: user.id }, data: { ultimoAcessoEm: new Date() } }).catch(() => {});
    }

    next();
  } catch (err) {
    return res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

// Restringe a rota a determinados papéis. Uso: permitir("DONO", "ATENDENTE")
//
// Exceção: quem está liberando acesso às rotas de PROFISSIONAL também deixa passar um usuário
// que não tem esse papel como principal, mas que TEM um cadastro de Profissional vinculado ao
// mesmo login (ex: um Dono que também atende pacientes, ativado em /dono/usuarios/:id/tornar-
// profissional). Isso permite login duplo — continua entrando e navegando como Dono, só ganha
// acesso extra às rotas de agenda/clientes/financeiro da Profissional — sem precisar de um
// segundo login nem trocar o papel principal dele.
function permitir(...papeis) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ erro: "Você não tem permissão para acessar isso." });
    }
    const temPapelPrincipal = papeis.includes(req.user.role);
    const temAcessoExtraDeProfissional = papeis.includes("PROFISSIONAL") && !!req.user.profissional;
    if (!temPapelPrincipal && !temAcessoExtraDeProfissional) {
      return res.status(403).json({ erro: "Você não tem permissão para acessar isso." });
    }
    next();
  };
}

module.exports = { autenticar, permitir };
