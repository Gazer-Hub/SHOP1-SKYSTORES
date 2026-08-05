    function getSenderName(p) {
      return p.sender_name || p.senderName || p.metadata?.sender_name || p.metadata?.senderName || p.metadata?.customer_name || '';
    }
    function getAccountNumber(p) {
      return p.account_number || p.accountNumber || p.metadata?.account_number || p.metadata?.msisdn || '';
    }
    function getDatetime(p) {
      return p.datetime || p.metadata?.normalized_datetime || p.metadata?.datetime || '';
    }
    function safeNumber(v) {
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    }

    function renderMoniepointPayments(filterQuery = "") {
      const tbody = document.getElementById('moniepoint-table-body');
      if (!tbody) return; // defensive

      const payments = Array.isArray(db.moniepointPayments) ? db.moniepointPayments : [];

      // compute total safely
      const totalAmount = payments.reduce((sum, p) => sum + safeNumber(p.amount ?? p.metadata?.amount), 0);
      const totalCount = payments.length;
      const totalAmountEl = document.getElementById('moniepoint-total-amount');
      const totalCountEl = document.getElementById('moniepoint-total-count');
      if (totalAmountEl) totalAmountEl.innerText = `₦${totalAmount.toLocaleString()}`;
      if (totalCountEl) totalCountEl.innerText = String(totalCount);

      const filtered = payments.slice().reverse().filter(p => {
        if (!filterQuery) return true;
        const q = filterQuery.toLowerCase();
        return (getSenderName(p).toLowerCase().includes(q)) ||
               (String(p.reference || '').toLowerCase().includes(q)) ||
               (String(getAccountNumber(p)).toLowerCase().includes(q)) ||
               (String(p.amount || p.metadata?.amount || '').includes(q));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">No matching Moniepoint payment records found</td></tr>`;
      } else {
        const rows = [];
        for (const p of filtered) {
          try {
            rows.push(`
          <tr>
            <td>${getDatetime(p)}</td>
            <td><code>${p.reference || ''}</code></td>
            <td><b>${getSenderName(p)}</b></td>
            <td>${getAccountNumber(p)}</td>
            <td class="text-success fw-bold">₦${safeNumber(p.amount ?? p.metadata?.amount).toLocaleString()}</td>
            <td>${p.status || (p.metadata?.status || '')}</td>
          </tr>
        `);
          } catch (err) {
            console.error('Failed to render payment row', err, p);
          }
        }
        tbody.innerHTML = rows.join('') || `<tr><td colspan="6" class="text-center text-muted py-3">No matching Moniepoint payment records found</td></tr>`;
      }
    }
