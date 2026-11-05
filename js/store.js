// Core Store, State Management, Cart & Database Synchronization
import { 
  db, 
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
  increment,
  writeBatch
} from "./firebase-config.js";

import { 
  INITIAL_STORE_SETTINGS, 
  INITIAL_CATEGORIES, 
  INITIAL_PRODUCTS, 
  INITIAL_BANNERS, 
  INITIAL_OFFERS, 
  INITIAL_REVIEWS 
} from "./data-seed.js";

const CART_STORAGE_KEY = "asc_cart_items";
const COUPON_STORAGE_KEY = "asc_applied_coupon";
const SETTINGS_CACHE_KEY = "asc_store_settings_cache";

// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      max-width: 90vw;
      width: 380px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `asc-toast asc-toast-${type}`;
  
  const colors = {
    success: { bg: "#065F46", border: "#10B981", text: "#ECFDF5", icon: "✓" },
    error: { bg: "#7F1D1D", border: "#EF4444", text: "#FEF2F2", icon: "✕" },
    warning: { bg: "#78350F", border: "#F59E0B", text: "#FFFBEB", icon: "⚠" },
    info: { bg: "#1E3A8A", border: "#3B82F6", text: "#EFF6FF", icon: "ℹ" }
  };
  const theme = colors[type] || colors.info;

  toast.style.cssText = `
    background: ${theme.bg};
    border-left: 5px solid ${theme.border};
    color: ${theme.text};
    padding: 14px 18px;
    border-radius: 8px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 500;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(-15px);
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  toast.innerHTML = `
    <span style="font-weight: bold; font-size: 16px; background: rgba(255,255,255,0.2); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">${theme.icon}</span>
    <span style="flex: 1; line-height: 1.4;">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-15px)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

// ==========================================
// CART & LOCAL STORAGE MANAGEMENT
// ==========================================
export function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error reading cart:", e);
    return [];
  }
}

export function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    dispatchCartUpdate();
  } catch (e) {
    console.error("Error saving cart:", e);
  }
}

export function addToCart(product, quantity = 1, variant = null) {
  if (!product || !product.id) return;
  const cart = getCart();
  const variantKey = variant ? (typeof variant === 'object' ? JSON.stringify(variant) : variant) : "";
  
  const existingIndex = cart.findIndex(
    item => item.id === product.id && (item.variantKey || "") === variantKey
  );

  if (existingIndex > -1) {
    cart[existingIndex].quantity += Number(quantity);
    showToast(`Updated quantity for ${product.name}`, "success");
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      mrp: Number(product.mrp || product.price),
      image: product.image || (product.images && product.images[0]) || "images/poster.jpg",
      category: product.category,
      unit: product.unit || "Pcs",
      sku: product.sku || "",
      quantity: Number(quantity),
      variant: variant,
      variantKey: variantKey
    });
    showToast(`Added ${product.name} to cart!`, "success");
  }

  saveCart(cart);
}

export function updateCartQuantity(productId, newQty, variantKey = "") {
  let cart = getCart();
  const qty = Number(newQty);
  if (qty <= 0) {
    cart = cart.filter(item => !(item.id === productId && (item.variantKey || "") === variantKey));
  } else {
    const item = cart.find(item => item.id === productId && (item.variantKey || "") === variantKey);
    if (item) {
      item.quantity = qty;
    }
  }
  saveCart(cart);
}

export function removeFromCart(productId, variantKey = "") {
  let cart = getCart();
  cart = cart.filter(item => !(item.id === productId && (item.variantKey || "") === variantKey));
  saveCart(cart);
  showToast("Item removed from cart", "info");
}

export function clearCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
  localStorage.removeItem(COUPON_STORAGE_KEY);
  dispatchCartUpdate();
}

