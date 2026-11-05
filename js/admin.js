// Complete Admin Panel & POS Engine for Ayush Service Center
import { 
  auth, 
  db, 
  signOut, 
  onAuthStateChanged,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment
} from "./firebase-config.js";

import { 
  seedInitialDatabase, 
  getCachedSettings, 
  saveStoreSettings, 
  showToast 
} from "./store.js";

import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from "./data-seed.js";

// Global Admin State
let currentUser = null;
let allProducts = [];
let allCategories = [];
let allOrders = [];
let allBookings = [];
let allSales = [];
let allExpenses = [];
let allMovements = [];
let allCustomers = [];
let allOffers = [];
let allBanners = [];
let posCart = [];
let selectedPayMode = "Cash";
let salesChart = null;

// ==========================================
// AUTHENTICATION & ACCESS CONTROL
// ==========================================
const AUTHORIZED_ADMIN_EMAILS = [
  "vinodkumargupta290@gmail.com",
  "ayush44129@gmail.com",
  "guptaayush932589@gmail.com",
  "ayushgupta2005@gmail.com",
  "admin@ayushservicecenter.com"
];

// Strict requirement: User MUST have authenticated with ID/Password in login.html
let verifiedSession = null;
try {
  const rawSession = sessionStorage.getItem("asc_admin_session");
  if (rawSession) {
    const s = JSON.parse(rawSession);
    if (s && s.email && AUTHORIZED_ADMIN_EMAILS.includes(s.email.toLowerCase())) {
      verifiedSession = s;
    }
  }
} catch(e) {}

if (!verifiedSession) {
  // No active validated login session! Redirect to login immediately.
  window.location.href = "login.html";
}

onAuthStateChanged(auth, async (user) => {
  if (!verifiedSession) {
    window.location.href = "login.html";
    return;
  }

  let activeUser = {
    email: verifiedSession.email,
    displayName: verifiedSession.name || (verifiedSession.email.includes("ayush") ? "Ayush Gupta" : "Vinod Kumar Gupta"),
    uid: (user && user.uid) || verifiedSession.uid || "owner_session"
  };

  currentUser = activeUser;
  const userEmail = activeUser.email || "admin@ayushservicecenter.com";
  const userInitials = (userEmail[0] || "A").toUpperCase();

  const avatarEl = document.getElementById("sidebar-user-avatar");
  const emailEl = document.getElementById("sidebar-user-email");
  const nameEl = document.getElementById("sidebar-user-name");

  if (avatarEl) avatarEl.textContent = userInitials;
  if (emailEl) emailEl.textContent = userEmail;
  if (nameEl) nameEl.textContent = activeUser.displayName;

  // Load all operational data
  await loadAllAdminData();
  logAuditAction("LOGIN", `Admin ${userEmail} accessed dashboard`);
});

// Logout handler
document.getElementById("admin-logout-btn").addEventListener("click", async () => {
  if (confirm("Are you sure you want to log out of the admin panel?")) {
    logAuditAction("LOGOUT", `Admin logged out`);
    sessionStorage.removeItem("asc_admin_session");
    try {
      await signOut(auth);
    } catch(e) {}
    window.location.href = "login.html";
  }
});

// ==========================================
// TAB & DRAWER NAVIGATION
// ==========================================
const navItems = document.querySelectorAll(".admin-nav-item");
const tabPanes = document.querySelectorAll(".admin-tab-pane");
const pageTitle = document.getElementById("topbar-page-title");
const sidebar = document.getElementById("admin-sidebar");
const sidebarOpenBtn = document.getElementById("sidebar-open-btn");
const sidebarCloseBtn = document.getElementById("sidebar-close-btn");
const sidebarBackdrop = document.getElementById("admin-sidebar-backdrop");

function openSidebar() {
  if (sidebar) sidebar.classList.add("open");
  if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove("open");
  if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
  document.body.style.overflow = "";
}

navItems.forEach(item => {
  item.addEventListener("click", () => {
    const targetTabId = item.dataset.tab;
    navItems.forEach(i => i.classList.remove("active"));
    tabPanes.forEach(p => p.classList.remove("active"));

    item.classList.add("active");
    const activePane = document.getElementById(targetTabId);
    if (activePane) activePane.classList.add("active");

    const titleText = item.querySelector(".nav-left").textContent.replace(/[^\w\s/]/gi, '').trim();
    if (pageTitle) pageTitle.textContent = titleText;

    // Auto-close sidebar on mobile
    if (window.innerWidth < 1024) {
      closeSidebar();
    }
  });
});

if (sidebarOpenBtn) {
  sidebarOpenBtn.addEventListener("click", openSidebar);
}
if (sidebarCloseBtn) {
  sidebarCloseBtn.addEventListener("click", closeSidebar);
}
if (sidebarBackdrop) {
  sidebarBackdrop.addEventListener("click", closeSidebar);
}

// Quick action buttons in topbar/overview
document.getElementById("topbar-quick-pos-btn").addEventListener("click", () => switchTab("tab-pos"));
document.getElementById("btn-quick-new-sale").addEventListener("click", () => switchTab("tab-pos"));
document.getElementById("btn-quick-add-prod").addEventListener("click", () => openProductModal());
document.getElementById("btn-quick-stock-in").addEventListener("click", () => openStockAdjustModal());
document.getElementById("btn-quick-seed-db").addEventListener("click", async () => {
  if (confirm("Initialize Firebase with authentic store catalog (Categories, Products, Banners, Offers, Settings)? This will populate any missing data.")) {
    await seedInitialDatabase();
    await loadAllAdminData();
  }
});
document.getElementById("view-all-inventory-btn").addEventListener("click", () => switchTab("tab-inventory"));

function switchTab(tabId) {
  const targetItem = document.querySelector(`.admin-nav-item[data-tab="${tabId}"]`);
  if (targetItem) targetItem.click();
}

