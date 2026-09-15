import { formatarPresenca } from "../lib/presenca";

// Bolinha + texto de presença ("Online agora" / "Visto há X min/h/dias"). Recebe o
// User.ultimoAcessoEm — quem decide se manda esse dado pro frontend é cada rota do backend, então
// esse componente só aparece em telas que já receberam a informação (o cliente nunca recebe a
// presença de nenhuma profissional, por exemplo).
export default function IndicadorPresenca({ ultimoAcessoEm, className = "" }) {
  const { online, texto } = formatarPresenca(ultimoAcessoEm);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${online ? "text-emerald-700" : "text-renascer-ink/50"} ${className}`}>
      <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-renascer-ink/30"}`} />
      {texto}
    </span>
  );
}
