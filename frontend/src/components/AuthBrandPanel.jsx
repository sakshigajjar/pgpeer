// Right-side brand panel for the auth pages.
// - Diagonal slant on the left edge (clip-path polygon) for visual interest
// - Brand mark + heading + tagline + 3 feature pills with icons
// - Parent column passes overflow-hidden + h-full; this fills it


function HouseIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  )
}

function TrendingUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}


function FeaturePill({ icon, text }) {
  return (
    <div className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-lg px-3.5 py-2.5">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}


function AuthBrandPanel({ tagline }) {
  return (
    <div className="h-full relative flex flex-col justify-center">
      {/*
        Gradient background with a diagonal cut on the LEFT edge.
        clipPath polygon: top-left starts at 15% from the left,
        bottom-left stays at 0% — so the panel's left edge slopes from
        15% (top) to 0% (bottom), creating an inward diagonal slant.
      */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-rose-500 via-rose-600 to-amber-500"
        style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
        aria-hidden
      />

      {/* Content — padded left enough to clear the diagonal */}
      <div className="relative text-white px-8 pl-20 py-12 max-w-md">
        <HouseIcon />

        <h2 className="text-4xl font-bold tracking-tight mt-6 mb-3">PGPeer</h2>

        <p className="text-base leading-relaxed opacity-95 mb-8">
          {tagline}
        </p>

        <div className="space-y-3">
          <FeaturePill icon={<StarIcon />}        text="Reviews from real residents" />
          <FeaturePill icon={<SparklesIcon />}    text="AI-generated summaries" />
          <FeaturePill icon={<TrendingUpIcon />}  text="Monthly rating trends" />
        </div>
      </div>
    </div>
  )
}


export default AuthBrandPanel