import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import api, { sair, atualizarUsuarioLocal } from "../lib/api";
import { inscreverPush, statusPermissao, tentarReinscreverSilenciosamente } from "../lib/push";

// Avatar que qualquer papel (Cliente, Atendente, Dono ou Profissional) pode clicar pra trocar a
// própria foto — antes só a Profissional tinha isso, na tela de perfil dela. Aqui é a mesma foto
// (mesmo campo fotoUrl do usuário), só que direto pelo cabeçalho/menu, disponível pra todo mundo.
function AvatarEditavel({ user }) {
  const inputRef = useRef(null);
  const [foto, setFoto] = useState(user?.fotoUrl || null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const inicial = (user?.nome || "?").trim().charAt(0).toUpperCase();

  async function trocarFoto(e) {
    const arquivo = e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const fotoBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(arquivo);
      });
      const { data } = await api.put("/comum/minha-foto", { fotoBase64 });
      setFoto(data.fotoUrl);
      atualizarUsuarioLocal({ fotoUrl: data.fotoUrl });
    } catch (err) {
      setErro(err?.response?.data?.erro || "Não foi possível trocar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Trocar foto de perfil"
        className="w-8 h-8 rounded-full overflow-hidden bg-renascer-gradient text-white text-sm font-semibold flex items-center justify-center ring-2 ring-gold/40 hover:ring-gold transition-all"
      >
        {foto ? <img src={foto} alt="Sua foto" className="w-full h-full object-cover" /> : inicial}
      </button>
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gold text-white flex items-center justify-center text-[8px] ring-2 ring-white pointer-events-none">
        {enviando ? "…" : "✎"}
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={trocarFoto} />
      {erro && (
        <span className="absolute top-full mt-1 right-0 text-[10px] text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow-soft whitespace-nowrap z-10">
          {erro}
        </span>
      )}
    </span>
  );
}

