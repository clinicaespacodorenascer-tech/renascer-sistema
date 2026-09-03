import { useState } from "react";

const DIAS = [
  ["SEGUNDA", "Segunda"],
  ["TERCA", "Terça"],
  ["QUARTA", "Quarta"],
  ["QUINTA", "Quinta"],
  ["SEXTA", "Sexta"],
  ["SABADO", "Sábado"],
  ["DOMINGO", "Domingo"],
];

// Em vez de liberar uma faixa contínua (ex: "8h às 18h"), a profissional cadastra os horários
// EXATOS que atende em cada dia (ex: 08:30, 10:30, 18h) — isso evita que o sistema "invente"
// horário livre que na verdade não é atendido (ex: 9:30 aparecer livre só porque cai dentro de
// uma faixa ampla). Agrupado por dia da semana pra ficar fácil de organizar.
//
// Componente compartilhado: usado tanto na tela da própria profissional quanto na tela da
// atendente (que pode ajustar os horários de qualquer profissional a pedido dela) — mesma
// lógica, mesmo componente, pra recepção, profissional e cliente sempre falarem a mesma língua.
export default function DisponibilidadeSemanal({ disponibilidades, setDisponibilidades, salvar, aviso }) {
  const [novoHorario, setNovoHorario] = useState({});
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  function adicionar(dia) {
    const hora = novoHorario[dia];
    if (!hora) return;
    if (disponibilidades.some((d) => d.diaSemana === dia && d.horaInicio === hora)) {
      setNovoHorario({ ...novoHorario, [dia]: "" });
      return;
    }
    setDisponibilidades([...disponibilidades, { diaSemana: dia, horaInicio: hora }]);
    setNovoHorario({ ...novoHorario, [dia]: "" });
  }

  function remover(dia, hora) {
    setDisponibilidades(disponibilidades.filter((d) => !(d.diaSemana === dia && d.horaInicio === hora)));
  }

  async function salvarClick() {
    setMsg("");
    setSalvando(true);
    try {
      await salvar(disponibilidades);
      setMsg("Horários atualizados!");
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao salvar horários.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">Horários de atendimento</h2>
        <p className="text-xs text-renascer-ink/50 mt-1">
          {aviso ||
            'Cadastre só os horários exatos atendidos em cada dia — por exemplo, se atende 8:30, 10:30 e 18h na terça, cadastre só esses três, não uma faixa "8h às 18h". Assim ninguém (recepção ou cliente) consegue marcar num horário que não é atendido de verdade.'}
        </p>
      </div>
      {DIAS.map(([dia, label]) => {
        const horariosDoDia = disponibilidades
          .filter((d) => d.diaSemana === dia)
          .map((d) => d.horaInicio)
          .sort();
        return (
          <div key={dia} className="border-t border-renascer/10 pt-3">
            <p className="text-sm font-medium mb-2">{label}</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {horariosDoDia.length === 0 && <span className="text-xs text-renascer-ink/40">Nenhum horário cadastrado.</span>}
              {horariosDoDia.map((h) => (
                <span key={h} className="badge bg-renascer-light text-renascer flex items-center gap-1.5">
                  {h}
                  <button className="text-renascer-ink/50 hover:text-red-600 leading-none" onClick={() => remover(dia, h)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="time"
                className="input !w-32"
                value={novoHorario[dia] || ""}
                onChange={(e) => setNovoHorario({ ...novoHorario, [dia]: e.target.value })}
              />
              <button className="btn-secondary !py-1.5 !px-3 text-sm" onClick={() => adicionar(dia)}>
                + adicionar
              </button>
            </div>
          </div>
        );
      })}
      <button className="btn-primary block" onClick={salvarClick} disabled={salvando}>
        {salvando ? "Salvando..." : "Salvar horários"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
