from flask import Flask, render_template_string, request, redirect, url_for, session, flash, jsonify, Response
from functools import wraps
import json
import os
from datetime import datetime, date, timedelta
from collections import Counter
import threading
import time
import csv
from io import StringIO

app = Flask(__name__)
app.secret_key = "sky-modernize-secret-key-change-this"

DB_FILE = "sky_modernize.json"
COMPANY_NAME = "SKY MODERNIZE SAVE TECHNOLOGY LTD"
CAC_RATE = 0.075 # 7.5% CAC commission
MANAGER_PIN = "2468" # Change this to your manager PIN

# --- Jinja Filter for Date Math ---
@app.template_filter('todatetime')
def todatetime_filter(s):
    return datetime.strptime(s, '%Y-%m-%d')

# --- Database Functions ---
def load_db():
    if not os.path.exists(DB_FILE):
        data = {
            "users": {"admin": {"password": "1234"}},
            "stock": [],
            "sales": [],
            "returns": []
        }
        save_db(data)
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# --- Feature 6: Auto Backup ---
def backup_db_to_csv():
    db = load_db()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    os.makedirs('backups', exist_ok=True)

    for key in ['stock', 'sales', 'returns']:
        if db.get(key):
            with open(f'backups/{key}_{timestamp}.csv', 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=db[key][0].keys())
                writer.writeheader()
                writer.writerows(db[key])

def auto_backup():
    while True:
        time.sleep(86400)
        backup_db_to_csv()
        print(f"{COMPANY_NAME} - Daily backup completed")

threading.Thread(target=auto_backup, daemon=True).start()

# --- Auth Decorator ---
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# --- Manager PIN Decorator for Stock ---
def manager_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'manager_access' not in session:
            return redirect(url_for('manager_auth'))
        return f(*args, **kwargs)
    return decorated

# --- NAVBAR TEMPLATE ---
NAVBAR = '''
<nav class="navbar navbar-dark bg-dark mb-4">
<div class="container-fluid">
<a href="/" class="navbar-brand">{{ company }}</a>
<div>
<a href="/" class="btn btn-sm btn-outline-light">Dashboard</a>
<a href="/stock" class="btn btn-sm btn-outline-light">Stock 🔒</a>
<a href="/sales" class="btn btn-sm btn-outline-light">Sales</a>
<a href="/returns" class="btn btn-sm btn-outline-light">Returns</a>
<a href="/change-password" class="btn btn-sm btn-outline-light">Password</a>
<a href="/logout" class="btn btn-sm btn-danger">Logout</a>
</div></div></nav>
'''

# --- TEMPLATES ---
LOGIN_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - {{ company }}</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-dark text-white min-vh-100 d-flex align-items-center justify-content-center">

    <div class="container">
        <div class="row justify-content-center">
            <div class="col-12 col-sm-8 col-md-6 col-lg-4">
                <div class="card bg-secondary text-white shadow-lg border-0 rounded-3">
                    <div class="card-body p-4">
                        <h3 class="text-center mb-3">{{ company }}</h3>
                        <p class="text-center text-light-50 mb-4">Inventory Management</p>

                        {% with messages = get_flashed_messages() %}
                        {% if messages %}
                            {% for message in messages %}
                                <div class="alert alert-danger py-2" role="alert">
                                    {{ message }}
                                </div>
                            {% endfor %}
                        {% endif %}
                        {% endwith %}

                        <form method="post">
                            <div class="mb-3">
                                <input name="username" class="form-control bg-dark text-white border-secondary" placeholder="Username" required>
                            </div>
                            <div class="mb-3">
                                <input name="password" type="password" class="form-control bg-dark text-white border-secondary" placeholder="Password" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100 fw-bold">Login</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
'''

MANAGER_AUTH_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Manager Access - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body class="bg-light"><div class="container mt-5"><div class="row justify-content-center">
<div class="col-md-4"><div class="card shadow border-warning"><div class="card-body">
<h4 class="text-center mb-3">🔒 Manager Access Required</h4>
<p class="text-center text-muted">Enter Manager PIN to access Stock</p>
{% with messages = get_flashed_messages() %}
{% if messages %}<div class="alert alert-danger">{{ messages[0] }}</div>{% endif %}
{% endwith %}
<form method="post">
<input name="pin" type="password" class="form-control mb-2" placeholder="Manager PIN" required autofocus>
<button class="btn btn-warning w-100">Unlock Stock</button>
<a href="/" class="btn btn-secondary w-100 mt-2">Back to Dashboard</a>
</form></div></div></div></body></html>
'''

