let state = {
  user: null,           // { name, email }
  expenses: [],         // [{ id, desc, amount, date, category }]
  income: [],           // [{ id, desc, amount, date, source }]
  goals: []             // [{ id, name, target, saved, date, emoji }]
};

/** Generate a unique ID */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Format number as Indian Rupee currency */
function fmt(n) {
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Format a date string (YYYY-MM-DD) to readable form */
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
}

/** Get today's date as YYYY-MM-DD */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** Get current month key: "YYYY-MM" */
function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

/** Get readable month name from "YYYY-MM" */
function monthLabel(key) {
  const [y, m] = key.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[parseInt(m)-1]} ${y}`;
}

/** Category config: emoji + CSS class */
const CAT_CONFIG = {
  'Food':          { emoji: '🍔', cls: 'cat-food' },
  'Transport':     { emoji: '🚌', cls: 'cat-transport' },
  'Education':     { emoji: '📚', cls: 'cat-education' },
  'Entertainment': { emoji: '🎮', cls: 'cat-entertainment' },
  'Health':        { emoji: '💊', cls: 'cat-health' },
  'Shopping':      { emoji: '🛍️', cls: 'cat-shopping' },
  'Utilities':     { emoji: '💡', cls: 'cat-utilities' },
  'Other':         { emoji: '📦', cls: 'cat-other' },
  // Income sources
  'Scholarship':   { emoji: '🎓', cls: 'cat-scholarship' },
  'Part-time Job': { emoji: '💼', cls: 'cat-part-time' },
  'Pocket Money':  { emoji: '👨‍👩‍👧', cls: 'cat-pocket' },
  'Freelance':     { emoji: '💻', cls: 'cat-freelance' },
  'Stipend':       { emoji: '📋', cls: 'cat-stipend' }
};

function catEmoji(name)  { return CAT_CONFIG[name]?.emoji  || '📦'; }
function catClass(name)  { return CAT_CONFIG[name]?.cls    || 'cat-other'; }

/** Chart.js colors (one per category) */
const CAT_COLORS = {
  'Food':          '#ff6b6b',
  'Transport':     '#60a5fa',
  'Education':     '#a78bfa',
  'Entertainment': '#f472b6',
  'Health':        '#4ade80',
  'Shopping':      '#fbbf24',
  'Utilities':     '#38bdf8',
  'Other':         '#94a3b8'
};

/* =============================================
   LOCAL STORAGE PERSISTENCE
============================================= */

function saveState() {
  localStorage.setItem('bw_state', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('bw_state');
  if (raw) {
    try { state = JSON.parse(raw); }
    catch(e) { console.error('Failed to load state', e); }
  }
}

/* =============================================
   TOAST NOTIFICATION
============================================= */
let toastTimer = null;

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 3000);
}

/* =============================================
   PAGE & TAB NAVIGATION
============================================= */

/** Show a top-level page (login / signup / app) */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/** Switch tabs inside the app */
function showTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll(`.nav-link[data-tab="${tabId}"]`).forEach(l => l.classList.add('active'));

  // Refresh relevant data when switching tabs
  if (tabId === 'dashboard')  renderDashboard();
  if (tabId === 'expenses')   renderExpensesTable();
  if (tabId === 'income')     renderIncomeTable();
  if (tabId === 'goals')      renderGoals();
  if (tabId === 'summary')    renderSummary();
}

/* =============================================
   AUTH (simulated — localStorage-based)
============================================= */

function loginUser(user) {
  state.user = user;
  saveState();
  updateUserUI();
  showPage('app');
  showTab('dashboard');
}

function logoutUser() {
  state.user = null;
  saveState();
  showPage('login-page');
}

function updateUserUI() {
  if (!state.user) return;
  const initial = state.user.name.charAt(0).toUpperCase();
  const firstName = state.user.name.split(' ')[0];

  // Update all avatar + name elements
  ['sidebar-avatar', 'topbar-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  const sn = document.getElementById('sidebar-name');
  if (sn) sn.textContent = firstName;

  const dn = document.getElementById('dash-name');
  if (dn) dn.textContent = firstName;
}

/* =============================================
   DASHBOARD RENDER
============================================= */

let pieChartInstance = null;
let barChartInstance = null;

function renderDashboard() {
  updateUserUI();

  // Current month badge
  const badge = document.getElementById('current-month-badge');
  if (badge) badge.textContent = monthLabel(currentMonthKey());

  // -- Totals --
  const totalIncome   = state.income.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = state.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const balance       = totalIncome - totalExpenses;
  const savingsRate   = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;

  // KPI values
  document.getElementById('kpi-balance').textContent   = fmt(balance);
  document.getElementById('kpi-income').textContent    = fmt(totalIncome);
  document.getElementById('kpi-expenses').textContent  = fmt(totalExpenses);
  document.getElementById('kpi-savings-rate').textContent = savingsRate + '%';

  // KPI deltas
  const balanceDelta = document.getElementById('kpi-balance-delta');
  balanceDelta.textContent = balance >= 0 ? 'In the green 🟢' : 'In the red 🔴';
  balanceDelta.className   = 'kpi-delta ' + (balance >= 0 ? 'positive' : 'negative');

  document.getElementById('kpi-income-count').textContent  = state.income.length   + ' entries';
  document.getElementById('kpi-expense-count').textContent = state.expenses.length + ' entries';

  // Pie chart — category spending
  renderPieChart();

  // Bar chart — last 6 months income vs expense
  renderBarChart();

  // Recent transactions (last 6)
  renderRecentTransactions();
}

function renderPieChart() {
  // Aggregate spending by category
  const catTotals = {};
  state.expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
  });

  const labels = Object.keys(catTotals);
  const data   = Object.values(catTotals);
  const colors = labels.map(l => CAT_COLORS[l] || '#94a3b8');

  const ctx = document.getElementById('pie-chart').getContext('2d');

  if (pieChartInstance) pieChartInstance.destroy();

  if (labels.length === 0) {
    // Show empty state
    document.getElementById('pie-legend').innerHTML = '<span style="color:var(--text-muted);font-size:12px">No expenses yet</span>';
    return;
  }

  pieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#18181d',
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)}`
          }
        }
      }
    }
  });

  // Custom legend
  const legend = document.getElementById('pie-legend');
  legend.innerHTML = labels.map((l, i) =>
    `<div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      ${l}
    </div>`
  ).join('');
}

