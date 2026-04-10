/**
 * Balance tiers for test account funding.
 * These are defined in USD and should be converted to HBAR at runtime
 * using UsdToHbarService.usdToHbar().
 *
 * Tiers:
 * - MINIMAL:  $0.50 - Basic operations (single transfer, simple query)
 * - STANDARD: $5.00 - Most common test scenarios (token operations, multiple transfers)
 * - ELEVATED: $10.00 - Complex operations (NFT minting, multiple token operations)
 * - MAXIMUM:  $20.00 - Heavy operations (contract deployments, extensive token operations)
 */
export const BALANCE_TIERS = {
  /** $0.50 - Basic operations (single transfer, simple query) */
  MINIMAL: 0.5,
  /** $5.00 - Most common test scenarios (token operations, multiple transfers) */
  STANDARD: 5,
  /** $10.00 - Complex operations (NFT minting, multiple token operations) */
  ELEVATED: 10,
  /** $20.00 - Heavy operations (contract deployments, extensive token operations) */
  MAXIMUM: 20,
} as const;

export type BalanceTier = (typeof BALANCE_TIERS)[keyof typeof BALANCE_TIERS];
