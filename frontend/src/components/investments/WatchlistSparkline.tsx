import { useMemo } from 'react';

interface WatchlistSparklineProps {
  data: number[];
  isPositive: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export function WatchlistSparkline({
  data,
  isPositive,
  width = 90,
  height = 34,
  className = '',
}: WatchlistSparklineProps) {
  const points = useMemo(() => {
    if (!data || data.length < 2) {
      // Fallback artificial suave se não houver pontos suficientes
      const base = isPositive ? [10, 10.5, 11, 10.8, 11.5, 12] : [12, 11.5, 11, 11.2, 10.5, 10];
      return base;
    }
    return data;
  }, [data, isPositive]);

  const pathData = useMemo(() => {
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const padding = 3;
    const effectiveHeight = height - padding * 2;
    const stepX = (width - padding * 2) / (points.length - 1);

    const coords = points.map((val, idx) => {
      const x = padding + idx * stepX;
      // Inverte Y pois o SVG 0 fica no topo
      const normalized = (val - min) / range;
      const y = height - padding - normalized * effectiveHeight;
      return { x, y };
    });

    if (coords.length === 0) return { line: '', area: '' };

    // Construção de curva suave (Catmull-Rom / Bezier simples)
    let line = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2 >= coords.length ? coords.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const lastCoord = coords[coords.length - 1];
    const firstCoord = coords[0];
    const area = `${line} L ${lastCoord.x} ${height} L ${firstCoord.x} ${height} Z`;

    return { line, area };
  }, [points, width, height]);

  const strokeColor = isPositive ? '#10B981' : '#EF4444';
  const fillGradientId = `spark-grad-${isPositive ? 'pos' : 'neg'}-${width}-${height}`;

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Linha pontilhada de referência (como no Apple Bolsa) */}
        <line
          x1="2"
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeDasharray="2 2"
          strokeWidth="1"
        />

        {/* Área preenchida transparente com gradiente */}
        {pathData.area && (
          <path d={pathData.area} fill={`url(#${fillGradientId})`} />
        )}

        {/* Linha suave do gráfico */}
        {pathData.line && (
          <path
            d={pathData.line}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}