function renderBarChart() {
  // Build last 6 months
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months.push({ key, label: d.toLocaleString('default', { month: 'short' }) });
  }

  const incomeByMonth  = {};
  const expenseByMonth = {};
  months.forEach(m => { incomeByMonth[m.key] = 0; expenseByMonth[m.key] = 0; });

  state.income.forEach(i => {
    const mk = i.date.slice(0,7);
    if (incomeByMonth[mk] !== undefined) incomeByMonth[mk] += Number(i.amount);
  });
  state.expenses.forEach(e => {
    const mk = e.date.slice(0,7);
    if (expenseByMonth[mk] !== undefined) expenseByMonth[mk] += Number(e.amount);
  });

  const ctx = document.getElementById('bar-chart').getContext('2d');
  if (barChartInstance) barChartInstance.destroy();

  barChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Income',
          data: months.map(m => incomeByMonth[m.key]),
          backgroundColor: 'rgba(74,222,128,0.75)',
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Expenses',
          data: months.map(m => expenseByMonth[m.key]),
          backgroundColor: 'rgba(248,113,113,0.75)',
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#8e8d96', font: { size: 11 }, boxWidth: 10 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8e8d96', font: { size: 11 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: {
            color: '#8e8d96',
            font: { size: 11 },
            callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)
          },
          grid: { color: 'rgba(255,255,255,0.04)' },
          beginAtZero: true
        }
      }
    }
  });
}

