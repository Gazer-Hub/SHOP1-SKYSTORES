(() => {
  'use strict';

  // Set these globals before app.js, or replace the placeholders below.
  const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
  const db = window.supabase && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const AUTH_KEY = 'sky-modernize-auth-v4';
  const localKey = 'sky-modernize-cache-v4';
  const state = { stock: [], sales: [], returns: [], requisitions: [] };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const today = () => new Date().toISOString().slice(0, 10);
  const money = (n) => `₦${Number(n || 0).toLocaleString()}`;
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

  function notify(message, error = false) {
    const node = document.createElement('div');
    node.className = `toast show app-toast ${error ? 'bg-danger' : ''}`;
    node.innerHTML = `<div class="toast-body"><i class="fa-solid ${error ? 'fa-circle-exclamation' : 'fa-circle-check'} me-2"></i>${esc(message)}</div>`;
    $('#toast-container')?.append(node);
    setTimeout(() => node.remove(), 3500);
  }

  function readCache() {
    try {
      const saved = JSON.parse(localStorage.getItem(localKey));
      if (saved) Object.assign(state, saved);
    } catch (error) { console.warn('Local cache unavailable', error); }
  }

  function cache() { localStorage.setItem(localKey, JSON.stringify(state)); }

  async function fetchTable(table, order = 'created_at') {
    if (!db) return [];
    const { data, error } = await db.from(table).select('*').order(order, { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function refreshFromSupabase() {
    if (!db) return;
    try {
      const [stock, sales, returns, requisitions] = await Promise.all([
        fetchTable('stock'), fetchTable('sales', 'date'), fetchTable('returns', 'date'), fetchTable('requisitions', 'date')
      ]);
      state.stock = stock.map((x) => ({ ...x, quality: x.quality ?? x.subcat, price: Number(x.price ?? x.sell_price ?? 0), cost: Number(x.cost ?? x.cost_price ?? 0), qty: Number(x.qty ?? 0) }));
      state.sales = sales.map((x) => ({ ...x, price: Number(x.price ?? x.unit_price ?? 0), cost: Number(x.cost ?? x.cost_price ?? 0), qty: Number(x.qty ?? 0), total: Number(x.total ?? 0) }));
      state.returns = returns.map((x) => ({ ...x, qty: Number(x.qty ?? 0), amount: Number(x.amount ?? 0) }));
      state.requisitions = requisitions;
      cache(); renderAll();
    } catch (error) {
      console.error('Supabase load failed:', error);
      notify('Cloud data could not be loaded; using local cache.', true);
    }
  }

  async function insertRow(table, row) {
    if (!db) return true;
    const { error } = await db.from(table).insert(row);
    if (error) { console.error(`${table} insert failed`, error); notify(`Cloud save failed for ${table}.`, true); return false; }
    return true;
  }

  async function updateRow(table, id, values) {
    if (!db) return true;
    const { error } = await db.from(table).update(values).eq('id', id);
    if (error) { console.error(`${table} update failed`, error); notify(`Cloud update failed for ${table}.`, true); return false; }
    return true;
  }

  async function deleteRow(table, id) {
    if (!db) return true;
    const { error } = await db.from(table).delete().eq('id', id);
    if (error) { console.error(`${table} delete failed`, error); notify(`Cloud delete failed for ${table}.`, true); return false; }
    return true;
  }

  function navigate(page) {
    if (sessionStorage.getItem(AUTH_KEY) !== '1' && page !== 'login') page = 'login';
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));
    if ($('#main-nav')) $('#main-nav').hidden = page === 'login';
  }

  function renderStock(filter = '') {
    const q = filter.toLowerCase();
    const rows = state.stock.filter((x) => [x.model, x.category, x.quality, x.supplier].join(' ').toLowerCase().includes(q));
    const target = $('#stock-table');
    if (!target) return;
    target.innerHTML = rows.length ? rows.map((x) => `<tr><td>${esc(x.model)}</td><td>${esc(x.category)}</td><td>${esc(x.quality || '—')}</td><td>${esc(x.supplier || '—')}</td><td>${x.qty}</td><td>${money(x.cost)}</td><td>${money(x.price)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-stock" data-id="${x.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No inventory items found.</td></tr>';
    $('#sale-models').innerHTML = [...new Set(state.stock.map((x) => x.model))].map((x) => `<option value="${esc(x)}">`).join('');
    $('#stat-stock').textContent = money(state.stock.reduce((sum, x) => sum + x.qty * x.cost, 0));
  }

  function renderSales(filter = '') {
    const q = filter.toLowerCase();
    const rows = state.sales.filter((x) => [x.date, x.model, x.quality, x.customer, x.payment].join(' ').toLowerCase().includes(q));
    const target = $('#sales-table');
    if (!target) return;
    target.innerHTML = rows.length ? rows.map((x) => `<tr><td>${x.date}</td><td>${esc(x.model)}</td><td>${esc(x.quality || '—')}</td><td>${esc(x.customer)}</td><td>${esc(x.payment)}</td><td>${x.qty}</td><td>${money(x.total)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-sale" data-id="${x.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="8" class="text-center text-muted py-4">No sales found.</td></tr>';
    const revenue = state.sales.reduce((sum, x) => sum + Number(x.total || 0), 0);
    const cost = state.sales.reduce((sum, x) => sum + Number(x.cost || 0) * Number(x.qty || 0), 0);
    $('#stat-revenue').textContent = money(revenue); $('#stat-cost').textContent = money(cost); $('#stat-profit').textContent = money(revenue - cost);
  }

  function renderReturns() {
    const target = $('#returns-table');
    if (!target) return;
    target.innerHTML = state.returns.length ? state.returns.map((x) => `<tr><td>${x.date}</td><td>${esc(x.model)}</td><td>${esc(x.customer)}</td><td>${x.qty}</td><td>${esc(x.reason)}</td><td class="no-print"><button class="btn btn-sm btn-outline-danger delete-return" data-id="${x.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No returns recorded.</td></tr>';
    $('#return-sale').innerHTML = state.sales.map((x) => `<option value="${x.id}">${esc(x.model)} — ${esc(x.customer)} (${x.qty} sold)</option>`).join('') || '<option value="">No sales available</option>';
  }

  function renderRequisitions() {
    const target = $('#requisition-table');
    if (!target) return;
    target.innerHTML = state.requisitions.length ? state.requisitions.map((x) => `<tr><td><code>${esc(x.id)}</code></td><td>${x.date}</td><td>${esc(x.item)}</td><td>${x.qty}</td><td>${esc(x.supplier || '—')}</td><td><span class="badge bg-warning text-dark">${esc(x.status)}</span></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted py-4">No requisitions recorded.</td></tr>';
  }

  function renderDashboard() {
    const target = $('#low-stock-list');
    if (!target) return;
    const low = state.stock.filter((x) => x.qty <= 10).sort((a, b) => a.qty - b.qty);
    target.innerHTML = low.length ? `<div class="table-responsive"><table class="table mb-0"><thead><tr><th>Model</th><th>Category</th><th>Qty</th><th>Supplier</th></tr></thead><tbody>${low.map((x) => `<tr><td>${esc(x.model)}</td><td>${esc(x.category)}</td><td class="text-danger fw-bold">${x.qty}</td><td>${esc(x.supplier || '—')}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-muted mb-0">No low stock items currently.</p>';
  }

  function renderAll() { renderStock($('#stock-search')?.value || ''); renderSales(); renderReturns(); renderRequisitions(); renderDashboard(); }

  function exportCsv(filename, headers, rows) {
    const quote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(quote).join(',')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = filename; link.click(); URL.revokeObjectURL(link.href);
  }

  function bindEvents() {
    $('#login-form')?.addEventListener('submit', (e) => { e.preventDefault(); if (!$('#login-username').value.trim() || !$('#login-password').value) return notify('Enter your credentials.', true); sessionStorage.setItem(AUTH_KEY, '1'); navigate('dashboard'); notify('Signed in successfully.'); });
    $$('.nav-btn[data-page]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.page)));
    $('#logout-btn')?.addEventListener('click', () => { sessionStorage.removeItem(AUTH_KEY); navigate('login'); notify('Signed out.'); });
    $('#theme-toggle')?.addEventListener('click', () => { document.body.classList.toggle('dark-mode'); localStorage.setItem('sky-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); });
    $('#stock-search')?.addEventListener('input', (e) => renderStock(e.target.value));

    $('#stock-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const item = { id: crypto.randomUUID(), model: $('#stock-model').value.trim(), category: $('#stock-category').value.trim(), quality: $('#stock-quality').value.trim(), supplier: $('#stock-supplier').value.trim(), qty: Number($('#stock-qty').value), cost: Number($('#stock-cost').value), price: Number($('#stock-price').value) }; if (!item.model || !item.category || !Number.isInteger(item.qty) || item.qty < 1 || item.cost < 0 || item.price < 0) return notify('Complete the stock form correctly.', true); if (await insertRow('stock', item)) { state.stock.push(item); cache(); e.target.reset(); renderAll(); notify('Inventory item saved.'); } });

    $('#sales-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const model = $('#sale-model').value.trim(); const stock = state.stock.find((x) => x.model.toLowerCase() === model.toLowerCase()); const qty = Number($('#sale-qty').value); const price = Number($('#sale-price').value); const customer = $('#sale-customer').value.trim(); if (!stock || !customer || !Number.isInteger(qty) || qty < 1 || qty > stock.qty || price < 0) return notify('Check model, customer, quantity, stock, and price.', true); const sale = { id: crypto.randomUUID(), stock_id: stock.id, date: today(), model: stock.model, quality: $('#sale-quality').value.trim() || stock.quality, customer, payment: $('#sale-payment').value, qty, cost: stock.cost, price }; if (await insertRow('sales', sale) && await updateRow('stock', stock.id, { qty: stock.qty - qty, updated_at: new Date().toISOString() })) { state.sales.push({ ...sale, total: qty * price }); stock.qty -= qty; cache(); e.target.reset(); renderAll(); notify('Sale recorded and stock updated.'); } });

    $('#sale-model')?.addEventListener('input', () => { const item = state.stock.find((x) => x.model.toLowerCase() === $('#sale-model').value.trim().toLowerCase()); if (item) { $('#sale-quality').value = item.quality || ''; $('#sale-price').value = item.price; } });
    $('#returns-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const sale = state.sales.find((x) => x.id === $('#return-sale').value); const qty = Number($('#return-qty').value); const reason = $('#return-reason').value.trim(); const stock = sale && state.stock.find((x) => x.model.toLowerCase() === sale.model.toLowerCase()); if (!sale || !stock || !reason || !Number.isInteger(qty) || qty < 1 || qty > sale.qty) return notify('Select a valid sale, quantity, and reason.', true); const returned = { id: crypto.randomUUID(), sale_id: sale.id, date: today(), model: sale.model, customer: sale.customer, qty, reason, amount: qty * sale.price }; if (await insertRow('returns', returned) && await updateRow('stock', stock.id, { qty: stock.qty + qty, updated_at: new Date().toISOString() })) { state.returns.push(returned); stock.qty += qty; cache(); e.target.reset(); renderAll(); notify('Return recorded and stock restored.'); } });
    $('#requisition-form')?.addEventListener('submit', async (e) => { e.preventDefault(); const item = { id: `REQ-${Date.now()}`, date: today(), item: $('#requisition-item').value.trim(), qty: Number($('#requisition-qty').value), supplier: $('#requisition-supplier').value.trim(), status: 'Pending' }; if (!item.item || item.qty < 1) return notify('Enter a valid requisition.', true); if (await insertRow('requisitions', item)) { state.requisitions.push(item); cache(); e.target.reset(); renderRequisitions(); notify('Requisition submitted.'); } });

    $('#password-form')?.addEventListener('submit', (e) => { e.preventDefault(); if ($('#new-password').value !== $('#confirm-password').value) return notify('Passwords do not match.', true); notify('Password updated locally. Use Supabase Auth for production credentials.'); e.target.reset(); });
    document.body.addEventListener('click', async (e) => { const b = e.target.closest('.delete-stock,.delete-sale,.delete-return'); if (!b) return; const table = b.classList.contains('delete-stock') ? 'stock' : b.classList.contains('delete-sale') ? 'sales' : 'returns'; if (await deleteRow(table, b.dataset.id)) { if (table === 'stock') state.stock = state.stock.filter((x) => x.id !== b.dataset.id); if (table === 'sales') state.sales = state.sales.filter((x) => x.id !== b.dataset.id); if (table === 'returns') state.returns = state.returns.filter((x) => x.id !== b.dataset.id); cache(); renderAll(); notify('Record deleted.'); } });
    $('#export-stock')?.addEventListener('click', () => exportCsv('stock.csv', ['Model','Category','Quality','Supplier','Qty','Cost','Price'], state.stock.map((x) => [x.model,x.category,x.quality,x.supplier,x.qty,x.cost,x.price])));
    $('#export-sales')?.addEventListener('click', () => exportCsv('sales.csv', ['Date','Model','Quality','Customer','Payment','Qty','Cost','Price','Total'], state.sales.map((x) => [x.date,x.model,x.quality,x.customer,x.payment,x.qty,x.cost,x.price,x.total])));
    $('#backup-stock')?.addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = `sky-backup-${today()}.json`; a.click(); });
    $('#restore-stock')?.addEventListener('click', () => $('#restore-input').click());
    $('#restore-input')?.addEventListener('change', (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const imported = JSON.parse(reader.result); if (!Array.isArray(imported.stock)) throw new Error(); Object.assign(state, imported); cache(); renderAll(); notify('Backup restored locally.'); } catch { notify('Invalid backup file.', true); } }; reader.readAsText(file); });
    $('#print-dashboard')?.addEventListener('click', () => window.print()); $('#print-cash')?.addEventListener('click', () => window.print());
  }

  async function init() {
    readCache();
    if (localStorage.getItem('sky-theme') === 'dark') document.body.classList.add('dark-mode');
    bindEvents(); renderAll(); navigate(sessionStorage.getItem(AUTH_KEY) === '1' ? 'dashboard' : 'login');
    await refreshFromSupabase();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
