interface KeyIconProps {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly order: number;
}

export function KeyIcon({ x, y, size, order }: KeyIconProps) {
  const s = size / 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} aria-label={`Часть ответа ${order}`}>
      <rect x="17" y="17" width="19" height="6" rx="1.5" fill="#d9a521" stroke="#7a5a10" strokeWidth="1.2" />
      <rect x="28" y="23" width="3.5" height="7" fill="#d9a521" stroke="#7a5a10" strokeWidth="1.2" />
      <rect x="33" y="23" width="3" height="5" fill="#d9a521" stroke="#7a5a10" strokeWidth="1.2" />
      <circle cx="13" cy="20" r="9.5" fill="#f0c33c" stroke="#7a5a10" strokeWidth="1.4" />
      <text x="13" y="24.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#5a3f06" fontFamily="PT Sans, Arial, sans-serif">
        {order}
      </text>
    </g>
  );
}
