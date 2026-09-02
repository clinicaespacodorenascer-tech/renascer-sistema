// Logo real do Espaço do Renascer (arquivo em /public/logo.png).
// `size` = altura em pixels; a largura acompanha automaticamente.
export default function Logo({ size = 44 }) {
  return (
    <img
      src="/logo.png"
      alt="Espaço do Renascer"
      style={{ height: size, width: "auto" }}
      className="select-none"
    />
  );
}
