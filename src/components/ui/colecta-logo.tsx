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
      {/* Hard offset shadow — pencil black, shifted down-right */}
      <path
        d="M38 7C54 6 70 20 70 38C71 55 56 70 38 70C20 71 5 56 6 38C5 20 21 8 38 7Z"
        fill="#2d2d2d"
      />
      {/* Main wobbly circle — primary red with pencil border */}
      <path
        d="M35 4C51 3 67 18 67 36C68 53 53 68 35 68C17 69 2 54 3 36C2 18 18 5 35 4Z"
        fill="hsl(0, 100%, 65%)"
        stroke="#2d2d2d"
        strokeWidth="2.5"
      />
      {/* C letter shadow (depth) */}
      <path
        d="M51 28C48 23 43 19.5 37 19.5C27.3 19.5 19.5 27.3 19.5 37C19.5 46.7 27.3 54.5 37 54.5C43 54.5 48 51 51 46"
        stroke="#2d2d2d"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      {/* C letter — white */}
      <path
        d="M51 28C48 23 43 19.5 37 19.5C27.3 19.5 19.5 27.3 19.5 37C19.5 46.7 27.3 54.5 37 54.5C43 54.5 48 51 51 46"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      {/* Blue ballpoint dot at C opening */}
      <circle cx="51" cy="28" r="3" fill="hsl(215, 56%, 40%)" stroke="#2d2d2d" strokeWidth="1.5" />
    </svg>
  );
}
