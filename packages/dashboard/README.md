# The Caring Place Dashboard

An interactive dashboard for visualizing consolidated report data.

## Project structure

```
dashboard/
├── index.html          # Home page
├── service-report.html # Service report page
├── financials.html     # Financial report page
├── styles.css          # Shared styles
├── data/               # JSON data (copied by prebuild from parser)
│   ├── service-report.json
│   └── financials.json
├── src/
│   ├── index.js        # Home page logic
│   ├── service-reports.js
│   └── financials.js
└── dist/               # Build output
```

## Run locally


```bash
npm install
cd dashboard
npm run dev
```

The dashboard opens at [http://localhost:5173](http://localhost:5173).

## Build for deployment

```bash
npm run build
```
## Preview production build

```bash
npm run preview
```

## Deploy with SST (password-protected)

From the project root, deploy to AWS with HTTP Basic Auth:

```bash
# 1. Ensure parser reports exist
cd parser && npm run build && cd ..

# 2. Set auth credentials
npx sst secret set USERNAME your-username
npx sst secret set PASSWORD your-password

# 3. Deploy
npm run deploy
```

The deployed URL is shown after deploy. The browser will prompt for username and password.
