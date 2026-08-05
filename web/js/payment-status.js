(function(){
  // Simple polling client for Netlify function /.netlify/functions/payment-status
  // Usage: window.startPaymentStatusPoll('REF123', 'payment-status', 3000)

  function startPaymentStatusPoll(reference, elementId, interval) {
    interval = interval || 3000;
    const el = document.getElementById(elementId || 'payment-status');
    if (!el) {
      console.warn('No element found with id', elementId);
      return;
    }

    async function check() {
      try {
        const res = await fetch(`/.netlify/functions/payment-status?reference=${encodeURIComponent(reference)}`);
        if (!res.ok) {
          if (res.status === 404) {
            el.textContent = 'Not found';
            return;
          }
          throw new Error('Network error');
        }
        const json = await res.json();
        el.textContent = json.status || 'unknown';
        if ((json.status || '').toLowerCase() === 'pending') {
          setTimeout(check, interval);
        }
      } catch (err) {
        console.error('Error checking payment status', err);
        setTimeout(check, interval * 2);
      }
    }

    // start
    check();
  }

  window.startPaymentStatusPoll = startPaymentStatusPoll;
})();