// ==========================================
// LOAD ALL DATA & HYDRATE
// ==========================================
async function loadAllAdminData() {
  try {
    // 1. Products
    const prodSnap = await getDocs(collection(db, "products"));
    allProducts = [];
    prodSnap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
    if (allProducts.length === 0) {
      allProducts = [...INITIAL_PRODUCTS];
    }

    // 2. Categories
    const catSnap = await getDocs(collection(db, "categories"));
    allCategories = [];
    catSnap.forEach(d => allCategories.push({ id: d.id, ...d.data() }));
    if (allCategories.length === 0) {
      allCategories = [...INITIAL_CATEGORIES];
    }

    // 3. Orders
    const ordSnap = await getDocs(collection(db, "orders"));
    allOrders = [];
    ordSnap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
    allOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 4. Sales
    const salesSnap = await getDocs(collection(db, "sales"));
    allSales = [];
    salesSnap.forEach(d => allSales.push({ id: d.id, ...d.data() }));
    allSales.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 5. Auto Bookings
    const abSnap = await getDocs(collection(db, "auto_bookings"));
    allBookings = [];
    abSnap.forEach(d => allBookings.push({ id: d.id, ...d.data() }));
    allBookings.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 6. Expenses
    const expSnap = await getDocs(collection(db, "expenses"));
    allExpenses = [];
    expSnap.forEach(d => allExpenses.push({ id: d.id, ...d.data() }));

    // 7. Inventory Movements
    const mvSnap = await getDocs(collection(db, "inventory_movements"));
    allMovements = [];
    mvSnap.forEach(d => allMovements.push({ id: d.id, ...d.data() }));
    allMovements.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // 8. Customers
    const custSnap = await getDocs(collection(db, "customers"));
    allCustomers = [];
    custSnap.forEach(d => allCustomers.push({ id: d.id, ...d.data() }));

    // Render components
    renderKPIs();
    renderSalesChart();
    renderPOSCatalog();
    renderProductsTable();
    renderCategoriesTable();
    renderOrdersTable();
    renderBookingsTable();
    renderInventoryTable();
    renderSalesTable();
    renderExpensesTable();
    renderCustomersTable();
    renderMediaLibrary();
    loadAuditLogs();
  } catch (error) {
    console.error("Error loading admin data:", error);
  }
}

// ==========================================
// 10 KPI CALCULATIONS
// ==========================================
function renderKPIs() {
  const totalProducts = allProducts.length;
  const totalStock = allProducts.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const lowStockItems = allProducts.filter(p => Number(p.stock) > 0 && Number(p.stock) <= (p.minStock || 5));
  const outOfStockItems = allProducts.filter(p => Number(p.stock) <= 0 || p.stock === "Out of Stock");

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todaySalesTotal = allSales
    .filter(s => (s.createdAt || 0) >= todayStart)
    .reduce((acc, s) => acc + Number(s.grandTotal || 0), 0);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const monthSalesTotal = allSales
    .filter(s => (s.createdAt || 0) >= monthStart)
    .reduce((acc, s) => acc + Number(s.grandTotal || 0), 0);

  const totalOrders = allOrders.length;
  const pendingOrders = allOrders.filter(o => o.status === "Pending").length;

  const inventoryValue = allProducts.reduce((acc, p) => {
    const cost = Number(p.purchasePrice) || (Number(p.price) * 0.75);
    return acc + (cost * (Number(p.stock) || 0));
  }, 0);

  const grossProfit = allSales.reduce((acc, s) => {
    const costEst = (s.items || []).reduce((itemAcc, item) => itemAcc + (item.costPrice || item.price * 0.75) * item.quantity, 0);
    return acc + Math.max(0, Number(s.grandTotal || 0) - costEst);
  }, 0);

  document.getElementById("kpi-total-products").textContent = totalProducts;
  document.getElementById("kpi-total-stock").textContent = totalStock;
  document.getElementById("kpi-low-stock").textContent = lowStockItems.length;
  document.getElementById("kpi-out-stock").textContent = outOfStockItems.length;
  document.getElementById("kpi-today-sales").textContent = `₹${todaySalesTotal.toLocaleString()}`;
  document.getElementById("kpi-month-sales").textContent = `₹${monthSalesTotal.toLocaleString()}`;
  document.getElementById("kpi-total-orders").textContent = totalOrders;
  document.getElementById("kpi-pending-orders").textContent = pendingOrders;
  document.getElementById("kpi-inventory-val").textContent = `₹${Math.round(inventoryValue).toLocaleString()}`;
  document.getElementById("kpi-gross-profit").textContent = `₹${Math.round(grossProfit).toLocaleString()}`;

  // Update sidebar badges
  const pendingOrdersBadge = document.getElementById("sidebar-pending-orders-badge");
  if (pendingOrdersBadge) pendingOrdersBadge.textContent = pendingOrders;

  const pendingBookings = allBookings.filter(b => b.status === "Pending").length;
  const bookingsBadge = document.getElementById("sidebar-bookings-badge");
  if (bookingsBadge) bookingsBadge.textContent = pendingBookings;

  // Render overview low-stock warnings table
  const lowStockTbody = document.getElementById("overview-low-stock-tbody");
  if (lowStockTbody) {
    if (lowStockItems.length === 0 && outOfStockItems.length === 0) {
      lowStockTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #16A34A;">✓ All products are adequately stocked.</td></tr>`;
    } else {
      const displayAlerts = [...outOfStockItems, ...lowStockItems].slice(0, 6);
      lowStockTbody.innerHTML = displayAlerts.map(p => `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td><span class="badge ${p.stock <= 0 ? 'badge-danger' : 'badge-warning'}">${p.stock} ${p.unit || 'pcs'}</span></td>
          <td>${p.minStock || 5}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="window.quickRestock('${p.id}', '${p.name}')">Restock</button>
          </td>
        </tr>
      `).join("");
    }
  }
}

