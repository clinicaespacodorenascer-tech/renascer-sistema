require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const profissionalRoutes = require("./routes/profissional");
const clienteRoutes = require("./routes/cliente");
const donoRoutes = require("./routes/dono");
const atendenteRoutes = require("./routes/atendente");
const comumRoutes = require("./routes/comum");
const { verificarLembretes } = require("./utils/lembretes");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "15mb" })); // limite maior por causa das fotos/comprovantes em base64

app.get("/", (req, res) => res.json({ ok: true, sistema: "Espaço do Renascer — API" }));
app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/profissional", profissionalRoutes);
app.use("/api/cliente", clienteRoutes);
app.use("/api/dono", donoRoutes);
app.use("/api/atendente", atendenteRoutes);
app.use("/api/comum", comumRoutes);

app.use((req, res) => res.status(404).json({ erro: "Rota não encontrada." }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API do Espaço do Renascer rodando na porta ${PORT}`);
  // Checa lembretes de sessão (24h/6h antes) e de renovação assim que sobe, e depois a cada 15 minutos.
  verificarLembretes();
  setInterval(verificarLembretes, 15 * 60 * 1000);
});