DASHBOARD_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Dashboard - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body>''' + NAVBAR + '''
<div class="container">
<div class="card mb-4"><div class="card-body">
<form method="get" class="row g-2 align-items-end">
<div class="col-md-3">
<label class="form-label">Start Date</label>
<input type="date" name="start" value="{{ start }}" class="form-control">
</div>
<div class="col-md-3">
<label class="form-label">End Date</label>
<input type="date" name="end" value="{{ end }}" class="form-control">
</div>
<div class="col-md-6">
<button class="btn btn-primary">Filter</button>
<a href="/" class="btn btn-secondary">Today</a>
<a href="/?start={{ seven_days_ago }}&end={{ end }}" class="btn btn-outline-secondary">7 Days</a>
<a href="/?start={{ thirty_days_ago }}&end={{ end }}" class="btn btn-outline-secondary">30 Days</a>
</div>
</form></div></div>

<div class="row mb-3">
<div class="col-md-12">
<div class="btn-group" role="group">
<a href="/export/sales?start={{ start }}&end={{ end }}" class="btn btn-success btn-sm">📥 Export Sales CSV</a>
<a href="/export/stock" class="btn btn-primary btn-sm">📥 Export Stock CSV</a>
<a href="/export/returns?start={{ start }}&end={{ end }}" class="btn btn-warning btn-sm">📥 Export Returns CSV</a>
</div>
</div></div>

<div class="row mb-4">
<div class="col-md-2"><div class="card text-center"><div class="card-body">
<h6>Sales</h6><h4 class="text-success">₦{{ "{:,}".format(total_sales) }}</h4>
</div></div></div>
<div class="col-md-2"><div class="card text-center"><div class="card-body">
<h6>Cost</h6><h4 class="text-warning">₦{{ "{:,}".format(total_cost) }}</h4>
</div></div></div>
<div class="col-md-2"><div class="card text-center"><div class="card-body">
<h6>Returns</h6><h4 class="text-danger">₦{{ "{:,}".format(total_returns) }}</h4>
</div></div></div>
<div class="col-md-2"><div class="card text-center"><div class="card-body">
<h6>Gross Profit</h6><h4 class="text-info">₦{{ "{:,}".format(gross_profit) }}</h4>
<small>Margin: {{ profit_margin }}%</small>
</div></div></div>
<div class="col-md-2"><div class="card text-center border-danger"><div class="card-body">
<h6>CAC 7.5%</h6><h4 class="text-danger">₦{{ "{:,}".format(cac_fee) }}</h4>
</div></div></div>
<div class="col-md-2"><div class="card text-center border-success"><div class="card-body">
<h6>Net Profit</h6><h4 class="text-success">₦{{ "{:,}".format(net_profit) }}</h4>
<small>After CAC</small>
</div></div></div>
</div>

<div class="row">
<div class="col-md-6">
<div class="card mb-3"><div class="card-header bg-success text-white">🔥 Top 5 Hot Models</div>
<div class="card-body">
{% for model, count in top_models %}
<div class="d-flex justify-content-between border-bottom py-1"><span>{{ model }}</span><b>{{ count }} sold</b></div>
{% else %}<p class="text-muted">No sales yet</p>{% endfor %}
</div></div></div>

<div class="col-md-6">
<div class="card mb-3"><div class="card-header bg-danger text-white">💀 Worst 5 Models</div>
<div class="card-body">
{% for model, count in worst_models %}
<div class="d-flex justify-content-between border-bottom py-1"><span>{{ model }}</span><b>{{ count }} returned</b></div>
{% else %}<p class="text-muted">No returns yet</p>{% endfor %}
</div></div></div>
</div>

