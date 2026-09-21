# The billing unit is the slot, not the person

Reno invoices per manpower, and the obvious model is to bill per named cleaner. We bill per
**slot** instead — one area, one shift, one day — because that is how the work is actually
contracted and how the SOP already thinks: the Operational Manager's first morning job is to
order a *pergeseran* when a slot is empty, not to chase a specific person. A covered slot
therefore bills in full whoever fills it, and only an unfilled, unreplaced slot-day deducts.

## Consequences

Swapping every name on a shift while holding the headcount must not move the invoice by one
rupiah — `tests/rules/billing.test.ts` asserts exactly that. It also means complaints never
touch the invoice: a filthy toilet costs the Pimpro his Rapor score and eventually the
contract, but billing is manpower.
