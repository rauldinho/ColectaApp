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
      <circle cx="36" cy="36" r="34" fill="#ff5252" stroke="#2d2d2d" strokeWidth="2" />
      <path
        d="M52 24C48.5 19.5 42.6 16.5 36 16.5C23 16.5 12.5 25.8 12.5 37C12.5 48.2 23 57.5 36 57.5C42.6 57.5 48.5 54.5 52 50"
        stroke="white"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
