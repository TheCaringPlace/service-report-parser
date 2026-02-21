import { Chart, registerables } from 'chart.js';
import financialData from '../data/financials.json';
import serviceData from '../data/service-report.json';
import { formatCurrency } from './lib/utils.js';
import { chartDefaults, destroyChart } from './lib/charts.js';
import {
  buildServiceByYear,
  buildExpensesByYear,
  getExpensePerHouseholdYears,
} from './lib/expense-per-household.js';

Chart.register(...registerables);

const { serviceByYear, yearsWithFullServiceData } = buildServiceByYear(serviceData);
const expensesByYear = buildExpensesByYear(financialData.expenses);
const allYears = getExpensePerHouseholdYears(expensesByYear, yearsWithFullServiceData);

const defaultYear = new Date().getFullYear();
const minYear = allYears.length > 0 ? Math.min(...allYears) : defaultYear - 5;
const maxYear = allYears.length > 0 ? Math.max(...allYears) : defaultYear;

// Filters
const yearStartInput = document.getElementById('year-start');
const yearEndInput = document.getElementById('year-end');
const yearStartLabel = document.getElementById('year-start-label');
const yearEndLabel = document.getElementById('year-end-label');

yearStartInput.min = minYear;
yearStartInput.max = maxYear;
yearStartInput.value = minYear;
yearEndInput.min = minYear;
yearEndInput.max = maxYear;
yearEndInput.value = maxYear;

function updateYearLabels() {
  yearStartLabel.textContent = yearStartInput.value;
  yearEndLabel.textContent = yearEndInput.value;
}

function enforceYearOrder() {
  const start = Number(yearStartInput.value);
  const end = Number(yearEndInput.value);
  if (start > end) yearEndInput.value = start;
  if (end < start) yearStartInput.value = end;
  updateYearLabels();
}

updateYearLabels();

function getFilteredYears() {
  const start = Number(yearStartInput.value);
  const end = Number(yearEndInput.value);
  return allYears.filter((y) => y >= start && y <= end);
}

const charts = {};

