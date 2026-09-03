import { useState } from "react";
import Logo from "./Logo";
import { sair } from "../lib/api";

export default function Layout({ user, abas = [], abaAtiva, onTrocarAba, children }) {
  const [menuAberto, setMenuAberto] = useState(false);

  function irPara(id) {
    onTrocarAba(id);
    setMenuAberto(false);
  }

  return (
    <div className="min-h-screen bg-renascer-light">
      <header className="bg-white border-b border-renascer/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {abas.length > 0 && (
              <button
                onClick={() => setMenuAberto(true)}
                className="md:hidden -ml-1 p-2 rounded-lg hover:bg-renascer-light"
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
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-renascer-ink/70 hidden sm:block">
                Olá, <strong>{user.nome}</strong>
              </span>
            )}
            <button onClick={sair} className="btn-secondary !px-4 !py-2 text-sm">
              Sair
            </button>
          </div>
        </div>
        {abas.length > 0 && (
          <nav className="hidden md:flex max-w-6xl mx-auto px-4 gap-1 overflow-x-auto pb-1">
            {abas.map((aba) => (
              <button
                key={aba.id}
                onClick={() => onTrocarAba(aba.id)}
                className={`whitespace-nowrap px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  abaAtiva === aba.id
                    ? "bg-renascer text-white"
                    : "text-renascer-ink/60 hover:bg-renascer-light"
                }`}
              >
                {aba.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Menu lateral (celular) — abre pra pegar as categorias sem precisar rolar a barra de cima */}
      {menuAberto && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAberto(false)} />
          <div className="absolute top-0 left-0 h-full w-72 max-w-[80%] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-renascer/10">
              <Logo size={44} />
              <button onClick={() => setMenuAberto(false)} className="p-2 rounded-lg hover:bg-renascer-light" aria-label="Fechar menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="4" x2="20" y2="20" />
                  <line x1="20" y1="4" x2="4" y2="20" />
                </svg>
              </button>
            </div>
            {user && (
              <p className="px-4 pt-3 text-sm text-renascer-ink/60">
                Olá, <strong>{user.nome}</strong>
              </p>
            )}
            <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
              {abas.map((aba) => (
                <button
                  key={aba.id}
                  onClick={() => irPara(aba.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                    abaAtiva === aba.id ? "bg-renascer text-white" : "text-renascer-ink/70 hover:bg-renascer-light"
                  }`}
                >
                  {aba.label}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-renascer/10">
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
