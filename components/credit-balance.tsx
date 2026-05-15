export function CreditBalance({ balance }: { balance: number | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">
      Credit: {balance == null ? '—' : balance.toFixed(2)}
    </div>
  )
}
