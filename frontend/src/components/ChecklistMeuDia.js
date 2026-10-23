import { useEffect, useState } from "react";
import api from "../lib/api";

// Checklist reaproveitável do "Meu dia" (Fase 30) — usado pelos 3 painéis de gestão (Dono,
// Atendente, Profissional), tanto pro checklist DIÁRIO (passe `data`, ex: "2026-10-21") quanto
// pro PERMANENTE/implantação (não passe `data` — marca uma vez só e nunca mais reaparece).
// `itens` é uma lista fixa definida em cada painel: [{ chave, texto }].
export default function ChecklistMeuDia({ itens, data }) {
  const [concluidos, setConcluidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    setCarregando(true);
    setErro("");
    try {
      const { data: resp } = await api.get("/comum/meu-dia/checklist", { params: data ? { data } : {} });
      setConcluidos(resp.itensConcluidos);
    } catch (e) {
      setErro("Não consegui carregar o checklist agora.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  async function alternar(itemChave) {
    // Otimista: já troca na tela, e corrige se der erro de rede.
    const estavaConcluido = concluidos.includes(itemChave);
    setConcluidos((prev) => (estavaConcluido ? prev.filter((c) => c !== itemChave) : [...prev, itemChave]));
    try {
      await api.post("/comum/meu-dia/checklist/alternar", { itemChave, data });
    } catch (e) {
      setConcluidos((prev) => (estavaConcluido ? [...prev, itemChave] : prev.filter((c) => c !== itemChave)));
      setErro("Não consegui salvar — tente de novo.");
    }
  }

  if (carregando) return <p className="text-sm text-renascer-ink/50">Carregando...</p>;

  const feitos = itens.filter((i) => concluidos.includes(i.chave)).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-renascer-ink/50">
          {feitos} de {itens.length} concluído(s)
        </p>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
      </div>
      {itens.map((item) => {
        const feito = concluidos.includes(item.chave);
        return (
          <button
            key={item.chave}
            type="button"
            onClick={() => alternar(item.chave)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              feito ? "border-renascer/20 bg-renascer-light/50" : "border-renascer-ink/10 hover:bg-renascer-light/20"
            }`}
          >
            <span
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 text-xs ${
                feito ? "bg-renascer border-renascer text-white" : "border-renascer-ink/25"
              }`}
            >
              {feito && "✓"}
            </span>
            <span className={`text-sm ${feito ? "text-renascer-ink/50 line-through" : "text-renascer-ink"}`}>{item.texto}</span>
          </button>
        );
      })}
    </div>
  );
}
