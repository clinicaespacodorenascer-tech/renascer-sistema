import { useState } from "react";
import Logo from "./Logo";
import { sair } from "../lib/api";

// ---------- Fase 31 — novo sistema visual ----------
// Casca (sidebar + cabeçalho mobile) do design novo (navy + azul + dourado, Sora/Public Sans),
// igual ao canvas "Novo Layout — Espaço do Renascer". Pensada pra já servir de base pro redesign
// das outras telas na Fase 32+ — mesma API de props do Layout.js antigo (user, abas, abaAtiva,
// onTrocarAba, children), só trocando o visual. `cargo` é o texto embaixo do nome da pessoa no
// rodapé da barra lateral (ex: "Setor financeiro").
const ROTULO_CARGO = {
  DONO: "Dono(a)",
  PROFISSIONAL: "Profissional",
  CLIENTE: "Cliente",
  ATENDENTE: "Atendente",
  FINANCEIRO: "Setor financeiro",
};

export default function LayoutNovo({ user, abas = [], abaAtiva, onTrocarAba, cargo, children }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const inicial = (user?.nome || "?").trim().charAt(0).toUpperCase();
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
      <div className="w-[34px] h-[34px] rounded-full bg-nv-navyLight flex items-center justify-center font-sora font-semibold text-[13px] text-white shrink-0 overflow-hidden">
        {user.fotoUrl ? <img src={user.fotoUrl} alt={user.nome} className="w-full h-full object-cover" /> : inicial}
      </div>
      <div className="leading-tight min-w-0">
        <p className="text-[13px] font-semibold text-[#F2F6FC] truncate">{user.nome}</p>
        <p className="text-[11.5px] text-[#8595AD] truncate">{cargoTexto}</p>
      </div>
      <button onClick={sair} className="ml-auto text-[11px] text-[#8595AD] hover:text-white underline whitespace-nowrap">
        Sair
      </button>
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
          <button onClick={sair} className="text-[12px] text-[#C3CFE2] underline">
            Sair
          </button>
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
        <main className="max-w-[1120px] mx-auto px-5 md:px-[42px] py-6 md:py-[38px] flex flex-col gap-[22px]">{children}</main>
      </div>
    </div>
  );
}