// Quick restock prompt from alert table
window.quickRestock = async (productId, productName) => {
  const qty = prompt(`Add restock units for ${productName}:`, "10");
  if (qty && parseInt(qty) > 0) {
    const addCount = parseInt(qty);
    try {
      const ref = doc(db, "products", productId);
      await updateDoc(ref, { stock: increment(addCount) });
      await addDoc(collection(db, "inventory_movements"), {
        productId,
        productName,
        type: "STOCK_IN",
        quantityChanged: addCount,
        reason: "Quick Restock from Dashboard",
        timestamp: Date.now()
      });
      showToast(`Added ${addCount} units to ${productName}`, "success");
      await loadAllAdminData();
    } catch (e) {
      showToast(e.message, "error");
    }
  }
};

// ==========================================
// SALES TRENDS CHART (Chart.js)
// ==========================================
function renderSalesChart() {
  const ctx = document.getElementById("salesTrendsChart");
  if (!ctx) return;

  const last7Days = [];
  const dayLabels = [];
  const revenueData = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d).setHours(23, 59, 59, 999);
    dayLabels.push(d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }));

    const dayTotal = allSales
      .filter(s => (s.createdAt || 0) >= d.getTime() && (s.createdAt || 0) <= dayEnd)
      .reduce((acc, s) => acc + Number(s.grandTotal || 0), 0);
    revenueData.push(dayTotal);
  }

  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dayLabels,
      datasets: [{
        label: "Daily Sales (₹)",
        data: revenueData,
        borderColor: "#2563EB",
        backgroundColor: "rgba(37, 99, 235, 0.1)",
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#2563EB",
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (val) => "₹" + val }
        }
      }
    }
  });
}

// ==========================================
// POINT OF SALE (POS) SYSTEM
// ==========================================
function renderPOSCatalog() {
  const container = document.getElementById("pos-product-grid");
  const catSelect = document.getElementById("pos-category-select");
  if (!container) return;

  // Hydrate category select
  if (catSelect && catSelect.children.length <= 1) {
    allCategories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });

    catSelect.addEventListener("change", () => filterPOSProducts());
  }

  renderPOSGrid(allProducts);

  // Barcode / Name live scanner listener
  const barcodeInput = document.getElementById("pos-barcode-input");
  barcodeInput.addEventListener("input", () => filterPOSProducts());
  barcodeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const queryStr = barcodeInput.value.trim().toLowerCase();
      const match = allProducts.find(p => 
        (p.barcode && p.barcode.toLowerCase() === queryStr) ||
        (p.sku && p.sku.toLowerCase() === queryStr) ||
        (p.name && p.name.toLowerCase() === queryStr)
      );
      if (match) {
        addToPOSCart(match);
        barcodeInput.value = "";
      }
    }
  });

  // Custom Line Item Modal trigger
  document.getElementById("pos-add-custom-item-btn").addEventListener("click", () => {
    const name = prompt("Enter Custom Item Name:", "Miscellaneous Product");
    if (!name) return;
    const price = prompt("Enter Selling Price (₹):", "100");
    if (!price || isNaN(price)) return;

    addToPOSCart({
      id: "custom_" + Date.now(),
      name: name,
      price: Number(price),
      category: "General",
      unit: "pcs"
    });
  });

  // Paymode selector
  document.querySelectorAll(".pos-paymode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pos-paymode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedPayMode = btn.dataset.mode;
    });
  });

  // Clear Bill
  document.getElementById("pos-clear-bill-btn").addEventListener("click", () => {
    posCart = [];
    renderPOSCart();
  });

  // Discount & Tax inputs
  document.getElementById("pos-discount-input").addEventListener("input", () => calculatePOSTotals());
  document.getElementById("pos-tax-select").addEventListener("change", () => calculatePOSTotals());

  // POS Complete Checkout & Print
  document.getElementById("pos-checkout-btn").addEventListener("click", () => processPOSSale());
}

function filterPOSProducts() {
  const term = document.getElementById("pos-barcode-input").value.trim().toLowerCase();
  const cat = document.getElementById("pos-category-select").value;

  let filtered = allProducts;
  if (cat !== "all") {
    filtered = filtered.filter(p => p.category === cat);
  }
  if (term) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(term) ||
      (p.barcode && p.barcode.includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term))
    );
  }
  renderPOSGrid(filtered);
}

function renderPOSGrid(products) {
  const container = document.getElementById("pos-product-grid");
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #94A3B8;">No matching items.</div>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px; text-align: center; cursor: pointer; transition: transform 0.15s ease;" onclick="window.addPOSItem('${p.id}')" onmouseover="this.style.borderColor='#2563EB'" onmouseout="this.style.borderColor='#E2E8F0'">
      <img src="${p.image || (p.images && p.images[0]) || 'images/poster.jpg'}" style="width: 100%; height: 75px; object-fit: cover; border-radius: 6px; margin-bottom: 6px; background: #F8FAFC;">
      <div style="font-weight: 700; font-size: 0.8rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
      <div style="font-size: 0.9rem; font-weight: 800; color: #2563EB;">₹${p.price}</div>
      <div style="font-size: 0.7rem; color: ${p.stock <= 0 ? '#EF4444' : '#16A34A'};">Stock: ${p.stock}</div>
    </div>
  `).join("");
}

window.addPOSItem = (productId) => {
  const prod = allProducts.find(p => p.id === productId);
  if (prod) addToPOSCart(prod);
};

function addToPOSCart(product) {
  const existing = posCart.find(i => i.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    posCart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      costPrice: Number(product.purchasePrice || product.price * 0.75),
      unit: product.unit || "Pcs",
      quantity: 1
    });
  }
  renderPOSCart();
}

function renderPOSCart() {
  const container = document.getElementById("pos-cart-items-container");
  if (!container) return;

  if (posCart.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 30px 10px; color: #94A3B8; font-size: 0.88rem;">Scan barcode or tap products to add items to bill.</div>`;
    calculatePOSTotals();
    return;
  }

  container.innerHTML = posCart.map((item, idx) => `
    <div class="pos-item-row">
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 700; font-size: 0.85rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
        <div style="font-size: 0.75rem; color: #64748B;">₹${item.price} × ${item.quantity} = <strong>₹${item.price * item.quantity}</strong></div>
      </div>
      <div style="display: flex; align-items: center; border: 1px solid #CBD5E1; border-radius: 6px; overflow: hidden;">
        <button type="button" onclick="window.updatePOSQty(${idx}, -1)" style="width: 26px; height: 26px; background: none; border: none; font-weight: bold; cursor: pointer;">−</button>
        <span style="width: 28px; text-align: center; font-size: 0.85rem; font-weight: 700;">${item.quantity}</span>
        <button type="button" onclick="window.updatePOSQty(${idx}, 1)" style="width: 26px; height: 26px; background: none; border: none; font-weight: bold; cursor: pointer;">+</button>
      </div>
      <button type="button" onclick="window.removePOSItem(${idx})" style="background: none; border: none; color: #EF4444; font-size: 16px; cursor: pointer;">✕</button>
    </div>
  `).join("");

  calculatePOSTotals();
}

