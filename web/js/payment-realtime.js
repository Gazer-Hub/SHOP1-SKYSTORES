(function(){
  // Supabase Realtime helper that subscribes to all inserts/updates on the 'payments' table
  // It requires the Supabase client library to already be loaded on the page (window.supabase)
  // and the globals SUPABASE_URL and SUPABASE_ANON_KEY to be defined in the page.

  async function startPaymentRealtimeAll(supabaseUrl, supabaseAnonKey) {
    try {
      if (!window.supabase || !window.supabase.createClient) {
        console.warn('Supabase client not found on page. Ensure <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> is included.');
        return;
      }

      const sup = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

      // Fetch current payments once and merge into local DB
      try {
        const { data, error } = await sup.from('payments').select('*');
        if (error) console.warn('Initial payments fetch error', error);
        if (Array.isArray(data)) {
          window.db = window.db || {};
          window.db.moniepointPayments = window.db.moniepointPayments || [];
          data.forEach(row => {
            const p = mapRowToFrontend(row);
            if (!window.db.moniepointPayments.some(x => x.reference === p.reference)) {
              window.db.moniepointPayments.push(p);
            }
          });
          if (typeof saveDB === 'function') saveDB();
        }
      } catch (err) {
        console.warn('Error fetching initial payments', err);
      }

      // Subscribe to postgres changes on payments table
      const channel = sup.channel('public:payments')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, payload => {
          const row = payload?.new || payload?.record || payload;
          handleRow(row);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payments' }, payload => {
          const row = payload?.new || payload?.record || payload;
          handleRow(row);
        })
        .subscribe();

      window._paymentsRealtime = { sup, channel };

    } catch (err) {
      console.error('Failed to start realtime subscription', err);
    }
  }

  function mapRowToFrontend(row) {
    return {
      datetime: row.datetime || row.created_at || new Date().toISOString(),
      reference: row.reference,
      senderName: row.metadata?.senderName || row.sender_name || row.metadata?.sender_name || '',
      accountNumber: row.metadata?.accountNumber || row.account_number || row.metadata?.account_number || '',
      amount: row.amount,
      status: row.status || (row.metadata && row.metadata.status) || 'unknown'
    };
  }

  function handleRow(row) {
    if (!row || !row.reference) return;
    const p = mapRowToFrontend(row);
    window.db = window.db || {};
    window.db.moniepointPayments = window.db.moniepointPayments || [];
    const exists = window.db.moniepointPayments.some(x => x.reference === p.reference);
    if (!exists) {
      window.db.moniepointPayments.push(p);
      if (typeof saveDB === 'function') saveDB();
      if (typeof showMoniepointToast === 'function') {
        try {
          showMoniepointToast(`Payment of ₦${Number(p.amount).toLocaleString()} received from ${p.senderName || 'Moniepoint'} (Ref: ${p.reference})`);
        } catch (e) { console.warn(e); }
      }
    } else {
      // update existing
      const idx = window.db.moniepointPayments.findIndex(x => x.reference === p.reference);
      if (idx !== -1) {
        window.db.moniepointPayments[idx] = p;
        if (typeof saveDB === 'function') saveDB();
      }
    }
  }

  window.startPaymentRealtimeAll = startPaymentRealtimeAll;
})();
