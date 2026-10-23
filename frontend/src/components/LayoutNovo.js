import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import api, { sair, atualizarUsuarioLocal } from "../lib/api";
import { inscreverPush, statusPermissao, tentarReinscreverSilenciosamente } from "../lib/push";

// ---------- Fase 31 — novo sistema visual ----------
// Casca (sidebar + cabeçalho mobile) do design novo (navy + azul + dourado, Sora/Public Sans),
// igual ao canvas "Novo Layout — Espaço do Renascer". Pensada pra já servir de base pro redesign
// das outras telas na Fase 32+ — mesma API de props do Layout.js antigo (user, abas, abaAtiva,
// onTrocarAba, children), só trocando o visual. `cargo` é o texto embaixo do nome da pessoa no
// rodapé da barra lateral (ex: "Setor financeiro").
//
// Fase 34 — redesign visual das telas antigas: antes de passar a ser usado por Dono, Atendente,
// Profissional e Cliente (que já tinham foto de perfil clicável e sininho de notificações no
// Layout.js antigo), esta casca ganhou as MESMAS duas funções, reaproveitando a lógica igualzinha
// — só o visual (cores/posição) foi adaptado pro fundo navy. Sem isso, trocar de Layout pra
// LayoutNovo faria essas 4 áreas perderem funções que já tinham.
const ROTULO_CARGO = {
  DONO: "Dono(a)",
  PROFISSIONAL: "Profissional",
  CLIENTE: "Cliente",
  ATENDENTE: "Atendente",
  FINANCEIRO: "Setor financeiro",
};

// Avatar clicável pra trocar a própria foto — mesma lógica do Layout.js antigo (componente
// AvatarEditavel), só com as cores adaptadas pro fundo escuro da barra lateral/cabeçalho novos.
function AvatarEditavelNovo({ user }) {
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
        className="w-[34px] h-[34px] rounded-full overflow-hidden bg-nv-navyLight flex items-center justify-center font-sora font-semibold text-[13px] text-white ring-2 ring-nv-gold/0 hover:ring-nv-gold/70 transition-all"
      >
        {foto ? <img src={foto} alt="Sua foto" className="w-full h-full object-cover" /> : inicial}
      </button>
      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-nv-gold text-white flex items-center justify-center text-[8px] ring-2 ring-nv-navy pointer-events-none">
        {enviando ? "…" : "✎"}
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={trocarFoto} />
      {erro && (
        <span className="absolute bottom-full mb-1 left-0 text-[10px] text-red-600 bg-white border border-red-200 rounded px-2 py-1 shadow-lg whitespace-nowrap z-10">
          {erro}
        </span>
      )}
    </span>
  );
}

