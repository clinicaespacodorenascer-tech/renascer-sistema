import { useState } from "react";
import Logo from "./Logo";
import { sair } from "../lib/api";

function Avatar({ nome }) {
  const inicial = (nome || "?").trim().charAt(0).toUpperCase();
  return (
    <span className="w-8 h-8 rounded-full bg-renascer-gradient text-white text-sm font-semibold flex items-center justify-center shrink-0 ring-2 ring-gold/40">
      {inicial}
    </span>
  );
}

export default function Layout({ user, abas = [], abaAtiva, onTrocarAba, children }) {
  const [menuAberto, setMenuAberto] = useState(false);

  function irPara(id) {
    onTrocarAba(id);
    setMenuAberto(false);
  }

  return (
    <div className="min-h-screen">
      <div className="h-[3px] bg-gold-line" />
      <header className="bg-white/85 backdrop-blur-md border-b border-renascer-ink/[0.06] shadow-[0_1px_0_rgba(0,80,150,0.04)] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {abas.length > 0 && (
              <button
                onClick={() => setMenuAberto(true)}
                className="md:hidden -ml-1 p-2 rounded-lg hover:bg-renascer-light transition-colors"
                aria-label="Abrir menu"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            <Logo size={52} />
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:flex items-center gap-2 text-sm text-renascer-ink/70 bg-renascer-light/70 border border-renascer/10 rounded-full pl-1.5 pr-3 py-1">
                <Avatar nome={user.nome} />
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
        {abas.length > 0 && (
          <nav className="hidden md:flex max-w-6xl mx-auto px-4 gap-1 overflow-x-auto">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => onTrocarAba(aba.id)}
                className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                  abaAtiva === aba.id ? "text-renascer" : "text-renascer-ink/55 hover:text-renascer-ink"
                }`}
              >
                {aba.label}
                <span
                  className={`absolute left-3 right-3 -bottom-px h-[2.5px] rounded-full bg-gold transition-opacity ${
                    abaAtiva === aba.id ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Menu lateral (celular) — abre pra pegar as categorias sem precisar rolar a barra de cima */}
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
                <Avatar nome={user.nome} />
                <span>
                  Olá, <strong className="text-renascer-ink">{user.nome}</strong>
                </span>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
              {abas.map((aba) => (
                <button
                  key={aba.id}
                  onClick={() => irPara(aba.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    abaAtiva === aba.id ? "bg-renascer-light text-renascer border-l-2 border-gold" : "text-renascer-ink/70 hover:bg-renascer-light"
                  }`}
                >
                  {aba.label}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-renascer-ink/[0.06]">
              <button onClick={sair} className="btn-secondary w-full">
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
