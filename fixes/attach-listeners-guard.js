// Wrap existing addEventListener attachments in DOMContentLoaded guards to avoid calling on null
// We'll replace repeated direct getElementById(...).addEventListener calls with guarded versions.

document.addEventListener('DOMContentLoaded', function(){
  // stock-form
  const stockForm = document.getElementById('stock-form');
  if (stockForm) {
    stockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const modelEl = document.getElementById('stk-model');
      const catEl = document.getElementById('stk-cat');
      const subcatEl = document.getElementById('stk-subcat');
      const qtyEl = document.getElementById('stk-qty');
      const costEl = document.getElementById('stk-cost');
      const sellEl = document.getElementById('stk-sell');
      const supplierEl = document.getElementById('stk-supplier');

      const model = modelEl ? modelEl.value.trim() : '';
      const category = catEl ? catEl.value.trim() : '';
      const subcat = subcatEl ? subcatEl.value.trim() : '';
      const qty = qtyEl ? parseInt(qtyEl.value) : 0;
      const cost_price = costEl ? parseInt(costEl.value) : 0;
      const sell_price = sellEl ? parseInt(sellEl.value) : 0;
      const supplier = supplierEl ? supplierEl.value.trim() : '';

      db.stock.push({ model, category, subcat, qty, cost_price, sell_price, supplier });
      saveDB();
      e.target.reset();
      alert("✅ New stock entry added successfully!");
    });
  }

  // edit-stock-form
  const editStockForm = document.getElementById('edit-stock-form');
  if (editStockForm) {
    editStockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const index = parseInt(document.getElementById('edit-stk-index').value || '0');
      db.stock[index] = {
        model: document.getElementById('edit-stk-model').value.trim(),
        category: document.getElementById('edit-stk-cat').value.trim(),
        subcat: document.getElementById('edit-stk-subcat').value.trim(),
        qty: parseInt(document.getElementById('edit-stk-qty').value),
        cost_price: parseInt(document.getElementById('edit-stk-cost').value),
        sell_price: parseInt(document.getElementById('edit-stk-sell').value),
        supplier: document.getElementById('edit-stk-supplier').value.trim()
      };
      bootstrap.Modal.getInstance(document.getElementById('editStockModal')).hide();
      saveDB();
      alert("✅ Stock details updated successfully!");
    });
  }

  // edit-requisition-form
  const editReqForm = document.getElementById('edit-requisition-form');
  if (editReqForm) {
    editReqForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const index = parseInt(document.getElementById('edit-req-index').value || '0');
      db.requisitions[index] = {
        item: document.getElementById('edit-req-item').value.trim(),
        category: document.getElementById('edit-req-cat').value.trim(),
        qty: parseInt(document.getElementById('edit-req-qty').value),
        cost: document.getElementById('edit-req-cost').value || null,
        supplier: document.getElementById('edit-req-supplier').value || '',
        notes: document.getElementById('edit-req-notes').value || ''
      };
      bootstrap.Modal.getInstance(document.getElementById('editRequisitionModal')).hide();
      saveDB();
      alert("✅ Requisition updated successfully!");
    });
  }

  // other listeners that were attached directly can be added here with guards similarly
});
