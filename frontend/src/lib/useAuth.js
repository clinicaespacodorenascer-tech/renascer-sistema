import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { pegarUsuario } from "./api";

// Protege uma página: exige login e, opcionalmente, um papel específico.
//
// Exceção "Dono também é Profissional" (Fase 13): quem pede acesso de PROFISSIONAL também deixa
// passar um usuário cujo papel PRINCIPAL é outro (ex: o Dono), desde que ele tenha um cadastro de
// Profissional vinculado ao mesmo login — espelha exatamente a mesma exceção que o backend já
// aplica em `permitir()` (backend/src/middleware/auth.js). Sem isso, um Dono que também atende
// clientes era jogado de volta pro login ao clicar em "Entrar na videochamada" na própria agenda,
// porque essa tela (`/profissional/videochamada/[id]`) antes exigia `role === "PROFISSIONAL"` ao
// pé da letra, e o papel principal de um Dono é "DONO" mesmo quando ele também é profissional.
export function useAuth(papelEsperado) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const u = pegarUsuario();
    if (!u) {
      router.replace("/login");
      return;
    }
    const temPapelPrincipal = !papelEsperado || u.role === papelEsperado;
    const temAcessoExtraDeProfissional = papelEsperado === "PROFISSIONAL" && !!u.profissional;
    if (!temPapelPrincipal && !temAcessoExtraDeProfissional) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, carregando };
}
