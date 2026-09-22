# Every read is scoped to one site, and there is no "every site"

`getRecords` defaults to this deployment's `SITE_ID`. It used to default to
returning every site's records, and each caller was expected to narrow.

That expectation failed exactly as expectations do. The client link passed its
token's site; the Reno screens, the print route and the workbook export passed
nothing. So any valid ingest token for any site could write records that
rendered on this dashboard and fed the amount payable on the printed invoice —
while a separate defence, added days earlier, stopped that same token
overwriting a record on the write path. The write path was hardened and the
read path was open.

The same class of leak appeared three more times in the same review: another
site's token saw this site's workbook, its contracted rate of Rp 5.000.000 per
person per month, and its name in the page title.

## Consequences

Narrowing is the default and the wide read does not exist. A caller cannot
forget to scope, because there is no unscoped call to make. Serving a second
site means passing its id, not removing a filter.

Anything else one site owns — the workbook, the contract, the site label — is
withheld from another site's token in `monthReport`, not in each screen. A
screen that forgot would leak, and screens are added more often than services.

The cost is that a genuine cross-site view, if one is ever wanted, has to be
built deliberately. Given the deployment is single-tenant and the failure mode
is a client seeing another client's invoice, that is the right way round.
