import { useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../../components/Layout";
import api from "../../../lib/api";
import { useAuth } from "../../../lib/useAuth";

export default function VideoChamadaProfissional() {
  const { user, carregando } = useAuth("PROFISSIONAL");
  const router = useRouter();
  const { agendamentoId } = router.query;
  const [chamada, setChamada] = useState(null);
  const [aviso, setAviso] = useState("");

  async function iniciar() {
    const { data } = await api.post(`/profissional/agenda/${agendamentoId}/iniciar-chamada`);
    setChamada(data);
    setAviso(data.aviso || "");
    if (data.linkMeet) {
      window.open(data.linkMeet, "_blank", "noopener,noreferrer");
    }
  }

  async function encerrar() {
    const { data } = await api.post(`/profissional/agenda/${agendamentoId}/encerrar-chamada`);
    setChamada(data);
  }

  if (carregando) return null;

  return (
    <Layout user={user}>
      <div className="card max-w-2xl mx-auto text-center">
        <h1 className="text-xl font-semibold mb-3">Sessão por videochamada</h1>
        {aviso && <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-sm mb-3">{aviso}</p>}
        <div className="aspect-video bg-renascer-ink/90 rounded-xl flex flex-col items-center justify-center text-white mb-4 gap-3">
          {chamada?.iniciadaEm && !chamada?.encerradaEm ? (
            <>
              <span>Sessão em andamento.</span>
              {chamada?.linkMeet && (
                <a
                  href={chamada.linkMeet}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                >
                  Abrir Google Meet
                </a>
              )}
            </>
          ) : (
            <span>A sala do Google Meet vai abrir em uma nova aba quando você entrar.</span>
          )}
        </div>
        <div className="flex justify-center gap-3">
          {!chamada?.iniciadaEm && (
            <button className="btn-primary" onClick={iniciar}>
              Entrar na chamada
            </button>
          )}
          {chamada?.iniciadaEm && !chamada?.encerradaEm && (
            <button className="btn-secondary" onClick={encerrar}>
              Encerrar chamada
            </button>
          )}
        </div>
        {chamada?.duracaoMinutos != null && (
          <p className="text-sm text-renascer-ink/60 mt-3">Duração registrada: {chamada.duracaoMinutos} minuto(s).</p>
        )}
      </div>
    </Layout>
  );
}
