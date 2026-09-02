type CheckoutConfirmationOptions = {
  count: number
  sampleIds?: string[]
}

export function confirmSampleCheckout({ count, sampleIds = [] }: CheckoutConfirmationOptions) {
  if (count <= 0) return false

  const visibleSampleIds = sampleIds.filter(Boolean).slice(0, 5)
  const sampleLabel = count === 1
    ? `sample${visibleSampleIds[0] ? ` ${visibleSampleIds[0]}` : ''}`
    : `${count} samples`
  const sampleList = visibleSampleIds.length > 0
    ? `\n\n${visibleSampleIds.join(', ')}${count > visibleSampleIds.length ? `, and ${count - visibleSampleIds.length} more` : ''}`
    : ''

  return window.confirm(
    `Check out ${sampleLabel}?\n\nThis will remove the sample${count === 1 ? '' : 's'} from storage and mark ${count === 1 ? 'it' : 'them'} as checked out.${sampleList}`
  )
}