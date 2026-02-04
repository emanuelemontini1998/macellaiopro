// ==========================================
// MACELLAIO PRO - APP COMPLETA
// ==========================================

import { DB } from './db.js';
import { State, CATEGORIES } from './state.js';
import { formatMoney, futureDate, showToast, updateDate } from './utils.js';

// Initialize App
(async function init() {
    await DB.init();
    
    // Load data
    State.products = await DB.getAll('products');
    if (State.products.length === 0) {
        State.products = [
            { id: Date.now(), name: "Bistecca di Manzo", category: "beef", price: 28.50, cost: 18.00, stock: 12.5, unit: "kg", expiry: futureDate(7), sales: 45 },
            { id: Date.now()+1, name: "Macinato di Manzo", category: "beef", price: 12.90, cost: 8.50, stock: 8.2, unit: "kg", expiry: futureDate(5), sales: 128 },
            { id: Date.now()+2, name: "Costolette di Maiale", category: "pork", price: 14.50, cost: 9.00, stock: 6.0, unit: "kg", expiry: futureDate(6), sales: 67 },
            { id: Date.now()+3, name: "Petto di Pollo", category: "poultry", price: 11.90, cost: 7.20, stock: 15.3, unit: "kg", expiry: futureDate(4), sales: 95 },
            { id: Date.now()+4, name: "Salsiccia Fresca", category: "processed", price: 8.90, cost: 4.50, stock: 45, unit: "pz", expiry: futureDate(12), sales: 89 }
        ];
        for (const p of State.products) await DB.put('products', p);
    }
    
    State.sales = await DB.getAll('sales');
    State.waste = await DB.getAll('waste');
    
    initDashboard();
    renderPOS();
    renderInventory();
    renderProducts();
    renderWaste();
    updateDate();
})();

// Make functions global for onclick
window.navigateTo = navigateTo;
window.showCart = showCart;
window.hideCart = hideCart;
window.toggleCart = toggleCart;
window.filterPOS = filterPOS;
window.openQtyModal = openQtyModal;
window.closeQtyModal = closeQtyModal;
window.appendQty = appendQty;
window.clearQty = clearQty;
window.confirmQty = confirmQty;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.checkout = checkout;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.deleteProduct = deleteProduct;
window.openQuickAdd = openQuickAdd;
window.filterSales = filterSales;
window.exportToCSV = exportToCSV;
window.showMargins = showMargins;
window.closeMarginsModal = closeMarginsModal;
window.searchProducts = searchProducts;
window.editSale = editSale;
window.deleteSale = deleteSale;
window.saveEditSale = saveEditSale;

// Navigation
function navigateTo(page) {
    document.querySelectorAll('section.page').forEach(s => s.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.remove('text-red-600');
        n.classList.add('text-slate-400');
        if (n.dataset.page === page) {
            n.classList.add('text-red-600');
            n.classList.remove('text-slate-400');
        }
    });
    
    if (page === 'pos') {
        renderCart();
    } else {
        hideCart();
    }
    
    if (page === 'dashboard') {
        updateStats();
        renderCharts();
    }
    if (page === 'sales-detail') {
        renderSalesDetail('today');
    }
    if (page === 'orders-detail') {
        renderOrdersDetail();
    }
    
    window.scrollTo(0, 0);
}

function showCart() {
    const items = document.getElementById('cartItemsContainer');
    const footer = document.getElementById('cartFooter');
    const chevron = document.getElementById('cartChevron');
    
    items?.classList.remove('hidden');
    footer?.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    State.cartExpanded = true;
}

function hideCart() {
    const items = document.getElementById('cartItemsContainer');
    const footer = document.getElementById('cartFooter');
    const chevron = document.getElementById('cartChevron');
    
    items?.classList.add('hidden');
    footer?.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    State.cartExpanded = false;
}

function toggleCart() {
    State.cartExpanded ? hideCart() : showCart();
}