function renderRecentTransactions() {
  const list = document.getElementById('recent-tx-list');

  // Merge income + expenses, sort by date descending, take 6
  const all = [
    ...state.expenses.map(e => ({ ...e, type: 'expense' })),
    ...state.income.map(i => ({ ...i, type: 'income', category: i.source }))
  ].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 6);

  if (all.length === 0) {
    list.innerHTML = '<p class="empty-state">No transactions yet. Add your first one!</p>';
    return;
  }

  list.innerHTML = all.map(tx => `
    <div class="tx-item">
      <div class="tx-cat-icon ${catClass(tx.category)}">
        ${catEmoji(tx.category)}
      </div>
      <div class="tx-info">
        <div class="tx-desc">${escHtml(tx.desc)}</div>
        <div class="tx-meta">${tx.category} · ${fmtDate(tx.date)}</div>
      </div>
      <div class="tx-amount ${tx.type === 'expense' ? 'debit' : 'credit'}">
        ${tx.type === 'expense' ? '-' : '+'}${fmt(tx.amount)}
      </div>
    </div>
  `).join('');
}

/* =============================================
   EXPENSES
============================================= */

function renderExpensesTable() {
  const tbody = document.getElementById('expense-table-body');
  const search  = document.getElementById('search-expense').value.toLowerCase();
  const catFilter  = document.getElementById('filter-category').value;
  const monthFilter = document.getElementById('filter-month').value;

  let filtered = state.expenses.filter(e => {
    const matchSearch = e.desc.toLowerCase().includes(search) || e.category.toLowerCase().includes(search);
    const matchCat    = !catFilter   || e.category === catFilter;
    const matchMonth  = !monthFilter || e.date.slice(0,7) === monthFilter;
    return matchSearch && matchCat && matchMonth;
  }).sort((a,b) => b.date.localeCompare(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state-td">No expenses found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td>${escHtml(e.desc)}</td>
      <td>
        <span class="cat-pill ${catClass(e.category)}">
          ${catEmoji(e.category)} ${e.category}
        </span>
      </td>
      <td>${fmtDate(e.date)}</td>
      <td class="amount-debit">-${fmt(e.amount)}</td>
      <td>
        <button class="action-btn edit" onclick="editExpense('${e.id}')">Edit</button>
        <button class="action-btn del"  onclick="deleteExpense('${e.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function addOrUpdateExpense(data) {
  if (data.id) {
    // Update existing
    const idx = state.expenses.findIndex(e => e.id === data.id);
    if (idx > -1) state.expenses[idx] = data;
  } else {
    // Add new
    state.expenses.push({ ...data, id: uid() });
  }
  saveState();
  renderExpensesTable();
  renderDashboard();
  showToast(data.id ? 'Expense updated!' : 'Expense added!');
}

function editExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  document.getElementById('expense-modal-title').textContent = 'Edit Expense';
  document.getElementById('expense-submit-btn').textContent  = 'Update Expense';
  document.getElementById('expense-edit-id').value    = e.id;
  document.getElementById('expense-desc').value       = e.desc;
  document.getElementById('expense-amount').value     = e.amount;
  document.getElementById('expense-date').value       = e.date;
  document.getElementById('expense-category').value   = e.category;
  openModal('expense-modal');
}

function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveState();
  renderExpensesTable();
  renderDashboard();
  showToast('Expense deleted.', 'error');
}

/* =============================================
   INCOME
============================================= */