window.updatePOSQty = (idx, delta) => {
  if (posCart[idx]) {
    posCart[idx].quantity += delta;
    if (posCart[idx].quantity <= 0) {
      posCart.splice(idx, 1);
    }
    renderPOSCart();
  }
};

window.removePOSItem = (idx) => {
  posCart.splice(idx, 1);
  renderPOSCart();
};

function calculatePOSTotals() {
  const subtotal = posCart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const discount = Number(document.getElementById("pos-discount-input").value) || 0;
  const taxRate = Number(document.getElementById("pos-tax-select").value) || 0;

  const afterDiscount = Math.max(0, subtotal - discount);
  const taxAmount = Math.round((afterDiscount * taxRate) / 100);
  const grandTotal = afterDiscount + taxAmount;

  document.getElementById("pos-subtotal").textContent = `₹${subtotal}`;
  document.getElementById("pos-grand-total").textContent = `₹${grandTotal}`;

  return { subtotal, discount, taxAmount, grandTotal };
}

async function processPOSSale() {
  if (posCart.length === 0) {
    showToast("Please add items to bill first!", "warning");
    return;
  }

  const totals = calculatePOSTotals();
  const invoiceNumber = "INV-" + Date.now().toString().slice(-6);
  const custName = document.getElementById("pos-cust-name").value.trim() || "Walk-in Customer";
  const custPhone = document.getElementById("pos-cust-phone").value.trim() || "";

  const saleRecord = {
    invoiceNumber,
    customerName: custName,
    customerPhone: custPhone,
    paymentMethod: selectedPayMode,
    items: [...posCart],
    subtotal: totals.subtotal,
    discountAmount: totals.discount,
    taxAmount: totals.taxAmount,
    grandTotal: totals.grandTotal,
    cashier: currentUser ? currentUser.email : "Admin",
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp()
  };

  try {
    // 1. Save sale record
    const saleDoc = await addDoc(collection(db, "sales"), saleRecord);

    // 2. Concurrency-safe inventory deduction
    for (const item of posCart) {
      if (item.id && !item.id.startsWith("custom_")) {
        try {
          await updateDoc(doc(db, "products", item.id), {
            stock: increment(-item.quantity)
          });
          await addDoc(collection(db, "inventory_movements"), {
            productId: item.id,
            productName: item.name,
            type: "POS_SALE",
            quantityChanged: -item.quantity,
            referenceId: invoiceNumber,
            reason: `POS Sale #${invoiceNumber}`,
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn("Stock decrease err:", e.message);
        }
      }
    }

    logAuditAction("POS_SALE", `Generated Invoice #${invoiceNumber} for ₹${totals.grandTotal}`);
    showToast(`✓ Invoice #${invoiceNumber} generated successfully!`, "success");

    // Reset POS
    posCart = [];
    document.getElementById("pos-cust-name").value = "";
    document.getElementById("pos-cust-phone").value = "";
    document.getElementById("pos-discount-input").value = "0";
    renderPOSCart();

    // Open printable receipt in new window
    window.open(`../invoice.html?id=${saleDoc.id}`, "_blank");

    // Refresh data in background
    loadAllAdminData();
  } catch (error) {
    showToast("Error processing sale: " + error.message, "error");
  }
}

// ==========================================
// PRODUCTS CRUD & CSV EXPORT
// ==========================================
function renderProductsTable() {
  const tbody = document.getElementById("admin-products-tbody");
  if (!tbody) return;

  tbody.innerHTML = allProducts.map(p => {
    const safeName = (p.name || '').replace(/'/g, "\\'");
    return `
    <tr>
      <td>
        <img src="${p.image || (p.images && p.images[0]) || 'images/poster.jpg'}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px;">
      </td>
      <td>
        <div style="font-weight: 700; color: #0F172A;">${p.name}</div>
        <div style="font-size: 0.75rem; color: #64748B;">SKU: ${p.sku || 'N/A'} • Barcode: ${p.barcode || 'N/A'}</div>
      </td>
      <td>${p.category}</td>
      <td>
        <div style="display: inline-flex; align-items: center; gap: 6px;">
          <strong style="color: #2563EB; font-size: 0.95rem;">₹${p.price}</strong>
          <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 7px; font-size: 0.72rem; border-color: #CBD5E1;" onclick="window.quickEditPrice('${p.id}', '${safeName}', ${p.price})" title="Quick Change Price">✎ Edit</button>
        </div>
      </td>
      <td>₹${p.mrp || p.price}</td>
      <td>₹${p.purchasePrice || Math.round(p.price * 0.75)}</td>
      <td>
        <div style="display: inline-flex; align-items: center; gap: 6px;">
          <span class="badge ${p.stock <= 0 ? 'badge-danger' : (p.stock <= (p.minStock || 5) ? 'badge-warning' : 'badge-success')}">
            ${p.stock} ${p.unit || 'pcs'}
          </span>
          <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size: 0.72rem; border-color: #CBD5E1;" onclick="window.quickEditStock('${p.id}', '${safeName}', ${p.stock})" title="Quick Change Stock">✎</button>
        </div>
      </td>
      <td>
        <span class="badge ${p.isActive !== false ? 'badge-success' : 'badge-danger'}">
          ${p.isActive !== false ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm btn-primary" onclick="window.editProduct('${p.id}')">Edit All</button>
          <button class="btn btn-sm btn-outline" style="color: #EF4444;" onclick="window.deleteProduct('${p.id}', '${safeName}')">✕</button>
        </div>
      </td>
    </tr>
  `;}).join("");

  // Hydrate category filter
  const filterSelect = document.getElementById("admin-prod-cat-filter");
  if (filterSelect && filterSelect.children.length <= 1) {
    allCategories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = c.name;
      filterSelect.appendChild(opt);
    });
  }
}

// Quick Price Edit Function
window.quickEditPrice = async (id, name, currentPrice) => {
  const newPrice = prompt(`Enter new selling price (₹) for "${name}":`, currentPrice);
  if (newPrice !== null && !isNaN(newPrice) && Number(newPrice) >= 0) {
    try {
      await setDoc(doc(db, "products", id), { 
        price: Number(newPrice),
        updatedAt: Date.now() 
      }, { merge: true });
      showToast(`✓ Price updated for "${name}" to ₹${newPrice}`, "success");
      logAuditAction("PRICE_EDIT", `Updated price for ${name} to ₹${newPrice}`);
      await loadAllAdminData();
    } catch(err) {
      showToast("Error updating price: " + err.message, "error");
    }
  }
};

// Quick Stock Edit Function
window.quickEditStock = async (id, name, currentStock) => {
  const newStock = prompt(`Update stock units for "${name}":`, currentStock);
  if (newStock !== null && !isNaN(newStock) && Number(newStock) >= 0) {
    try {
      await setDoc(doc(db, "products", id), { 
        stock: Number(newStock),
        updatedAt: Date.now() 
      }, { merge: true });
      showToast(`✓ Stock updated for "${name}" to ${newStock}`, "success");
      logAuditAction("STOCK_EDIT", `Updated stock for ${name} to ${newStock}`);
      await loadAllAdminData();
    } catch(err) {
      showToast("Error updating stock: " + err.message, "error");
    }
  }
};

// CSV Export
document.getElementById("btn-export-products-csv").addEventListener("click", () => {
  let csv = "ID,Name,SKU,Barcode,Category,Price,MRP,PurchasePrice,Stock,Unit\n";
  allProducts.forEach(p => {
    csv += `"${p.id}","${p.name}","${p.sku || ''}","${p.barcode || ''}","${p.category}","${p.price}","${p.mrp || p.price}","${p.purchasePrice || ''}","${p.stock}","${p.unit || 'Pcs'}"\n`;
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Ayush_Service_Center_Products_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
});

// Sync/Seed Default 26 Items Button
const syncProductsBtn = document.getElementById("btn-sync-default-products");
if (syncProductsBtn) {
  syncProductsBtn.addEventListener("click", async () => {
    if (confirm("Sync and populate all 26 default store products to Firestore?")) {
      try {
        await seedInitialDatabase();
        showToast("✓ All 26 products & categories synced successfully!", "success");
        await loadAllAdminData();
      } catch(e) {
        showToast("Sync error: " + e.message, "error");
      }
    }
  });
}

// Product Modal Handlers
document.getElementById("btn-add-product-modal").addEventListener("click", () => openProductModal());

function openProductModal(prod = null) {
  const modal = document.getElementById("modal-product");
  const title = document.getElementById("modal-product-title");
  const catSelect = document.getElementById("prod-form-category");

  // Populate categories
  catSelect.innerHTML = allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join("");

  if (prod) {
    title.textContent = "Edit Product";
    document.getElementById("prod-form-id").value = prod.id;
    document.getElementById("prod-form-name").value = prod.name;
    document.getElementById("prod-form-name-hindi").value = prod.nameHindi || "";
    catSelect.value = prod.category;
    document.getElementById("prod-form-unit").value = prod.unit || "Pcs";
    document.getElementById("prod-form-price").value = prod.price;
    document.getElementById("prod-form-mrp").value = prod.mrp || prod.price;
    document.getElementById("prod-form-cost").value = prod.purchasePrice || Math.round(prod.price * 0.75);
    document.getElementById("prod-form-stock").value = prod.stock;
    document.getElementById("prod-form-min-stock").value = prod.minStock || 5;
    document.getElementById("prod-form-image").value = prod.image || (prod.images && prod.images[0]) || "";
    document.getElementById("prod-form-desc").value = prod.description || "";
    document.getElementById("prod-form-featured").checked = !!prod.isFeatured;
    document.getElementById("prod-form-active").checked = prod.isActive !== false;
  } else {
    title.textContent = "Add New Product";
    document.getElementById("form-product").reset();
    document.getElementById("prod-form-id").value = "";
  }

  modal.classList.add("active");
}

document.getElementById("form-product").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("prod-form-id").value;
  const isEditing = !!id;

  const payload = {
    name: document.getElementById("prod-form-name").value.trim(),
    nameHindi: document.getElementById("prod-form-name-hindi").value.trim(),
    category: document.getElementById("prod-form-category").value,
    unit: document.getElementById("prod-form-unit").value,
    price: Number(document.getElementById("prod-form-price").value),
    mrp: Number(document.getElementById("prod-form-mrp").value),
    purchasePrice: Number(document.getElementById("prod-form-cost").value),
    stock: Number(document.getElementById("prod-form-stock").value),
    minStock: Number(document.getElementById("prod-form-min-stock").value),
    image: document.getElementById("prod-form-image").value.trim(),
    description: document.getElementById("prod-form-desc").value.trim(),
    isFeatured: document.getElementById("prod-form-featured").checked,
    isActive: document.getElementById("prod-form-active").checked,
    updatedAt: Date.now()
  };

  try {
    if (isEditing) {
      await setDoc(doc(db, "products", id), payload, { merge: true });
      showToast("✓ Product updated successfully!", "success");
      logAuditAction("PRODUCT_EDIT", `Edited product ${payload.name}`);
    } else {
      payload.createdAt = Date.now();
      payload.sku = "ASC-" + Date.now().toString().slice(-5);
      await addDoc(collection(db, "products"), payload);
      showToast("✓ Product created successfully!", "success");
      logAuditAction("PRODUCT_CREATE", `Created product ${payload.name}`);
    }
    document.getElementById("modal-product").classList.remove("active");
    await loadAllAdminData();
  } catch (err) {
    showToast(err.message, "error");
  }
});

window.editProduct = (id) => {
  const p = allProducts.find(item => item.id === id);
  if (p) openProductModal(p);
};

window.deleteProduct = async (id, name) => {
  if (confirm(`Are you sure you want to delete ${name}?`)) {
    try {
      await deleteDoc(doc(db, "products", id));
      showToast("Product deleted successfully", "info");
      logAuditAction("PRODUCT_DELETE", `Deleted product ${name}`);
      await loadAllAdminData();
    } catch (e) {
      showToast(e.message, "error");
    }
  }
};

// ==========================================
// CATEGORIES CRUD
// ==========================================
function renderCategoriesTable() {
  const tbody = document.getElementById("admin-categories-tbody");
  if (!tbody) return;

  tbody.innerHTML = allCategories.map(c => `
    <tr>
      <td>
        <img src="${c.image || 'images/poster.jpg'}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px;">
      </td>
      <td><strong>${c.name}</strong></td>
      <td>${c.nameHindi || ''}</td>
      <td><code>${c.slug}</code></td>
      <td>${c.order || 1}</td>
      <td>
        <button class="btn btn-sm btn-outline" style="color: #EF4444;" onclick="window.deleteCategory('${c.id}', '${c.name}')">Delete</button>
      </td>
    </tr>
  `).join("");
}

window.deleteCategory = async (id, name) => {
  if (confirm(`Delete category "${name}"?`)) {
    try {
      await deleteDoc(doc(db, "categories", id));
      showToast("Category removed", "info");
      await loadAllAdminData();
    } catch (e) {
      showToast(e.message, "error");
    }
  }
};

// ==========================================
// ORDERS MANAGEMENT
// ==========================================
function renderOrdersTable() {
  const tbody = document.getElementById("admin-orders-tbody");
  if (!tbody) return;

  if (allOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94A3B8;">No customer orders placed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allOrders.map(o => `
    <tr>
      <td><strong>#${o.orderNumber || o.id}</strong></td>
      <td>${new Date(o.createdAt || Date.now()).toLocaleDateString()}</td>
      <td>${o.customerName}</td>
      <td><a href="tel:${o.customerPhone}" style="color: #2563EB;">${o.customerPhone}</a></td>
      <td>${(o.items || []).length} items</td>
      <td><strong>₹${o.grandTotal}</strong></td>
      <td>
        <select onchange="window.updateOrderStatus('${o.id}', this.value)" style="padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; border: 1px solid #CBD5E1;">
          <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Preparing" ${o.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
          <option value="Ready for Pickup" ${o.status === 'Ready for Pickup' ? 'selected' : ''}>Ready for Pickup</option>
          <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
          <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-sm btn-outline" onclick="window.viewOrder('${o.id}')">View</button>
          <a href="https://wa.me/${(o.customerPhone || '').replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(o.customerName)},%20your%20Ayush%20Service%20Center%20order%20%23${o.orderNumber}%20is%20${encodeURIComponent(o.status)}." target="_blank" class="btn btn-sm btn-whatsapp">
            💬 WA
          </a>
        </div>
      </td>
    </tr>
  `).join("");
}

window.updateOrderStatus = async (id, newStatus) => {
  try {
    await updateDoc(doc(db, "orders", id), { status: newStatus });
    showToast(`Order status updated to ${newStatus}`, "success");
    logAuditAction("ORDER_STATUS", `Order #${id} marked as ${newStatus}`);
    await loadAllAdminData();
  } catch (e) {
    showToast(e.message, "error");
  }
};

window.viewOrder = (id) => {
  const ord = allOrders.find(o => o.id === id);
  if (!ord) return;

  const modal = document.getElementById("modal-order-details");
  document.getElementById("modal-order-title").textContent = `Order Details #${ord.orderNumber || ord.id}`;
  document.getElementById("modal-order-body").innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
      <div>
        <p><strong>Customer:</strong> ${ord.customerName}</p>
        <p><strong>Phone:</strong> ${ord.customerPhone}</p>
        <p><strong>Fulfillment:</strong> ${ord.fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</p>
        <p><strong>Address:</strong> ${ord.deliveryAddress || 'N/A'}</p>
      </div>
      <div style="text-align: right;">
        <p><strong>Date:</strong> ${new Date(ord.createdAt).toLocaleString()}</p>
        <p><strong>Payment:</strong> ${ord.paymentMethod}</p>
        <p><strong>Status:</strong> <span class="badge badge-primary">${ord.status}</span></p>
      </div>
    </div>

    <h4 style="margin-bottom: 10px;">Ordered Items:</h4>
    <table class="admin-table" style="margin-bottom: 20px;">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${(ord.items || []).map(i => `
          <tr>
            <td>${i.name}</td>
            <td>${i.quantity}</td>
            <td>₹${i.price}</td>
            <td>₹${i.price * i.quantity}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div style="text-align: right; font-size: 1.15rem; font-weight: 800; color: #2563EB;">
      Total: ₹${ord.grandTotal}
    </div>
  `;
  modal.classList.add("active");
};

// ==========================================
// AUTO BOOKINGS MANAGEMENT
// ==========================================
function renderBookingsTable() {
  const tbody = document.getElementById("admin-bookings-tbody");
  if (!tbody) return;

  if (allBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #94A3B8;">No auto travel bookings requested yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allBookings.map(b => `
    <tr>
      <td><strong>#${b.bookingNumber || b.id}</strong></td>
      <td>${b.customerName}</td>
      <td><a href="tel:${b.customerPhone}" style="color: #2563EB;">${b.customerPhone}</a></td>
      <td>${b.pickupLocation}</td>
      <td>${b.destination}</td>
      <td>${b.date} at ${b.time}</td>
      <td>${b.vehicleType}</td>
      <td>
        <select onchange="window.updateBookingStatus('${b.id}', this.value)" style="padding: 4px; border-radius: 6px; font-weight: 600; font-size: 0.8rem;">
          <option value="Pending" ${b.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Completed" ${b.status === 'Completed' ? 'selected' : ''}>Completed</option>
          <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <a href="https://wa.me/${(b.customerPhone || '').replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(b.customerName)},%20your%20Ayush%20Service%20Center%20auto%20booking%20%23${b.bookingNumber}%20is%20${encodeURIComponent(b.status)}." target="_blank" class="btn btn-sm btn-whatsapp">
          💬 Call/WA
        </a>
      </td>
    </tr>
  `).join("");
}

window.updateBookingStatus = async (id, status) => {
  try {
    await updateDoc(doc(db, "auto_bookings", id), { status });
    showToast(`Booking marked as ${status}`, "success");
    await loadAllAdminData();
  } catch (e) {
    showToast(e.message, "error");
  }
};

// ==========================================
// INVENTORY LOGS & STOCK ADJUSTMENT
// ==========================================
function renderInventoryTable() {
  const tbody = document.getElementById("admin-inventory-movements-tbody");
  if (!tbody) return;

  if (allMovements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #94A3B8;">No stock movements recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allMovements.map(m => `
    <tr>
      <td>${new Date(m.timestamp || Date.now()).toLocaleString()}</td>
      <td><strong>${m.productName}</strong></td>
      <td><span class="badge ${m.quantityChanged > 0 ? 'badge-success' : 'badge-danger'}">${m.type}</span></td>
      <td style="font-weight: 800; color: ${m.quantityChanged > 0 ? '#16A34A' : '#EF4444'};">
        ${m.quantityChanged > 0 ? '+' : ''}${m.quantityChanged}
      </td>
      <td>${m.reason || 'N/A'}</td>
    </tr>
  `).join("");
}

function openStockAdjustModal() {
  const modal = document.getElementById("modal-stock-adjust");
  const select = document.getElementById("adjust-prod-select");
  select.innerHTML = allProducts.map(p => `<option value="${p.id}">${p.name} (Current: ${p.stock})</option>`).join("");
  modal.classList.add("active");
}

document.getElementById("btn-open-stock-adjust-modal").addEventListener("click", openStockAdjustModal);

document.getElementById("form-stock-adjust").addEventListener("submit", async (e) => {
  e.preventDefault();
  const prodId = document.getElementById("adjust-prod-select").value;
  const prod = allProducts.find(p => p.id === prodId);
  const type = document.getElementById("adjust-type").value;
  const qty = Number(document.getElementById("adjust-qty").value);
  const reason = document.getElementById("adjust-reason").value.trim();

  const change = (type === "STOCK_IN" || type === "RETURN") ? qty : -qty;

  try {
    await updateDoc(doc(db, "products", prodId), { stock: increment(change) });
    await addDoc(collection(db, "inventory_movements"), {
      productId: prodId,
      productName: prod ? prod.name : "Product",
      type: type,
      quantityChanged: change,
      reason: reason || type,
      timestamp: Date.now()
    });
    showToast("Stock adjusted successfully!", "success");
    logAuditAction("INVENTORY_ADJUST", `Adjusted stock for ${prod.name} by ${change}`);
    document.getElementById("modal-stock-adjust").classList.remove("active");
    await loadAllAdminData();
  } catch (err) {
    showToast(err.message, "error");
  }
});

// ==========================================
// SALES TABLE
// ==========================================
function renderSalesTable() {
  const tbody = document.getElementById("admin-sales-tbody");
  if (!tbody) return;

  if (allSales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #94A3B8;">No sales records logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allSales.map(s => `
    <tr>
      <td><strong>#${s.invoiceNumber || s.id}</strong></td>
      <td>${new Date(s.createdAt || Date.now()).toLocaleDateString()}</td>
      <td>${s.customerName || 'Walk-in'}</td>
      <td><span class="badge badge-primary">${s.paymentMethod || 'Cash'}</span></td>
      <td>${(s.items || []).length} items</td>
      <td>₹${s.subtotal}</td>
      <td style="font-weight: 800; color: #2563EB;">₹${s.grandTotal}</td>
      <td>
        <a href="../invoice.html?id=${s.id}" target="_blank" class="btn btn-sm btn-outline">🖨️ Receipt</a>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// EXPENSES TRACKER
// ==========================================
function renderExpensesTable() {
  const tbody = document.getElementById("admin-expenses-tbody");
  if (!tbody) return;

  if (allExpenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #94A3B8;">No store expenses recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = allExpenses.map(exp => `
    <tr>
      <td>${new Date(exp.createdAt || Date.now()).toLocaleDateString()}</td>
      <td><strong>${exp.category}</strong></td>
      <td style="color: #EF4444; font-weight: 800;">₹${exp.amount}</td>
      <td>${exp.description || ''}</td>
      <td>
        <button class="btn btn-sm btn-outline" style="color: #EF4444;" onclick="window.deleteExpense('${exp.id}')">✕</button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("btn-add-expense-modal").addEventListener("click", () => {
  document.getElementById("modal-expense").classList.add("active");
});

document.getElementById("form-expense").addEventListener("submit", async (e) => {
  e.preventDefault();
  const category = document.getElementById("exp-category").value;
  const amount = Number(document.getElementById("exp-amount").value);
  const description = document.getElementById("exp-desc").value.trim();

  try {
    await addDoc(collection(db, "expenses"), {
      category,
      amount,
      description,
      createdAt: Date.now()
    });
    showToast("Expense logged successfully", "success");
    document.getElementById("modal-expense").classList.remove("active");
    await loadAllAdminData();
  } catch (err) {
    showToast(err.message, "error");
  }
});

window.deleteExpense = async (id) => {
  if (confirm("Delete this expense record?")) {
    await deleteDoc(doc(db, "expenses", id));
    showToast("Expense deleted", "info");
    await loadAllAdminData();
  }
};

// ==========================================
// CUSTOMERS CRM TABLE
// ==========================================
function renderCustomersTable() {
  const tbody = document.getElementById("admin-customers-tbody");
  if (!tbody) return;

  if (allCustomers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: #94A3B8;">No customer profiles recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allCustomers.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><a href="tel:${c.phone}" style="color: #2563EB;">${c.phone}</a></td>
      <td>${c.address || 'N/A'}</td>
      <td>${c.totalOrders || 1}</td>
      <td><strong>₹${c.totalSpend || 0}</strong></td>
      <td>
        <div style="display: flex; gap: 6px;">
          <a href="tel:${c.phone}" class="btn btn-sm btn-outline">📞 Call</a>
          <a href="https://wa.me/${(c.phone || '').replace(/\D/g, '')}" target="_blank" class="btn btn-sm btn-whatsapp">💬 WA</a>
        </div>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// MEDIA GALLERY
// ==========================================
function renderMediaLibrary() {
  const grid = document.getElementById("media-library-grid");
  if (!grid) return;

  const images = [
    "images/owner.jpg",
    "images/poster.jpg",
    "images/shop1.jpeg",
    "images/cooker.jpg",
    "images/steel-plate.jpg",
    "images/steel-glass.jpg",
    "images/1bartan.jpg",
    "images/bucket.jpg",
    "images/mug.jpg",
    "images/container.jpg",
    "images/1plastic.jpg",
    "images/charger.jpg",
    "images/usb-cable.jpg",
    "images/earphones.jpg",
    "images/mobile-cover.jpg",
    "images/1mobile.jpg",
    "images/coca-cola.jpg",
    "images/sprite.jpg",
    "images/pepsi.jpg",
    "images/1colddrink.jpg",
    "images/facewash.jpg",
    "images/lotion.jpg",
    "images/lipbalm.jpg",
    "images/dona.jpg",
    "images/paper-plate.jpg",
    "images/disposable-glass.jpg",
    "images/1dona-pattal.jpg",
    "images/1gas.jpg",
    "images/1autobooking.jpg"
  ];

  grid.innerHTML = images.map(src => `
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px; text-align: center;">
      <img src="../${src}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;">
      <div style="font-size: 0.72rem; color: #64748B; word-break: break-all; margin-bottom: 4px;">${src}</div>
      <button class="btn btn-sm btn-outline" style="width: 100%; font-size: 0.75rem;" onclick="navigator.clipboard.writeText('${src}'); alert('Path copied: ${src}');">Copy Path</button>
    </div>
  `).join("");
}

// ==========================================
// CMS CONTENT & SETTINGS SAVE
// ==========================================
document.getElementById("btn-save-cms-content").addEventListener("click", async () => {
  const hindiTitle = document.getElementById("cms-hindi-title").value.trim();
  const subtitle = document.getElementById("cms-english-subtitle").value.trim();
  const welcomeText = document.getElementById("cms-welcome-text").value.trim();
  const aboutText = document.getElementById("cms-about-text").value.trim();

  await saveStoreSettings({
    hindiTitle,
    subtitle,
    welcomeText,
    aboutText
  });
});

document.getElementById("btn-save-store-settings").addEventListener("click", async () => {
  const storeName = document.getElementById("set-store-name").value.trim();
  const ownerName = document.getElementById("set-owner-name").value.trim();
  const phone = document.getElementById("set-phone").value.trim();
  const whatsappNumber = document.getElementById("set-whatsapp").value.trim();
  const upiId = document.getElementById("set-upi").value.trim();
  const address = document.getElementById("set-address").value.trim();
  const deliveryFee = Number(document.getElementById("set-delivery-fee").value);
  const freeDeliveryThreshold = Number(document.getElementById("set-free-threshold").value);
  const mapEmbedUrl = document.getElementById("set-map-url").value.trim();

  await saveStoreSettings({
    storeName,
    ownerName,
    phone,
    whatsappNumber,
    upiId,
    address,
    deliveryFee,
    freeDeliveryThreshold,
    mapEmbedUrl
  });
});

// ==========================================
// AUDIT LOGS
// ==========================================
async function logAuditAction(actionType, description) {
  try {
    await addDoc(collection(db, "audit_logs"), {
      actionType,
      description,
      operator: currentUser ? currentUser.email : "System",
      timestamp: Date.now()
    });
  } catch (e) {
    console.warn("Audit log error:", e.message);
  }
}

async function loadAuditLogs() {
  const tbody = document.getElementById("admin-audit-tbody");
  if (!tbody) return;

  try {
    const qSnap = await getDocs(collection(db, "audit_logs"));
    const logs = [];
    qSnap.forEach(d => logs.push(d.data()));
    logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #94A3B8;">No audit logs yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.slice(0, 50).map(l => `
      <tr>
        <td>${new Date(l.timestamp || Date.now()).toLocaleString()}</td>
        <td><span class="badge badge-primary">${l.actionType}</span></td>
        <td>${l.description}</td>
        <td>${l.operator || 'Admin'}</td>
      </tr>
    `).join("");
  } catch (e) {
    console.warn("Audit logs lookup failed:", e.message);
  }
}

// Modal generic close buttons
document.querySelectorAll(".modal-close-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const modalId = btn.dataset.modal;
    if (modalId) {
      document.getElementById(modalId).classList.remove("active");
    }
  });
});