// Sininho de notificações — mesma lógica do Layout.js antigo (componente SininhoNotificacoes:
// contador de avisos não lidos + botão pra ativar notificação push no aparelho), só com as cores
// adaptadas pro fundo escuro.
function SininhoNotificacoesNovo() {
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
        className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors text-[#C3CFE2]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {totalNaoLidas > 0 && (
          <span className="absolute top-0 right-0 min-w-[14px] h-3.5 px-1 rounded-full bg-nv-gold text-white text-[9px] font-semibold flex items-center justify-center leading-none">
            {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl border border-black/10 z-40 max-h-[70vh] overflow-y-auto text-[#121E33]">
          <div className="p-3 border-b border-black/[0.06] flex items-center justify-between gap-2 sticky top-0 bg-white">
            <span className="font-semibold text-sm">Notificações</span>
            {statusPush !== "granted" && (
              <button
                type="button"
                onClick={ativarNotificacoes}
                disabled={ativando}
                className="text-xs text-nv-blue underline whitespace-nowrap disabled:opacity-50"
              >
                {ativando ? "Ativando..." : "Ativar no aparelho"}
              </button>
            )}
            {statusPush === "granted" && <span className="text-[11px] text-green-700">Push ativado ✓</span>}
          </div>
          {avisoPush && <p className="px-3 py-2 text-xs text-red-600 border-b border-black/[0.06]">{avisoPush}</p>}
          <div className="p-2 space-y-1.5">
            {lista.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => marcarLida(n.id)}
                className={`w-full text-left border rounded-lg p-2.5 transition-colors ${
                  n.lida ? "border-black/10" : "border-nv-blue/40 bg-nv-blue/5"
                }`}
              >
                <p className="font-medium text-xs">{n.titulo}</p>
                <p className="text-xs text-black/60 mt-0.5">{n.mensagem}</p>
              </button>
            ))}
            {lista.length === 0 && <p className="text-xs text-black/40 px-2 py-4 text-center">Nenhum aviso por enquanto.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LayoutNovo({ user, abas = [], abaAtiva, onTrocarAba, cargo, children }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const cargoTexto = cargo || ROTULO_CARGO[user?.role] || "";

  function irPara(id) {
    onTrocarAba(id);
    setMenuAberto(false);
  }

  const conteudoNav = (
    <nav className="flex flex-col gap-0.5 text-[13.5px] font-medium" aria-label="Menu principal">
      {abas.map((aba) => {
        const ativa = abaAtiva === aba.id;
        return (
          <button
            key={aba.id}
            onClick={() => irPara(aba.id)}
            className={`text-left px-3 py-2 rounded-lg transition-colors ${
              ativa ? "bg-nv-blue text-white font-semibold" : "text-[#C3CFE2] font-medium hover:bg-white/10"
            }`}
          >
            {aba.label}
          </button>
        );
      })}
    </nav>
  );

  const rodapeUsuario = user && (
    <div className="flex items-center gap-2.5 px-2 py-2.5 border-t border-white/10">
      <AvatarEditavelNovo user={user} />
      <div className="leading-tight min-w-0">
        <p className="text-[13px] font-semibold text-[#F2F6FC] truncate">{user.nome}</p>
        <p className="text-[11.5px] text-[#8595AD] truncate">{cargoTexto}</p>
      </div>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        <SininhoNotificacoesNovo />
        <button onClick={sair} className="text-[11px] text-[#8595AD] hover:text-white underline whitespace-nowrap">
          Sair
        </button>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-nv-bg font-publicSans text-[#121E33]">
      {/* Barra lateral fixa (computador) */}
      {abas.length > 0 && (
        <aside
          className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-[264px] bg-nv-navy text-[#D9E3F2] px-[18px] py-7 gap-7 z-20"
          style={{ borderTop: "3px solid transparent", borderImage: "linear-gradient(90deg, #9C6B2E, #0B5FA8) 1" }}
        >
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-[0_4px_10px_rgba(11,95,168,0.35)]">
              <Logo size={26} />
            </div>
            <div className="font-sora font-semibold text-[14.5px] text-[#F2F6FC] leading-tight">
              Espaço do
              <br />
              Renascer
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">{conteudoNav}</div>

          {rodapeUsuario}
        </aside>
      )}

      {/* Cabeçalho (celular) */}
      <header className="md:hidden bg-nv-navy text-white sticky top-0 z-20" style={{ borderTop: "3px solid transparent", borderImage: "linear-gradient(90deg, #9C6B2E, #0B5FA8) 1" }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {abas.length > 0 && (
              <button onClick={() => setMenuAberto(true)} className="-ml-1 p-2 rounded-lg hover:bg-white/10" aria-label="Abrir menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <div className="font-sora font-semibold text-[14.5px] text-[#F2F6FC]">Espaço do Renascer</div>
          </div>
          <div className="flex items-center gap-3">
            {user && <SininhoNotificacoesNovo />}
            <button onClick={sair} className="text-[12px] text-[#C3CFE2] underline">
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Menu em gaveta (celular) */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuAberto(false)} />
          <div className="absolute top-0 left-0 h-full w-72 max-w-[80%] bg-nv-navy text-[#D9E3F2] flex flex-col px-[18px] py-7 gap-7">
            <div className="flex items-center justify-between">
              <div className="font-sora font-semibold text-[14.5px] text-[#F2F6FC]">Espaço do Renascer</div>
              <button onClick={() => setMenuAberto(false)} className="p-2 rounded-lg hover:bg-white/10" aria-label="Fechar menu">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="20" y2="20" />
                  <line x1="20" y1="4" x2="4" y2="20" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{conteudoNav}</div>
            {rodapeUsuario}
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className={abas.length > 0 ? "md:pl-[264px]" : ""}>
        <main className="px-5 md:px-[42px] py-6 md:py-[38px] flex flex-col gap-[22px]">{children}</main>
      </div>
    </div>
  );
}
