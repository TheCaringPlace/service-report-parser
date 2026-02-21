import { Chart, registerables } from 'chart.js';
import data from '../data/financials.json';
import { formatCurrency } from './lib/utils.js';
import { chartDefaults, destroyChart } from './lib/charts.js';

Chart.register(...registerables);

// Year range slider
const yearStartInput = document.getElementById('year-start');
const yearEndInput = document.getElementById('year-end');
const yearStartLabel = document.getElementById('year-start-label');
const yearEndLabel = document.getElementById('year-end-label');

const dataYears = data.years ?? [];
const minYear = dataYears.length > 0 ? Math.min(...dataYears) : new Date().getFullYear() - 5;
const maxYear = dataYears.length > 0 ? Math.max(...dataYears) : new Date().getFullYear();

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
  if (start > end) {
    yearEndInput.value = start;
  }
  if (end < start) {
    yearStartInput.value = end;
  }
  updateYearLabels();
}

updateYearLabels();

function getFilteredData() {
  const start = Number(yearStartInput.value);
  const end = Number(yearEndInput.value);
  const filter = (rows) => (rows ?? []).filter((r) => r.year >= start && r.year <= end);
  return {
    expenses: filter(data.expenses),
    income: filter(data.income),
  };
}

let charts = {};

function renderMetrics(filtered) {
  const totalIncome = (filtered.income ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalExpense = (filtered.expenses ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const net = totalIncome - totalExpense;
  document.getElementById('metrics').innerHTML = `
    <div class="metric">
      <div class="metric-value income">${formatCurrency(totalIncome)}</div>
      <div class="metric-label">Total Income</div>
    </div>
    <div class="metric">
      <div class="metric-value expense">${formatCurrency(totalExpense)}</div>
      <div class="metric-label">Total Expenses</div>
    </div>
    <div class="metric">
      <div class="metric-value net">${formatCurrency(net)}</div>
      <div class="metric-label">Net</div>
    </div>
  `;
}

function renderCharts() {
  const filtered = getFilteredData();
  renderMetrics(filtered);

  // Aggregate by year
  const byYear = {};
  (filtered.income ?? []).forEach((r) => {
    byYear[r.year] = byYear[r.year] || { income: 0, expense: 0 };
    byYear[r.year].income += Number(r.amount) || 0;
  });
  (filtered.expenses ?? []).forEach((r) => {
    byYear[r.year] = byYear[r.year] || { income: 0, expense: 0 };
    byYear[r.year].expense += Number(r.amount) || 0;
  });
  const years = Object.keys(byYear).sort((a, b) => a - b);

  // Overview: Income vs Expenses line chart with net shading
  const incomeData = years.map((y) => byYear[y].income);
  const expenseData = years.map((y) => byYear[y].expense);
  const netData = years.map((y) => byYear[y].income - byYear[y].expense);

  destroyChart(charts, 'overview');
  charts.overview = new Chart(document.getElementById('chart-overview').getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#059669',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#b94a9e',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointHoverBackgroundColor: '#b94a9e',
          pointHoverBorderColor: '#b94a9e',
        },
        {
          label: 'Net',
          data: netData,
          borderColor: 'transparent',
          fill: 'origin',
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          segment: {
            backgroundColor: (ctx) => {
              const y = ctx.p1.parsed.y;
              return y >= 0 ? 'rgba(5, 150, 105, 0.35)' : 'rgba(185, 74, 158, 0.35)';
            },
          },
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: { beginAtZero: true },
        x: {},
      },
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx != null && netData[idx] != null) {
                const n = netData[idx];
                return n >= 0 ? `Net: +$${n.toLocaleString()}` : `Net: -$${Math.abs(n).toLocaleString()}`;
              }
              return '';
            },
          },
        },
      },
    },
  });

  // Income by category
  const incByCat = {};
  (filtered.income ?? []).forEach((r) => {
    const amt = Number(r.amount) || 0;
    incByCat[r.category] = (incByCat[r.category] || 0) + amt;
  });
  const incCatEntries = Object.entries(incByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  destroyChart(charts, 'income-category');
  charts['income-category'] = new Chart(document.getElementById('chart-income-category').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: incCatEntries.map(([k]) => k),
      datasets: [{
        data: incCatEntries.map(([, v]) => v),
        backgroundColor: ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#94a3b8'],
      }],
    },
    options: chartDefaults,
  });

  // Expenses by category
  const expByCat = {};
  (filtered.expenses ?? []).forEach((r) => {
    const amt = Number(r.amount) || 0;
    expByCat[r.category] = (expByCat[r.category] || 0) + amt;
  });
  const expCatEntries = Object.entries(expByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  destroyChart(charts, 'expense-category');
  charts['expense-category'] = new Chart(document.getElementById('chart-expense-category').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: expCatEntries.map(([k]) => k),
      datasets: [{
        data: expCatEntries.map(([, v]) => v),
        backgroundColor: ['#cc5c5c', '#b94a9e', '#9b5cc5', '#8554c4', '#6d4ab3'],
        hoverBackgroundColor: ['#e08a8a', '#d96ab7', '#b58cd9', '#9d7cd4', '#8d6ec3'],
      }],
    },
    options: chartDefaults,
  });

  // Top income sources
  const incBySource = {};
  (filtered.income ?? []).forEach((r) => {
    const amt = Number(r.amount) || 0;
    if (amt > 0) incBySource[r.source] = (incBySource[r.source] || 0) + amt;
  });
  const topIncome = Object.entries(incBySource).sort((a, b) => b[1] - a[1]).slice(0, 12);
  destroyChart(charts, 'income-sources');
  charts['income-sources'] = new Chart(document.getElementById('chart-income-sources').getContext('2d'), {
    type: 'bar',
    data: {
      labels: topIncome.map(([k]) => k),
      datasets: [{ label: 'Amount', data: topIncome.map(([, v]) => v), backgroundColor: '#059669' }],
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } },
    },
  });

  // Top expense sources
  const expBySource = {};
  (filtered.expenses ?? []).forEach((r) => {
    const amt = Number(r.amount) || 0;
    if (amt > 0) expBySource[r.source] = (expBySource[r.source] || 0) + amt;
  });
  const topExpense = Object.entries(expBySource).sort((a, b) => b[1] - a[1]).slice(0, 12);
  destroyChart(charts, 'expense-sources');
  charts['expense-sources'] = new Chart(document.getElementById('chart-expense-sources').getContext('2d'), {
    type: 'bar',
    data: {
      labels: topExpense.map(([k]) => k),
      datasets: [{ label: 'Amount', data: topExpense.map(([, v]) => v), backgroundColor: '#b94a9e', hoverBackgroundColor: '#d96ab7' }],
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } },
    },
  });

  // Income composition over time (stacked area)
  const incByYearCat = {};
  (filtered.income ?? []).forEach((r) => {
    if (!incByYearCat[r.year]) incByYearCat[r.year] = {};
    const amt = Number(r.amount) || 0;
    incByYearCat[r.year][r.category] = (incByYearCat[r.year][r.category] || 0) + amt;
  });
  const incCategories = [...new Set((filtered.income ?? []).map((r) => r.category))].filter(Boolean);
  const incCompColors = ['#059669', '#0891b2', '#2563eb', '#7c3aed'];
  destroyChart(charts, 'income-composition');
  charts['income-composition'] = new Chart(document.getElementById('chart-income-composition').getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: incCategories.map((cat, i) => ({
        label: cat,
        data: years.map((y) => incByYearCat[y]?.[cat] ?? 0),
        borderColor: incCompColors[i % incCompColors.length],
        backgroundColor: incCompColors[i % incCompColors.length],
        fill: true,
        tension: 0.3,
      })),
    },
    options: {
      ...chartDefaults,
      scales: { y: { stacked: true, beginAtZero: true }, x: { stacked: true } },
    },
  });

  // Expense composition over time (stacked area)
  const expByYearCat = {};
  (filtered.expenses ?? []).forEach((r) => {
    if (!expByYearCat[r.year]) expByYearCat[r.year] = {};
    const amt = Number(r.amount) || 0;
    expByYearCat[r.year][r.category] = (expByYearCat[r.year][r.category] || 0) + amt;
  });
  const expCategories = [...new Set((filtered.expenses ?? []).map((r) => r.category))].filter(Boolean);
  const expCompColors = ['#cc5c5c', '#b94a9e', '#9b5cc5', '#8554c4'];
  destroyChart(charts, 'expense-composition');
  charts['expense-composition'] = new Chart(document.getElementById('chart-expense-composition').getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: expCategories.map((cat, i) => {
        const c = expCompColors[i % expCompColors.length];
        return {
          label: cat,
          data: years.map((y) => expByYearCat[y]?.[cat] ?? 0),
          borderColor: c,
          backgroundColor: c,
          fill: true,
          tension: 0.3,
          pointHoverBackgroundColor: c,
          pointHoverBorderColor: c,
        };
      }),
    },
    options: {
      ...chartDefaults,
      scales: { y: { stacked: true, beginAtZero: true }, x: { stacked: true } },
    },
  });

  // Top income sources over time (line chart)
  const top5IncSources = topIncome.slice(0, 5).map(([k]) => k);
  const incByYearSource = {};
  (filtered.income ?? []).forEach((r) => {
    if (!incByYearSource[r.year]) incByYearSource[r.year] = {};
    const amt = Number(r.amount) || 0;
    incByYearSource[r.year][r.source] = (incByYearSource[r.year][r.source] || 0) + amt;
  });
  const trendIncColors = ['#059669', '#047857', '#065f46', '#134e4a', '#042f2e'];
  destroyChart(charts, 'income-sources-trend');
  charts['income-sources-trend'] = new Chart(document.getElementById('chart-income-sources-trend').getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: top5IncSources.map((src, i) => ({
        label: src,
        data: years.map((y) => incByYearSource[y]?.[src] ?? 0),
        borderColor: trendIncColors[i],
        backgroundColor: 'transparent',
        tension: 0.3,
      })),
    },
    options: {
      ...chartDefaults,
      scales: { y: { beginAtZero: true } },
    },
  });

  // Top expense sources over time (line chart)
  const top5ExpSources = topExpense.slice(0, 5).map(([k]) => k);
  const expByYearSource = {};
  (filtered.expenses ?? []).forEach((r) => {
    if (!expByYearSource[r.year]) expByYearSource[r.year] = {};
    const amt = Number(r.amount) || 0;
    expByYearSource[r.year][r.source] = (expByYearSource[r.year][r.source] || 0) + amt;
  });
  const trendExpColors = ['#cc5c5c', '#b94a9e', '#9b5cc5', '#8554c4', '#6d4ab3'];
  destroyChart(charts, 'expense-sources-trend');
  charts['expense-sources-trend'] = new Chart(document.getElementById('chart-expense-sources-trend').getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: top5ExpSources.map((src, i) => ({
        label: src,
        data: years.map((y) => expByYearSource[y]?.[src] ?? 0),
        borderColor: trendExpColors[i],
        backgroundColor: 'transparent',
        tension: 0.3,
        pointHoverBackgroundColor: trendExpColors[i],
        pointHoverBorderColor: trendExpColors[i],
      })),
    },
    options: {
      ...chartDefaults,
      scales: { y: { beginAtZero: true } },
    },
  });

  // Net margin (% of income)
  const netMarginData = years.map((y) => {
    const inc = byYear[y].income;
    const exp = byYear[y].expense;
    const net = inc - exp;
    return inc > 0 ? Math.round((net / inc) * 100) : 0;
  });
  destroyChart(charts, 'net-margin');
  charts['net-margin'] = new Chart(document.getElementById('chart-net-margin').getContext('2d'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [{
        label: 'Net margin %',
        data: netMarginData,
        backgroundColor: netMarginData.map((v) => (v >= 0 ? 'rgba(5, 150, 105, 0.8)' : 'rgba(185, 74, 158, 0.8)')),
        hoverBackgroundColor: netMarginData.map((v) => (v >= 0 ? 'rgba(5, 150, 105, 1)' : 'rgba(185, 74, 158, 1)')),
      }],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: {
          title: { display: true, text: '%' },
          ticks: { callback: (v) => v + '%' },
        },
      },
    },
  });

  // Year-over-year change
  const yoyLabels = [];
  const yoyIncome = [];
  const yoyExpense = [];
  for (let i = 1; i < years.length; i++) {
    const y = years[i];
    const prevY = years[i - 1];
    const inc = byYear[y].income;
    const prevInc = byYear[prevY].income;
    const exp = byYear[y].expense;
    const prevExp = byYear[prevY].expense;
    yoyLabels.push(`${prevY}→${y}`);
    yoyIncome.push(prevInc > 0 ? Math.round(((inc - prevInc) / prevInc) * 100) : 0);
    yoyExpense.push(prevExp > 0 ? Math.round(((exp - prevExp) / prevExp) * 100) : 0);
  }
  destroyChart(charts, 'yoy');
  charts.yoy = new Chart(document.getElementById('chart-yoy').getContext('2d'), {
    type: 'bar',
    data: {
      labels: yoyLabels,
      datasets: [
        { label: 'Income', data: yoyIncome, backgroundColor: 'rgba(5, 150, 105, 0.7)' },
        { label: 'Expenses', data: yoyExpense, backgroundColor: 'rgba(185, 74, 158, 0.7)', hoverBackgroundColor: 'rgba(185, 74, 158, 1)' },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: {
          title: { display: true, text: '% change' },
          ticks: { callback: (v) => v + '%' },
        },
      },
    },
  });

  // Summary table
  const tbody = document.querySelector('#data-table tbody');
  if (tbody) {
    tbody.innerHTML = years
      .map((y) => {
        const inc = byYear[y].income;
        const exp = byYear[y].expense;
        const net = inc - exp;
        const margin = inc > 0 ? Math.round((net / inc) * 100) : 0;
        return `
      <tr>
        <td>${y}</td>
        <td>${formatCurrency(inc)}</td>
        <td>${formatCurrency(exp)}</td>
        <td>${formatCurrency(net)}</td>
        <td>${margin}%</td>
      </tr>
    `;
      })
      .join('');
  }
}

yearStartInput.addEventListener('input', () => {
  enforceYearOrder();
  renderCharts();
});
yearEndInput.addEventListener('input', () => {
  enforceYearOrder();
  renderCharts();
});
renderCharts();
