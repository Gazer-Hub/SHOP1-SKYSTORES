/* Separate Supabase persistence for the SKY store app.
 * Include after the existing inline application script:
 * <script src="/supabase-sync.js"></script>
 *
 * The app keeps localStorage as its offline cache, while each collection is
 * stored in its own Supabase table. Records receive stable UUIDs so upsert
 * works for stock, sales, returns, requisitions, and supplier returns.
 */
(function () {
  const TABLES = {
    stock: 'stock',
    sales: 'sales',
    returns: 'returns',
    supplierReturns: 'supplier_returns',
    requisitions: 'requisitions',
    moniepointPayments: 'payments'
  };

  const id = () => crypto.randomUUID();
  const withIds = (rows) => (rows || []).map(row => ({
    id: row.id || id(),
    ...row
  }));

  async function syncTable(table, rows) {
    const records = withIds(rows);
    const { error } = await supabaseClient.from(table).upsert(records, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
    return records;
  }

  async function saveSeparateTables() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    if (!supabaseClient) {
      renderAll();
      return;
    }

    try {
      db.stock = await syncTable(TABLES.stock, db.stock);
      db.sales = await syncTable(TABLES.sales, db.sales);
      db.returns = await syncTable(TABLES.returns, db.returns);
      db.supplierReturns = await syncTable(TABLES.supplierReturns, db.supplierReturns);
      db.requisitions = await syncTable(TABLES.requisitions, db.requisitions);
      db.moniepointPayments = await syncTable(TABLES.moniepointPayments, db.moniepointPayments);
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      console.info('Supabase sync completed for all separate tables.');
    } catch (error) {
      console.error('Supabase sync failed:', error);
      alert(`Cloud save failed: ${error.message}`);
    }
    renderAll();
  }

  async function loadSeparateTables() {
    if (!supabaseClient) return;
    const loaded = {};
    for (const [key, table] of Object.entries(TABLES)) {
      const { data, error } = await supabaseClient.from(table).select('*');
      if (error) {
        console.error(`Could not load ${table}:`, error.message);
        continue;
      }
      loaded[key] = data || [];
    }
    Object.assign(db, loaded);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    renderAll();
  }

  // Override the old inventory-payload functions after the app script loads.
  window.saveDB = saveSeparateTables;
  window.initTripleSavingSync = loadSeparateTables;
})();
