// Formata "presença" (online agora / visto há X) a partir do campo User.ultimoAcessoEm, que o
// backend atualiza sozinho (com limite de 1x por minuto) em praticamente toda request
// autenticada — então "online" aqui quer dizer "usou o app recentemente", não uma conexão em
// tempo real. Quem pode ver isso de quem é decidido em cada tela (o cliente nunca recebe o
// ultimoAcessoEm de nenhuma profissional, por exemplo — o backend simplesmente não envia).
const LIMITE_ONLINE_MINUTOS = 2;

export function formatarPresenca(ultimoAcessoEm) {
  if (!ultimoAcessoEm) return { online: false, texto: "Nunca acessou" };

  const minutos = (Date.now() - new Date(ultimoAcessoEm).getTime()) / 60000;
  if (minutos < LIMITE_ONLINE_MINUTOS) return { online: true, texto: "Online agora" };

  if (minutos < 60) return { online: false, texto: `Visto há ${Math.round(minutos)} min` };
  const horas = minutos / 60;
  if (horas < 24) return { online: false, texto: `Visto há ${Math.round(horas)}h` };
  const dias = Math.round(horas / 24);
  return { online: false, texto: `Visto há ${dias} dia${dias > 1 ? "s" : ""}` };
}

// Status de uma sessão agendada, a partir do horário marcado e do registro de ChamadaVideo
// (criado quando a profissional entra na videochamada — ver /agenda/:id/iniciar-chamada).
// GRACE_MINUTOS espelha o mesmo valor usado no aviso automático do backend (lembretes.js).
const GRACE_MINUTOS = 15;

export function statusSessao(agendamento) {
  const { status, data, horaInicio, chamadaVideo } = agendamento;
  if (status === "CANCELADO") return { cor: "cinza", texto: "Cancelada" };
  if (status === "REAGENDADO") return { cor: "cinza", texto: "Reagendada" };
  if (status === "FALTOU") return { cor: "vermelho", texto: "Cliente faltou" };
  if (chamadaVideo?.encerradaEm) {
    return { cor: "azul", texto: `Concluída (${chamadaVideo.duracaoMinutos ?? "?"} min)` };
  }
  if (chamadaVideo?.iniciadaEm) return { cor: "verde", texto: "Em atendimento agora" };

  // Monta o instante exato do horário marcado com o fuso de Bahia/Brasília fixo (-03:00, sem
  // horário de verão desde 2019) em vez de usar o fuso do navegador de quem está vendo a tela —
  // assim o cálculo fica certo pra qualquer um, e igual ao que o backend calcula (lembretes.js).
  const diaISO = new Date(data).toISOString().slice(0, 10);
  const horarioMarcado = new Date(`${diaISO}T${horaInicio || "00:00"}:00-03:00`);
  const minutosDeAtraso = (Date.now() - horarioMarcado.getTime()) / 60000;

  if (minutosDeAtraso >= GRACE_MINUTOS) return { cor: "vermelho", texto: "⚠️ Não iniciada" };
  return { cor: "cinza", texto: "Aguardando horário" };
}

export const CORES_STATUS_SESSAO = {
  verde: "bg-emerald-100 text-emerald-700",
  azul: "bg-sky-100 text-sky-700",
  vermelho: "bg-red-100 text-red-700",
  cinza: "bg-renascer-ink/10 text-renascer-ink/60",
};
