(() => {
  'use strict';

  const STORAGE_KEY = 'sky-modernize-inventory-v2';
  const AUTH_KEY = 'sky-modernize-auth-v2';
  const DEFAULTS = { username: 'admin', password: '1234' };
  const state = loadState();
  state.cart ??= [];
  state.requisitions ??= [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = (value) => `₦${Number(value || 0).toLocaleString()}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.stock)) return saved;
    } catch (error) { console.warn('Could not load saved data', error); }
    return { stock: [], sales: [], returns: [], requisitions: [] };
  }

  function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  function toast(message, type = 'success') {
    const node = document.createElement('div');
    node.className = `toast show app-toast ${type === 'error' ? 'bg-danger' : ''}`;
    node.setAttribute('role', 'status');
    node.innerHTML = `<div class="toast-body"><i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} me-2"></i>${escapeHtml(message)}</div>`;
    $('#toast-container').append(node);
    setTimeout(() => node.remove(), 3200);
  }

  function authenticated() { return sessionStorage.getItem(AUTH_KEY) === '1'; }

  function navigate(page) {
    if (!authenticated() && page !== 'login') page = 'login';
    $$('.page').forEach((node) => node.classList.toggle('active', node.id === `page-${page}`));
    $('#main-nav').hidden = page === 'login';
    if (page === 'dashboard') renderDashboard();
  }

  function renderStock(filter = '') {
    const query = filter.trim().toLowerCase();
    const rows = state.stock.filter((item) => [item.model, item.category, item.quality, item.supplier].join(' ').toLowerCase().includes(query));
    $('#stock-table').innerHTML = rows.length ? rows.map((item) => `<tr><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.quality || '—')}</td><td>${escapeHtml(item.supplier || '—')}</td><td>${item.qty}</td><td>${money(item.cost)}</td><td>${money(item.price)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-stock" data-id="${item.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No inventory items found.</td></tr>';
    $('#stat-stock').textContent = money(state.stock.reduce((sum, item) => sum + item.qty * item.cost, 0));
    const models = [...new Set(state.stock.map((item) => item.model))];
    $('#sale-models').innerHTML = models.map((model) => `<option value="${escapeHtml(model)}">`).join('');
  }

  function renderSales(filter = '') {
    const query = filter.trim().toLowerCase();
    const rows = state.sales.filter((sale) => [sale.model, sale.quality, sale.customer, sale.payment, sale.date].join(' ').toLowerCase().includes(query));
    $('#sales-table').innerHTML = rows.length ? rows.map((sale) => `<tr><td>${sale.date}</td><td>${escapeHtml(sale.model)}</td><td>${escapeHtml(sale.quality || '—')}</td><td>${escapeHtml(sale.customer)}</td><td>${escapeHtml(sale.payment)}</td><td>${sale.qty}</td><td>${money(sale.total)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-sale" data-id="${sale.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No sales found.</td></tr>';
    const salesTotal = state.sales.reduce((sum, sale) => sum + sale.total, 0);
    const cost = state.sales.reduce((sum, sale) => sum + sale.cost * sale.qty, 0);
    $('#stat-revenue').textContent = money(salesTotal);
    $('#stat-cost').textContent = money(cost);
    $('#stat-profit').textContent = money(salesTotal - cost);
  }

  function renderReturns() {
    $('#returns-table').innerHTML = state.returns.length ? state.returns.map((item) => `<tr><td>${item.date}</td><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.customer)}</td><td>${item.qty}</td><td>${escapeHtml(item.reason)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-return" data-id="${item.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No returns recorded.</td></tr>';
    $('#return-sale').innerHTML = state.sales.length ? state.sales.map((sale) => `<option value="${sale.id}">${escapeHtml(sale.model)} — ${escapeHtml(sale.customer)} (${sale.qty} available)</option>`).join('') : '<option value="">No sales available</option>';
  }

  function renderRequisitions() {
    $('#requisition-table').innerHTML = state.requisitions.length ? state.requisitions.map((item) => `<tr><td><code>${item.id}</code></td><td>${item.date}</td><td>${escapeHtml(item.item)}</td><td>${item.qty}</td><td>${escapeHtml(item.supplier || '—')}</td><td><span class="badge bg-warning text-dark">${escapeHtml(item.status)}</span></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No requisitions recorded.</td></tr>';
  }

  function renderDashboard() {
    renderSales();
    renderStock($('#stock-search')?.value || '');
    renderReturns();
    renderRequisitions();
    const low = state.stock.filter((item) => item.qty <= 10).sort((a, b) => a.qty - b.qty);
    $('#low-stock-list').innerHTML = low.length ? `<div class="table-responsive"><table class="table mb-0"><thead><tr><th>Model</th><th>Category</th><th>Qty</th><th>Supplier</th></tr></thead><tbody>${low.map((item) => `<tr><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.category)}</td><td class="text-danger fw-bold">${item.qty}</td><td>${escapeHtml(item.supplier || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-muted mb-0">No low stock items currently.</p>';
  }

  function resetCart() { state.cart = []; }
  function renderCart() {
    const body = $('#sales-cart');
    if (!body) return;
    body.innerHTML = state.cart.length ? state.cart.map((item, index) => `<tr><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.quality || '—')}</td><td>${item.qty}</td><td>${money(item.price)}</td><td>${money(item.qty * item.price)}</td><td><button class="btn btn-sm btn-outline-danger remove-cart" data-index="${index}">Remove</button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">Cart is empty.</td></tr>';
  }

  function exportCsv(filename, headers, rows) {
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(quote).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
  }

  function bindEvents() {
    $('#login-form').addEventListener('submit', (event) => { event.preventDefault(); const user = $('#login-username').value.trim(); const password = $('#login-password').value; if (!user || !password) return toast('Enter your credentials.', 'error'); sessionStorage.setItem(AUTH_KEY, '1'); navigate('dashboard'); toast('Signed in successfully.'); });
    $$('.nav-btn[data-page]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.page)));
    $('#logout-btn').addEventListener('click', () => { sessionStorage.removeItem(AUTH_KEY); navigate('login'); toast('Signed out.'); });
    $('#theme-toggle').addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('sky-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); });
    $('#stock-search').addEventListener('input', (event) => renderStock(event.target.value));

    $('#stock-form').addEventListener('submit', (event) => { event.preventDefault(); const item = { id: crypto.randomUUID(), model: $('#stock-model').value.trim(), category: $('#stock-category').value.trim(), quality: $('#stock-quality').value.trim(), supplier: $('#stock-supplier').value.trim(), qty: Number($('#stock-qty').value), cost: Number($('#stock-cost').value), price: Number($('#stock-price').value) }; if (!item.model || !item.category || !Number.isInteger(item.qty) || item.qty < 1 || item.cost < 0 || item.price < 0) return toast('Complete the stock form correctly.', 'error'); state.stock.push(item); saveState(); event.target.reset(); renderDashboard(); toast('Inventory item saved.'); });

    $('#sales-form').addEventListener('submit', (event) => { event.preventDefault(); const model = $('#sale-model').value.trim(); const stock = state.stock.find((item) => item.model.toLowerCase() === model.toLowerCase()); const qty = Number($('#sale-qty').value); const price = Number($('#sale-price').value); if (!stock || !Number.isInteger(qty) || qty < 1 || qty > stock.qty || price < 0) return toast('Check model, quantity, stock, and price.', 'error'); state.sales.push({ id: crypto.randomUUID(), date: today(), model: stock.model, quality: $('#sale-quality').value.trim() || stock.quality, customer: $('#sale-customer').value.trim(), payment: $('#sale-payment').value, qty, cost: stock.cost, price, total: qty * price }); stock.qty -= qty; saveState(); event.target.reset(); renderDashboard(); toast('Sale recorded and stock updated.'); });

    $('#sale-model').addEventListener('input', () => { const item = state.stock.find((stock) => stock.model.toLowerCase() === $('#sale-model').value.trim().toLowerCase()); if (item) { $('#sale-quality').value = item.quality || ''; $('#sale-price').value = item.price; } });
    $('#returns-form').addEventListener('submit', (event) => { event.preventDefault(); const sale = state.sales.find((item) => item.id === $('#return-sale').value); const qty = Number($('#return-qty').value); if (!sale || !Number.isInteger(qty) || qty < 1 || qty > sale.qty) return toast('Select a valid sale and quantity.', 'error'); state.returns.push({ id: crypto.randomUUID(), date: today(), model: sale.model, customer: sale.customer, qty, reason: $('#return-reason').value.trim(), amount: qty * sale.price }); const stock = state.stock.find((item) => item.model.toLowerCase() === sale.model.toLowerCase()); if (stock) stock.qty += qty; saveState(); event.target.reset(); renderDashboard(); toast('Return recorded and stock restored.'); });
    $('#requisition-form').addEventListener('submit', (event) => { event.preventDefault(); state.requisitions.push({ id: `REQ-${Date.now()}`, date: today(), item: $('#requisition-item').value.trim(), qty: Number($('#requisition-qty').value), supplier: $('#requisition-supplier').value.trim(), status: 'Pending' }); saveState(); event.target.reset(); renderRequisitions(); toast('Requisition submitted.'); });
    $('#password-form').addEventListener('submit', (event) => { event.preventDefault(); if ($('#new-password').value !== $('#confirm-password').value) return toast('Passwords do not match.', 'error'); toast('Password updated locally. Configure server authentication for production.'); event.target.reset(); });

    document.body.addEventListener('click', (event) => { const button = event.target.closest('.delete-stock,.delete-sale,.delete-return,.remove-cart'); if (!button) return; if (button.classList.contains('delete-stock')) state.stock = state.stock.filter((item) => item.id !== button.dataset.id); if (button.classList.contains('delete-sale')) state.sales = state.sales.filter((item) => item.id !== button.dataset.id); if (button.classList.contains('delete-return')) state.returns = state.returns.filter((item) => item.id !== button.dataset.id); if (button.classList.contains('remove-cart')) state.cart.splice(Number(button.dataset.index), 1); saveState(); renderDashboard(); renderCart(); toast('Updated.'); });
    $('#export-stock').addEventListener('click', () => exportCsv('stock.csv', ['Model','Category','Quality','Supplier','Qty','Cost','Price'], state.stock.map((x) => [x.model,x.category,x.quality,x.supplier,x.qty,x.cost,x.price])));
    $('#export-sales').addEventListener('click', () => exportCsv('sales.csv', ['Date','Model','Quality','Customer','Payment','Qty','Cost','Price','Total'], state.sales.map((x) => [x.date,x.model,x.quality,x.customer,x.payment,x.qty,x.cost,x.price,x.total])));
    $('#backup-stock').addEventListener('click', () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); link.download = `sky-backup-${today()}.json`; link.click(); });
    $('#restore-stock').addEventListener('click', () => $('#restore-input').click());
    $('#restore-input').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(reader.result); if (!Array.isArray(imported.stock)) throw new Error('Invalid backup'); Object.assign(state, imported); saveState(); renderDashboard(); toast('Backup restored.'); } catch { toast('Invalid backup file.', 'error'); } }; reader.readAsText(file); });
    $('#print-dashboard').addEventListener('click', () => window.print()); $('#print-cash').addEventListener('click', () => window.print());
  }

  function init() {
    if (localStorage.getItem('sky-theme') === 'dark') document.body.classList.add('dark-mode');
    bindEvents(); renderDashboard(); renderCart(); navigate(authenticated() ? 'dashboard' : 'login');
  }
  document.addEventListener('DOMContentLoaded', init);
})();
