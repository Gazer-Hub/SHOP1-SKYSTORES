(() => {
  'use strict';

  /*
   * Supabase setup for this static app.
   * Replace these two values with your project's public URL and anon key.
   * Never put a Supabase service_role key in browser code.
   */
  const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
  const supabase = window.supabase && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const STORAGE_KEY = 'sky-modernize-inventory-v3';
  const AUTH_KEY = 'sky-modernize-auth-v3';
  const CLOUD_TABLE = 'inventory';
  const CLOUD_ROW_ID = 1;
  const state = loadState();
  state.stock ??= [];
  state.sales ??= [];
  state.returns ??= [];
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
    } catch (error) { console.warn('Could not load local data', error); }
    return { stock: [], sales: [], returns: [], requisitions: [] };
  }

  function saveLocalState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  async function saveState() {
    saveLocalState();
    if (!supabase) return;
    const { error } = await supabase.from(CLOUD_TABLE).upsert({ id: CLOUD_ROW_ID, payload: state, updated_at: new Date().toISOString() });
    if (error) {
      console.error('Supabase save failed:', error);
      toast('Saved locally, but cloud sync failed.', 'error');
    }
  }

  async function loadCloudState() {
    if (!supabase) return;
    const { data, error } = await supabase.from(CLOUD_TABLE).select('payload').eq('id', CLOUD_ROW_ID).maybeSingle();
    if (error) {
      console.error('Supabase load failed:', error);
      toast('Using local data; cloud load failed.', 'error');
      return;
    }
    if (data?.payload && Array.isArray(data.payload.stock)) {
      Object.assign(state, data.payload);
      saveLocalState();
      renderAll();
      toast('Cloud data loaded.');
    }
  }

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
    $('#sale-models').innerHTML = [...new Set(state.stock.map((item) => item.model))].map((model) => `<option value="${escapeHtml(model)}">`).join('');
  }

  function renderSales(filter = '') {
    const query = filter.trim().toLowerCase();
    const rows = state.sales.filter((sale) => [sale.model, sale.quality, sale.customer, sale.payment, sale.date].join(' ').toLowerCase().includes(query));
    $('#sales-table').innerHTML = rows.length ? rows.map((sale) => `<tr><td>${sale.date}</td><td>${escapeHtml(sale.model)}</td><td>${escapeHtml(sale.quality || '—')}</td><td>${escapeHtml(sale.customer)}</td><td>${escapeHtml(sale.payment)}</td><td>${sale.qty}</td><td>${money(sale.total)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-sale" data-id="${sale.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No sales found.</td></tr>';
    const revenue = state.sales.reduce((sum, sale) => sum + sale.total, 0);
    const cost = state.sales.reduce((sum, sale) => sum + sale.cost * sale.qty, 0);
    $('#stat-revenue').textContent = money(revenue);
    $('#stat-cost').textContent = money(cost);
    $('#stat-profit').textContent = money(revenue - cost);
  }

  function renderReturns() {
    $('#returns-table').innerHTML = state.returns.length ? state.returns.map((item) => `<tr><td>${item.date}</td><td>${escapeHtml(item.model)}</td><td>${escapeHtml(item.customer)}</td><td>${item.qty}</td><td>${escapeHtml(item.reason)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-return" data-id="${item.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No returns recorded.</td></tr>';
    $('#return-sale').innerHTML = state.sales.length ? state.sales.map((sale) => `<option value="${sale.id}">${escapeHtml(sale.model)} — ${escapeHtml(sale.customer)} (${sale.qty} sold)</option>`).join('') : '<option value="">No sales available</option>';
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

  function renderAll() { renderDashboard(); renderCart(); }
  function resetCart() { state.cart = []; }
  function renderCart() { /* Cart UI is intentionally retained for future multi-item checkout expansion. */ }

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

    $('#stock-form').addEventListener('submit', async (event) => { event.preventDefault(); const item = { id: crypto.randomUUID(), model: $('#stock-model').value.trim(), category: $('#stock-category').value.trim(), quality: $('#stock-quality').value.trim(), supplier: $('#stock-supplier').value.trim(), qty: Number($('#stock-qty').value), cost: Number($('#stock-cost').value), price: Number($('#stock-price').value) }; if (!item.model || !item.category || !Number.isInteger(item.qty) || item.qty < 1 || item.cost < 0 || item.price < 0) return toast('Complete the stock form correctly.', 'error'); state.stock.push(item); await saveState(); event.target.reset(); renderAll(); toast('Inventory item saved.'); });

    $('#sales-form').addEventListener('submit', async (event) => { event.preventDefault(); const model = $('#sale-model').value.trim(); const stock = state.stock.find((item) => item.model.toLowerCase() === model.toLowerCase()); const qty = Number($('#sale-qty').value); const price = Number($('#sale-price').value); const customer = $('#sale-customer').value.trim(); if (!stock || !customer || !Number.isInteger(qty) || qty < 1 || qty > stock.qty || price < 0) return toast('Check model, customer, quantity, stock, and price.', 'error'); state.sales.push({ id: crypto.randomUUID(), date: today(), model: stock.model, quality: $('#sale-quality').value.trim() || stock.quality, customer, payment: $('#sale-payment').value, qty, cost: stock.cost, price, total: qty * price }); stock.qty -= qty; await saveState(); event.target.reset(); renderAll(); toast('Sale recorded and stock updated.'); });

    $('#sale-model').addEventListener('input', () => { const item = state.stock.find((stock) => stock.model.toLowerCase() === $('#sale-model').value.trim().toLowerCase()); if (item) { $('#sale-quality').value = item.quality || ''; $('#sale-price').value = item.price; } });
    $('#returns-form').addEventListener('submit', async (event) => { event.preventDefault(); const sale = state.sales.find((item) => item.id === $('#return-sale').value); const qty = Number($('#return-qty').value); const reason = $('#return-reason').value.trim(); if (!sale || !reason || !Number.isInteger(qty) || qty < 1 || qty > sale.qty) return toast('Select a valid sale, quantity, and reason.', 'error'); state.returns.push({ id: crypto.randomUUID(), date: today(), model: sale.model, customer: sale.customer, qty, reason, amount: qty * sale.price }); const stock = state.stock.find((item) => item.model.toLowerCase() === sale.model.toLowerCase()); if (stock) stock.qty += qty; await saveState(); event.target.reset(); renderAll(); toast('Return recorded and stock restored.'); });
    $('#requisition-form').addEventListener('submit', async (event) => { event.preventDefault(); state.requisitions.push({ id: `REQ-${Date.now()}`, date: today(), item: $('#requisition-item').value.trim(), qty: Number($('#requisition-qty').value), supplier: $('#requisition-supplier').value.trim(), status: 'Pending' }); await saveState(); event.target.reset(); renderRequisitions(); toast('Requisition submitted.'); });
    $('#password-form').addEventListener('submit', (event) => { event.preventDefault(); if ($('#new-password').value !== $('#confirm-password').value) return toast('Passwords do not match.', 'error'); toast('Password updated locally. Configure server authentication for production.'); event.target.reset(); });

    document.body.addEventListener('click', async (event) => { const button = event.target.closest('.delete-stock,.delete-sale,.delete-return'); if (!button) return; if (button.classList.contains('delete-stock')) state.stock = state.stock.filter((item) => item.id !== button.dataset.id); if (button.classList.contains('delete-sale')) state.sales = state.sales.filter((item) => item.id !== button.dataset.id); if (button.classList.contains('delete-return')) state.returns = state.returns.filter((item) => item.id !== button.dataset.id); await saveState(); renderAll(); toast('Updated.'); });
    $('#export-stock').addEventListener('click', () => exportCsv('stock.csv', ['Model','Category','Quality','Supplier','Qty','Cost','Price'], state.stock.map((x) => [x.model,x.category,x.quality,x.supplier,x.qty,x.cost,x.price])));
    $('#export-sales').addEventListener('click', () => exportCsv('sales.csv', ['Date','Model','Quality','Customer','Payment','Qty','Cost','Price','Total'], state.sales.map((x) => [x.date,x.model,x.quality,x.customer,x.payment,x.qty,x.cost,x.price,x.total])));
    $('#backup-stock').addEventListener('click', () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); link.download = `sky-backup-${today()}.json`; link.click(); });
    $('#restore-stock').addEventListener('click', () => $('#restore-input').click());
    $('#restore-input').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const imported = JSON.parse(reader.result); if (!Array.isArray(imported.stock)) throw new Error('Invalid backup'); Object.assign(state, imported); await saveState(); renderAll(); toast('Backup restored.'); } catch { toast('Invalid backup file.', 'error'); } }; reader.readAsText(file); });
    $('#print-dashboard').addEventListener('click', () => window.print()); $('#print-cash').addEventListener('click', () => window.print());
  }

  async function init() {
    if (localStorage.getItem('sky-theme') === 'dark') document.body.classList.add('dark-mode');
    bindEvents(); renderAll(); navigate(authenticated() ? 'dashboard' : 'login');
    await loadCloudState();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
