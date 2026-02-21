import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        serviceReports: 'service-report.html',
        financials: 'financials.html',
        serviceExpenses: 'service-expenses.html',
      },
    },
  },
});
