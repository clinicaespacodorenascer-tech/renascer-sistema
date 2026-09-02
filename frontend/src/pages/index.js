import { useEffect } from "react";
import { useRouter } from "next/router";
import { pegarUsuario, rotaPorPapel } from "../lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = pegarUsuario();
    router.replace(user ? rotaPorPapel(user.role) : "/login");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
