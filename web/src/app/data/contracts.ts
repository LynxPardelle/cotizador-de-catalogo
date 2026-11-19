export interface CatalogOption { id: string; name: string; priceMinor: string }
export interface CatalogProduct { id: string; name: string; basePriceMinor: string; options: CatalogOption[]; incompatibleOptions: string[][] }
export interface CatalogRule { id: string; type: 'percentage-discount' | 'percentage-surcharge'; minimumQuantity: number; numerator: string; denominator: string; priority: number }
export interface Catalog { catalogId: string; name: string; version: number; currency: string; currencyExponent: number; rounding: 'half-up' | 'half-even' | 'down'; validUntil: string; products: CatalogProduct[]; rules: CatalogRule[] }
export interface QuoteItem { productId: string; quantity: number; optionIds: string[] }
export interface QuoteRequest { catalogId: string; version: number; currency: string; items: QuoteItem[] }
export interface QuoteLine { productId: string; name: string; quantity: number; optionIds: string[]; selectedOptions?: CatalogOption[]; unitPriceMinor: string; totalMinor: string }
export interface AppliedRule { id: string; type: string; amountMinor: string; priority?: number; description?: string }
export interface Preview { catalogId: string; version: number; currency: string; currencyExponent: number; validUntil: string; subtotalMinor: string; totalMinor: string; lines: QuoteLine[]; appliedRules: AppliedRule[] }
export interface Quote extends Preview { quoteId: string; issuedAt: string; items: QuoteItem[] }