function render() {
  const years = getFilteredYears();

  const rows = years.map((y) => {
    const exp = expensesByYear[y] ?? 0;
    const svc = serviceByYear[y] ?? { households: 0, individuals: 0 };
    const perHousehold = svc.households > 0 ? exp / svc.households : null;
    const perIndividual = svc.individuals > 0 ? exp / svc.individuals : null;
    return {
      year: y,
      expenses: exp,
      households: svc.households,
      individuals: svc.individuals,
      perHousehold,
      perIndividual,
    };
  });

  // Metrics: use totals for selected range
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const totalHouseholds = rows.reduce((s, r) => s + r.households, 0);
  const totalIndividuals = rows.reduce((s, r) => s + r.individuals, 0);
  const avgPerHousehold = totalHouseholds > 0 ? totalExpenses / totalHouseholds : null;
  const avgPerIndividual = totalIndividuals > 0 ? totalExpenses / totalIndividuals : null;

  document.getElementById('metrics').innerHTML = `
    <div class="metric">
      <div class="metric-value">${formatCurrency(avgPerHousehold ?? 0)}</div>
      <div class="metric-label">Expenses per household</div>
    </div>
    <div class="metric">
      <div class="metric-value">${formatCurrency(avgPerIndividual ?? 0)}</div>
      <div class="metric-label">Expenses per individual</div>
    </div>
    <div class="metric">
      <div class="metric-value">${totalHouseholds.toLocaleString()}</div>
      <div class="metric-label">Households served (selected range)</div>
    </div>
    <div class="metric">
      <div class="metric-value">${totalIndividuals.toLocaleString()}</div>
      <div class="metric-label">Individuals served (selected range)</div>
    </div>
  `;

  // Chart: per household and per individual over time
  const perHouseholdData = rows.map((r) => (r.perHousehold != null ? Math.round(r.perHousehold) : null));
  const perIndividualData = rows.map((r) => (r.perIndividual != null ? Math.round(r.perIndividual) : null));

  destroyChart(charts, 'over-time');
  destroyChart(charts, 'people-per-household');
  destroyChart(charts, 'yoy-change');
  destroyChart(charts, 'totals');

  charts['over-time'] = new Chart(document.getElementById('chart-over-time').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [
        {
          label: 'Expenses per household',
          data: perHouseholdData,
          backgroundColor: 'rgba(35, 54, 88, 0.8)',
          yAxisID: 'y',
        },
        {
          label: 'Expenses per individual',
          data: perIndividualData,
          backgroundColor: 'rgba(240, 101, 30, 0.8)',
          yAxisID: 'y',
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: {
          type: 'linear',
          beginAtZero: true,
          ticks: {
            callback: (v) => (typeof v === 'number' ? '$' + v.toLocaleString() : v),
          },
        },
      },
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw;
              return v != null ? `${ctx.dataset.label}: ${formatCurrency(v)}` : 'No data';
            },
          },
        },
      },
    },
  });

  // People per household over time
  const peoplePerHouseholdData = rows.map((r) =>
    r.households > 0 ? Number((r.individuals / r.households).toFixed(1)) : null
  );
  charts['people-per-household'] = new Chart(
    document.getElementById('chart-people-per-household').getContext('2d'),
    {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [
          {
            label: 'People per household',
            data: peoplePerHouseholdData,
            borderColor: 'rgba(35, 54, 88, 1)',
            backgroundColor: 'rgba(35, 54, 88, 0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        ...chartDefaults,
        scales: {
          y: { beginAtZero: true },
        },
      },
    }
  );

  // Year-over-year % change in cost efficiency
  const yoyLabels = [];
  const yoyPerHousehold = [];
  const yoyPerIndividual = [];
  for (let i = 1; i < rows.length; i++) {
    const curr = rows[i];
    const prev = rows[i - 1];
    yoyLabels.push(`${prev.year}→${curr.year}`);
    const pctHousehold =
      prev.perHousehold != null && prev.perHousehold > 0
        ? Math.round(((curr.perHousehold ?? 0) - prev.perHousehold) / prev.perHousehold * 100)
        : null;
    const pctIndividual =
      prev.perIndividual != null && prev.perIndividual > 0
        ? Math.round(((curr.perIndividual ?? 0) - prev.perIndividual) / prev.perIndividual * 100)
        : null;
    yoyPerHousehold.push(pctHousehold);
    yoyPerIndividual.push(pctIndividual);
  }
  charts['yoy-change'] = new Chart(document.getElementById('chart-yoy-change').getContext('2d'), {
    type: 'bar',
    data: {
      labels: yoyLabels,
      datasets: [
        {
          label: 'Expense per household % change',
          data: yoyPerHousehold,
          backgroundColor: 'rgba(35, 54, 88, 0.8)',
        },
        {
          label: 'Expense per individual % change',
          data: yoyPerIndividual,
          backgroundColor: 'rgba(240, 101, 30, 0.8)',
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: {
          ticks: { callback: (v) => (typeof v === 'number' ? v + '%' : v) },
        },
      },
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw;
              return v != null ? `${ctx.dataset.label}: ${v > 0 ? '+' : ''}${v}%` : 'No data';
            },
          },
        },
      },
    },
  });

  // Total expenses, households & individuals (dual axis)
  const expensesData = rows.map((r) => r.expenses);
  const householdsData = rows.map((r) => r.households);
  const individualsData = rows.map((r) => r.individuals);
  charts['totals'] = new Chart(document.getElementById('chart-totals').getContext('2d'), {
    type: 'line',
    data: {
      labels: years.map(String),
      datasets: [
        {
          label: 'Total expenses',
          data: expensesData,
          borderColor: 'rgba(35, 54, 88, 1)',
          backgroundColor: 'rgba(35, 54, 88, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Households',
          data: householdsData,
          borderColor: 'rgba(240, 101, 30, 1)',
          tension: 0.3,
          yAxisID: 'y1',
        },
        {
          label: 'Individuals',
          data: individualsData,
          borderColor: 'rgba(244, 159, 45, 1)',
          tension: 0.3,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          ticks: { callback: (v) => (typeof v === 'number' ? '$' + v.toLocaleString() : v) },
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
        },
      },
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw;
              if (v == null) return 'No data';
              if (ctx.dataset.label === 'Total expenses') return `Total expenses: ${formatCurrency(v)}`;
              return `${ctx.dataset.label}: ${v.toLocaleString()}`;
            },
          },
        },
      },
    },
  });

  // Table
  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${r.year}</td>
      <td>${formatCurrency(r.expenses)}</td>
      <td>${r.households.toLocaleString()}</td>
      <td>${r.individuals.toLocaleString()}</td>
      <td>${r.perHousehold != null ? formatCurrency(r.perHousehold) : '—'}</td>
      <td>${r.perIndividual != null ? formatCurrency(r.perIndividual) : '—'}</td>
    </tr>
  `
    )
    .join('');
}

yearStartInput.addEventListener('input', () => {
  enforceYearOrder();
  render();
});
yearEndInput.addEventListener('input', () => {
  enforceYearOrder();
  render();
});
render();
