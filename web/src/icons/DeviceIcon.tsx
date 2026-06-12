

interface Props {
  name: string;
  size?: number;
}

function Frame({ children, size = 28 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// batteryGlyph: an enclosure with `cells` vertical dividers and a lightning bolt.
function batteryGlyph(cells: number) {
  const left = 3;
  const right = 21;
  const span = right - left;
  const dividers = [];
  for (let i = 1; i < cells; i++) {
    const x = left + (span * i) / cells;
    dividers.push(<line key={i} x1={x} y1={6} x2={x} y2={18} opacity={0.5} />);
  }
  return (
    <>
      <rect x={left} y={6} width={span} height={12} rx={1.5} />
      {dividers}
      <path
        d="M13 8.5l-3 4h2.2l-1 3 3-4H14z"
        fill="currentColor"
        stroke="none"
      />
    </>
  );
}

export function DeviceIcon({ name, size }: Props) {
  switch (name) {
    case "MegapackXL":
      return <Frame size={size}>{batteryGlyph(4)}</Frame>;
    case "Megapack2":
      return <Frame size={size}>{batteryGlyph(3)}</Frame>;
    case "Megapack":
      return <Frame size={size}>{batteryGlyph(3)}</Frame>;
    case "PowerPack":
      return <Frame size={size}>{batteryGlyph(1)}</Frame>;
    case "Transformer":
      return (
        <Frame size={size}>
          {/* E-core */}
          <rect x={4} y={5} width={16} height={14} rx={1.5} />
          <line x1={12} y1={5} x2={12} y2={19} />
          {/* coil windings */}
          <line x1={7} y1={8} x2={9} y2={8} />
          <line x1={7} y1={11} x2={9} y2={11} />
          <line x1={7} y1={14} x2={9} y2={14} />
          <line x1={15} y1={8} x2={17} y2={8} />
          <line x1={15} y1={11} x2={17} y2={11} />
          <line x1={15} y1={14} x2={17} y2={14} />
        </Frame>
      );
    default:
      return (
        <Frame size={size}>
          <rect x={4} y={6} width={16} height={12} rx={1.5} />
        </Frame>
      );
  }
}