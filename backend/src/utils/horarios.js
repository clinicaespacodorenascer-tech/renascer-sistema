// A profissional não libera uma faixa contínua de horário (ex: "8h às 18h") — ela cadastra os
// horários EXATOS que atende naquele dia da semana (ex: 08:30, 10:30, 18:00). Isso evita que o
// sistema "invente" horários livres que ela na verdade não atende, só porque caem dentro de uma
// faixa ampla. Aqui a gente só descobre, dentre os horários que ela realmente atende, quais
// ainda estão livres numa data específica (descontando o que já está ocupado na agenda dela).

const DIAS_SEMANA_JS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
const DURACAO_MINUTOS = { MIN30: 30, MIN50: 50 };

function diaSemanaDeData(data) {
  return DIAS_SEMANA_JS[new Date(data).getDay()];
}

function paraMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Diz se um horário específico (início + duração) colide com algum agendamento já existente
// naquele dia — dois intervalos [a,b) e [c,d) se sobrepõem quando a < d e c < b. Assim uma
// sessão de 50min bloqueia de verdade quem tentaria começar 30min depois, por exemplo.
function haConflito({ horaInicio, duracao, agendamentosDoDia }) {
  const duracaoMinutos = DURACAO_MINUTOS[duracao] || 50;
  const inicioNovo = paraMinutos(horaInicio);
  const fimNovo = inicioNovo + duracaoMinutos;
  return agendamentosDoDia.some((ag) => {
    const inicio = paraMinutos(ag.horaInicio);
    const fim = inicio + (DURACAO_MINUTOS[ag.duracao] || 50);
    return inicioNovo < fim && inicio < fimNovo;
  });
}

// Pega os horários exatos que a profissional cadastrou pra esse dia da semana e devolve só os
// que ainda estão livres pra a duração pedida (30 ou 50min) — nunca inventa um horário que ela
// não colocou na disponibilidade dela.
function horariosLivres({ disponibilidadesDoDia, agendamentosDoDia, duracao }) {
  const horarios = [...new Set(disponibilidadesDoDia.map((d) => d.horaInicio))].sort();
  return horarios.filter((horaInicio) => !haConflito({ horaInicio, duracao, agendamentosDoDia }));
}

module.exports = { diaSemanaDeData, horariosLivres, haConflito, DURACAO_MINUTOS };
