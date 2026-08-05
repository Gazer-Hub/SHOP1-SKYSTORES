(function(){
  // Realtime subscription helper using Supabase Realtime.
  // Usage (example):
  // <script src="/js/payment-realtime.js"></script>
  // <script>
  //   window.startPaymentRealtime('ORDER_REF', 'payment-status', 'https://<project>.supabase.co', '<ANON_KEY>');
  // </script>
  
  async function loadSupabaseUmd() {
    if (window.supabase && window.supabase.createClient) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js';
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  async function startPaymentRealtime(reference, elementId, supabaseUrl, supabaseAnonKey) {
    const el = document.getElementById(elementId || 'payment-status');
    if (!el) return console.warn('No element found with id', elementId);
    if (!reference) return console.warn('Missing reference');
    if (!supabaseUrl || !supabaseAnonKey) return console.error('Missing Supabase config for realtime (supabaseUrl, supabaseAnonKey)');

    try {
      await loadSupabaseUmd();
    } catch (err) {
      console.error('Failed to load Supabase client', err);
      return;
    }

    const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

    // Fetch current status once
    try {
      const { data, error } = await supabase.from('payments').select('*').eq('reference', reference).single();
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = "The resource was not found" sometimes; ignore not found
        console.warn('Supabase select error', error);
      }
      if (data) {
        el.textContent = data.status || 'unknown';
      }
    } catch (err) {
      console.warn('Error fetching initial payment row', err);
    }

    // Subscribe to inserts and updates for this reference
    try {
      const insertSub = supabase
        .from(`payments:reference=eq.${reference}`)
        .on('INSERT', payload => {
          const row = payload.new || payload.record || payload;
          el.textContent = row.status || 'unknown';
        })
        .subscribe();

      const updateSub = supabase
        .from(`payments:reference=eq.${reference}`)
        .on('UPDATE', payload => {
          const row = payload.new || payload.record || payload;
          el.textContent = row.status || 'unknown';
        })
        .subscribe();

      // store so the page can unsubscribe later if needed
      window._supabasePaymentRealtime = { insertSub, updateSub, client: supabase };

    } catch (err) {
      console.error('Error subscribing to Supabase realtime', err);
    }
  }

  function stopPaymentRealtime() {
    try {
      const s = window._supabasePaymentRealtime;
      if (!s || !s.client) return;
      if (s.insertSub) s.client.removeSubscription(s.insertSub);
      if (s.updateSub) s.client.removeSubscription(s.updateSub);
      window._supabasePaymentRealtime = null;
    } catch (err) {
      console.warn('Error stopping realtime subscription', err);
    }
  }

  window.startPaymentRealtime = startPaymentRealtime;
  window.stopPaymentRealtime = stopPaymentRealtime;
})();
