import { useState } from "react";
import api from "../lib/api";

// Botões pra profissional/atendente registrarem o andamento do cliente: "Marcar ativo" volta
// ao normal, "Marcar renovou" registra a renovação no histórico, e "Excluir (não renovou)" tira
// o cliente da lista atual e joga ele na fila de reativação do dono/atendente — sem apagar o
// cadastro dele do sistema.
export default function SituacaoCliente({ clienteId, rotaBase, onMudou }) {
  const [enviando, setEnviando] = useState("");
  const [msg, setMsg] = useState("");

  async function marcar(acao) {
    if (
      acao === "EXCLUIR" &&
      !window.confirm(
        "Marcar que esse cliente não renovou e tirar ele da sua lista? Ele continua cadastrado no sistema — o dono e a recepção vão vê-lo na fila de reativação pra tentar um follow-up."
      )
    ) {
      return;
    }
    setEnviando(acao);
    setMsg("");
    try {
      await api.put(`${rotaBase}/clientes/${clienteId}/situacao`, { acao });
      if (acao === "EXCLUIR") setMsg("Cliente removido da sua lista e enviado pra fila de reativação.");
      else if (acao === "RENOVOU") setMsg("Renovação registrada no histórico!");
      else setMsg("Cliente marcado como ativo.");
      onMudou?.();
    } catch (e) {
      setMsg(e?.response?.data?.erro || "Erro ao atualizar.");
    } finally {
      setEnviando("");
    }
  }

  return (
    <div className="border-t border-renascer/10 pt-3 mt-3">
      <p className="text-xs font-medium text-renascer-ink/60 mb-2">Situação do cliente</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary text-sm" onClick={() => marcar("ATIVO")} disabled={!!enviando}>
          {enviando === "ATIVO" ? "..." : "Marcar ativo"}
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
          onClick={() => marcar("RENOVOU")}
          disabled={!!enviando}
        >
          {enviando === "RENOVOU" ? "..." : "Marcar renovou"}
        </button>
        <button
          className="text-sm px-3 py-1.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
          onClick={() => marcar("EXCLUIR")}
          disabled={!!enviando}
        >
          {enviando === "EXCLUIR" ? "..." : "Excluir (não renovou)"}
        </button>
      </div>
      {msg && <p className="text-xs mt-2 text-renascer-ink/70">{msg}</p>}
    </div>
  );
}
