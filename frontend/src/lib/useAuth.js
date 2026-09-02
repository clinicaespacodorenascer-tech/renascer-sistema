import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { pegarUsuario } from "./api";

// Protege uma página: exige login e, opcionalmente, um papel específico
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
    if (papelEsperado && u.role !== papelEsperado) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, carregando };
}
