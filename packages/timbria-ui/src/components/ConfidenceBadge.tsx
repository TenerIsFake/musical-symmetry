export function ConfidenceBadge({ confidence, status }: { confidence: string; status: string }) {
  return (<span>{status === 'draft' ? '⚠ unverified · ' : ''}{confidence}</span>);
}