// Sininho de notificações — usado por TODOS os papéis (Dono, Profissional, Cliente, Atendente),
// por isso mora aqui no Layout compartilhado em vez de dentro de cada página. Faz duas coisas:
// mostra os avisos salvos dentro do app (o que já existia antes, cada papel tinha sua própria
// aba "Avisos" pra isso) e oferece o botão pra ativar notificação push de verdade no aparelho
// (toque/vibração, mesmo com o app fechado).
function SininhoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [statusPush, setStatusPush] = useState("default");
  const [ativando, setAtivando] = useState(false);
  const [avisoPush, setAvisoPush] = useState("");
  const menuRef = useRef(null);

  async function carregarTotal() {
    try {
      const { data } = await api.get("/comum/notificacoes/nao-lidas/total");
      setTotalNaoLidas(data.total);
    } catch (e) {
      // silencioso — não vale a pena travar a tela por causa do contador do sininho
    }
  }

  useEffect(() => {
    carregarTotal();
    setStatusPush(statusPermissao());
    tentarReinscreverSilenciosamente();
    const intervalo = setInterval(carregarTotal, 60000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function fecharAoClicarFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  async function carregarLista() {
    const { data } = await api.get("/comum/notificacoes");
    setLista(data);
  }

  async function alternarMenu() {
    const vaiAbrir = !aberto;
    setAberto(vaiAbrir);
    if (vaiAbrir) await carregarLista();
  }

  async function marcarLida(id) {
    await api.put(`/comum/notificacoes/${id}/lida`);
    setLista((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    carregarTotal();
  }

  async function ativarNotificacoes() {
    setAtivando(true);
    setAvisoPush("");
    const resultado = await inscreverPush();
    setAtivando(false);
    setStatusPush(statusPermissao());
    if (!resultado.ok) setAvisoPush(resultado.motivo || "Não foi possível ativar as notificações agora.");
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={alternarMenu}
        aria-label="Notificações"
        className="relative p-2 rounded-lg hover:bg-renascer-light transition-colors text-renascer-ink/70"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalNaoLidas > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-gold text-white text-[10px] font-semibold flex items-center justify-center leading-none">
            {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-renascer-ink/10 z-40 max-h-[70vh] overflow-y-auto">
          <div className="p-3 border-b border-renascer-ink/[0.06] flex items-center justify-between gap-2 sticky top-0 bg-white">
            <span className="font-semibold text-sm">Notificações</span>
            {statusPush !== "granted" && (
              <button
                type="button"
                onClick={ativarNotificacoes}
                disabled={ativando}
                className="text-xs text-renascer underline whitespace-nowrap disabled:opacity-50"
              >
                {ativando ? "Ativando..." : "Ativar no aparelho"}
              </button>
            )}
            {statusPush === "granted" && <span className="text-[11px] text-green-700">Push ativado ✓</span>}
          </div>
          {avisoPush && <p className="px-3 py-2 text-xs text-red-600 border-b border-renascer-ink/[0.06]">{avisoPush}</p>}
          <div className="p-2 space-y-1.5">
            {lista.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => marcarLida(n.id)}
                className={`w-full text-left border rounded-lg p-2.5 transition-colors ${
                  n.lida ? "border-renascer/10" : "border-renascer/40 bg-renascer-light/40"
                }`}
              >
                <p className="font-medium text-xs">{n.titulo}</p>
                <p className="text-xs text-renascer-ink/60 mt-0.5">{n.mensagem}</p>
              </button>
            ))}
            {lista.length === 0 && <p className="text-xs text-renascer-ink/40 px-2 py-4 text-center">Nenhum aviso por enquanto.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Fase 23 — redesign visual: ícones do menu lateral.
//
// As abas de cada papel (ex: { id: "clientes", label: "Clientes" }) já existiam antes e continuam
// exatamente iguais — nenhuma página precisou ser alterada. Pra não ter que editar os 4 painéis
// (Dono, Profissional, Atendente, Cliente) só pra adicionar um ícone em cada aba, o Layout decide
// sozinho qual ícone mostrar a partir do "id" da aba, com um ícone genérico de reserva pra
// qualquer aba nova que apareça no futuro e ainda não esteja nesta lista.
// ---------------------------------------------------------------------------------------------
const FORMAS_ICONE = {
  casa: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  pessoas: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M16 14.2c2.7.5 4.5 2.6 4.5 5.3" />
    </>
  ),
  maleta: (
    <>
      <rect x="2.5" y="7.5" width="19" height="12" rx="2" />
      <path d="M8 7.5V5.8A2.3 2.3 0 0 1 10.3 3.5h3.4A2.3 2.3 0 0 1 16 5.8V7.5" />
      <path d="M2.5 13h19" />
    </>
  ),
  fone: (
    <>
      <path d="M4 12.5v-1a8 8 0 0 1 16 0v1" />
      <rect x="2.5" y="12.5" width="4.5" height="6" rx="1.5" />
      <rect x="17" y="12.5" width="4.5" height="6" rx="1.5" />
    </>
  ),
  pessoaMais: (
    <>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M2.5 20.5c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3" />
      <path d="M18.5 7v6M15.5 10h6" />
    </>
  ),
  atualizar: (
    <>
      <path d="M3 11a9 9 0 0 1 15.3-5.8L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 13a9 9 0 0 1-15.3 5.8L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  calendario: (
    <>
      <rect x="2.8" y="4.5" width="18.4" height="16.5" rx="2.3" />
      <path d="M2.8 9.5h18.4M7.5 2.5v4M16.5 2.5v4" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="9.3" />
      <path d="M12 7v5l3.3 2" />
    </>
  ),
  carteira: (
    <>
      <rect x="2.5" y="6" width="19" height="13.5" rx="2.3" />
      <path d="M2.5 10.5h19" />
      <circle cx="16.5" cy="14.5" r="1.2" />
    </>
  ),
  grafico: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="12" width="3.4" height="8" rx="0.8" />
      <rect x="10.3" y="7.5" width="3.4" height="12.5" rx="0.8" />
      <rect x="15.6" y="3.5" width="3.4" height="16.5" rx="0.8" />
    </>
  ),
  alvo: (
    <>
      <circle cx="12" cy="12" r="9.3" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  moeda: (
    <>
      <circle cx="12" cy="12" r="9.3" />
      <path d="M12 7.3v9.4M9.6 9.4c0-1.3 1.1-2.1 2.4-2.1s2.4.8 2.4 1.9c0 2.8-4.8 1.4-4.8 4 0 1.2 1.1 2 2.4 2s2.4-.8 2.4-2.1" />
    </>
  ),
  bloco: (
    <>
      <rect x="4" y="2.5" width="16" height="19" rx="2" />
      <path d="M8 7.5h8M8 11.5h8M8 15.5h5" />
    </>
  ),
  sino: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  balao: (
    <>
      <path d="M3 5.5h18v11H8.5L4 20.5V16.5H3z" />
      <path d="M7.5 10h9M7.5 13h6" />
    </>
  ),
  check: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M8 12.5l2.5 2.5L16.5 9" />
    </>
  ),
  arquivo: (
    <>
      <path d="M6 2.5h8l5 5v13.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" />
      <path d="M14 2.5V8h5" />
      <path d="M8.5 13h7M8.5 16.5h7" />
    </>
  ),
  pasta: <path d="M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h5l2 2.5h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18z" />,
  ajuda: (
    <>
      <circle cx="12" cy="12" r="9.3" />
      <path d="M9.2 9.3a2.8 2.8 0 1 1 4.2 2.4c-.9.6-1.4 1.1-1.4 2.1" />
      <circle cx="12" cy="17.2" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  filtro: (
    <>
      <path d="M4 5.5h16M7 12h10M10 18.5h4" />
    </>
  ),
  ponto: <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />,
};

const MAPA_ICONE_POR_ABA = {
  dashboard: "casa",
  painel: "casa",
  clientes: "pessoas",
  usuarios: "pessoas",
  profissionais: "maleta",
  atender: "fone",
  cadastrar: "pessoaMais",
  reativar: "atualizar",
  agenda: "calendario",
  historico: "relogio",
  financeiro: "carteira",
  repasses: "carteira",
  resumo: "grafico",
  lancamentos: "grafico",
  metas: "alvo",
  poupanca: "moeda",
  notas: "bloco",
  diario: "bloco",
  notificacoes: "sino",
  avisos: "sino",
  chat: "balao",
  tarefas: "check",
  relatorios: "arquivo",
  contrato: "arquivo",
  materiais: "pasta",
  duvidas: "ajuda",
  suporte: "ajuda",
  config: "filtro",
};

function IconeAba({ id, className }) {
  const forma = FORMAS_ICONE[MAPA_ICONE_POR_ABA[id]] || FORMAS_ICONE.ponto;
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {forma}
    </svg>
  );
}

const ROTULO_PAINEL = {
  DONO: "Painel do Dono",
  PROFISSIONAL: "Painel do Profissional",
  CLIENTE: "Área do Cliente",
  ATENDENTE: "Painel do Atendente",
};

export default function Layout({ user, abas = [], abaAtiva, onTrocarAba, children }) {
  const [menuAberto, setMenuAberto] = useState(false);

  function irPara(id) {
    onTrocarAba(id);
    setMenuAberto(false);
  }

  return (
    <div className="min-h-screen">
      <div className="h-[3px] bg-gold-line" />

      {/* Menu lateral fixo (computador) — Fase 23: antes o menu de categorias era uma fileira de
          abas horizontais embaixo do cabeçalho; agora é uma barra lateral fixa à esquerda, no
          mesmo estilo do painel da Renascer IA, sempre visível enquanto a pessoa navega. */}
      {abas.length > 0 && (
        <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-renascer-ink/[0.06] z-20">
          <div className="p-5 border-b border-renascer-ink/[0.06] flex items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <p className="font-bold text-sm text-renascer-ink leading-tight truncate">Espaço do Renascer</p>
              {user && <p className="text-xs text-renascer-ink/55 truncate">{ROTULO_PAINEL[user.role] || "Painel"}</p>}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu principal">
            {abas.map((aba) => {
              const ativa = abaAtiva === aba.id;
              return (
                <button
                  key={aba.id}
                  onClick={() => onTrocarAba(aba.id)}
                  className={`flex items-center gap-3 w-full min-h-[46px] px-3 rounded-xl text-sm transition-colors ${
                    ativa ? "bg-gold-light text-gold-dark font-bold" : "text-renascer-ink/60 font-semibold hover:bg-renascer-light hover:text-renascer-ink"
                  }`}
                >
                  <IconeAba id={aba.id} className="shrink-0" />
                  <span className="truncate text-left">{aba.label}</span>
                </button>
              );
            })}
          </nav>

          {user && (
            <div className="p-3 border-t border-renascer-ink/[0.06] space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="flex items-center gap-2 min-w-0">
                  <AvatarEditavel user={user} />
                  <span className="text-xs text-renascer-ink/70 truncate">
                    Olá, <strong className="text-renascer-ink">{user.nome}</strong>
                  </span>
                </span>
                <SininhoNotificacoes />
              </div>
              <button onClick={sair} className="btn-secondary w-full !py-2 text-sm">
                Sair
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Cabeçalho (celular) — a barra lateral acima some em telas pequenas; no celular continua
          existindo um cabeçalho fixo no topo com o menu em gaveta, igual já funcionava antes. */}
      <header className="md:hidden bg-white/85 backdrop-blur-md border-b border-renascer-ink/[0.06] shadow-[0_1px_0_rgba(0,80,150,0.04)] sticky top-0 z-20">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {abas.length > 0 && (
              <button
                onClick={() => setMenuAberto(true)}
                className="-ml-1 p-2 rounded-lg hover:bg-renascer-light transition-colors"
                aria-label="Abrir menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <Logo size={44} />
          </div>
          <div className="flex items-center gap-3">
            {user && <SininhoNotificacoes />}
            {user && (
              <span className="hidden sm:flex items-center gap-2 text-sm text-renascer-ink/70 bg-renascer-light/70 border border-renascer/10 rounded-full pl-1.5 pr-3 py-1">
                <AvatarEditavel user={user} />
                <span>
                  Olá, <strong className="text-renascer-ink">{user.nome}</strong>
                </span>
              </span>
            )}
            <button onClick={sair} className="btn-secondary !px-4 !py-2 text-sm">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Menu em gaveta (celular) — abre pra pegar as categorias sem precisar rolar a barra de cima */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-renascer-deep/70 backdrop-blur-sm" onClick={() => setMenuAberto(false)} />
          <div className="absolute top-0 left-0 h-full w-72 max-w-[80%] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-renascer-ink/[0.06]">
              <Logo size={44} />
              <button onClick={() => setMenuAberto(false)} className="p-2 rounded-lg hover:bg-renascer-light transition-colors" aria-label="Fechar menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="20" y2="20" />
                  <line x1="20" y1="4" x2="4" y2="20" />
                </svg>
              </button>
            </div>
            {user && (
              <div className="flex items-center gap-2 px-4 pt-3 text-sm text-renascer-ink/60">
                <AvatarEditavel user={user} />
                <span>
                  Olá, <strong className="text-renascer-ink">{user.nome}</strong>
                </span>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
              {abas.map((aba) => {
                const ativa = abaAtiva === aba.id;
                return (
                  <button
                    key={aba.id}
                    onClick={() => irPara(aba.id)}
                    className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      ativa ? "bg-gold-light text-gold-dark font-bold" : "text-renascer-ink/70 font-medium hover:bg-renascer-light"
                    }`}
                  >
                    <IconeAba id={aba.id} className="shrink-0" />
                    <span className="truncate">{aba.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-renascer-ink/[0.06]">
              <button onClick={sair} className="btn-secondary w-full">
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo — no computador, empurrado pra direita pra abrir espaço pra barra lateral fixa */}
      <div className={abas.length > 0 ? "md:pl-64" : ""}>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
