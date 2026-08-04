(function(){
  // public/moniepoint-live.js
  // Polls Supabase for latest transactions and updates elements in Index.html
  // Requires the page to expose `supabaseClient` as a global (Index.html already does)

  if (typeof window === 'undefined') return;
  const POLL_INTERVAL = 5000; // ms

  async function fetchAndRender() {
    try {
      if (!window.supabaseClient) return;
      // Fetch totals and recent transactions
      const { data: txs, error } = await window.supabaseClient
        .from('transactions')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('Error fetching transactions for live UI:', error.message || error);
        return;
      }

      // Update totals
      let totalAmount = 0;
      let successCount = 0;
      if (txs && txs.length) {
        txs.forEach(t => { totalAmount += Number(t.amount || 0); if (t.status && String(t.status).toLowerCase().includes('success')) successCount++; });
      }
      const elTotalAmt = document.getElementById('moniepoint-total-amount');
      const elTotalCount = document.getElementById('moniepoint-total-count');
      if (elTotalAmt) elTotalAmt.innerText = '₦' + (totalAmount.toLocaleString());
      if (elTotalCount) elTotalCount.innerText = (txs && txs.length) ? txs.length : '0';

      // Update latest transaction card (create if missing)
      let latest = (txs && txs.length) ? txs[0] : null;
      let latestContainer = document.getElementById('moniepoint-latest-transaction');
      if (!latestContainer) {
        const parent = document.querySelector('#page-moniepoint .d-flex.justify-content-between') || document.querySelector('#page-moniepoint');
        if (parent) {
          latestContainer = document.createElement('div');
          latestContainer.id = 'moniepoint-latest-transaction';
          latestContainer.className = 'card mb-3';
          latestContainer.style.maxWidth = '420px';
          latestContainer.innerHTML = `\
            <div class="card-body p-2">\
              <h6 class="mb-1">Last Moniepoint Transaction</h6>\
              <div id="mp-latest-content" class="small text-muted">No transactions yet.</div>\
            </div>`;
          // insert after the header section
          const header = document.querySelector('#page-moniepoint > div.d-flex') || document.querySelector('#page-moniepoint');
          if (header && header.parentNode) header.parentNode.insertBefore(latestContainer, header.nextSibling);
        }
      }

      if (latest && latestContainer) {
        const content = `\
          <div><strong>₦${Number(latest.amount || 0).toLocaleString()}</strong> — <span class="text-muted">${latest.status || ''}</span></div>\
          <div class="small text-muted">Ref: ${latest.reference || ''} • ${new Date(latest.received_at).toLocaleString()}</div>`;
        const target = document.getElementById('mp-latest-content');
        if (target) target.innerHTML = content;
      }

      // Update table of recent transactions
      const tbody = document.getElementById('moniepoint-table-body');
      if (tbody) {
        tbody.innerHTML = '';
        if (txs && txs.length) {
          txs.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `\
              <td>${new Date(t.received_at).toLocaleString()}</td>\
              <td>${t.reference || ''}</td>\
              <td>${t.customer_name || ''}</td>\
              <td class="text-muted">-</td>\
              <td>₦${Number(t.amount || 0).toLocaleString()}</td>\
              <td>${t.status || ''}</td>`;
            tbody.appendChild(tr);
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No Moniepoint payments recorded yet.</td></tr>';
        }
      }

    } catch (err) {
      console.error('moniepoint-live error', err);
    }
  }

  // Start polling when DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    fetchAndRender();
    setInterval(fetchAndRender, POLL_INTERVAL);
  });
})();