<div class="card"><div class="card-header bg-warning">⚠️ Low Stock Alert (<=10)</div>
<div class="card-body">
{% for item in low_stock %}
<span class="badge bg-danger m-1">{{ item.model }} - {{ item.qty }} pcs | {{ item.supplier or 'No supplier' }}</span>
{% else %}<p class="text-muted">All stock good</p>{% endfor %}
</div></div>
</div></body></html>
'''

STOCK_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Stock - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body>''' + NAVBAR + '''
<div class="container">
<div class="d-flex justify-content-between align-items-center mb-3">
<h3>🔒 Stock Management - Manager Only</h3>
<a href="/manager-logout" class="btn btn-sm btn-outline-warning">Lock Stock</a>
</div>

<form method="get" class="mb-3">
<div class="input-group">
<input type="text" name="q" value="{{ search }}" class="form-control" placeholder="Search model, category, supplier...">
<button class="btn btn-primary">Search</button>
<a href="/stock" class="btn btn-secondary">Clear</a>
</div></form>

<div class="card mb-3"><div class="card-header">Add New Stock</div><div class="card-body">
<form method="post" class="row g-2">
<div class="col-md-2"><input name="model" class="form-control" placeholder="Model" required></div>
<div class="col-md-2"><input name="category" class="form-control" placeholder="Category" required></div>
<div class="col-md-2"><input name="qty" type="number" class="form-control" placeholder="Qty" required></div>
<div class="col-md-2"><input name="cost_price" type="number" class="form-control" placeholder="Cost Price" required></div>
<div class="col-md-2"><input name="sell_price" type="number" class="form-control" placeholder="Sell Price" required></div>
<div class="col-md-2"><input name="supplier" class="form-control" placeholder="Supplier"></div>
<div class="col-12"><button class="btn btn-success">Add Stock</button></div>
</form></div></div>

<table class="table table-striped table-hover">
<thead class="table-dark"><tr><th>Model</th><th>Category</th><th>Supplier</th><th>Qty</th><th>Cost</th><th>Sell</th><th>Profit/Unit</th><th>Action</th></tr></thead>
<tbody>
{% for item in stock %}
<tr class="{% if item.qty <= 10 %}table-danger{% endif %}">
<td><b>{{ item.model }}</b></td>
<td>{{ item.category }}</td>
<td>{{ item.supplier or '-' }}</td>
<td>{{ item.qty }}</td>
<td>₦{{ "{:,}".format(item.cost_price) }}</td>
<td>₦{{ "{:,}".format(item.sell_price) }}</td>
<td class="text-success">₦{{ "{:,}".format(item.sell_price - item.cost_price) }}</td>
<td><a href="/delete-stock/{{ loop.index0 }}" class="btn btn-sm btn-danger" onclick="return confirm('Delete {{ item.model }}?')">Del</a></td>
</tr>
{% endfor %}
</tbody></table>
</div></body></html>
'''

SALES_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Sales - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body>''' + NAVBAR + '''
<div class="container">
<h3>Sales Management</h3>
{% with messages = get_flashed_messages() %}
{% if messages %}<div class="alert alert-info">{{ messages[0] }}</div>{% endif %}
{% endwith %}

<div class="card mb-3"><div class="card-header bg-success text-white">Record New Sale</div><div class="card-body">
<form method="post" action="/add-sale" class="row g-2">
<div class="col-md-4">
<label>Select Model</label>
<select name="model" class="form-select" required>
<option value="">-- Select --</option>
{% for item in stock %}
<option value="{{ item.model }}">
{{ item.model }} - ₦{{ "{:,}".format(item.sell_price) }} | Stock: {{ item.qty }}
</option>
{% endfor %}
</select>
</div>
<div class="col-md-2">
<label>Quantity</label>
<input name="qty" type="number" class="form-control" placeholder="Qty" required min="1">
</div>
<div class="col-md-3">
<label>Customer Name</label>
<input name="customer" class="form-control" placeholder="Customer" required>
</div>
<div class="col-md-3">
<label>&nbsp;</label>
<button class="btn btn-success w-100">Record Sale</button>
</div>
</form></div></div>

