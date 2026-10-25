import { useState } from "react";
import api from "../lib/api";

// Fase 69 — pop-up de "clientes pra renovar" que abre sozinho ao entrar no sistema, pra quem não
// olha o sininho. Reaproveitado por profissional (vê só a carteira dela, escopo "hoje"), atendente
// (clínica inteira, escopo "essa semana") e dono/financeiro (clínica inteira, escopo "essa
// semana", reaproveitando a mesma rota /financeiro/clientes-renovar-por-data que já alimenta a
// aba "Clientes pra renovar"). Mesma lógica de urgência/WhatsApp da aba Financeiro (Fase 57),
// simplificada pro formato de lista curta dentro de um modal.

// renovarEm é salvo como meia-noite UTC — compara em UTC pra não variar com o fuso de quem está
// vendo a tela (mesmo cuidado já tomado em financeiro/index.js).
function diasAte(iso) {
  if (!iso) return null;
  const alvo = new Date(iso);
  const alvoUTC = Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), alvo.getUTCDate());
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((alvoUTC - hojeUTC) / (24 * 60 * 60 * 1000));
}

function urgencia(dias) {
  if (dias == null) return { cor: "#96A2B6", texto: "sem data" };
  if (dias < 0) return { cor: "#D94F4F", texto: `atrasado ${-dias}d` };
  if (dias === 0) return { cor: "#D94F4F", texto: "hoje" };
  if (dias === 1) return { cor: "#D94F4F", texto: "amanhã" };
  if (dias <= 3) return { cor: "#D94F4F", texto: `em ${dias}d` };
  if (dias <= 10) return { cor: "#D6883B", texto: `em ${dias}d` };
  return { cor: "#1C7C54", texto: `em ${dias}d` };
}

// `rotaMarcarContatado`: prefixo da rota de papel (ex: "/profissional", "/atendente",
// "/financeiro") — o toggle "marcar como contatado" é o mesmo endpoint em todas (PUT
// `${rota}/clientes/:id/marcar-contatado`), só muda o prefixo porque cada papel tem seu próprio
// arquivo de rotas (ver backend/src/routes/*.js).
export default function PopupRenovacoes({ titulo, subtitulo, clientes, mostrarProfissional, rotaMarcarContatado, onFechar, onAtualizarCliente }) {
  const [marcando, setMarcando] = useState(null);

  async function marcarContatado(c) {
    setMarcando(c.id);
    try {
      await api.put(`${rotaMarcarContatado}/clientes/${c.id}/marcar-contatado`);
      onAtualizarCliente(c.id);
    } catch (e) {
      // não é crítico — a lista continua igual, dá pra tentar de novo
    } finally {
      setMarcando(null);
    }
  }

  const ordenada = [...clientes].sort((a, b) => {
    const da = diasAte(a.renovarEm);
    const db = diasAte(b.renovarEm);
    if (da == null && db == null) return a.nome.localeCompare(b.nome);
    if (da == null) return 1;
    if (db == null) return -1;
    return da - db;
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <p className="nv-eyebrow mb-1">Renovações</p>
          <h3 className="font-sora font-semibold text-nv-ink text-lg">{titulo}</h3>
          {subtitulo && <p className="text-sm text-nv-ink2 mt-1">{subtitulo}</p>}
        </div>

        <div className="divide-y divide-nv-borderLight">
          {ordenada.map((c) => {
            const dias = diasAte(c.renovarEm);
            const { cor, texto } = urgencia(dias);
            const contatado = !!c.renovarContatadoEm;
            const dataFormatada = c.renovarEm
              ? new Date(c.renovarEm).toLocaleDateString("pt-BR", { timeZone: "UTC" })
              : null;
            return (
              <div key={c.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-nv-ink2">{c.nome}</p>
                  <p className="text-[11.5px] text-nv-muted3">
                    {dataFormatada ? `renova em ${dataFormatada}` : "sem data definida"}
                    {mostrarProfissional && c.profissionalNome ? ` · ${c.profissionalNome}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: cor }}>
                    {texto}
                  </span>
                  {c.whatsapp ? (
                    <a
                      className="text-nv-green text-[12px] font-semibold underline whitespace-nowrap"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://wa.me/55${c.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Oi ${c.nome}! Aqui é do Espaço do Renascer, passando pra saber como você está e como estão indo as sessões 💙`
                      )}`}
                    >
                      WhatsApp
                    </a>
                  ) : (
                    <span className="text-[11px] text-nv-muted3 italic whitespace-nowrap">sem WhatsApp cadastrado</span>
                  )}
                  <button
                    type="button"
                    disabled={marcando === c.id}
                    onClick={() => marcarContatado(c)}
                    className={`text-[11.5px] font-semibold underline whitespace-nowrap ${
                      contatado ? "text-nv-muted2" : "text-nv-blue"
                    }`}
                  >
                    {contatado ? "Contatado" : "Marcar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" className="text-xs text-nv-muted3 underline block mx-auto" onClick={onFechar}>
          Fechar — ver depois
        </button>
      </div>
    </div>
  );
}
