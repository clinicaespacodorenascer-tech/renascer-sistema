import api from "./api";

// Abre numa aba nova o comprovante anexado numa transação financeira (contratação,
// renovação, pacote). Abre a aba em branco ANTES do await de propósito — no celular,
// window.open() chamado depois de um await é bloqueado como pop-up.
export async function verComprovante(transacaoId) {
  const janela = window.open("", "_blank");
  try {
    const { data } = await api.get(`/comum/transacoes/${transacaoId}/comprovante`);
    const src = `data:${data.mimeType};base64,${data.base64}`;
    if (janela) {
      janela.document.write(
        `<title>Comprovante</title><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;">` +
          `<img src="${src}" style="max-width:100%;max-height:100vh;" /></body>`
      );
    } else {
      window.location.href = src;
    }
  } catch (e) {
    if (janela) janela.close();
    alert(e?.response?.data?.erro || "Não foi possível abrir o comprovante.");
  }
}

// Lê um arquivo escolhido no <input type="file"> e devolve só a parte base64 (sem o
// prefixo "data:...;base64,"), pronto pra mandar pro backend.
export function lerArquivoBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  });
}
