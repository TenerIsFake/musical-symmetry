interface Props {
  icon: string;
  name: string;
  description: string;
  earned: boolean;
  grantedAt: string | null;
}

export default function AchievementBadge({ icon, name, description, earned, grantedAt }: Props) {
  const dateLabel = grantedAt
    ? new Date(grantedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div
      className={`relative group flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
        earned
          ? 'border-indigo-600 bg-indigo-900/30 text-white'
          : 'border-gray-700 bg-gray-800/50 text-gray-600 opacity-50'
      }`}
      title={`${name}: ${description}${dateLabel ? ` — Earned ${dateLabel}` : ''}`}
    >
      <span className="text-2xl leading-none select-none">{icon}</span>
      <span className="text-xs font-medium text-center leading-tight max-w-[80px] truncate">
        {name}
      </span>

      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 shadow-lg">
          <p className="font-semibold text-white mb-0.5">{name}</p>
          <p className="text-gray-400">{description}</p>
          {earned && dateLabel && (
            <p className="text-indigo-400 mt-1">Earned {dateLabel}</p>
          )}
          {!earned && (
            <p className="text-gray-500 mt-1 italic">Not yet earned</p>
          )}
        </div>
        {/* Arrow */}
        <div className="w-2 h-2 bg-gray-900 border-b border-r border-gray-700 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}
