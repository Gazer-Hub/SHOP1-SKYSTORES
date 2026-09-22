const appState = {
  currentPage: 'login',
  authenticated: false,
  stock: [
    { id: 1, model: 'iPhone 13', category: 'Phones', subcat: 'Grade A', supplier: 'Sky Supplies', qty: 18, cost: 240000, sell: 360000 },
    { id: 2, model: 'Samsung S24', category: 'Phones', subcat: 'Grade A', supplier: 'Adex Traders', qty: 6, cost: 290000, sell: 420000 },
    { id: 3, model: 'Dell XPS 13', category: 'Laptops', subcat: 'New', supplier: 'TechNest', qty: 9, cost: 550000, sell: 760000 },
    { id: 4, model: 'HP LaserJet Pro', category: 'Printers', subcat: 'Office', supplier: 'OfficeHub', qty: 12, cost: 180000, sell: 260000 }
  ],
  sales: [
    { date: '2026-09-22', model: 'iPhone 13', quality: 'Grade A', customer: 'Aisha Bello', payment: 'Transfer', qty: 2, unitPrice: 360000, total: 720000 },
    { date: '2026-09-21', model: 'Dell XPS 13', quality: 'New', customer: 'Tunde Yusuf', payment: 'Cash', qty: 1, unitPrice: 760000, total: 760000 },
    { date: '2026-09-20', model: 'Samsung S24', quality: 'Grade A', customer: 'Jane Okafor', payment: 'Transfer', qty: 3, unitPrice: 420000, total: 1260000 }
  ],
  returns: [],
  payments: [
    { datetime: '2026-09-22T12:45:00', reference: 'MP-1023', sender_name: 'Aisha Bello', account_number: '203****223', amount: 720000, status: 'Successful' },
    { datetime: '2026-09-22T09:12:00', reference: 'MP-1018', sender_name: 'Tunde Yusuf', account_number: '123****998', amount: 760000, status: 'Successful' }
  ]
};

const money = (value) => `₦${Number(value || 0).toLocaleString()}`;

function showToast(message) {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  if (!toast || !msg) return;
  msg.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `page-${page}`);
  });
  appState.currentPage = page;
  const nav = document.getElementById('main-nav');
  if (nav) nav.style.display = appState.authenticated ? 'block' : 'none';
}

function setAuthState(isAuth) {
  appState.authenticated = isAuth;
  const nav = document.getElementById('main-nav');
  if (nav) nav.style.display = isAuth ? 'block' : 'none';
  navigateTo(isAuth ? 'dashboard' : 'login');
}

function renderStockTable() {
  const tableBody = document.getElementById('stock-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = appState.stock.map((item) => `
    <tr>
      <td>${item.model}</td>
      <td>${item.category}</td>
      <td>${item.subcat || '—'}</td>
      <td>${item.supplier || '—'}</td>
      <td>${item.qty}</td>
      <td>${money(item.cost)}</td>
      <td>${money(item.sell)}</td>
      <td class="no-print text-end">
        <button class="btn btn-sm btn-outline-primary me-1 edit-stock-btn" data-id="${item.id}" type="button">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-stock-btn" data-id="${item.id}" type="button">Delete</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('total-stock-units').textContent = `${appState.stock.reduce((sum, item) => sum + Number(item.qty || 0), 0)} pcs`;
  document.getElementById('total-stock-value').textContent = money(appState.stock.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.cost || 0)), 0));
}

