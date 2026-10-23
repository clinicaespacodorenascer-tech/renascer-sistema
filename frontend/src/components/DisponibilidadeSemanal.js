import { useState } from "react";

const DIAS = [
  ["SEGUNDA", "Seg"],
  ["TERCA", "Ter"],
  ["QUARTA", "Qua"],
  ["QUINTA", "Qui"],
  ["SEXTA", "Sex"],
  ["SABADO", "Sáb"],
];

// Fase 51 — igual canvas: grade de horários (dias nas colunas, meia em meia hora nas linhas),
// toca na célula pra abrir/fechar, em vez da lista de pills + input de horário de antes. Continua
// guardando só os horários EXATOS atendidos (não uma faixa contínua), só muda a forma de marcar.
function gerarSlots() {
  const slots = [];
  for (let h = 7; h <= 20; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
    slots.push(`${String(h).padStart(2, "0")}:30`);
  }
  return slots;
}
const SLOTS = gerarSlots();

// Componente compartilhado: usado tanto na tela da própria profissional quanto na tela da
// atendente (que pode ajustar os horários de qualquer profissional a pedido dela) — mesma
// lógica, mesmo componente, pra recepção, profissional e cliente sempre falarem a mesma língua.
export default function DisponibilidadeSemanal({ disponibilidades, setDisponibilidades, salvar, aviso, ocupados = [] }) {
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  function ocupadoDe(dia, hora) {
    return ocupados.find((o) => o.diaSemana === dia && o.horaInicio === hora);
  }
  function livre(dia, hora) {
    return disponibilidades.some((d) => d.diaSemana === dia && d.horaInicio === hora);
  }

  function alternar(dia, hora) {
    if (ocupadoDe(dia, hora)) return; // trava: tem cliente fixo nesse horário, não dá pra fechar por aqui
    if (livre(dia, hora)) {
      setDisponibilidades(disponibilidades.filter((d) => !(d.diaSemana === dia && d.horaInicio === hora)));
    } else {
      setDisponibilidades([...disponibilidades, { diaSemana: dia, horaInicio: hora }]);
    }
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
    <div className="font-publicSans flex flex-col gap-3">
      <div className="bg-[#F2F7FC] border border-nv-blue/20 rounded-xl px-4 py-3 text-[12.5px] text-nv-navy">
        {aviso || "Essa disponibilidade também é visível para o Setor Financeiro, o Dono e a Atendente, para ajudar no agendamento de novos clientes."}
      </div>
      {ocupados.length > 0 && (
        <p className="text-[11.5px] text-[#B0580F]">🔒 = horário fixo de um cliente — pra liberar, agende um novo horário pra ele primeiro.</p>
      )}

      <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(14,30,54,0.05)] overflow-x-auto">
        <table className="w-full text-[12px] border-collapse min-w-[560px]">
          <thead>
            <tr>
              <th className="text-left text-nv-muted3 font-semibold text-[11px] px-2.5 py-2 sticky left-0 bg-white">—</th>
              {DIAS.map(([dia, label]) => (
                <th key={dia} className="text-nv-ink2 font-semibold text-[12.5px] px-2.5 py-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((hora) => (
              <tr key={hora} className="border-t border-nv-borderLight">
                <td className="text-nv-muted3 text-[11px] font-semibold px-2.5 py-1 whitespace-nowrap sticky left-0 bg-white">{hora}</td>
                {DIAS.map(([dia]) => {
                  const ocupado = ocupadoDe(dia, hora);
                  const aberto = livre(dia, hora);
                  return (
                    <td key={dia} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        title={ocupado ? `Horário fixo de ${ocupado.nome}` : undefined}
                        onClick={() => alternar(dia, hora)}
                        className={`w-full rounded-md text-[11px] font-semibold py-1 transition-colors ${
                          ocupado
                            ? "bg-[#FBF0E3] text-[#B0580F] cursor-default"
                            : aberto
                            ? "bg-[#E8F5EE] text-nv-green hover:bg-[#D9EEE2]"
                            : "bg-nv-bg text-nv-muted3 hover:bg-nv-borderLight"
                        }`}
                      >
                        {ocupado ? "🔒" : aberto ? "Livre" : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary text-sm" onClick={salvarClick} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar horários"}
        </button>
        {msg && <span className="text-[12.5px] text-nv-muted">{msg}</span>}
      </div>
    </div>
  );
}
