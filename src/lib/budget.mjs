// ponytail: validates supplied per-request quotes only; add trusted price discovery at provider integration.
export function assertZeroCost(quote) {
  if (
    quote === null ||
    typeof quote !== 'object' ||
    Array.isArray(quote) ||
    !['inputPrice', 'outputPrice', 'requiredFees'].every(
      (field) => Object.hasOwn(quote, field) && quote[field] === 0,
    )
  ) {
    throw new Error('ZERO_BUDGET_EXCEEDED');
  }
}
