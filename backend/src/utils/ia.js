// Integrações com a IA da Anthropic: leitura automática de comprovante de pagamento (já existia)
// e, a partir da Fase Renascer IA, a conversa da Renascer IA com quem baixa o app.

const Anthropic = require("@anthropic-ai/sdk");

async function reconhecerComprovante({ base64, mimeType }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { disponivel: false };

  const client = new Anthropic({ apiKey });

  const prompt = `Você está vendo a imagem de um comprovante de pagamento (Pix, transferência ou cartão) recebido por uma profissional de terapia.
Extraia APENAS um JSON válido, sem nenhum texto antes ou depois, no formato:
{"valor": <numero, ex: 170.00>, "data": "<YYYY-MM-DD ou null se não achar>", "tipoProvavel": "<PACOTE_NOVO|RENOVACAO|SESSAO_EXTRA|OUTRO>", "descricao": "<breve descrição do que aparece, ex: 'Pix recebido de fulano'>"}
Se não conseguir identificar o valor com confiança, retorne "valor": null.`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  const textoResposta = resp.content.find((c) => c.type === "text")?.text || "{}";
  let dados;
  try {
    const jsonMatch = textoResposta.match(/\{[\s\S]*\}/);
    dados = JSON.parse(jsonMatch ? jsonMatch[0] : textoResposta);
  } catch (e) {
    dados = { valor: null, erro: "Não foi possível interpretar a resposta da IA." };
  }

  return { disponivel: true, ...dados, respostaCrua: textoResposta };
}

// Prompt de sistema da Renascer IA — define o jeito dela conversar e os limites dela. Não muda
// por plano (grátis/assinante usam a mesma personalidade, só o limite diário é diferente).
const PROMPT_SISTEMA_RENASCER_IA = `Você é a Renascer IA, uma companheira de conversa dentro do app do Espaço do Renascer (uma clínica de terapia).

O que você é: um apoio para a pessoa refletir, organizar os pensamentos e criar o hábito de parar e pensar sobre a própria vida, entre uma sessão de terapia e outra (ou para quem ainda não faz terapia nenhuma).

O que você NUNCA é: você não dá diagnóstico, não decide se algo é um transtorno, não prescreve nem sugere medicação, e não substitui terapia ou acompanhamento profissional. Se a pessoa perguntar algo que pareça um pedido de diagnóstico, deixe claro com gentileza que isso é trabalho de um profissional, não seu.

Tom: acolhedor, caloroso, direto, sem parecer um robô nem um manual clínico. Frases curtas. Perguntas abertas que ajudam a pessoa a pensar, em vez de respostas prontas. Nunca minimize o que a pessoa está sentindo.

Quando - e só quando - fizer sentido pela conversa (nunca na primeira mensagem da pessoa, a não ser que ela mesma peça), você pode mencionar, de um jeito leve e sem insistir, que marcar uma sessão com uma das profissionais do Espaço do Renascer pode ajudar. Não repita isso toda hora.

Nunca use emojis. Nunca use travessão. Respostas curtas (no máximo uns 3 parágrafos curtos).`;

// Gera a resposta da Renascer IA pra uma mensagem nova, dado o histórico recente da conversa
// (array de { autor: "USUARIO" | "IA", texto }, do mais antigo pro mais novo). maxTokens controla
// o tamanho máximo da resposta — uma das travas de custo aprovadas pelo Elismael.
async function responderRenascerIA({ historico, maxTokens = 500 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      disponivel: false,
      texto:
        "A Renascer IA está temporariamente indisponível. Tente de novo em alguns minutos, ou fale com a nossa equipe pelo WhatsApp.",
    };
  }

  const client = new Anthropic({ apiKey });

  const mensagens = historico.map((m) => ({
    role: m.autor === "IA" ? "assistant" : "user",
    content: m.texto,
  }));

  const resp = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: maxTokens,
    system: PROMPT_SISTEMA_RENASCER_IA,
    messages: mensagens,
  });

  const texto = resp.content.find((c) => c.type === "text")?.text || "";
  return { disponivel: true, texto };
}

module.exports = { reconhecerComprovante, responderRenascerIA };