function renderIncomeTable() {
  const tbody = document.getElementById('income-table-body');
  const sorted = [...state.income].sort((a,b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state-td">No income entries yet.</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(i => `
    <tr>
      <td>${escHtml(i.desc)}</td>
      <td>
        <span class="cat-pill ${catClass(i.source)}">
          ${catEmoji(i.source)} ${i.source}
        </span>
      </td>
      <td>${fmtDate(i.date)}</td>
      <td class="amount-credit">+${fmt(i.amount)}</td>
      <td>
        <button class="action-btn edit" onclick="editIncome('${i.id}')">Edit</button>
        <button class="action-btn del"  onclick="deleteIncome('${i.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

function addOrUpdateIncome(data) {
  if (data.id) {
    const idx = state.income.findIndex(i => i.id === data.id);
    if (idx > -1) state.income[idx] = data;
  } else {
    state.income.push({ ...data, id: uid() });
  }
  saveState();
  renderIncomeTable();
  renderDashboard();
  showToast(data.id ? 'Income updated!' : 'Income added!');
}

function editIncome(id) {
  const i = state.income.find(x => x.id === id);
  if (!i) return;
  document.getElementById('income-modal-title').textContent = 'Edit Income';
  document.getElementById('income-submit-btn').textContent  = 'Update Income';
  document.getElementById('income-edit-id').value   = i.id;
  document.getElementById('income-desc').value      = i.desc;
  document.getElementById('income-amount').value    = i.amount;
  document.getElementById('income-date').value      = i.date;
  document.getElementById('income-source').value    = i.source;
  openModal('income-modal');
}

function deleteIncome(id) {
  if (!confirm('Delete this income entry?')) return;
  state.income = state.income.filter(i => i.id !== id);
  saveState();
  renderIncomeTable();
  renderDashboard();
  showToast('Income deleted.', 'error');
}

/* =============================================
   SAVINGS GOALS
============================================= */

function renderGoals() {
  const grid = document.getElementById('goals-grid');

  if (state.goals.length === 0) {
    grid.innerHTML = '<div class="empty-state-card">No goals yet. Create your first savings goal!</div>';
    return;
  }

  grid.innerHTML = state.goals.map(g => {
    const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
    const done = pct >= 100;
    return `
      <div class="goal-card ${done ? 'goal-complete' : ''}">
        <div class="goal-card-top">
          <div class="goal-icon">${g.emoji || '🎯'}</div>
          <div class="goal-actions">
            <button class="action-btn edit" onclick="editGoal('${g.id}')">Edit</button>
            <button class="action-btn del"  onclick="deleteGoal('${g.id}')">✕</button>
          </div>
        </div>
        <div class="goal-name">${escHtml(g.name)}</div>
        <div class="goal-amounts">
          <span>${fmt(g.saved)}</span> saved of ${fmt(g.target)}
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="goal-footer">
          <span class="goal-percent">${done ? '✓ Complete!' : pct + '%'}</span>
          <span class="goal-deadline">${g.date ? 'By ' + fmtDate(g.date) : ''}</span>
        </div>
      </div>
    `;
  }).join('');
}

function addOrUpdateGoal(data) {
  if (data.id) {
    const idx = state.goals.findIndex(g => g.id === data.id);
    if (idx > -1) state.goals[idx] = data;
  } else {
    state.goals.push({ ...data, id: uid() });
  }
  saveState();
  renderGoals();
  showToast(data.id ? 'Goal updated!' : 'New goal created! 🎯');
}

function editGoal(id) {
  const g = state.goals.find(x => x.id === id);
  if (!g) return;
  document.getElementById('goal-modal-title').textContent = 'Edit Goal';
  document.getElementById('goal-submit-btn').textContent  = 'Update Goal';
  document.getElementById('goal-edit-id').value   = g.id;
  document.getElementById('goal-name').value      = g.name;
  document.getElementById('goal-target').value    = g.target;
  document.getElementById('goal-saved').value     = g.saved;
  document.getElementById('goal-date').value      = g.date;
  document.getElementById('goal-emoji').value     = g.emoji || '🎯';
  openModal('goal-modal');
}

function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  state.goals = state.goals.filter(g => g.id !== id);
  saveState();
  renderGoals();
  showToast('Goal deleted.', 'error');
}

/* =============================================
   MONTHLY SUMMARY
============================================= */

function populateSummaryMonthSelect() {
  // Collect all unique months from expenses + income
  const months = new Set();
  state.expenses.forEach(e => months.add(e.date.slice(0,7)));
  state.income.forEach(i => months.add(i.date.slice(0,7)));
  months.add(currentMonthKey()); // always include current month

  const sel = document.getElementById('summary-month-select');
  const current = sel.value || currentMonthKey();
  sel.innerHTML = [...months].sort((a,b) => b.localeCompare(a)).map(m =>
    `<option value="${m}" ${m === current ? 'selected' : ''}>${monthLabel(m)}</option>`
  ).join('');
}

function renderSummary() {
  populateSummaryMonthSelect();
  const mk = document.getElementById('summary-month-select').value || currentMonthKey();

  // Filter by selected month
  const expenses = state.expenses.filter(e => e.date.slice(0,7) === mk);
  const income   = state.income.filter(i => i.date.slice(0,7) === mk);

  const totalInc  = income.reduce((s,i) => s + Number(i.amount), 0);
  const totalExp  = expenses.reduce((s,e) => s + Number(e.amount), 0);
  const netSaving = totalInc - totalExp;

  // Stats cards
  const stats = document.getElementById('summary-stats');
  stats.innerHTML = `
    <div class="summary-stat-card">
      <div class="summary-stat-label">Total Income</div>
      <div class="summary-stat-value positive">${fmt(totalInc)}</div>
    </div>
    <div class="summary-stat-card">
      <div class="summary-stat-label">Total Expenses</div>
      <div class="summary-stat-value negative">${fmt(totalExp)}</div>
    </div>
    <div class="summary-stat-card">
      <div class="summary-stat-label">Net Savings</div>
      <div class="summary-stat-value ${netSaving >= 0 ? 'positive' : 'negative'}">${fmt(netSaving)}</div>
    </div>
  `;

  // Category breakdown
  const catTotals = {};
  expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
  });

  const cats = Object.entries(catTotals).sort((a,b) => b[1] - a[1]);
  const maxAmt = cats[0]?.[1] || 1;

  const breakdown = document.getElementById('category-breakdown');
  if (cats.length === 0) {
    breakdown.innerHTML = '<p class="empty-state">No expenses this month.</p>';
    return;
  }

  breakdown.innerHTML = cats.map(([cat, amt]) => {
    const barPct = Math.round((amt / maxAmt) * 100);
    const color  = CAT_COLORS[cat] || '#94a3b8';
    return `
      <div class="cat-row">
        <div class="cat-row-label">
          <span>${catEmoji(cat)}</span>
          ${cat}
        </div>
        <div class="cat-row-bar-wrap">
          <div class="cat-row-bar" style="width:${barPct}%;background:${color}"></div>
        </div>
        <div class="cat-row-amount">${fmt(amt)}</div>
      </div>
    `;
  }).join('');
}

