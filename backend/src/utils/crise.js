// Detecção simples de sinal de crise na mensagem da pessoa, pra Renascer IA mostrar o cartão fixo
// (CVV 188, equipe da Renascer, SAMU 192) — decisão do Elismael: a conversa NÃO pausa quando isso
// acontece, a IA continua presente e acolhendo normalmente, só aparece o cartão junto.
//
// É um casamento de palavras-chave (sem IA/NLP por trás) — propositalmente mais sensível do que
// preciso: é preferível mostrar o cartão de ajuda numa mensagem que não era bem uma crise do que
// deixar passar uma que era.

const SINAIS_DE_CRISE = [
  "quero morrer",
  "quero me matar",
  "vou me matar",
  "me matar",
  "tirar minha vida",
  "tirar a minha vida",
  "acabar com a minha vida",
  "acabar com minha vida",
  "nao aguento mais viver",
  "nao aguento mais",
  "nao vale a pena viver",
  "nao quero mais viver",
  "melhor eu nao existir",
  "melhor nao existir",
  "me machucar",
  "me cortar",
  "cortar meus pulsos",
  "me ferir",
  "suicidio",
  "suicida",
  "cometer suicidio",
  "sumir de vez",
  "desistir de tudo",
  "nao tenho mais motivo",
  "nao aguento mais a dor",
];

// Remove acentos e normaliza pra minúsculas, pra o casamento de palavras não depender de acento
// digitado certo ou errado.
function normalizar(texto) {
  return (texto || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function contemSinalDeCrise(texto) {
  const normalizado = normalizar(texto);
  return SINAIS_DE_CRISE.some((sinal) => normalizado.includes(sinal));
}

module.exports = { contemSinalDeCrise };
