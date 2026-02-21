import { Chart, registerables } from 'chart.js';
import data from '../data/service-report.json';
import { formatPeriod, parseDatePart } from './lib/utils.js';
import { chartDefaults } from './lib/charts.js';

Chart.register(...registerables);

// Parse dates and sort – use parseDatePart for consistent M/D/YYYY parsing
const sortedData = [...(data ?? [])]
  .filter((row) => row.daterange?.from)
  .map((row) => {
    const parsed = parseDatePart(row.daterange.from);
    const date = parsed ? new Date(parsed.year, parsed.month - 1, 1) : new Date(0);
    return {
      ...row,
      date,
      year: parsed?.year ?? date.getFullYear(),
      month: parsed?.month ?? date.getMonth() + 1,
      label: formatPeriod(row.daterange),
    };
  })
  .sort((a, b) => a.date - b.date);

// Populate year filter with unique years from data
const yearSelect = document.getElementById('year');
const monthSelect = document.getElementById('month');
const years = [...new Set(sortedData.map((r) => r.year))].sort();
years.forEach((y) => {
  const opt = document.createElement('option');
  opt.value = String(y);
  opt.textContent = String(y);
  yearSelect.appendChild(opt);
});

function getFilteredData() {
  const yearVal = yearSelect.value;
  const monthVal = monthSelect.value;

  return sortedData.filter((row) => {
    const yearMatch = yearVal === 'all' || row.year === Number(yearVal);
    const monthMatch = monthVal === 'all' || row.month === Number(monthVal);
    return yearMatch && monthMatch;
  });
}

function renderMetrics(filtered) {
  const container = document.getElementById('metrics');
  const totals = filtered.reduce(
    (acc, row) => {
      acc.households += row.client_types?.households ?? 0;
      acc.people += row.client_types?.total ?? 0;
      acc.volunteerHours += row.volunteerhours ?? 0;
      acc.days += row.operatingdays ?? 0;
      return acc;
    },
    { households: 0, people: 0, volunteerHours: 0, days: 0 }
  );

  container.innerHTML = `
    <div class="metric">
      <div class="metric-value">${totals.households.toLocaleString()}</div>
      <div class="metric-label">Households</div>
    </div>
    <div class="metric">
      <div class="metric-value">${totals.people.toLocaleString()}</div>
      <div class="metric-label">People served</div>
    </div>
    <div class="metric">
      <div class="metric-value">${totals.volunteerHours.toLocaleString()}</div>
      <div class="metric-label">Volunteer hours</div>
    </div>
    <div class="metric">
      <div class="metric-value">${totals.days}</div>
      <div class="metric-label">Operating days</div>
    </div>
  `;
}

// Chart instances for update
let charts = {};

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    charts[id] = null;
  }
}

