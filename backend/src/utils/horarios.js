// Calcula, a partir da disponibilidade semanal que a profissional liberou (dia + faixa de
// horário), quais horários exatos estão livres numa data específica — descontando o que já
// está ocupado na agenda dela. É essa lista que a atendente vê pra marcar exatamente o que o
// cliente quer, e é a mesma base que alimenta a escolha de horário do cliente ao reagendar.

const DIAS_SEMANA_JS = ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"];
const DURACAO_MINUTOS = { MIN30: 30, MIN50: 50 };

function diaSemanaDeData(data) {
  return DIAS_SEMANA_JS[new Date(data).getDay()];
}

function paraMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function paraHHMM(minutos) {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Gera os horários possíveis dentro de uma faixa (ex: 14:00-18:00), pulando de `duracao` em `duracao`
function gerarSlots(horaInicio, horaFim, duracaoMinutos) {
  const inicio = paraMinutos(horaInicio);
  const fim = paraMinutos(horaFim);
  const slots = [];
  for (let t = inicio; t + duracaoMinutos <= fim; t += duracaoMinutos) {
    slots.push(paraHHMM(t));
  }
  return slots;
}

// Recebe as disponibilidades (faixas) de um dia + os agendamentos já existentes naquela data
// e devolve só os horários realmente livres (checando sobreposição real de intervalos, não só
// o horário exato de início — assim um agendamento de 50min bloqueia de verdade quem tentaria
// começar 30min depois, por exemplo).
function horariosLivres({ disponibilidadesDoDia, agendamentosDoDia, duracao }) {
  const duracaoMinutos = DURACAO_MINUTOS[duracao] || 50;

  const intervalosOcupados = agendamentosDoDia.map((ag) => {
    const inicio = paraMinutos(ag.horaInicio);
    const duracaoOcupada = DURACAO_MINUTOS[ag.duracao] || 50;
    return [inicio, inicio + duracaoOcupada];
  });

  function estaLivre(slotHHMM) {
    const inicioSlot = paraMinutos(slotHHMM);
    const fimSlot = inicioSlot + duracaoMinutos;
    // dois intervalos [a,b) e [c,d) se sobrepõem quando a < d e c < b
    return !intervalosOcupados.some(([oi, of]) => inicioSlot < of && oi < fimSlot);
  }

  const livres = [];
  for (const disp of disponibilidadesDoDia) {
    for (const slot of gerarSlots(disp.horaInicio, disp.horaFim, duracaoMinutos)) {
      if (estaLivre(slot)) livres.push(slot);
    }
  }
  return [...new Set(livres)].sort();
}

// Diz se um horário específico (início + duração) colide com algum agendamento já existente
// naquele dia — mesma matemática de sobreposição do horariosLivres, mas pra checar um único
// horário direto (útil quando já se sabe o horário e só precisa confirmar que não bate em nada,
// como ao mover uma sessão pra outro dia da semana mantendo o mesmo horário).
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

module.exports = { diaSemanaDeData, horariosLivres, haConflito, gerarSlots, DURACAO_MINUTOS };
