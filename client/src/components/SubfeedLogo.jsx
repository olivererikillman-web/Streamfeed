export default function SubfeedLogo({ size = 32, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
    >
      <defs>
        <clipPath id="oval-clip">
          <ellipse cx="100" cy="120" rx="95" ry="115" />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="120" rx="95" ry="115" />
      {/* Upper-left white cut with chevron */}
      <polygon
        points="5,25 115,25 72,90 112,130 5,130"
        fill="white"
        clipPath="url(#oval-clip)"
      />
      {/* Lower-right white cut with chevron (mirrored) */}
      <polygon
        points="195,110 88,110 128,150 85,215 195,215"
        fill="white"
        clipPath="url(#oval-clip)"
      />
    </svg>
  )
}