export function getAppliedCoupon() {
  try {
    const raw = localStorage.getItem(COUPON_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function applyCoupon(code) {
  if (!code) return { success: false, message: "Please enter a coupon code" };
  const cleanCode = code.trim().toUpperCase();
  const offer = INITIAL_OFFERS.find(o => o.code === cleanCode && o.isActive);
  
  if (!offer) {
    return { success: false, message: "Invalid or expired coupon code" };
  }

  const cart = getCart();
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  if (offer.minOrderAmount && subtotal < offer.minOrderAmount) {
    return { 
      success: false, 
      message: `Coupon requires minimum order of ₹${offer.minOrderAmount}. Add ₹${offer.minOrderAmount - subtotal} more.` 
    };
  }

  localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(offer));
  dispatchCartUpdate();
  showToast(`Coupon ${offer.code} applied successfully!`, "success");
  return { success: true, offer };
}

export function removeCoupon() {
  localStorage.removeItem(COUPON_STORAGE_KEY);
  dispatchCartUpdate();
  showToast("Coupon removed", "info");
}

export function getCartSummary() {
  const cart = getCart();
  const coupon = getAppliedCoupon();
  const settings = getCachedSettings();

  const totalItems = cart.length;
  const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const mrpTotal = cart.reduce((acc, item) => acc + ((item.mrp || item.price) * item.quantity), 0);
  const retailSavings = Math.max(0, mrpTotal - subtotal);

  let couponDiscount = 0;
  if (coupon) {
    if (coupon.discountPercent > 0) {
      couponDiscount = Math.round((subtotal * coupon.discountPercent) / 100);
    } else if (coupon.discountAmount > 0) {
      couponDiscount = Math.min(coupon.discountAmount, subtotal);
    }
  }

  const deliveryFee = (subtotal >= (settings.freeDeliveryThreshold || 500) || subtotal === 0) 
    ? 0 
    : (settings.deliveryFee || 30);

  const grandTotal = Math.max(0, subtotal - couponDiscount + deliveryFee);

  return {
    items: cart,
    totalItems,
    totalQty,
    subtotal,
    mrpTotal,
    retailSavings,
    coupon,
    couponDiscount,
    deliveryFee,
    grandTotal
  };
}

function dispatchCartUpdate() {
  const summary = getCartSummary();
  window.dispatchEvent(new CustomEvent("asc-cart-updated", { detail: summary }));
}

// ==========================================
// STORE SETTINGS
// ==========================================
export function getCachedSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    return raw ? { ...INITIAL_STORE_SETTINGS, ...JSON.parse(raw) } : INITIAL_STORE_SETTINGS;
  } catch (e) {
    return INITIAL_STORE_SETTINGS;
  }
}