function renderCharts() {
  const filtered = getFilteredData();

  renderMetrics(filtered);

  const labels = filtered.map((r) => r.label);

  function ctx(id) {
    return document.getElementById(id).getContext('2d');
  }

  // Clients over time
  destroyChart('clients');
  charts.clients = new Chart(ctx('chart-clients'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total people',
          data: filtered.map((r) => r.client_types?.total ?? 0),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Households',
          data: filtered.map((r) => r.client_types?.households ?? 0),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.1)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Volunteer hours',
          data: filtered.map((r) => r.volunteerhours ?? 0),
          borderColor: '#0891b2',
          yAxisID: 'y1',
          borderDash: [5, 5],
          tension: 0.3,
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: { beginAtZero: true },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
      },
    },
  });

  // Population: adults vs children vs seniors over time
  destroyChart('population');
  const seniorsPerRow = (r) => {
    const s = r.total_number_of_seniors_served || {};
    return (s.households_without_children ?? 0) + (s.households_with_children ?? 0);
  };
  charts.population = new Chart(ctx('chart-population'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Adults', data: filtered.map((r) => r.client_types?.adults ?? 0), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.2)', fill: true, tension: 0.3 },
        { label: 'Children', data: filtered.map((r) => r.client_types?.children ?? 0), borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.2)', fill: true, tension: 0.3 },
        { label: 'Seniors', data: filtered.map(seniorsPerRow), borderColor: '#0891b2', backgroundColor: 'rgba(8, 145, 178, 0.2)', fill: true, tension: 0.3 },
      ],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // First-time vs returning clients over time
  destroyChart('visits-trend');
  charts['visits-trend'] = new Chart(ctx('chart-visits-trend'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'First visit', data: filtered.map((r) => (r.client_visit_frequency || {}).first_time ?? 0), borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.3 },
        { label: 'Second visit', data: filtered.map((r) => (r.client_visit_frequency || {}).second_time ?? 0), borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.1)', fill: true, tension: 0.3 },
        { label: 'Third or more', data: filtered.map((r) => (r.client_visit_frequency || {}).third_or_more_time ?? 0), borderColor: '#0891b2', backgroundColor: 'rgba(8, 145, 178, 0.1)', fill: true, tension: 0.3 },
      ],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // Top services over time
  destroyChart('services-trend');
  const keyServices = ['food', 'clothing', 'laundry', 'housewares', 'senior_box', 'transportation'];
  const svcLabel = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  charts['services-trend'] = new Chart(ctx('chart-services-trend'), {
    type: 'line',
    data: {
      labels,
      datasets: keyServices.map((k, i) => ({
        label: svcLabel(k),
        data: filtered.map((r) => (r.services || {})[k] ?? 0),
        borderColor: ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#b87070'][i],
        tension: 0.3,
      })),
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // Income level mix over time
  destroyChart('income-trend');
  const incKeys = ['extremely_low', 'very_low', 'low', 'normal', 'n/a'];
  const incLabelsMap = { extremely_low: 'Extremely low', very_low: 'Very low', low: 'Low', normal: 'Normal', 'n/a': 'N/A' };
  charts['income-trend'] = new Chart(ctx('chart-income-trend'), {
    type: 'bar',
    data: {
      labels,
      datasets: incKeys.map((k, i) => ({
        label: incLabelsMap[k],
        data: filtered.map((r) => (r.income_levels || {})[k] ?? 0),
        backgroundColor: ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#94a3b8'][i],
      })),
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true, stacked: true }, x: { stacked: true } } },
  });

  // Volunteer hours per household
  destroyChart('volunteer-per-household');
  charts['volunteer-per-household'] = new Chart(ctx('chart-volunteer-per-household'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Hours per household',
        data: filtered.map((r) => {
          const h = r.client_types?.households ?? 0;
          return h > 0 ? Number(((r.volunteerhours ?? 0) / h).toFixed(1)) : 0;
        }),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // People per household
  destroyChart('people-per-household');
  charts['people-per-household'] = new Chart(ctx('chart-people-per-household'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'People per household',
        data: filtered.map((r) => {
          const h = r.client_types?.households ?? 0;
          return h > 0 ? Number(((r.client_types?.total ?? 0) / h).toFixed(1)) : 0;
        }),
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // Operating days over time
  destroyChart('operating-days');
  charts['operating-days'] = new Chart(ctx('chart-operating-days'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Operating days',
        data: filtered.map((r) => r.operatingdays ?? 0),
        borderColor: '#059669',
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        fill: true,
        tension: 0.3,
      }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // Households vs people
  destroyChart('households');
  charts.households = new Chart(ctx('chart-households'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Without children',
          data: filtered.map((r) => r.number_of_households?.households_without_children ?? 0),
          backgroundColor: '#2563eb',
        },
        {
          label: 'With children',
          data: filtered.map((r) => r.number_of_households?.households_with_children ?? 0),
          backgroundColor: '#7c3aed',
        },
      ],
    },
    options: {
      ...chartDefaults,
      scales: {
        y: { beginAtZero: true, stacked: true },
        x: { stacked: true },
      },
    },
  });

  // Visit frequency
  destroyChart('visits');
  const vf = filtered.reduce(
    (acc, r) => {
      const v = r.client_visit_frequency || {};
      acc.first += v.first_time ?? 0;
      acc.second += v.second_time ?? 0;
      acc.third += v.third_or_more_time ?? 0;
      return acc;
    },
    { first: 0, second: 0, third: 0 }
  );
  charts.visits = new Chart(document.getElementById('chart-visits').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['First visit', 'Second visit', 'Third or more'],
      datasets: [{ data: [vf.first, vf.second, vf.third], backgroundColor: ['#2563eb', '#7c3aed', '#0891b2'] }],
    },
    options: chartDefaults,
  });

  // Top services
  destroyChart('services');
  const serviceCounts = {};
  filtered.forEach((r) => {
    const svc = r.services || {};
    Object.entries(svc).forEach(([k, v]) => {
      if (!k.startsWith('z_') || v > 0) {
        const name = k.replace(/^z_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        serviceCounts[name] = (serviceCounts[name] ?? 0) + Number(v);
      }
    });
  });
  const topServices = Object.entries(serviceCounts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  charts.services = new Chart(document.getElementById('chart-services').getContext('2d'), {
    type: 'bar',
    data: {
      labels: topServices.map(([k]) => k),
      datasets: [{ label: 'Usage count', data: topServices.map(([, v]) => v), backgroundColor: '#2563eb' }],
    },
    options: { ...chartDefaults, indexAxis: 'y', scales: { x: { beginAtZero: true } } },
  });

  // Age distribution
  destroyChart('ages');
  const ageGroups = {};
  const ageKeys = ['infants:_0_-_5', 'between_6_and_12', 'between_13_and_27', 'between_18_and_30', 'between_31_and_45', 'between_46_and_59', 'between_60_and_74', '75_and_over', 'unknown'];
  const ageLabels = { 'infants:_0_-_5': '0–5', between_6_and_12: '6–12', between_13_and_27: '13–17', between_18_and_30: '18–30', between_31_and_45: '31–45', between_46_and_59: '46–59', between_60_and_74: '60–74', '75_and_over': '75+', unknown: 'Unknown' };
  filtered.forEach((r) => {
    const ag = r.age_groups || {};
    ageKeys.forEach((k) => { ageGroups[k] = (ageGroups[k] ?? 0) + (ag[k] ?? 0); });
  });
  charts.ages = new Chart(document.getElementById('chart-ages').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ageKeys.filter((k) => (ageGroups[k] ?? 0) > 0).map((k) => ageLabels[k]),
      datasets: [{ label: 'Count', data: ageKeys.filter((k) => (ageGroups[k] ?? 0) > 0).map((k) => ageGroups[k]), backgroundColor: '#2563eb' }],
    },
    options: { ...chartDefaults, scales: { y: { beginAtZero: true } } },
  });

  // Income levels
  destroyChart('income');
  const incLevels = {};
  filtered.forEach((r) => {
    const inc = r.income_levels || {};
    Object.entries(inc).forEach(([k, v]) => { incLevels[k] = (incLevels[k] ?? 0) + Number(v); });
  });
  const incLabels = { extremely_low: 'Extremely low', very_low: 'Very low', low: 'Low', normal: 'Normal', 'n/a': 'N/A' };
  charts.income = new Chart(document.getElementById('chart-income').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(incLevels).map((k) => incLabels[k] ?? k),
      datasets: [{ data: Object.values(incLevels), backgroundColor: ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#94a3b8'] }],
    },
    options: chartDefaults,
  });

  // Sex
  destroyChart('sex');
  const sexCounts = {};
  filtered.forEach((r) => {
    const s = r.sex || {};
    Object.entries(s).forEach(([k, v]) => { sexCounts[k] = (sexCounts[k] ?? 0) + Number(v); });
  });
  const sexLabels = { f: 'Female', m: 'Male', o: 'Other', 'n/a': 'N/A' };
  const sexEntries = Object.entries(sexCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  charts.sex = new Chart(document.getElementById('chart-sex').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: sexEntries.map(([k]) => sexLabels[k] ?? k),
      datasets: [{ data: sexEntries.map(([, v]) => v), backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#94a3b8'] }],
    },
    options: chartDefaults,
  });

  // Ethnic background
  destroyChart('ethnicity');
  const ethnicCounts = {};
  filtered.forEach((r) => {
    const eb = r.ethnic_background || {};
    Object.entries(eb).forEach(([k, v]) => { ethnicCounts[k] = (ethnicCounts[k] ?? 0) + Number(v); });
  });
  const ethnicLabels = { american_indian_alaskan_native: 'American Indian / Alaskan Native', asian_pacific: 'Asian / Pacific Islander', black_african_american: 'Black / African American', hispanic: 'Hispanic', multiracial: 'Multiracial', white: 'White', unknown: 'Unknown', 'n/a': 'N/A' };
  const ethnicEntries = Object.entries(ethnicCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  charts.ethnicity = new Chart(document.getElementById('chart-ethnicity').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ethnicEntries.map(([k]) => ethnicLabels[k] ?? k.replace(/_/g, ' ')),
      datasets: [{ data: ethnicEntries.map(([, v]) => v), backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#b87070', '#ca8a04', '#64748b', '#94a3b8'] }],
    },
    options: chartDefaults,
  });

  // Summary table
  const tbody = document.querySelector('#data-table tbody');
  if (tbody) {
    tbody.innerHTML = filtered
      .map((r) => {
        const h = r.client_types?.households ?? 0;
        const p = r.client_types?.total ?? 0;
        const ppH = h > 0 ? (p / h).toFixed(1) : '—';
        return `
      <tr>
        <td>${r.label}</td>
        <td>${h.toLocaleString()}</td>
        <td>${p.toLocaleString()}</td>
        <td>${(r.volunteerhours ?? 0).toLocaleString()}</td>
        <td>${r.operatingdays ?? 0}</td>
        <td>${ppH}</td>
      </tr>
    `;
      })
      .join('');
  }
}

yearSelect.addEventListener('change', renderCharts);
monthSelect.addEventListener('change', renderCharts);
renderCharts();
