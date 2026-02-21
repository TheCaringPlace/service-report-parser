import serviceData from '../data/service-report.json';
import financialData from '../data/financials.json';
import { formatCurrency, formatYearRange } from './lib/utils.js';
import {
  buildServiceByYear,
  buildExpensesByYear,
  getExpensePerHouseholdYears,
} from './lib/expense-per-household.js';

// Service rollup – totals across all periods
const serviceTotals = (serviceData ?? []).reduce(
  (acc, row) => {
    acc.households += row.client_types?.households ?? 0;
    acc.people += row.client_types?.total ?? 0;
    acc.volunteerHours += row.volunteerhours ?? 0;
    acc.reportPeriods += 1;
    return acc;
  },
  { households: 0, people: 0, volunteerHours: 0, reportPeriods: 0 }
);

// Financial rollup – totals across all years
const totalIncome = (financialData.income ?? []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
const totalExpenses = (financialData.expenses ?? []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
const financialYears = [...new Set([
  ...(financialData.income ?? []).map((r) => r.year),
  ...(financialData.expenses ?? []).map((r) => r.year),
])].filter(Boolean).sort();
const yearRange =
  financialYears.length > 0
    ? `${financialYears[0]}–${financialYears[financialYears.length - 1]}`
    : '—';

document.getElementById('metrics-service').innerHTML = `
  <div class="metric">
    <div class="metric-value">${serviceTotals.households.toLocaleString()}</div>
    <div class="metric-label">Households served</div>
  </div>
  <div class="metric">
    <div class="metric-value">${serviceTotals.people.toLocaleString()}</div>
    <div class="metric-label">People served</div>
  </div>
  <div class="metric">
    <div class="metric-value">${serviceTotals.volunteerHours.toLocaleString()}</div>
    <div class="metric-label">Volunteer hours</div>
  </div>
  <div class="metric">
    <div class="metric-value">${serviceTotals.reportPeriods}</div>
    <div class="metric-label">Report periods</div>
  </div>
`;

document.getElementById('metrics-financial').innerHTML = `
  <div class="metric">
    <div class="metric-value">${formatCurrency(totalIncome)}</div>
    <div class="metric-label">Total income</div>
  </div>
  <div class="metric">
    <div class="metric-value">${formatCurrency(totalExpenses)}</div>
    <div class="metric-label">Total expenses</div>
  </div>
  <div class="metric">
    <div class="metric-value">${formatCurrency(totalIncome - totalExpenses)}</div>
    <div class="metric-label">Net</div>
  </div>
  <div class="metric">
    <div class="metric-value">${yearRange}</div>
    <div class="metric-label">Years</div>
  </div>
`;

// Expense per household & individual – only years with 12 months of service data
const { serviceByYear, yearsWithFullServiceData } = buildServiceByYear(serviceData);
const expensesByYear = buildExpensesByYear(financialData.expenses);
const expensePerHouseholdYears = getExpensePerHouseholdYears(expensesByYear, yearsWithFullServiceData);

let totalExpForMetrics = 0;
let totalHouseholdsForMetrics = 0;
let totalIndividualsForMetrics = 0;
for (const y of expensePerHouseholdYears ?? []) {
  totalExpForMetrics += expensesByYear[y] ?? 0;
  const svc = serviceByYear[y] ?? { households: 0, individuals: 0 };
  totalHouseholdsForMetrics += svc.households;
  totalIndividualsForMetrics += svc.individuals;
}
const avgPerHousehold = totalHouseholdsForMetrics > 0 ? totalExpForMetrics / totalHouseholdsForMetrics : null;
const avgPerIndividual = totalIndividualsForMetrics > 0 ? totalExpForMetrics / totalIndividualsForMetrics : null;
const expenseYearRange = formatYearRange(expensePerHouseholdYears);

document.getElementById('metrics-expense-per-household').innerHTML = `
  <div class="metric">
    <div class="metric-value">${formatCurrency(avgPerHousehold ?? 0)}</div>
    <div class="metric-label">Expense per household</div>
  </div>
  <div class="metric">
    <div class="metric-value">${formatCurrency(avgPerIndividual ?? 0)}</div>
    <div class="metric-label">Expense per individual</div>
  </div>
  <div class="metric">
    <div class="metric-value">${totalHouseholdsForMetrics.toLocaleString()}</div>
    <div class="metric-label">Households (full-year data)</div>
  </div>
  <div class="metric">
    <div class="metric-value">${expenseYearRange}</div>
    <div class="metric-label">Years</div>
  </div>
`;