// Dashboard
function initDashboard() {
    updateStats();
    renderCharts();
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = State.sales.filter(s => s.date === today);
    const total = todaySales.reduce((sum, s) => sum + s.total, 0);
    
    document.getElementById('todaySales').textContent = formatMoney(total);
    document.getElementById('todayOrders').textContent = todaySales.length;
    
    const todayWaste = State.waste.filter(w => w.date === today).reduce((sum, w) => sum + w.value, 0);
    document.getElementById('todayWaste').textContent = formatMoney(todayWaste);
    
    const lowStock = State.products.filter(p => parseFloat(p.stock) <= 2).length;
    document.getElementById('lowStockCount').textContent = lowStock;
}

function renderCharts() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;
    
    const days = [], data = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        days.push(d.toLocaleDateString('it-IT', { weekday: 'short' }));
        const dateStr = d.toISOString().split('T')[0];
        data.push(State.sales.filter(s => s.date === dateStr).reduce((sum, s) => sum + s.total, 0));
    }
    
    if (window.salesChartInstance) {
        window.salesChartInstance.destroy();
    }
    
    window.salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: days, 
            datasets: [{ 
                data, 
                backgroundColor: '#dc2626',
                borderRadius: 6,
                barThickness: 20
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: '#f1f5f9' }, beginAtZero: true }
            }
        }
    });
}