<h5>Recent Sales</h5>
<table class="table table-striped">
<thead class="table-dark"><tr><th>Date</th><th>Model</th><th>Customer</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Profit</th><th>Action</th></tr></thead>
<tbody>
{% for sale in sales %}
<tr>
<td>{{ sale.date }}</td>
<td>{{ sale.model }}</td>
<td>{{ sale.customer }}</td>
<td>{{ sale.qty }}</td>
<td>₦{{ "{:,}".format(sale.sell_price) }}</td>
<td><b>₦{{ "{:,}".format(sale.sell_price * sale.qty) }}</b></td>
<td class="text-success">₦{{ "{:,}".format((sale.sell_price - sale.cost_price) * sale.qty) }}</td>
<td><a href="/receipt/{{ loop.index0 }}" class="btn btn-sm btn-primary" target="_blank">Print</a></td>
</tr>
{% else %}
<tr><td colspan="8" class="text-center text-muted">No sales recorded yet</td></tr>
{% endfor %}
</tbody></table>
</div></body></html>
'''

RETURNS_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Returns - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body>''' + NAVBAR + '''
<div class="container">
<h3>Returns Management</h3>
{% with messages = get_flashed_messages() %}
{% if messages %}<div class="alert alert-info">{{ messages[0] }}</div>{% endif %}
{% endwith %}

<div class="card mb-3"><div class="card-header bg-danger text-white">Process Return</div><div class="card-body">
<form method="post" action="/add-return" class="row g-2">
<div class="col-md-4">
<label>Select Sold Item</label>
<select name="sale_idx" class="form-select" required>
<option value="">-- Select Sale --</option>
{% for sale in recent_sales %}
<option value="{{ loop.index0 }}">{{ sale.date }} - {{ sale.model }} - {{ sale.customer }} - {{ sale.qty }} pcs</option>
{% endfor %}
</select>
</div>
<div class="col-md-2">
<label>Return Qty</label>
<input name="qty" type="number" class="form-control" placeholder="Qty" required min="1">
</div>
<div class="col-md-3">
<label>Reason</label>
<input name="reason" class="form-control" placeholder="Reason" required>
</div>
<div class="col-md-3">
<label>&nbsp;</label>
<button class="btn btn-danger w-100">Process Return</button>
</div>
</form></div></div>

<h5>Return History</h5>
<table class="table table-striped">
<thead class="table-dark"><tr><th>Date</th><th>Model</th><th>Customer</th><th>Qty</th><th>Amount</th><th>Reason</th></tr></thead>
<tbody>
{% for ret in returns %}
<tr>
<td>{{ ret.date }}</td>
<td>{{ ret.model }}</td>
<td>{{ ret.customer }}</td>
<td>{{ ret.qty }}</td>
<td>₦{{ "{:,}".format(ret.sell_price * ret.qty) }}</td>
<td>{{ ret.reason }}</td>
</tr>
{% else %}
<tr><td colspan="6" class="text-center text-muted">No returns yet</td></tr>
{% endfor %}
</tbody></table>
</div></body></html>
'''