/* =============================================
   FILTER MONTH OPTIONS (Expenses tab)
============================================= */

function populateFilterMonths() {
  const months = new Set();
  state.expenses.forEach(e => months.add(e.date.slice(0,7)));
  const sel = document.getElementById('filter-month');
  const prev = sel.value;
  // Keep the "All months" option
  sel.innerHTML = '<option value="">All months</option>' +
    [...months].sort((a,b) => b.localeCompare(a)).map(m =>
      `<option value="${m}" ${m === prev ? 'selected' : ''}>${monthLabel(m)}</option>`
    ).join('');
}

/* =============================================
   MODAL HELPERS
============================================= */

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function resetForm(formId) {
  document.getElementById(formId).reset();
  // Clear hidden edit IDs
  const hiddenInputs = document.querySelectorAll(`#${formId} input[type="hidden"]`);
  hiddenInputs.forEach(i => i.value = '');
}

/* =============================================
   SECURITY HELPER
============================================= */
/** Escape HTML to prevent XSS */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* =============================================
   SEED DEMO DATA
============================================= */
function seedDemoData() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const lastMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  state.income = [
    { id: uid(), desc: 'Monthly scholarship', amount: 12000, date: `${thisMonth}-01`, source: 'Scholarship' },
    { id: uid(), desc: 'Tutoring classes',    amount: 3500,  date: `${thisMonth}-10`, source: 'Part-time Job' },
    { id: uid(), desc: 'Family allowance',    amount: 5000,  date: `${lastMonth}-01`, source: 'Pocket Money' },
    { id: uid(), desc: 'Freelance logo work', amount: 4000,  date: `${lastMonth}-15`, source: 'Freelance' },
    { id: uid(), desc: 'Internship stipend',  amount: 8000,  date: `${lastMonth}-05`, source: 'Stipend' }
  ];

  state.expenses = [
    { id: uid(), desc: 'Canteen lunch',          amount: 850,  date: `${thisMonth}-03`, category: 'Food' },
    { id: uid(), desc: 'Metro card recharge',    amount: 500,  date: `${thisMonth}-04`, category: 'Transport' },
    { id: uid(), desc: 'Python Udemy course',    amount: 449,  date: `${thisMonth}-06`, category: 'Education' },
    { id: uid(), desc: 'Netflix subscription',   amount: 199,  date: `${thisMonth}-07`, category: 'Entertainment' },
    { id: uid(), desc: 'Groceries for hostel',   amount: 1200, date: `${thisMonth}-09`, category: 'Food' },
    { id: uid(), desc: 'Pharmacy — vitamins',    amount: 350,  date: `${thisMonth}-11`, category: 'Health' },
    { id: uid(), desc: 'New sneakers',           amount: 2499, date: `${thisMonth}-14`, category: 'Shopping' },
    { id: uid(), desc: 'Electricity bill share', amount: 600,  date: `${thisMonth}-15`, category: 'Utilities' },
    { id: uid(), desc: 'Weekend movie tickets',  amount: 480,  date: `${lastMonth}-20`, category: 'Entertainment' },
    { id: uid(), desc: 'Stationery & books',     amount: 780,  date: `${lastMonth}-08`, category: 'Education' },
    { id: uid(), desc: 'Dine out with friends',  amount: 1100, date: `${lastMonth}-22`, category: 'Food' },
    { id: uid(), desc: 'Auto rickshaw rides',    amount: 420,  date: `${lastMonth}-18`, category: 'Transport' }
  ];

  state.goals = [
    { id: uid(), name: 'New Laptop',        target: 55000, saved: 22000, date: `${now.getFullYear()+1}-03-01`, emoji: '💻' },
    { id: uid(), name: 'Trip to Goa',       target: 15000, saved: 8500,  date: `${now.getFullYear()}-12-15`,   emoji: '🏖️' },
    { id: uid(), name: 'Emergency Fund',    target: 20000, saved: 20000, date: `${now.getFullYear()}-10-01`,   emoji: '🛡️' },
    { id: uid(), name: 'New Smartphone',    target: 30000, saved: 5000,  date: `${now.getFullYear()+1}-06-01`, emoji: '📱' }
  ];
}

