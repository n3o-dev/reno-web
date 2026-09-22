/**
 * The site this deployment serves.
 *
 * Single-tenant by design, but the id is load-bearing: records, the
 * workbook and the contract are all one site's, and reading "every site"
 * anywhere means another site's ingest token can put rows on this
 * dashboard — and into the amount payable on the printed invoice.
 *
 * Lives in its own module so `getRecords` can default to it without
 * importing the report service, which imports `getRecords`.
 */
export const SITE_ID = 'lwas'
export const SITE_LABEL = 'Living World Alam Sutera'
