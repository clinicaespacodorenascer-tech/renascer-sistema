import Logo from "./Logo";
import { sair } from "../lib/api";

export default function Layout({ user, abas = [], abaAtiva, onTrocarAba, children }) {
  return (
    <div className="min-h-screen bg-renascer-light">
      <header className="bg-white border-b border-renascer/10 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo size={40} />
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
          <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto pb-1">
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
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
