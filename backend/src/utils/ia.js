// Leitura automática de comprovante de pagamento via IA da Anthropic (Claude com visão).
// Recebe a imagem em base64 e devolve { valor, data, tipo, descricao } extraídos, ou null
// se a chave ANTHROPIC_API_KEY não estiver configurada (fallback manual).

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

module.exports = { reconhecerComprovante };
