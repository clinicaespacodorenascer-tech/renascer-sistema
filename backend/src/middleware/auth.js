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
