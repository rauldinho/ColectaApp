export function ColectaLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Colecta"
    >
      <circle cx="36" cy="36" r="34" fill="#f05252" stroke="#2d2d2d" strokeWidth="2" />
      {/* C — arc centrado en (36,36), radio 17, apertura ~80° hacia la derecha */}
      <path
        d="M 49.8 24.4 A 17 17 0 1 0 49.8 47.6"
        stroke="white"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