// Sales Detail with Edit/Delete
function renderSalesDetail(period) {
    let filteredSales = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (period === 'today') {
        filteredSales = State.sales.filter(s => s.date === todayStr);
    } else if (period === 'week') {
        const weekAgo = new Date(today - 7 * 86400000).toISOString().split('T')[0];
        filteredSales = State.sales.filter(s => s.date >= weekAgo);
    } else if (period === 'month') {
        const monthAgo = new Date(today - 30 * 86400000).toISOString().split('T')[0];
        filteredSales = State.sales.filter(s => s.date >= monthAgo);
    }
    
    const total = filteredSales.reduce((sum, s) => sum + s.total, 0);
    document.getElementById('salesDetailTotal').textContent = formatMoney(total);
    
    const list = document.getElementById('salesList');
    if (filteredSales.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 py-8">Nessuna vendita</p>';
        return;
    }
    
    list.innerHTML = filteredSales.sort((a,b) => b.id - a.id).map(s => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl" data-sale-id="${s.id}">
            <div class="flex-1 min-w-0 mr-2">
                <div class="font-medium text-slate-900">${s.productName}</div>
                <div class="text-xs text-slate-500">${s.date} ${s.time?.substring(0,5) || ''}</div>
            </div>
            <div class="text-right mr-3">
                <div class="font-bold text-green-600">${formatMoney(s.total)}</div>
                <div class="text-xs text-slate-500">${s.quantity}${s.unit}</div>
            </div>
            <div class="flex gap-1">
                <button onclick="editSale(${s.id})" class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center touch-feedback">
                    <i class="fas fa-pen text-xs"></i>
                </button>
                <button onclick="deleteSale(${s.id})" class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center touch-feedback">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function filterSales(period) {
    document.querySelectorAll('.filter-sales').forEach(b => {
        b.classList.remove('active', 'bg-red-600', 'text-white');
        b.classList.add('bg-slate-100');
    });
    event.target.classList.add('active', 'bg-red-600', 'text-white');
    event.target.classList.remove('bg-slate-100');
    renderSalesDetail(period);
}

function editSale(saleId) {
    const sale = State.sales.find(s => s.id === saleId);
    if (!sale) return;
    
    const product = State.products.find(p => p.id === sale.productId);
    
    document.getElementById('editSaleId').value = sale.id;
    document.getElementById('editSaleProduct').textContent = sale.productName;
    document.getElementById('editSaleDate').value = sale.date;
    document.getElementById('editSaleTime').value = sale.time?.substring(0,5) || '';
    document.getElementById('editSaleQty').value = sale.quantity;
    document.getElementById('editSalePrice').value = sale.price;
    
    document.getElementById('editSaleModal').classList.remove('hidden');
}

function closeEditSaleModal() {
    document.getElementById('editSaleModal').classList.add('hidden');
}

async function saveEditSale() {
    const saleId = parseFloat(document.getElementById('editSaleId').value);
    const sale = State.sales.find(s => s.id === saleId);
    if (!sale) return;
    
    const product = State.products.find(p => p.id === sale.productId);
    const oldQty = sale.quantity;
    const newQty = parseFloat(document.getElementById('editSaleQty').value);
    const newPrice = parseFloat(document.getElementById('editSalePrice').value);
    const newDate = document.getElementById('editSaleDate').value;
    const newTime = document.getElementById('editSaleTime').value + ':00';
    
    // Aggiorna stock
    const qtyDiff = oldQty - newQty;
    product.stock = parseFloat(product.stock) + qtyDiff;
    product.sales = (product.sales || 0) - oldQty + newQty;
    
    // Aggiorna vendita
    sale.date = newDate;
    sale.time = newTime;
    sale.quantity = newQty;
    sale.price = newPrice;
    sale.total = newQty * newPrice;
    
    await DB.put('sales', sale);
    await DB.put('products', product);
    
    closeEditSaleModal();
    renderSalesDetail('today');
    updateStats();
    renderCharts();
    showToast('Vendita modificata!');
}

async function deleteSale(saleId) {
    if (!confirm('Eliminare questa vendita? Lo stock verrà ripristinato.')) return;
    
    const saleIndex = State.sales.findIndex(s => s.id === saleId);
    if (saleIndex === -1) return;
    
    const sale = State.sales[saleIndex];
    const product = State.products.find(p => p.id === sale.productId);
    
    // Ripristina stock
    product.stock = parseFloat(product.stock) + sale.quantity;
    product.sales = (product.sales || 0) - sale.quantity;
    
    await DB.put('products', product);
    await DB.delete('sales', saleId);
    
    State.sales.splice(saleIndex, 1);
    
    renderSalesDetail('today');
    updateStats();
    renderPOS();
    renderInventory();
    renderCharts();
    showToast('Vendita eliminata');
}

// Orders Detail
function renderOrdersDetail() {
    const list = document.getElementById('ordersList');
    if (State.sales.length === 0) {
        list.innerHTML = '<p class="text-center text-slate-400 py-8">Nessun ordine</p>';
        return;
    }
    
    const grouped = State.sales.reduce((acc, s) => {
        if (!acc[s.date]) acc[s.date] = [];
        acc[s.date].push(s);
        return acc;
    }, {});
    
    list.innerHTML = Object.entries(grouped).sort((a,b) => b[0].localeCompare(a[0])).map(([date, sales]) => {
        const dayTotal = sales.reduce((sum, s) => sum + s.total, 0);
        return `
            <div class="mb-4">
                <div class="flex justify-between items-center mb-2 px-2">
                    <span class="font-bold text-slate-700">${new Date(date).toLocaleDateString('it-IT')}</span>
                    <span class="text-green-600 font-bold">${formatMoney(dayTotal)}</span>
                </div>
                <div class="space-y-2">
                    ${sales.sort((a,b) => b.id - a.id).map(s => `
                        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                            <div class="flex-1 min-w-0 mr-2">
                                <div class="font-medium text-slate-900 text-sm">${s.productName}</div>
                                <div class="text-xs text-slate-500">${s.time?.substring(0,5) || ''}</div>
                            </div>
                            <div class="text-right mr-2">
                                <div class="font-bold">${formatMoney(s.total)}</div>
                                <div class="text-xs text-slate-500">${s.quantity}${s.unit} × €${s.price.toFixed(2)}</div>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="editSale(${s.id})" class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center touch-feedback">
                                    <i class="fas fa-pen text-xs"></i>
                                </button>
                                <button onclick="deleteSale(${s.id})" class="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center touch-feedback">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Export CSV
function exportToCSV() {
    const headers = ['Data', 'Ora', 'Prodotto', 'Quantita', 'Unita', 'Prezzo Unitario', 'Totale'];
    const rows = State.sales.map(s => [
        s.date,
        s.time?.substring(0,8) || '',
        `"${s.productName}"`,
        s.quantity,
        s.unit,
        s.price.toFixed(2).replace('.', ','),
        s.total.toFixed(2).replace('.', ',')
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendite_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV esportato!');
}

// Show Margins
function showMargins() {
    const modal = document.getElementById('marginsModal');
    const content = document.getElementById('marginsContent');
    
    const totalRevenue = State.sales.reduce((sum, s) => sum + s.total, 0);
    const totalCost = State.sales.reduce((sum, s) => {
        const p = State.products.find(prod => prod.id === s.productId);
        return sum + (p ? p.cost * s.quantity : 0);
    }, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : 0;
    
    const productMargins = State.products.map(p => {
        const sold = State.sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
        const revenue = sold * p.price;
        const cost = sold * p.cost;
        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue * 100).toFixed(1) : 0;
        return { name: p.name, sold, revenue, profit, margin };
    }).filter(p => p.sold > 0).sort((a,b) => b.profit - a.profit);
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-green-50 p-3 rounded-xl text-center">
                    <div class="text-xs text-green-700">Profitto Totale</div>
                    <div class="text-xl font-bold text-green-600">${formatMoney(totalProfit)}</div>
                </div>
                <div class="bg-blue-50 p-3 rounded-xl text-center">
                    <div class="text-xs text-blue-700">Margine Medio</div>
                    <div class="text-xl font-bold text-blue-600">${avgMargin}%</div>
                </div>
            </div>
            <div>
                <h4 class="font-bold mb-2 text-sm">Per Prodotto</h4>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                    ${productMargins.map(p => `
                        <div class="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                            <div class="flex-1 min-w-0 mr-2">
                                <div class="font-medium text-sm truncate">${p.name}</div>
                                <div class="text-xs text-slate-500">${p.sold} venduti</div>
                            </div>
                            <div class="text-right">
                                <div class="font-bold text-sm">${formatMoney(p.profit)}</div>
                                <div class="text-xs ${p.margin > 30 ? 'text-green-600' : p.margin > 20 ? 'text-amber-600' : 'text-red-600'}">${p.margin}%</div>
                            </div>
                        </div>
                    `).join('') || '<p class="text-center text-slate-400 py-4">Nessuna vendita</p>'}
                </div>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeMarginsModal() {
    document.getElementById('marginsModal').classList.add('hidden');
}

// Search Products
function searchProducts(query) {
    const results = document.getElementById('searchResults');
    if (!query) {
        results.innerHTML = '';
        return;
    }
    
    const filtered = State.products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    
    results.innerHTML = filtered.map(p => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl touch-feedback" onclick="navigateTo('pos')">
            <div>
                <div class="font-medium text-slate-900 text-sm">${p.name}</div>
                <div class="text-xs text-slate-500">${CATEGORIES[p.category]} | Stock: ${parseFloat(p.stock).toFixed(1)}${p.unit}</div>
            </div>
            <div class="text-right">
                <div class="font-bold text-red-600">€${p.price.toFixed(2)}</div>
            </div>
        </div>
    `).join('');
}

// POS
function renderPOS() {
    const grid = document.getElementById('posGrid');
    let products = State.products.filter(p => parseFloat(p.stock) > 0);
    if (State.filter !== 'all') products = products.filter(p => p.category === State.filter);
    
    grid.innerHTML = products.map(p => `
        <div onclick="openQtyModal(${p.id})" class="touch-feedback bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-95 transition-transform">
            <div class="flex justify-between items-start mb-2">
                <span class="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-full text-slate-600">${CATEGORIES[p.category]}</span>
                <span class="text-xs text-slate-400">${parseFloat(p.stock).toFixed(1)} ${p.unit}</span>
            </div>
            <h4 class="font-bold text-slate-900 mb-1 text-sm line-clamp-2">${p.name}</h4>
            <p class="text-red-600 font-bold text-lg">€${p.price.toFixed(2)}<span class="text-xs text-slate-400">/${p.unit}</span></p>
        </div>
    `).join('');
}

function filterPOS(cat) {
    State.filter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active', 'bg-red-600', 'text-white');
        b.classList.add('bg-slate-100');
    });
    event.target.classList.add('active', 'bg-red-600', 'text-white');
    event.target.classList.remove('bg-slate-100');
    renderPOS();
}

// Quantity Modal
function openQtyModal(id) {
    const p = State.products.find(x => x.id === id);
    State.tempQty = { id, val: '1', name: p.name, unit: p.unit };
    document.getElementById('qtyProductName').textContent = p.name;
    document.getElementById('qtyDisplay').textContent = '1.0';
    document.getElementById('qtyUnit').textContent = p.unit;
    document.getElementById('qtyModal').classList.remove('hidden');
}

function closeQtyModal() {
    document.getElementById('qtyModal').classList.add('hidden');
}

function appendQty(num) {
    if (State.tempQty.val === '0' && num !== '.') State.tempQty.val = num;
    else if (num === '.' && State.tempQty.val.includes('.')) return;
    else State.tempQty.val += num;
    document.getElementById('qtyDisplay').textContent = State.tempQty.val;
}

function clearQty() {
    State.tempQty.val = State.tempQty.val.slice(0, -1) || '0';
    document.getElementById('qtyDisplay').textContent = State.tempQty.val;
}

function confirmQty() {
    const qty = parseFloat(State.tempQty.val) || 1;
    const p = State.products.find(x => x.id === State.tempQty.id);
    
    if (qty > parseFloat(p.stock)) {
        showToast('Stock insufficiente!', 'error');
        closeQtyModal();
        return;
    }
    
    const existing = State.cart.find(i => i.id === State.tempQty.id);
    if (existing) {
        existing.qty = parseFloat(existing.qty) + qty;
    } else {
        State.cart.push({ 
            id: State.tempQty.id, 
            name: p.name, 
            price: p.price, 
            unit: p.unit, 
            qty: qty, 
            max: parseFloat(p.stock)
        });
    }
    
    if (navigator.vibrate) navigator.vibrate(30);
    closeQtyModal();
    renderCart();
    showCart();
    showToast('Aggiunto al carrello');
}

// Cart
function renderCart() {
    const container = document.getElementById('cartItems');
    
    if (State.cart.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-400 py-8"><i class="fas fa-shopping-basket text-4xl mb-3 opacity-50"></i><p>Il carrello è vuoto</p></div>';
        hideCart();
    } else {
        container.innerHTML = State.cart.map((i, idx) => `
            <div class="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                <div class="flex-1 min-w-0 mr-2">
                    <div class="font-medium text-slate-900 text-sm truncate">${i.name}</div>
                    <div class="text-xs text-slate-500">€${i.price.toFixed(2)} × ${i.qty}${i.unit}</div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button onclick="updateCartQty(${idx}, -1)" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center touch-feedback">
                        <i class="fas fa-minus text-xs"></i>
                    </button>
                    <span class="w-8 text-center font-semibold text-sm">${i.qty}</span>
                    <button onclick="updateCartQty(${idx}, 1)" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center touch-feedback">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                    <button onclick="removeFromCart(${idx})" class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center touch-feedback ml-1">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    const total = State.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    document.getElementById('cartTotal').textContent = formatMoney(total);
    document.getElementById('cartCount').textContent = State.cart.length;
    document.getElementById('checkoutBtn').disabled = State.cart.length === 0;
}

function updateCartQty(idx, delta) {
    const item = State.cart[idx];
    const newQty = parseFloat(item.qty) + delta;
    if (newQty <= 0) removeFromCart(idx);
    else if (newQty <= item.max) { 
        item.qty = newQty; 
        renderCart(); 
    }
}

function removeFromCart(idx) {
    State.cart.splice(idx, 1);
    renderCart();
    if (navigator.vibrate) navigator.vibrate(50);
}

function clearCart() {
    if (State.cart.length === 0) return;
    if (confirm('Svuotare il carrello?')) {
        State.cart = [];
        renderCart();
    }
}

async function checkout() {
    if (State.cart.length === 0) return;
    
    if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    for (const item of State.cart) {
        const sale = {
            id: Date.now() + Math.random(),
            productId: item.id,
            productName: item.name,
            quantity: item.qty,
            unit: item.unit,
            price: item.price,
            total: item.price * item.qty,
            date: dateStr,
            time: timeStr
        };
        await DB.put('sales', sale);
        State.sales.push(sale);
        
        const p = State.products.find(x => x.id === item.id);
        if (p) {
            p.stock = parseFloat(p.stock) - parseFloat(item.qty);
            p.sales = (p.sales || 0) + parseFloat(item.qty);
            await DB.put('products', p);
        }
    }
    
    State.cart = [];
    renderCart();
    renderPOS();
    renderInventory();
    renderProducts();
    updateStats();
    showToast('Vendita completata! 🎉');
    hideCart();
}

// Inventory
function renderInventory() {
    const today = new Date();
    let critical = 0, expiring = 0, ok = 0;
    
    document.getElementById('inventoryList').innerHTML = State.products.map(p => {
        const days = Math.ceil((new Date(p.expiry) - today) / 86400000);
        const stock = parseFloat(p.stock);
        let statusColor, statusText, cls;
        
        if (stock <= 2) {
            statusColor = 'red';
            statusText = 'CRITICO';
            cls = 'border-l-4 border-red-500 bg-red-50';
            critical++;
        } else if (days <= 2) {
            statusColor = 'amber';
            statusText = 'SCADENZA';
            cls = 'border-l-4 border-amber-500 bg-amber-50';
            expiring++;
        } else {
            statusColor = 'green';
            statusText = 'OK';
            cls = 'border-l-4 border-green-500';
            ok++;
        }
        
        return `
            <div class="p-4 ${cls} flex justify-between items-center touch-feedback">
                <div class="flex-1 min-w-0 mr-2">
                    <div class="font-medium text-slate-900 truncate">${p.name}</div>
                    <div class="text-xs text-slate-500 mt-1">Scade: ${p.expiry}</div>
                </div>
                <div class="text-right flex-shrink-0">
                    <div class="font-bold ${stock <= 2 ? 'text-red-600' : 'text-slate-900'}">${stock.toFixed(1)} ${p.unit}</div>
                    <div class="text-xs text-${statusColor}-600 font-semibold">${statusText}</div>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('criticalStock').textContent = critical;
    document.getElementById('expiringSoon').textContent = expiring;
    document.getElementById('healthyStock').textContent = ok;
}

// Products with Edit
function renderProducts() {
    document.getElementById('productsList').innerHTML = State.products.map(p => {
        const margin = ((p.price - p.cost) / p.price * 100).toFixed(1);
        return `
            <div class="bg-white rounded-2xl p-4 shadow-sm border touch-feedback flex justify-between items-center">
                <div class="flex-1 min-w-0 mr-2">
                    <span class="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-full text-slate-600 mb-1 inline-block">${CATEGORIES[p.category]}</span>
                    <h3 class="font-bold text-slate-900 truncate">${p.name}</h3>
                    <p class="text-sm text-slate-500">Stock: ${parseFloat(p.stock).toFixed(1)} ${p.unit}</p>
                </div>
                <div class="text-right flex-shrink-0">
                    <p class="font-bold text-lg">€${p.price.toFixed(2)}</p>
                    <p class="text-xs ${margin > 30 ? 'text-green-600' : margin > 20 ? 'text-amber-600' : 'text-red-600'}">${margin}% margine</p>
                    <div class="flex gap-1 mt-2 justify-end">
                        <button onclick="event.stopPropagation(); openEditProductModal(${p.id})" class="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center touch-feedback">
                            <i class="fas fa-pen text-xs"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deleteProduct(${p.id})" class="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center touch-feedback">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openQuickAdd() {
    navigateTo('products');
    setTimeout(openProductModal, 300);
}

// New Product Modal
function openProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('prodExpiry').valueAsDate = new Date(Date.now() + 7 * 86400000);
    document.getElementById('productModal').classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('productModal').classList.add('hidden');
}

// Edit Product Modal
function openEditProductModal(productId) {
    const p = State.products.find(prod => prod.id === productId);
    if (!p) return;
    
    document.getElementById('editProdId').value = p.id;
    document.getElementById('editProdName').value = p.name;
    document.getElementById('editProdCategory').value = p.category;
    document.getElementById('editProdPrice').value = p.price;
    document.getElementById('editProdCost').value = p.cost;
    document.getElementById('editProdStock').value = p.stock;
    document.getElementById('editProdUnit').value = p.unit || 'kg';
    document.getElementById('editProdExpiry').value = p.expiry;
    
    document.getElementById('editProductModal').classList.remove('hidden');
}

function closeEditProductModal() {
    document.getElementById('editProductModal').classList.add('hidden');
}

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = {
        id: Date.now(),
        name: document.getElementById('prodName').value,
        category: document.getElementById('prodCategory').value,
        price: parseFloat(document.getElementById('prodPrice').value),
        cost: parseFloat(document.getElementById('prodCost').value),
        stock: parseFloat(document.getElementById('prodStock').value),
        unit: document.getElementById('prodUnit').value,
        expiry: document.getElementById('prodExpiry').value,
        sales: 0
    };
    await DB.put('products', p);
    State.products.push(p);
    closeProductModal();
    renderProducts();
    renderInventory();
    renderPOS();
    showToast('Prodotto aggiunto!');
});

document.getElementById('editProductForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = parseFloat(document.getElementById('editProdId').value);
    const p = State.products.find(prod => prod.id === id);
    if (!p) return;
    
    p.name = document.getElementById('editProdName').value;
    p.category = document.getElementById('editProdCategory').value;
    p.price = parseFloat(document.getElementById('editProdPrice').value);
    p.cost = parseFloat(document.getElementById('editProdCost').value);
    p.stock = parseFloat(document.getElementById('editProdStock').value);
    p.unit = document.getElementById('editProdUnit').value;
    p.expiry = document.getElementById('editProdExpiry').value;
    
    await DB.put('products', p);
    closeEditProductModal();
    renderProducts();
    renderInventory();
    renderPOS();
    showToast('Prodotto modificato!');
});

async function deleteProduct(id) {
    if (!confirm('Eliminare questo prodotto?')) return;
    State.products = State.products.filter(p => p.id !== id);
    await DB.delete('products', id);
    renderProducts();
    renderInventory();
    renderPOS();
    showToast('Prodotto eliminato');
}

// Waste
function renderWaste() {
    const list = document.getElementById('wasteList');
    if (!list) return;
    list.innerHTML = [...State.waste].reverse().slice(0, 20).map(w => {
        const p = State.products.find(x => x.id === w.productId);
        return `
            <div class="p-4 flex justify-between items-center touch-feedback border-b border-slate-50 last:border-0">
                <div>
                    <div class="font-medium text-slate-900">${p?.name || 'Sconosciuto'}</div>
                    <div class="text-xs text-slate-500">${w.date}</div>
                </div>
                <div class="text-red-600 font-bold">€${w.value.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

// Prevent double tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