/* =============================================
   EVENT LISTENERS — BOOT
============================================= */

document.addEventListener('DOMContentLoaded', () => {

  // Load persisted state
  loadState();

  // ---- Auth flows ----

  // Login form
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;

    // Simple validation (no real auth — demo app)
    if (!email || !pass) return;

    // Check if user exists in local storage
    const savedUser = localStorage.getItem('bw_user_' + email);
    if (savedUser) {
      loginUser(JSON.parse(savedUser));
    } else {
      showToast('Account not found. Please sign up.', 'error');
    }
  });

  // Demo login shortcut
  document.getElementById('demo-login').addEventListener('click', () => {
    const demoUser = { name: 'Riya Sharma', email: 'demo@college.edu' };
    localStorage.setItem('bw_user_' + demoUser.email, JSON.stringify(demoUser));
    // Seed demo data only on first run
    if (state.income.length === 0 && state.expenses.length === 0) {
      seedDemoData();
    }
    loginUser(demoUser);
  });

  // Signup form
  document.getElementById('signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name  = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const pass  = document.getElementById('signup-pass').value;
    if (!name || !email || !pass) return;

    const user = { name, email };
    localStorage.setItem('bw_user_' + email, JSON.stringify(user));
    loginUser(user);
    showToast('Welcome to BudgetWise, ' + name.split(' ')[0] + '! 🎉');
  });

  // Toggle between login & signup
  document.getElementById('go-signup').addEventListener('click', (e) => {
    e.preventDefault(); showPage('signup-page');
  });
  document.getElementById('go-login').addEventListener('click', (e) => {
    e.preventDefault(); showPage('login-page');
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    logoutUser();
  });

  // ---- Sidebar nav ----
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.dataset.tab;
      showTab(tab);
      // Close mobile drawer
      document.querySelector('.sidebar').classList.remove('open');
    });
  });

  // "See all" link in dashboard
  document.querySelectorAll('.see-all').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showTab(a.dataset.tab);
    });
  });

  // ---- Mobile hamburger ----
  document.getElementById('hamburger').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });

  // ---- Modal open buttons ----
  document.getElementById('open-add-expense').addEventListener('click', () => {
    document.getElementById('expense-modal-title').textContent = 'Add Expense';
    document.getElementById('expense-submit-btn').textContent  = 'Add Expense';
    resetForm('expense-form');
    document.getElementById('expense-date').value = today();
    openModal('expense-modal');
  });

  document.getElementById('open-add-income').addEventListener('click', () => {
    document.getElementById('income-modal-title').textContent = 'Add Income';
    document.getElementById('income-submit-btn').textContent  = 'Add Income';
    resetForm('income-form');
    document.getElementById('income-date').value = today();
    openModal('income-modal');
  });

  document.getElementById('open-add-goal').addEventListener('click', () => {
    document.getElementById('goal-modal-title').textContent = 'New Savings Goal';
    document.getElementById('goal-submit-btn').textContent  = 'Save Goal';
    resetForm('goal-form');
    document.getElementById('goal-emoji').value = '🎯';
    openModal('goal-modal');
  });

  // ---- Modal close buttons ----
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Close modal when clicking overlay background
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // ---- Form submissions ----

  // Expense form
  document.getElementById('expense-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id  = document.getElementById('expense-edit-id').value;
    const data = {
      id:       id || null,
      desc:     document.getElementById('expense-desc').value.trim(),
      amount:   Number(document.getElementById('expense-amount').value),
      date:     document.getElementById('expense-date').value,
      category: document.getElementById('expense-category').value
    };
    if (!data.desc || !data.amount || !data.date || !data.category) return;
    addOrUpdateExpense(data);
    closeModal('expense-modal');
    resetForm('expense-form');
    populateFilterMonths();
  });

  // Income form
  document.getElementById('income-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('income-edit-id').value;
    const data = {
      id:     id || null,
      desc:   document.getElementById('income-desc').value.trim(),
      amount: Number(document.getElementById('income-amount').value),
      date:   document.getElementById('income-date').value,
      source: document.getElementById('income-source').value
    };
    if (!data.desc || !data.amount || !data.date || !data.source) return;
    addOrUpdateIncome(data);
    closeModal('income-modal');
    resetForm('income-form');
  });

  // Goal form
  document.getElementById('goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('goal-edit-id').value;
    const data = {
      id:     id || null,
      name:   document.getElementById('goal-name').value.trim(),
      target: Number(document.getElementById('goal-target').value),
      saved:  Number(document.getElementById('goal-saved').value),
      date:   document.getElementById('goal-date').value,
      emoji:  document.getElementById('goal-emoji').value || '🎯'
    };
    if (!data.name || !data.target) return;
    addOrUpdateGoal(data);
    closeModal('goal-modal');
    resetForm('goal-form');
  });

  // ---- Expense filters ----
  document.getElementById('search-expense').addEventListener('input', renderExpensesTable);
  document.getElementById('filter-category').addEventListener('change', renderExpensesTable);
  document.getElementById('filter-month').addEventListener('change', renderExpensesTable);

  // ---- Summary month select ----
  document.getElementById('summary-month-select').addEventListener('change', renderSummary);

  // ---- Auto-resume if user session exists ----
  if (state.user) {
    showPage('app');
    populateFilterMonths();
    showTab('dashboard');
  } else {
    showPage('login-page');
  }
});
