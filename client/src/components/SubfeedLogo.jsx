export default function SubfeedLogo({ size = 24, color = 'currentColor' }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.75)}
      viewBox="0 0 60 45"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
    >
      <rect x="0" y="0"    width="60" height="12" />
      <rect x="0" y="16.5" width="60" height="12" />
      <rect x="0" y="33"   width="60" height="12" />
    </svg>
  )
}