RECEIPT_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Receipt - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
@media print {
.no-print { display: none; }
    body { font-size: 12pt; }
}
.receipt { max-width: 400px; margin: auto; border: 2px dashed #000; padding: 20px; }
</style>
</head><body class="bg-light">
<div class="container mt-4">
<div class="receipt bg-white">
<div class="text-center mb-3">
<h3>{{ company }}</h3>
<p class="mb-1">SALES RECEIPT</p>
<small>{{ sale.date }} {{ sale.time }}</small>
</div>
<hr>
<div class="mb-2"><b>Customer:</b> {{ sale.customer }}</div>
<div class="mb-2"><b>Item:</b> {{ sale.model }}</div>
<div class="mb-2"><b>Quantity:</b> {{ sale.qty }}</div>
<div class="mb-2"><b>Unit Price:</b> ₦{{ "{:,}".format(sale.sell_price) }}</div>
<hr>
<div class="d-flex justify-content-between mb-2">
<h5>TOTAL:</h5>
<h5>₦{{ "{:,}".format(sale.sell_price * sale.qty) }}</h5>
</div>
<hr>
<div class="text-center mt-3">
<p><small>Thank you for your patronage!</small></p>
<p><small>{{ company }}</small></p>
</div>
<div class="text-center mt-3 no-print">
<button onclick="window.print()" class="btn btn-primary">Print Receipt</button>
<a href="/sales" class="btn btn-secondary">Back to Sales</a>
</div>
</div></div></body></html>
'''

PASSWORD_TEMPLATE = '''
<!DOCTYPE html><html><head><title>Change Password - {{ company }}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head><body class="bg-light"><div class="container mt-5"><div class="row justify-content-center">
<div class="col-md-4"><div class="card"><div class="card-body">
<h4>Change Password</h4>
{% with messages = get_flashed_messages() %}
{% if messages %}<div class="alert alert-success">{{ messages[0] }}</div>{% endif %}
{% endwith %}
<form method="post">
<input name="password" type="password" class="form-control mb-2" placeholder="New Password" required>
<button class="btn btn-primary w-100">Update</button>
<a href="/" class="btn btn-secondary w-100 mt-2">Back to Dashboard</a>
</form></div></div></div></body></html>
'''

# --- ROUTES ---
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        db = load_db()
        user = request.form["username"]
        pwd = request.form["password"]
        # FIXED: Check specific user's password
        if user in db["users"] and db["users"][user]["password"] == pwd:
            session['logged_in'] = True
            session['username'] = user
            return redirect(url_for('dashboard'))
        flash("Invalid credentials")
    return render_template_string(LOGIN_TEMPLATE, company=COMPANY_NAME)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route("/manager-auth", methods=["GET", "POST"])
@login_required
def manager_auth():
    if request.method == "POST":
        pin = request.form["pin"]
        if pin == MANAGER_PIN:
            session['manager_access'] = True
            return redirect(url_for('stock'))
        flash("Invalid Manager PIN")
    return render_template_string(MANAGER_AUTH_TEMPLATE, company=COMPANY_NAME)

@app.route("/manager-logout")
@login_required
def manager_logout():
    session.pop('manager_access', None)
    return redirect(url_for('dashboard'))

@app.route("/")
@login_required
def dashboard():
    db = load_db()
    start = request.args.get('start', date.today().strftime('%Y-%m-%d'))
    end = request.args.get('end', date.today().strftime('%Y-%m-%d'))

    start_date = datetime.strptime(start, '%Y-%m-%d')
    seven_days_ago = (start_date - timedelta(days=7)).strftime('%Y-%m-%d')
    thirty_days_ago = (start_date - timedelta(days=30)).strftime('%Y-%m-%d')

    sales = [s for s in db.get("sales", []) if start <= s.get("date", "") <= end]
    returns = [r for r in db.get("returns", []) if start <= r.get("date", "") <= end]

    total_sales = sum(s["sell_price"] * s["qty"] for s in sales)
    total_cost = sum(s["cost_price"] * s["qty"] for s in sales)
    total_returns = sum(r["sell_price"] * r["qty"] for r in returns)

    gross_profit = total_sales - total_cost - total_returns
    cac_fee = int(gross_profit * CAC_RATE) if gross_profit > 0 else 0
    net_profit = gross_profit - cac_fee

    profit_margin = round((gross_profit / total_sales * 100), 1) if total_sales else 0

    sold_models = []
    for s in sales:
        sold_models.extend([s["model"]] * s["qty"])

    returned_models = []
    for r in returns:
        returned_models.extend([r["model"]] * r["qty"])

    top_models = Counter(sold_models).most_common(5)
    worst_models = Counter(returned_models).most_common(5)

    low_stock_items = [s for s in db.get("stock", []) if s["qty"] <= 10]

    return render_template_string(DASHBOARD_TEMPLATE,
        company=COMPANY_NAME,
        stock=db.get("stock", []), sales=sales, returns=returns,
        low_stock=low_stock_items, total_sales=total_sales,
        total_cost=total_cost, total_returns=total_returns,
        gross_profit=gross_profit, cac_fee=cac_fee, net_profit=net_profit,
        profit_margin=profit_margin,
        top_models=top_models, worst_models=worst_models,
        start=start, end=end,
        seven_days_ago=seven_days_ago,
        thirty_days_ago=thirty_days_ago
    )

@app.route("/stock", methods=["GET", "POST"])
@login_required
@manager_required
def stock():
    db = load_db()
    if request.method == "POST":
        new_item = {
            "model": request.form["model"],
            "category": request.form["category"],
            "qty": int(request.form["qty"]),
            "cost_price": int(request.form["cost_price"]),
            "sell_price": int(request.form["sell_price"]),
            "supplier": request.form.get("supplier", ""),
            "date_added": date.today().strftime('%Y-%m-%d')
        }
        db["stock"].append(new_item)
        save_db(db)
        return redirect(url_for('stock'))

    search = request.args.get('q', '').lower()
    stock_list = db.get("stock", [])
    if search:
        stock_list = [s for s in stock_list if search in s["model"].lower()
                      or search in s["category"].lower()
                      or search in s.get("supplier", "").lower()]

    return render_template_string(STOCK_TEMPLATE, company=COMPANY_NAME, stock=stock_list, search=search)

@app.route("/delete-stock/<int:idx>")
@login_required
@manager_required
def delete_stock(idx):
    db = load_db()
    if 0 <= idx < len(db.get("stock", [])):
        db["stock"].pop(idx)
        save_db(db)
    return redirect(url_for('stock'))

# --- SALES ROUTES ---
@app.route("/sales")
@login_required
def sales():
    db = load_db()
    return render_template_string(SALES_TEMPLATE,
        company=COMPANY_NAME,
        stock=db.get("stock", []),
        sales=db.get("sales", [])[-20:]
    )

@app.route("/add-sale", methods=["POST"])
@login_required
def add_sale():
    db = load_db()
    model = request.form["model"]
    qty = int(request.form["qty"])
    customer = request.form["customer"]

    stock_item = None
    for item in db["stock"]:
        if item["model"] == model:
            stock_item = item
            break

    if not stock_item:
        flash(f"Model {model} not found in stock")
        return redirect(url_for('sales'))

    if stock_item["qty"] < qty:
        flash(f"Not enough stock. Only {stock_item['qty']} available")
        return redirect(url_for('sales'))

    stock_item["qty"] -= qty

    sale = {
        "model": model,
        "qty": qty,
        "cost_price": stock_item["cost_price"],
        "sell_price": stock_item["sell_price"],
        "customer": customer,
        "date": date.today().strftime('%Y-%m-%d'),
        "time": datetime.now().strftime('%H:%M:%S')
    }
    db["sales"].append(sale)
    save_db(db)

    sale_idx = len(db["sales"]) - 1
    return redirect(url_for('receipt', sale_idx=sale_idx))

@app.route("/receipt/<int:sale_idx>")
@login_required
def receipt(sale_idx):
    db = load_db()
    if sale_idx >= len(db["sales"]):
        return "Sale not found", 404
    sale = db["sales"][sale_idx]
    return render_template_string(RECEIPT_TEMPLATE, company=COMPANY_NAME, sale=sale)

# --- RETURNS ROUTES ---
@app.route("/returns")
@login_required
def returns():
    db = load_db()
    return render_template_string(RETURNS_TEMPLATE,
        company=COMPANY_NAME,
        recent_sales=db.get("sales", [])[-50:],
        returns=db.get("returns", [])[-20:]
    )

@app.route("/add-return", methods=["POST"])
@login_required
def add_return():
    db = load_db()
    sale_idx = int(request.form["sale_idx"])
    qty = int(request.form["qty"])
    reason = request.form["reason"]

    if sale_idx >= len(db["sales"]):
        flash("Invalid sale selected")
        return redirect(url_for('returns'))

    sale = db["sales"][sale_idx]

    if qty > sale["qty"]:
        flash(f"Cannot return {qty}. Only {sale['qty']} was sold")
        return redirect(url_for('returns'))

    for item in db["stock"]:
        if item["model"] == sale["model"]:
            item["qty"] += qty
            break
    else:
        db["stock"].append({
            "model": sale["model"],
            "category": "Returned",
            "qty": qty,
            "cost_price": sale["cost_price"],
            "sell_price": sale["sell_price"],
            "supplier": "Return",
            "date_added": date.today().strftime('%Y-%m-%d')
        })

    ret = {
        "model": sale["model"],
        "qty": qty,
        "cost_price": sale["cost_price"],
        "sell_price": sale["sell_price"],
        "customer": sale["customer"],
        "reason": reason,
        "date": date.today().strftime('%Y-%m-%d'),
        "time": datetime.now().strftime('%H:%M:%S')
    }
    db["returns"].append(ret)
    save_db(db)

    flash(f"Return processed: {qty} x {sale['model']}")
    return redirect(url_for('returns'))

# --- EXPORT ROUTES ---
@app.route("/export/<data_type>")
@login_required
def export_csv(data_type):
    db = load_db()

    if data_type == "stock":
        data = db.get("stock", [])
        filename = f"stock_{date.today()}.csv"
    elif data_type == "sales":
        start = request.args.get('start', date.today().strftime('%Y-%m-%d'))
        end = request.args.get('end', date.today().strftime('%Y-%m-%d'))
        data = [s for s in db.get("sales", []) if start <= s.get("date", "") <= end]
        filename = f"sales_{start}_to_{end}.csv"
    elif data_type == "returns":
        start = request.args.get('start', date.today().strftime('%Y-%m-%d'))
        end = request.args.get('end', date.today().strftime('%Y-%m-%d'))
        data = [r for r in db.get("returns", []) if start <= r.get("date", "") <= end]
        filename = f"returns_{start}_to_{end}.csv"
    else:
        return "Invalid export type", 400

    if not data:
        return "No data to export", 404

    si = StringIO()
    writer = csv.DictWriter(si, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)

    output = si.getvalue()
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"}
    )

@app.route("/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    if request.method == "POST":
        db = load_db()
        new_pass = request.form["password"]
        db["users"][session['username']]["password"] = new_pass
        save_db(db)
        flash("Password changed successfully!")
    return render_template_string(PASSWORD_TEMPLATE, company=COMPANY_NAME)

if __name__ == "__main__":
    print(f"{COMPANY_NAME} - Starting... Auto backup enabled.")
    app.run(host='0.0.0.0', port=5000, debug=False)
