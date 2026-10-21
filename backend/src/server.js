require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const profissionalRoutes = require("./routes/profissional");
const clienteRoutes = require("./routes/cliente");
const donoRoutes = require("./routes/dono");
const atendenteRoutes = require("./routes/atendente");
const comumRoutes = require("./routes/comum");
const financaPessoalRoutes = require("./routes/financaPessoal");
const iaRoutes = require("./routes/ia");
const formularioRoutes = require("./routes/formulario");
const { verificarLembretes } = require("./utils/lembretes");

const app = express();

// O Railway coloca a API atrás de um proxy (quem bate na API "de fora" na real passa por ele
// antes) — isso precisa ficar declarado pra dois recursos funcionarem certo: o freio de
// tentativas abaixo (senão ele pode achar que todo mundo é "o mesmo computador") e o registro
// correto do IP de quem acessa.
app.set("trust proxy", 1);

// Segurança (Fase 27): cabeçalhos de proteção padrão (protege contra alguns ataques comuns de
// navegador, como "clickjacking" e farejar o tipo de arquivo errado). É uma API só de JSON (o
// site de verdade roda na Vercel, separado), então não tem risco de quebrar nenhuma tela.
app.use(helmet());

// CORS: antes caía para "*" (qualquer site) se a variável FRONTEND_URL não estivesse configurada
// no Railway — agora, sem a variável, usa o endereço oficial de produção como padrão seguro, em
// vez de liberar geral.
app.use(cors({ origin: process.env.FRONTEND_URL || "https://renascer-sistema.vercel.app" }));
app.use(express.json({ limit: "15mb" })); // limite maior por causa das fotos/comprovantes em base64

// Freio contra tentativa de adivinhar senha ou criar conta em massa (Fase 27): conta as
// tentativas por IP numa janela de 15 minutos. Não afeta o uso normal — ninguém erra a senha ou
// se cadastra 20 vezes em 15 minutos por engano.
const freioLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." },
});
const freioCadastroIA = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." },
});
// Freio geral, mais largo, só pra não deixar a API inteira aberta sem nenhum limite — não afeta
// o uso normal do sistema (é bem mais alto que qualquer uso real de uma pessoa só).
const freioGeral = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
// Mesmo freio nas respostas de formulário público (Fase 28) — evita um script mandando centenas
// de respostas falsas pro mesmo formulário.
const freioFormularioPublico = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." },
});
app.use("/api", freioGeral);
app.use("/api/auth/login", freioLogin);
app.use("/api/ia/cadastro", freioCadastroIA);
app.use("/api/formularios/publico", freioFormularioPublico);

app.get("/", (req, res) => res.json({ ok: true, sistema: "Espaço do Renascer — API" }));
app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/profissional", profissionalRoutes);
app.use("/api/cliente", clienteRoutes);
app.use("/api/dono", donoRoutes);
app.use("/api/atendente", atendenteRoutes);
app.use("/api/comum", comumRoutes);
app.use("/api/financa-pessoal", financaPessoalRoutes);
app.use("/api/ia", iaRoutes);
app.use("/api/formularios", formularioRoutes);

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