export async function fetchStoreSettings() {
  try {
    const settingsDoc = await getDoc(doc(db, "store_settings", "general"));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      const merged = { ...INITIAL_STORE_SETTINGS, ...data };
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (error) {
    console.warn("Could not fetch remote settings, using default/cached:", error.message);
  }
  return getCachedSettings();
}

export async function saveStoreSettings(newSettings) {
  try {
    await setDoc(doc(db, "store_settings", "general"), {
      ...newSettings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(newSettings));
    showToast("Store settings saved successfully!", "success");
    return true;
  } catch (e) {
    console.error("Error saving settings:", e);
    showToast("Failed to save settings: " + e.message, "error");
    return false;
  }
}

// ==========================================
// DATABASE QUERY & FETCH HELPERS
// ==========================================
export async function fetchProducts(options = {}) {
  const { category, search, minPrice, maxPrice, inStockOnly, sortBy } = options;
  let products = [];

  try {
    const qSnapshot = await getDocs(collection(db, "products"));
    if (!qSnapshot.empty) {
      qSnapshot.forEach(docSnap => {
        products.push({ id: docSnap.id, ...docSnap.data() });
      });
    }
  } catch (err) {
    console.warn("Using initial product catalog fallback:", err.message);
  }

  // If remote has no products yet, use seed catalog
  if (products.length === 0) {
    products = [...INITIAL_PRODUCTS];
  }

  // Apply filters
  if (category && category !== "all") {
    const catLower = category.toLowerCase();
    products = products.filter(p => 
      (p.category && p.category.toLowerCase() === catLower) ||
      (p.categorySlug && p.categorySlug.toLowerCase() === catLower)
    );
  }

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    products = products.filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.nameHindi && p.nameHindi.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term)) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.includes(term))
    );
  }

  if (minPrice !== undefined && minPrice !== null) {
    products = products.filter(p => Number(p.price) >= Number(minPrice));
  }

  if (maxPrice !== undefined && maxPrice !== null) {
    products = products.filter(p => Number(p.price) <= Number(maxPrice));
  }

  if (inStockOnly) {
    products = products.filter(p => (Number(p.stock) > 0 || p.stock === "Available"));
  }

  // Sorting
  if (sortBy === "price_asc") {
    products.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortBy === "price_desc") {
    products.sort((a, b) => Number(b.price) - Number(a.price));
  } else if (sortBy === "name_asc") {
    products.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (sortBy === "rating") {
    products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else {
    // Default featured or order
    products.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }

  return products;
}

export async function fetchProductById(id) {
  if (!id) return null;
  try {
    const docSnap = await getDoc(doc(db, "products", id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (e) {
    console.warn("Product doc lookup fallback:", e.message);
  }
  return INITIAL_PRODUCTS.find(p => p.id === id) || null;
}

export async function fetchCategories() {
  let categories = [];
  try {
    const qSnapshot = await getDocs(collection(db, "categories"));
    if (!qSnapshot.empty) {
      qSnapshot.forEach(docSnap => {
        categories.push({ id: docSnap.id, ...docSnap.data() });
      });
      categories.sort((a, b) => (a.order || 99) - (b.order || 99));
      return categories;
    }
  } catch (e) {
    console.warn("Categories remote fetch fallback:", e.message);
  }
  return [...INITIAL_CATEGORIES];
}

export async function fetchBanners() {
  let banners = [];
  try {
    const qSnapshot = await getDocs(collection(db, "banners"));
    if (!qSnapshot.empty) {
      qSnapshot.forEach(docSnap => {
        banners.push({ id: docSnap.id, ...docSnap.data() });
      });
      banners.sort((a, b) => (a.order || 99) - (b.order || 99));
      return banners.filter(b => b.isActive !== false);
    }
  } catch (e) {
    console.warn("Banners remote fetch fallback:", e.message);
  }
  return [...INITIAL_BANNERS];
}

export async function fetchOffers() {
  let offers = [];
  try {
    const qSnapshot = await getDocs(collection(db, "offers"));
    if (!qSnapshot.empty) {
      qSnapshot.forEach(docSnap => {
        offers.push({ id: docSnap.id, ...docSnap.data() });
      });
      return offers.filter(o => o.isActive !== false);
    }
  } catch (e) {
    console.warn("Offers remote fetch fallback:", e.message);
  }
  return [...INITIAL_OFFERS];
}

export async function fetchReviews() {
  let reviews = [];
  try {
    const qSnapshot = await getDocs(collection(db, "reviews"));
    if (!qSnapshot.empty) {
      qSnapshot.forEach(docSnap => {
        reviews.push({ id: docSnap.id, ...docSnap.data() });
      });
      return reviews;
    }
  } catch (e) {
    console.warn("Reviews remote fetch fallback:", e.message);
  }
  return [...INITIAL_REVIEWS];
}

// ==========================================
// ORDER SUBMISSION & STOCK DEDUCTION
// ==========================================
export async function createOrder(orderPayload) {
  const orderNumber = "ASC-" + Date.now().toString().slice(-6);
  const orderRecord = {
    orderNumber,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
    status: "Pending", // Pending, Confirmed, Preparing, Ready for Pickup, Out for Delivery, Completed, Cancelled
    paymentStatus: orderPayload.paymentMethod === "Cash" ? "Pending (Cash on Delivery/Pickup)" : "Pending Verification",
    ...orderPayload
  };

  try {
    const docRef = await addDoc(collection(db, "orders"), orderRecord);
    const orderId = docRef.id;

    // Concurrency-safe inventory deduction for each ordered item
    if (Array.isArray(orderPayload.items)) {
      for (const item of orderPayload.items) {
        if (item.id && !item.id.startsWith("custom_")) {
          try {
            const productRef = doc(db, "products", item.id);
            await updateDoc(productRef, {
              stock: increment(-Number(item.quantity || 1))
            });

            // Record movement
            await addDoc(collection(db, "inventory_movements"), {
              productId: item.id,
              productName: item.name,
              type: "SALE_ORDER",
              quantityChanged: -Number(item.quantity || 1),
              referenceId: orderNumber,
              reason: `Customer Order #${orderNumber}`,
              timestamp: Date.now()
            });
          } catch (stkErr) {
            console.warn("Stock update warning for item:", item.name, stkErr.message);
          }
        }
      }
    }

    // Save or update customer record in CRM
    if (orderPayload.customerPhone) {
      try {
        const custId = "cust_" + orderPayload.customerPhone.replace(/\D/g, "");
        await setDoc(doc(db, "customers", custId), {
          name: orderPayload.customerName,
          phone: orderPayload.customerPhone,
          address: orderPayload.deliveryAddress || "",
          lastOrderDate: Date.now(),
          totalOrders: increment(1),
          totalSpend: increment(Number(orderPayload.grandTotal || 0))
        }, { merge: true });
      } catch (custErr) {
        console.warn("Customer CRM log error:", custErr.message);
      }
    }

    clearCart();
    return { success: true, orderId, orderNumber };
  } catch (error) {
    console.error("Error creating order:", error);
    // If offline, still generate order number for WhatsApp dispatch
    clearCart();
    return { success: true, orderId: "offline_" + orderNumber, orderNumber, isOffline: true };
  }
}

// ==========================================
// AUTO BOOKING SUBMISSION
// ==========================================
export async function createAutoBooking(bookingData) {
  const bookingNumber = "AB-" + Date.now().toString().slice(-5);
  const bookingRecord = {
    bookingNumber,
    createdAt: Date.now(),
    serverCreatedAt: serverTimestamp(),
    status: "Pending", // Pending, Confirmed, Completed, Cancelled
    ...bookingData
  };

  try {
    const docRef = await addDoc(collection(db, "auto_bookings"), bookingRecord);
    return { success: true, bookingId: docRef.id, bookingNumber };
  } catch (e) {
    console.warn("Auto booking offline fallback:", e.message);
    return { success: true, bookingId: "offline_" + bookingNumber, bookingNumber, isOffline: true };
  }
}

// ==========================================
// CONTACT / ENQUIRY SUBMISSION
// ==========================================
export async function submitEnquiry(enquiryData) {
  try {
    await addDoc(collection(db, "enquiries"), {
      ...enquiryData,
      createdAt: Date.now(),
      serverCreatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Enquiry submission error:", e);
    return { success: false, error: e.message };
  }
}

// ==========================================
// REVIEW SUBMISSION
// ==========================================
export async function submitReview(reviewData) {
  try {
    await addDoc(collection(db, "reviews"), {
      ...reviewData,
      createdAt: Date.now(),
      serverCreatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (e) {
    console.error("Review submission error:", e);
    return { success: false, error: e.message };
  }
}

// ==========================================
// WHATSAPP URL GENERATORS
// ==========================================
export function getWhatsAppOrderUrl(order) {
  const settings = getCachedSettings();
  const phone = (settings.whatsappNumber || "919616932589").replace(/\D/g, "");

  let msg = `🛍️ *NEW ORDER - AYUSH SERVICE CENTER*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🧾 *Order ID:* #${order.orderNumber}\n`;
  msg += `👤 *Customer:* ${order.customerName}\n`;
  msg += `📞 *Phone:* ${order.customerPhone}\n`;
  msg += `📍 *Delivery/Pickup:* ${order.fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}\n`;
  if (order.deliveryAddress) {
    msg += `🏠 *Address:* ${order.deliveryAddress}\n`;
  }
  msg += `💳 *Payment:* ${order.paymentMethod}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 *ITEMS ORDERED:*\n`;

  (order.items || []).forEach((item, idx) => {
    msg += `${idx + 1}. ${item.name} x ${item.quantity} ${item.unit || 'pcs'} - ₹${item.price * item.quantity}\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *Subtotal:* ₹${order.subtotal}\n`;
  if (order.discountAmount) {
    msg += `🏷️ *Discount:* -₹${order.discountAmount}\n`;
  }
  if (order.deliveryFee) {
    msg += `🚚 *Delivery Fee:* ₹${order.deliveryFee}\n`;
  }
  msg += `⭐ *TOTAL AMOUNT:* ₹${order.grandTotal}\n`;
  if (order.orderNotes) {
    msg += `📝 *Notes:* ${order.orderNotes}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Please confirm my order and share invoice details. Thank you!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function getWhatsAppAutoBookingUrl(booking) {
  const settings = getCachedSettings();
  const phone = (settings.whatsappNumber || "919616932589").replace(/\D/g, "");

  let msg = `🚗 *AUTO BOOKING REQUEST - AYUSH SERVICE CENTER*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔖 *Booking No:* #${booking.bookingNumber}\n`;
  msg += `👤 *Customer Name:* ${booking.customerName}\n`;
  msg += `📞 *Contact Phone:* ${booking.customerPhone}\n`;
  msg += `📍 *Pickup Point:* ${booking.pickupLocation}\n`;
  msg += `🏁 *Destination:* ${booking.destination}\n`;
  msg += `📅 *Date:* ${booking.date}\n`;
  msg += `⏰ *Time:* ${booking.time}\n`;
  msg += `👥 *Passengers:* ${booking.passengers || '1'}\n`;
  msg += `🛺 *Vehicle:* ${booking.vehicleType || 'Passenger Auto'}\n`;
  if (booking.notes) {
    msg += `📝 *Special Note:* ${booking.notes}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Please confirm availability and fare estimate. Thank you!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function getWhatsAppProductInquiryUrl(product) {
  const settings = getCachedSettings();
  const phone = (settings.whatsappNumber || "919616932589").replace(/\D/g, "");
  
  let msg = `Hello Ayush Service Center,\nI am interested in buying: *${product.name}* (Price: ₹${product.price}).\nIs this available in stock?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ==========================================
// 1-CLICK DATABASE SEEDING UTILITY (FOR ADMIN)
// ==========================================
export async function seedInitialDatabase() {
  try {
    let currentBatch = writeBatch(db);
    let count = 0;

    const commitIfNeeded = async () => {
      count++;
      if (count >= 400) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        count = 0;
      }
    };

    // 1. Store settings
    const settingsRef = doc(db, "store_settings", "general");
    currentBatch.set(settingsRef, {
      ...INITIAL_STORE_SETTINGS,
      updatedAt: serverTimestamp()
    });
    await commitIfNeeded();

    // 2. Categories
    for (const cat of INITIAL_CATEGORIES) {
      const catRef = doc(db, "categories", cat.id);
      currentBatch.set(catRef, { ...cat, updatedAt: serverTimestamp() });
      await commitIfNeeded();
    }

    // 3. Products
    for (const prod of INITIAL_PRODUCTS) {
      const prodRef = doc(db, "products", prod.id);
      currentBatch.set(prodRef, { ...prod, updatedAt: serverTimestamp() });
      await commitIfNeeded();
    }

    // 4. Banners
    for (const ban of INITIAL_BANNERS) {
      const banRef = doc(db, "banners", ban.id);
      currentBatch.set(banRef, { ...ban, updatedAt: serverTimestamp() });
      await commitIfNeeded();
    }

    // 5. Offers
    for (const off of INITIAL_OFFERS) {
      const offRef = doc(db, "offers", off.id);
      currentBatch.set(offRef, { ...off, updatedAt: serverTimestamp() });
      await commitIfNeeded();
    }

    // 6. Reviews
    for (const rev of INITIAL_REVIEWS) {
      const revRef = doc(db, "reviews", rev.id);
      currentBatch.set(revRef, { ...rev, createdAt: Date.now() });
      await commitIfNeeded();
    }

    if (count > 0) {
      await currentBatch.commit();
    }

    showToast("🎉 Store database successfully initialized with all 190+ products, categories & settings!", "success", 5000);
    return { success: true };
  } catch (e) {
    console.error("Seeding error:", e);
    showToast("Database seed error: " + e.message, "error", 5000);
    return { success: false, error: e.message };
  }
}

