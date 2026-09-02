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
function permitir(...papeis) {
  return (req, res, next) => {
    if (!req.user || !papeis.includes(req.user.role)) {
      return res.status(403).json({ erro: "Você não tem permissão para acessar isso." });
    }
    next();
  };
}

module.exports = { autenticar, permitir };
