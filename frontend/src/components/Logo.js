export default function Logo({ size = 44 }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-full bg-white flex items-center justify-center border border-renascer/15 shadow-premium"
        style={{ width: size, height: size }}
      >
        <span className="font-bold text-renascer" style={{ fontSize: size * 0.42 }}>
          ER
        </span>
      </div>
      <div className="leading-tight">
        <div className="font-semibold text-renascer-ink tracking-wide" style={{ fontSize: size * 0.28 }}>
          ESPAÇO DO
        </div>
        <div className="font-bold text-renascer" style={{ fontSize: size * 0.36 }}>
          RENASCER
        </div>
      </div>
    </div>
  );
}