function renderSalesTable() {
  const tableBody = document.getElementById('sales-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = appState.sales.map((sale) => `
    <tr>
      <td>${sale.date}</td>
      <td>${sale.model}</td>
      <td>${sale.quality}</td>
      <td>${sale.customer}</td>
      <td>${sale.payment}</td>
      <td>${sale.qty}</td>
      <td>${money(sale.unitPrice)}</td>
      <td>${money(sale.total)}</td>
      <td class="no-print text-end"><button class="btn btn-sm btn-outline-danger delete-sale-btn" data-model="${sale.model}" type="button">Remove</button></td>
    </tr>
  `).join('');
}

function renderReturnsTable() {
  const tableBody = document.getElementById('returns-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = appState.returns.map((returnItem) => `
    <tr>
      <td>${returnItem.date}</td>
      <td>${returnItem.model}</td>
      <td>${returnItem.customer}</td>
      <td>${returnItem.qty}</td>
      <td>${returnItem.reason}</td>
      <td>${returnItem.isExchanged ? 'Replacement Issued' : 'Refund'}</td>
      <td class="no-print text-end"><button class="btn btn-sm btn-outline-danger delete-return-btn" data-id="${returnItem.id}" type="button">Delete</button></td>
    </tr>
  `).join('');
}

function renderPaymentsTable() {
  const tableBody = document.getElementById('payment-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = appState.payments.map((payment) => `
    <tr>
      <td>${new Date(payment.datetime).toLocaleString()}</td>
      <td><code>${payment.reference}</code></td>
      <td>${payment.sender_name}</td>
      <td>${payment.account_number}</td>
      <td>${money(payment.amount)}</td>
      <td><span class="badge bg-success">${payment.status}</span></td>
    </tr>
  `).join('');
}

function renderDashboard() {
  const salesTotal = appState.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const costTotal = appState.sales.reduce((sum, sale) => sum + (Number(sale.unitPrice || 0) * Number(sale.qty || 0)), 0);
  const refundsTotal = appState.returns.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gross = salesTotal - costTotal;
  const periodExpense = Number(document.getElementById('dash-period-expenses')?.value || 0);
  const cac = salesTotal * 0.075;
  const net = gross - periodExpense - cac - refundsTotal;

  document.getElementById('dash-sales').textContent = money(salesTotal);
  document.getElementById('dash-cost').textContent = money(costTotal);
  document.getElementById('dash-returns').textContent = money(refundsTotal);
  document.getElementById('dash-gross').textContent = money(gross);
  document.getElementById('dash-cac').textContent = money(cac);
  document.getElementById('dash-net').textContent = money(net);

  const lowStock = appState.stock.filter((item) => Number(item.qty) <= 10);
  const lowStockList = document.getElementById('low-stock-list');
  if (lowStockList) {
    if (!lowStock.length) {
      lowStockList.innerHTML = '<p class="text-muted p-3 mb-0">No low stock items currently.</p>';
      return;
    }

    lowStockList.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead>
            <tr><th>Model</th><th>Qty</th><th>Category</th><th>Supplier</th></tr>
          </thead>
          <tbody>
            ${lowStock.map((item) => `
              <tr>
                <td>${item.model}</td>
                <td class="text-danger fw-bold">${item.qty}</td>
                <td>${item.category}</td>
                <td>${item.supplier}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function initSalesCart() {
  const cartContainer = document.getElementById('sales-cart-container');
  const cartRows = document.getElementById('sales-cart-tbody');
  const cartTotal = document.getElementById('sales-cart-total');
  const cartQty = document.getElementById('sales-cart-total-qty');

  if (!cartContainer || !cartRows || !cartTotal || !cartQty) return;

  const cart = [];
  cartContainer.classList.add('d-none');
  cartRows.innerHTML = '';
  cartTotal.textContent = money(0);
  cartQty.textContent = '0 pcs';

  return { cart, cartContainer, cartRows, cartTotal, cartQty };
}

function bindEvents() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const username = document.getElementById('login-username')?.value.trim();
      const password = document.getElementById('login-password')?.value.trim();
      if (!username || !password) {
        showToast('Please enter username and password');
        return;
      }
      setAuthState(true);
      showToast('Welcome back!');
    });
  }

  const stockForm = document.getElementById('stock-form');
  if (stockForm) {
    stockForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const item = {
        id: Date.now(),
        model: document.getElementById('stk-model').value.trim(),
        category: document.getElementById('stk-cat').value.trim(),
        subcat: document.getElementById('stk-subcat').value.trim(),
        supplier: document.getElementById('stk-supplier').value.trim(),
        qty: Number(document.getElementById('stk-qty').value || 0),
        cost: Number(document.getElementById('stk-cost').value || 0),
        sell: Number(document.getElementById('stk-sell').value || 0)
      };

      if (!item.model || !item.category || item.qty <= 0 || item.cost < 0 || item.sell < 0) {
        showToast('Please complete the stock form correctly.');
        return;
      }

      appState.stock.push(item);
      stockForm.reset();
      renderStockTable();
      renderDashboard();
      showToast('Stock saved successfully');
    });
  }

  const salesForm = document.getElementById('sales-form');
  if (salesForm) {
    salesForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const customer = document.getElementById('sale-customer')?.value.trim();
      const payment = document.getElementById('sale-payment-method')?.value;
      const cart = initSalesCart();
      const cartValues = cart?.cart || [];
      if (!customer || !cartValues.length) {
        showToast('Add products to cart before completing the sale');
        return;
      }

      cartValues.forEach((entry) => {
        appState.sales.push({
          date: new Date().toISOString().split('T')[0],
          model: entry.model,
          quality: entry.quality,
          customer,
          payment,
          qty: entry.qty,
          unitPrice: entry.unitPrice,
          total: entry.qty * entry.unitPrice
        });
      });

      renderSalesTable();
      renderDashboard();
      showToast('Sale recorded successfully');
      salesForm.reset();
      document.getElementById('sales-cart-container').classList.add('d-none');
    });
  }

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    setAuthState(false);
    showToast('Logged out successfully');
  });

  document.getElementById('refresh-app-btn')?.addEventListener('click', () => {
    renderStockTable();
    renderSalesTable();
    renderDashboard();
    renderPaymentsTable();
    showToast('Application refreshed');
  });

  document.getElementById('reset-expenses-btn')?.addEventListener('click', () => {
    const input = document.getElementById('dash-period-expenses');
    if (input) input.value = 0;
    renderDashboard();
  });

  document.getElementById('add-to-cart-btn')?.addEventListener('click', () => {
    const model = document.getElementById('sale-item')?.value.trim();
    const quality = document.getElementById('sale-quality')?.value;
    const qty = Number(document.getElementById('sale-qty')?.value || 0);
    const unitPrice = Number(document.getElementById('sale-price')?.value || 0);

    if (!model || !quality || qty <= 0 || unitPrice <= 0) {
      showToast('Select a valid model, quality, and quantity.');
      return;
    }

    const cartContainer = document.getElementById('sales-cart-container');
    const tbody = document.getElementById('sales-cart-tbody');
    const totalBox = document.getElementById('sales-cart-total');
    const qtyBox = document.getElementById('sales-cart-total-qty');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${model}</td>
      <td>${quality}</td>
      <td>${qty}</td>
      <td>${money(unitPrice)}</td>
      <td>${money(qty * unitPrice)}</td>
      <td><button class="btn btn-sm btn-outline-danger remove-cart-item" type="button">Remove</button></td>
    `;

    tbody.appendChild(row);
    cartContainer.classList.remove('d-none');

    const total = Array.from(tbody.querySelectorAll('tr')).reduce((sum, rowEl) => {
      const cells = rowEl.children;
      const value = Number(cells[4].textContent.replace(/[^\d]/g, '')) || 0;
      return sum + value;
    }, 0);

    totalBox.textContent = money(total);
    qtyBox.textContent = `${Array.from(tbody.querySelectorAll('tr')).reduce((sum, rowEl) => sum + Number(rowEl.children[2].textContent || 0), 0)} pcs`;

    showToast('Item added to cart');
    document.getElementById('sale-item').value = '';
    document.getElementById('sale-quality').value = '';
    document.getElementById('sale-price').value = '';
    document.getElementById('sale-qty').value = 1;
  });

  document.getElementById('clear-cart-btn')?.addEventListener('click', () => {
    const tbody = document.getElementById('sales-cart-tbody');
    const cartContainer = document.getElementById('sales-cart-container');
    if (tbody) tbody.innerHTML = '';
    if (cartContainer) cartContainer.classList.add('d-none');
    document.getElementById('sales-cart-total').textContent = money(0);
    document.getElementById('sales-cart-total-qty').textContent = '0 pcs';
  });

  document.getElementById('cancel-password-btn')?.addEventListener('click', () => navigateTo('dashboard'));

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;
      if (page) navigateTo(page);
    });
  });

  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    showToast('Theme updated');
  });

  document.getElementById('password-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('Password updated');
    navigateTo('dashboard');
  });

  document.getElementById('returns-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = document.getElementById('return-sale-idx').value;
    const reason = document.getElementById('return-reason').value.trim();
    const qty = Number(document.getElementById('return-qty').value || 0);
    const isExchanged = document.getElementById('return-is-exchanged').checked;

    if (!selected || !reason || qty <= 0) {
      showToast('Complete all return fields correctly.');
      return;
    }

    const sale = appState.sales.find((item) => item.model === selected) || appState.sales[0];
    appState.returns.push({
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      model: sale.model,
      customer: sale.customer,
      qty,
      reason,
      isExchanged,
      amount: qty * sale.unitPrice
    });

    renderReturnsTable();
    renderDashboard();
    showToast('Return processed successfully');
    event.target.reset();
  });

  document.getElementById('stock-search-input')?.addEventListener('input', () => {
    const query = document.getElementById('stock-search-input').value.trim().toLowerCase();
    const filtered = appState.stock.filter((item) => [item.model, item.category, item.subcat, item.supplier].join(' ').toLowerCase().includes(query));
    const tableBody = document.getElementById('stock-table-body');
    tableBody.innerHTML = filtered.map((item) => `
      <tr>
        <td>${item.model}</td>
        <td>${item.category}</td>
        <td>${item.subcat || '—'}</td>
        <td>${item.supplier || '—'}</td>
        <td>${item.qty}</td>
        <td>${money(item.cost)}</td>
        <td>${money(item.sell)}</td>
        <td class="no-print text-end"><button class="btn btn-sm btn-outline-primary me-1 edit-stock-btn" data-id="${item.id}" type="button">Edit</button><button class="btn btn-sm btn-outline-danger delete-stock-btn" data-id="${item.id}" type="button">Delete</button></td>
      </tr>
    `).join('');
  });

  document.body.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-stock-btn');
    if (editButton) {
      const id = Number(editButton.dataset.id);
      const item = appState.stock.find((stockItem) => stockItem.id === id);
      if (!item) return;
      const model = prompt('Edit model name', item.model);
      if (model) item.model = model;
      renderStockTable();
      renderDashboard();
      showToast('Stock updated');
    }

    const deleteButton = event.target.closest('.delete-stock-btn');
    if (deleteButton) {
      const id = Number(deleteButton.dataset.id);
      appState.stock = appState.stock.filter((stockItem) => stockItem.id !== id);
      renderStockTable();
      renderDashboard();
      showToast('Stock deleted');
    }

    const removeCart = event.target.closest('.remove-cart-item');
    if (removeCart) {
      removeCart.closest('tr').remove();
      const tbody = document.getElementById('sales-cart-tbody');
      const totalBox = document.getElementById('sales-cart-total');
      const qtyBox = document.getElementById('sales-cart-total-qty');
      const total = Array.from(tbody.querySelectorAll('tr')).reduce((sum, rowEl) => {
        const cells = rowEl.children;
        const value = Number(cells[4].textContent.replace(/[^\d]/g, '')) || 0;
        return sum + value;
      }, 0);
      totalBox.textContent = money(total);
      qtyBox.textContent = `${Array.from(tbody.querySelectorAll('tr')).reduce((sum, rowEl) => sum + Number(rowEl.children[2].textContent || 0), 0)} pcs`;
    }
  });
}

function populateReturnOptions() {
  const select = document.getElementById('return-sale-idx');
  if (!select) return;
  select.innerHTML = appState.sales.map((sale) => `<option value="${sale.model}">${sale.model} — ${sale.customer}</option>`).join('');
}

function seedData() {
  renderStockTable();
  renderSalesTable();
  renderReturnsTable();
  renderPaymentsTable();
  renderDashboard();
  populateReturnOptions();
  setAuthState(false);
}

document.addEventListener('DOMContentLoaded', () => {
  seedData();
  bindEvents();
  document.getElementById('dash-period-expenses').addEventListener('input', renderDashboard);
  document.getElementById('sales-period-filter')?.addEventListener('change', () => {
    document.getElementById('sales-badge-period').textContent = document.getElementById('sales-period-filter').value;
  });

  document.getElementById('sale-item')?.addEventListener('input', () => {
    const modelName = document.getElementById('sale-item').value.trim();
    const match = appState.stock.find((item) => item.model.toLowerCase() === modelName.toLowerCase());
    if (!match) return;
    const drop = document.getElementById('sale-quality');
    drop.innerHTML = `<option value="${match.subcat || 'Regular'}">${match.subcat || 'Regular'}</option>`;
    document.getElementById('sale-price').value = match.sell;
  });
});

window.addEventListener('beforeunload', () => {
  document.body.classList.remove('dark-mode');
});
