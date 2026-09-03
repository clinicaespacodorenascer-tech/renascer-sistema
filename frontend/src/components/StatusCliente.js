// Bolinha pulsante de status do cliente — verde (em dia), amarelo (perto de renovar) ou
// vermelho (atrasado/não renovou). É só visual: quem calcula o status é o backend
// (utils/statusCliente.js), a partir do pacote atual e da data de renovação combinada.
const CORES = {
  VERDE: { bola: "bg-emerald-500", label: "Em dia" },
  AMARELO: { bola: "bg-amber-500", label: "Perto de renovar" },
  VERMELHO: { bola: "bg-red-500", label: "Atrasado / não renovou" },
};

export default function StatusCliente({ status, mostrarLabel = false }) {
  const cor = CORES[status] || CORES.VERDE;
  return (
    <span className="inline-flex items-center gap-1.5" title={cor.label}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cor.bola} opacity-75`}></span>
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cor.bola}`}></span>
      </span>
      {mostrarLabel && <span className="text-xs text-renascer-ink/60">{cor.label}</span>}
    </span>
  );
}
