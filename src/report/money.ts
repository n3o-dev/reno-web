/**
 * Money, written the way Reno writes it.
 *
 * Rupiah has no minor unit in practice, so no decimals — a figure like
 * "Rp 5.000.000,00" on an Indonesian invoice reads as a foreign document.
 */
export function rupiah(amount: number, currency = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}
