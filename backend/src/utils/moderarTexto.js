// Bloqueia tentativas de trocar número de telefone/WhatsApp dentro do chat
// interno (cliente <-> profissional). A ideia é impedir que o atendimento saia
// do app oficial do Espaço do Renascer.
//
// Estratégia: procura blocos de texto onde os caracteres são majoritariamente
// dígitos (aceitando espaço, parênteses, traço e ponto no meio — formatos comuns
// de telefone) e bloqueia se algum desses blocos tiver 8 dígitos ou mais, que é
// o tamanho mínimo de um telefone brasileiro sem o DDD.
function contemTelefone(texto) {
  if (!texto) return false;
  // Ignora datas escritas por extenso em número (dd/mm, dd/mm/aaaa, aaaa-mm-dd)
  // antes de procurar telefone, pra não travar mensagens tipo "posso na sexta 15/03?".
  const semDatas = texto
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, "")
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, "");
  const blocos = semDatas.match(/[\d][\d\s\-.()]{6,}[\d]/g) || [];
  return blocos.some((bloco) => (bloco.match(/\d/g) || []).length >= 8);
}

const MENSAGEM_BLOQUEIO =
  "Por segurança, não é permitido enviar números de telefone ou WhatsApp pelo chat do app. Qualquer combinação deve ser feita pelos canais oficiais do Espaço do Renascer.";

module.exports = { contemTelefone, MENSAGEM_BLOQUEIO };
