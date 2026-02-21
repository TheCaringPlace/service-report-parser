# The Caring Place Reporting

Parser and dashboard for Service Reports from the FreeStore Foodbank tracking system.

## Packages

- **parser** – Parse PDF reports, consolidate to JSON, sync with S3
- **dashboard** – Interactive charts for service and financial data

## Quick start

```bash
npm install
cd packages/dashboard && npm run dev
```

## Build & deploy

1. Generate reports: `cd packages/parser && npm run build`
2. Deploy dashboard (SST, password-protected): from root, run `npm run deploy`
   - Set credentials first: `npx sst secret set USERNAME x` and `PASSWORD y`

See `packages/parser/README.md` and `packages/dashboard/README.md` for details.
