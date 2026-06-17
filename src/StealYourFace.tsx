type StealYourFaceProps = {
  size?: number
  className?: string
}

// The Grateful Dead "Steal Your Face" (Stealie): a skull over a 13-point
// lightning bolt splitting a red/blue circle. Drawn as inline SVG so it scales
// crisply at any chip size.
export function StealYourFace({ size = 18, className }: StealYourFaceProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id="syf-clip">
          <circle cx="32" cy="32" r="31" />
        </clipPath>
      </defs>
      <g clipPath="url(#syf-clip)">
        <rect x="0" y="0" width="64" height="64" fill="#1f49c6" />
        {/* Red left half, divided from the blue right half by the bolt's zigzag. */}
        <path
          d="M32 1 L28 14 L36 24 L27 34 L37 44 L29 54 L32 63 L0 63 L0 1 Z"
          fill="#e7152b"
        />
      </g>
      <circle cx="32" cy="32" r="31" fill="none" stroke="#0f0d0b" strokeWidth="2" />
      {/* The lightning bolt, showing above the forehead and below the jaw. */}
      <polyline
        points="32,1 28,14 36,24 27,34 37,44 29,54 32,63"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Skull on top of the bolt. */}
      <ellipse cx="32" cy="26" rx="11.5" ry="10.5" fill="#ffffff" />
      <path d="M22 31 Q22 44 32 44 Q42 44 42 31 Z" fill="#ffffff" />
      <ellipse cx="27" cy="27" rx="2.8" ry="3.4" fill="#15120f" />
      <ellipse cx="37" cy="27" rx="2.8" ry="3.4" fill="#15120f" />
      <path d="M32 31 L29.5 35 L34.5 35 Z" fill="#15120f" />
    </svg>
  )
}
