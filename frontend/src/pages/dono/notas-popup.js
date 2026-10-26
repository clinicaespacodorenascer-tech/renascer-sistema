import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";

// ============================================================================================
// Fase 71 — "Bloco de notas" de aula, item 6 do pedido do Dono:
//
//   "quero um bloco de notas que seja possivel eu abrir ele como uma aba tipo que possa ficar
//    pequeno e eu possa ir para minha aula que estou tendo no claude [...] quero que quando eu
//    quiser ir pra tela do claude eu consiga abrir o meu sistema em uma versão miniatura do bloco
//    de nota pra eu conseguir acompanhar a aula e ir anotando"
//
// Essa página é separada de propósito: não usa <LayoutNovo> (sem menu lateral, sem abas) porque
// ela é aberta numa JANELA POP-UP pequena (via window.open, ver o botão "Bloco de notas" no menu
// do Dono em LayoutNovo.js), pra ficar flutuando do lado da aula/vídeo enquanto o Dono anota —
// o objetivo é a janela ser mínima e sempre no topo, não uma tela cheia do sistema.
//
// Guarda a mesma sessão de login (pegarUsuario/localStorage são do mesmo domínio, então a janela
// pop-up já abre autenticada, sem pedir login de novo) e usa as rotas de backend que já existem
// em dono.js (/dono/anotacoes-estudo), feitas na Fase 71 junto com o Banco de Oportunidades.
//
// Autosave: cada letra digitada não dispara uma chamada pro servidor — espera 900ms sem digitar
// (debounce) antes de salvar, pra não sobrecarregar a API numa digitação rápida.
// ============================================================================================

export default function NotasPopup() {
  const { user, carregando } = useAuth("DONO");
  const [lista, setLista] = useState([]);
  const [selecionadaId, setSelecionadaId] = useState(null);
  const [temaEdit, setTemaEdit] = useState("");
  const [conteudoEdit, setConteudoEdit] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [painelListaAberto, setPainelListaAberto] = useState(true);
  const timerRef = useRef(null);

  function carregarLista(selecionarId) {
    api.get("/dono/anotacoes-estudo").then((r) => {
      setLista(r.data);
      if (selecionarId) {
        const achada = r.data.find((a) => a.id === selecionarId);
        if (achada) selecionarAula(achada);
      } else if (!selecionadaId && r.data.length > 0) {
        selecionarAula(r.data[0]);
      }
    });
  }

  useEffect(() => {
    if (carregando) return;
    carregarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando]);

  function selecionarAula(aula) {
    setSelecionadaId(aula.id);
    setTemaEdit(aula.tema);
    setConteudoEdit(aula.conteudo || "");
    setPainelListaAberto(false); // na janela pequena, ao escolher uma aula já fecha a lista pra sobrar espaço pro texto
  }

  function agendarSalvar(temaNovo, conteudoNovo) {
    if (!selecionadaId) return;
    clearTimeout(timerRef.current);
    setSalvando(true);
    timerRef.current = setTimeout(() => {
      api
        .put(`/dono/anotacoes-estudo/${selecionadaId}`, { tema: temaNovo, conteudo: conteudoNovo })
        .then(() => {
          setSalvando(false);
          setLista((atual) =>
            atual
              .map((a) => (a.id === selecionadaId ? { ...a, tema: temaNovo, conteudo: conteudoNovo } : a))
              .sort((a, b) => (a.id === selecionadaId ? -1 : b.id === selecionadaId ? 1 : 0))
          );
        })
        .catch(() => setSalvando(false));
    }, 900);
  }

  function onTemaChange(v) {
    setTemaEdit(v);
    agendarSalvar(v, conteudoEdit);
  }

  function onConteudoChange(v) {
    setConteudoEdit(v);
    agendarSalvar(temaEdit, v);
  }

  function novaAula() {
    const tema = window.prompt("Tema da aula:");
    if (!tema || !tema.trim()) return;
    api.post("/dono/anotacoes-estudo", { tema: tema.trim() }).then((r) => {
      setLista((atual) => [r.data, ...atual]);
      selecionarAula(r.data);
    });
  }

  function excluirAula(id, e) {
    e.stopPropagation();
    if (!window.confirm("Excluir essa aula e as anotações dela?")) return;
    api.delete(`/dono/anotacoes-estudo/${id}`).then(() => {
      setLista((atual) => atual.filter((a) => a.id !== id));
      if (selecionadaId === id) {
        setSelecionadaId(null);
        setTemaEdit("");
        setConteudoEdit("");
      }
    });
  }

  if (carregando) return null;

  return (
    <div className="h-screen w-screen flex flex-col bg-white font-publicSans overflow-hidden">
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>

      {/* Barra de topo — bem fina, só pra identificar a janela e alternar lista/anotação */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-nv-navy shrink-0">
        <button
          type="button"
          onClick={() => setPainelListaAberto((v) => !v)}
          className="text-white/80 hover:text-white text-xs font-semibold shrink-0"
          title="Ver todas as aulas"
        >
          ☰ Aulas
        </button>
        <p className="text-white text-[12.5px] font-sora font-semibold truncate flex-1 text-center">Bloco de notas</p>
        <span className="text-[10.5px] text-white/50 shrink-0 w-10 text-right">{salvando ? "salvando…" : "salvo"}</span>
      </div>

      {painelListaAberto ? (
        <div className="flex-1 overflow-y-auto">
          <button
            type="button"
            onClick={novaAula}
            className="w-full text-left px-3 py-2.5 text-[13px] font-semibold text-nv-blue border-b border-nv-borderLight"
          >
            + Nova aula
          </button>
          {lista.length === 0 && <p className="text-[12.5px] text-nv-muted3 px-3 py-4">Nenhuma aula registrada ainda.</p>}
          {lista.map((a) => (
            <div
              key={a.id}
              onClick={() => selecionarAula(a)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b border-nv-borderLight cursor-pointer ${
                a.id === selecionadaId ? "bg-nv-bg" : ""
              }`}
            >
              <p className="text-[13px] text-nv-ink2 truncate">{a.tema}</p>
              <button type="button" onClick={(e) => excluirAula(a.id, e)} className="text-nv-muted3 hover:text-nv-red text-[11px] shrink-0">
                excluir
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <input
            value={temaEdit}
            onChange={(e) => onTemaChange(e.target.value)}
            placeholder="Tema da aula"
            className="px-3 py-2 text-[14px] font-sora font-semibold text-nv-ink border-b border-nv-borderLight outline-none shrink-0"
          />
          <textarea
            value={conteudoEdit}
            onChange={(e) => onConteudoChange(e.target.value)}
            placeholder="Vai anotando aqui enquanto acompanha a aula…"
            className="flex-1 w-full resize-none outline-none px-3 py-2.5 text-[13.5px] text-nv-ink2 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
