import { useState } from "react";
import api from "../lib/api";

// Troca o cliente de profissional a qualquer momento — não depende de pacote encerrado nem do
// cliente estar na fila de reativação (diferente da troca que o próprio cliente faz pelo app).
// Pensada pra recepção/dono conseguirem mover clientes que estavam soltos ou com outra
// profissional, inclusive pro login do próprio Dono quando ele também atende pacientes.
export default function TrocarProfissionalCliente({ clienteId, profissionalAtualNome, profissionais, rotaBase, onTrocou }) {
  const [escolha, setEscolha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");

  async function trocar() {
    if (!escolha) return;
    setEnviando(true);
    setMsg("");
    try {
      await api.put(`${rotaBase}/clientes/${clienteId}/vincular-profissional`, { profissionalId: escolha });
      setMsg("Cliente trocado de profissional!");
      setEscolha("");
      onTrocou?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao trocar de profissional.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border-t border-renascer/10 pt-3 mt-3">
      <p className="text-xs font-medium text-renascer-ink/60 mb-2">
        Trocar de profissional {profissionalAtualNome ? `(hoje: ${profissionalAtualNome})` : "(sem profissional vinculada)"}
      </p>
      <div className="flex flex-wrap gap-2">
        <select className="input text-sm" value={escolha} onChange={(e) => setEscolha(e.target.value)}>
          <option value="">Escolha a nova profissional...</option>
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>
              {p.user.nome}
              {p.user.role === "DONO" ? " (Dono)" : ""}
            </option>
          ))}
        </select>
        <button className="btn-secondary text-sm" onClick={trocar} disabled={!escolha || enviando}>
          {enviando ? "..." : "Trocar"}
        </button>
      </div>
      {msg && <p className="text-xs mt-2 text-renascer-ink/70">{msg}</p>}
    </div>
  );
}
