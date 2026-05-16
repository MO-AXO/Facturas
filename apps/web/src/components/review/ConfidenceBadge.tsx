import type { MatchStatus } from '../../lib/api'

type Props = {
  status: MatchStatus
  confidence: number | null
}

const labels: Record<MatchStatus, string> = {
  auto: 'Auto',
  suggested: 'Sugerido',
  manual: 'Manual',
  confirmed: 'Confirmado',
  new_sku: 'SKU nuevo',
}

export function ConfidenceBadge({ status, confidence }: Props) {
  const color =
    status === 'auto' || status === 'confirmed'
      ? 'bg-green-100 text-green-800 border-green-300'
      : status === 'suggested'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
      : 'bg-red-100 text-red-800 border-red-300'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${color}`}>
      <span
        className={`w-2 h-2 rounded-full ${
          status === 'auto' || status === 'confirmed'
            ? 'bg-green-500'
            : status === 'suggested'
            ? 'bg-yellow-500'
            : 'bg-red-500'
        }`}
      />
      {labels[status]}
      {confidence !== null && confidence < 1 && (
        <span className="opacity-70">({Math.round(confidence * 100)}%)</span>
      )}
    </span>
  )
}
