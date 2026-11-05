// Customer Ordering, Checkout, Tracking, Auto Booking & Invoice Generation
import { 
  getCart, 
  getCartSummary, 
  updateCartQuantity, 
  removeFromCart, 
  clearCart, 
  applyCoupon, 
  removeCoupon, 
  createOrder, 
  createAutoBooking, 
  getWhatsAppOrderUrl, 
  getWhatsAppAutoBookingUrl,
  getCachedSettings,
  fetchStoreSettings,
  showToast 
} from "./store.js";

import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "./firebase-config.js";

// ==========================================
// CUSTOMER AUTHENTICATION & MOBILE OTP SYSTEM
// ==========================================
export function getCustomerAuth() {
  try {
    const raw = localStorage.getItem("asc_customer_auth");
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (auth && auth.phone && auth.verified) return auth;
    return null;
  } catch (e) {
    return null;
  }
}

export function setCustomerAuth(phone, name = "") {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  const auth = {
    phone: cleanPhone,
    name: name.trim(),
    verified: true,
    verifiedAt: Date.now()
  };
  localStorage.setItem("asc_customer_auth", JSON.stringify(auth));
  window.dispatchEvent(new CustomEvent("asc-customer-auth-changed", { detail: auth }));
  return auth;
}

export function clearCustomerAuth() {
  localStorage.removeItem("asc_customer_auth");
  window.dispatchEvent(new CustomEvent("asc-customer-auth-changed", { detail: null }));
}

// Direct Customer Checkout (No Login / No OTP Barrier)
export function showCustomerOtpModal(options = {}) {
  // Passthrough: proceed immediately with zero modal
  if (typeof options.onSuccess === "function") {
    options.onSuccess(getCustomerAuth() || { phone: options.phone || "", verified: true });
  }
}

// ==========================================
// SHOPPING CART PAGE (cart.html)
// ==========================================
export function initCartPage() {
  const container = document.getElementById("cart-page-container");
  if (!container) return;

  function render() {
    const summary = getCartSummary();
    const customerAuth = getCustomerAuth();

    if (summary.totalItems === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; max-width: 580px; margin: 30px auto; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <div style="font-size: 3.5rem; margin-bottom: 14px;">🛒</div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: #0F172A; margin-bottom: 8px;">Your Shopping Cart is Empty</h2>
          <p style="color: #64748B; font-size: 0.95rem; margin-bottom: 24px; line-height: 1.5;">Explore our steel utensils, plasticware, mobile gadgets, cold drinks and auto bookings!</p>
          <a href="shop.html" class="btn btn-primary btn-lg" style="font-weight: 700;">🛍️ Browse Store Catalog</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="cart-grid-layout">
        <!-- Cart Items List -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="font-size: 1.3rem; font-weight: 800; color: #0F172A; margin: 0;">Cart Items (${summary.totalQty})</h2>
            <button class="btn btn-sm btn-outline" id="clear-cart-btn" style="color: #EF4444; border-color: #FCA5A5; font-weight: 600;">Clear Cart</button>
          </div>

          <div class="cart-items-wrapper">
            ${summary.items.map(item => `
              <div class="cart-item-card" data-id="${item.id}" data-variant="${item.variantKey || ''}">
                <div class="cart-item-header">
                  <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='images/poster.jpg'">
                  <div class="cart-item-details">
                    <h4 class="cart-item-title">${item.name}</h4>
                    <div class="cart-item-meta">${item.category} • ₹${item.price} / ${item.unit}</div>
                    <div class="cart-item-unit-price">₹${item.price} each</div>
                  </div>
                  <button type="button" class="cart-item-remove-btn" data-id="${item.id}" data-variant="${item.variantKey || ''}" title="Remove item">✕</button>
                </div>

                <div class="cart-item-footer">
                  <div class="cart-qty-stepper">
                    <button type="button" class="cart-qty-btn dec-btn" data-id="${item.id}" data-variant="${item.variantKey || ''}" aria-label="Decrease quantity">−</button>
                    <span class="cart-qty-value">${item.quantity}</span>
                    <button type="button" class="cart-qty-btn inc-btn" data-id="${item.id}" data-variant="${item.variantKey || ''}" aria-label="Increase quantity">+</button>
                  </div>
                  <div class="cart-item-subtotal">₹${item.price * item.quantity}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Order Summary & Coupon -->
        <div>
          <div class="order-summary-card">


            <h3 style="font-size: 1.2rem; font-weight: 800; color: #0F172A; margin: 0 0 16px;">Order Summary</h3>

            <!-- Coupon Input -->
            <div style="margin-bottom: 18px; padding-bottom: 18px; border-bottom: 1px solid #F1F5F9;">
              <label style="font-size: 0.85rem; font-weight: 600; color: #0F172A; margin-bottom: 8px; display: block;">Discount Coupon</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="cart-coupon-input" placeholder="e.g. FESTIVE10" value="${summary.coupon ? summary.coupon.code : ''}" style="flex: 1; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; text-transform: uppercase; font-weight: 700; font-size: 0.9rem;">
                <button class="btn btn-navy btn-sm" id="cart-coupon-btn" style="font-weight: 700; white-space: nowrap;">
                  ${summary.coupon ? 'Change' : 'Apply'}
                </button>
              </div>
              ${summary.coupon ? `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px; font-size: 0.82rem; color: #16A34A; font-weight: 600;">
                  <span>✓ ${summary.coupon.code} Applied</span>
                  <button type="button" id="remove-coupon-btn" style="background: none; border: none; color: #EF4444; cursor: pointer; text-decoration: underline; font-size: 0.82rem;">Remove</button>
                </div>
              ` : ''}
            </div>

            <!-- Price Breakdown -->
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; font-size: 0.92rem;">
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>Subtotal (${summary.totalQty} items)</span>
                <span style="font-weight: 700; color: #0F172A;">₹${summary.subtotal}</span>
              </div>
              ${summary.retailSavings > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #16A34A;">
                  <span>Retail MRP Savings</span>
                  <span style="font-weight: 700;">−₹${summary.retailSavings}</span>
                </div>
              ` : ''}
              ${summary.couponDiscount > 0 ? `
                <div style="display: flex; justify-content: space-between; color: #16A34A;">
                  <span>Coupon Discount</span>
                  <span style="font-weight: 700;">−₹${summary.couponDiscount}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; color: #475569;">
                <span>Estimated Local Delivery</span>
                <span>${summary.deliveryFee === 0 ? '<strong style="color: #16A34A;">FREE</strong>' : `₹${summary.deliveryFee}`}</span>
              </div>
              <div style="height: 1px; background: #E2E8F0; margin: 4px 0;"></div>
              <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800; color: #0F172A;">
                <span>Grand Total</span>
                <span style="color: #2563EB;">₹${summary.grandTotal}</span>
              </div>
            </div>

            <button type="button" id="cart-proceed-btn" class="btn btn-primary btn-lg btn-full" style="font-size: 1.05rem; font-weight: 700; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">
              Proceed to Checkout →
            </button>

            <div style="margin-top: 14px; text-align: center;">
              <a href="shop.html" style="font-size: 0.88rem; color: #2563EB; font-weight: 600;">← Continue Shopping</a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Direct proceed to checkout
    const proceedBtn = document.getElementById("cart-proceed-btn");
    if (proceedBtn) {
      proceedBtn.addEventListener("click", () => {
        window.location.href = "checkout.html";
      });
    }

    // Item Quantity Steppers
    container.querySelectorAll(".inc-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const v = btn.dataset.variant;
        const item = summary.items.find(i => i.id === id && (i.variantKey || "") === v);
        if (item) {
          updateCartQuantity(id, item.quantity + 1, v);
          render();
        }
      });
    });

    container.querySelectorAll(".dec-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const v = btn.dataset.variant;
        const item = summary.items.find(i => i.id === id && (i.variantKey || "") === v);
        if (item) {
          updateCartQuantity(id, item.quantity - 1, v);
          render();
        }
      });
    });

    container.querySelectorAll(".cart-item-remove-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        removeFromCart(btn.dataset.id, btn.dataset.variant);
        render();
      });
    });

    const clearBtn = document.getElementById("clear-cart-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to empty your cart?")) {
          clearCart();
          render();
        }
      });
    }

    const couponBtn = document.getElementById("cart-coupon-btn");
    if (couponBtn) {
      couponBtn.addEventListener("click", () => {
        const input = document.getElementById("cart-coupon-input");
        const res = applyCoupon(input.value);
        if (res.success) render();
        else showToast(res.message, "error");
      });
    }

    const removeCouponBtn = document.getElementById("remove-coupon-btn");
    if (removeCouponBtn) {
      removeCouponBtn.addEventListener("click", () => {
        removeCoupon();
        render();
      });
    }
  }

  render();
}

// ==========================================
// CHECKOUT & ORDER ENQUIRY PAGE (checkout.html)
// ==========================================
export function initCheckoutPage() {
  const container = document.getElementById("checkout-page-container");
  if (!container) return;

  const summary = getCartSummary();
  const settings = getCachedSettings();
  const storeUpiId = (settings.upiId || "9616932589@paytm").trim();
  const storePhone = (settings.whatsappNumber || "9616932589").replace(/\D/g, "");

  if (summary.totalItems === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; max-width: 580px; margin: 30px auto;">
        <div style="font-size: 3rem; margin-bottom: 12px;">💳</div>
        <h2 style="font-size: 1.4rem; font-weight: 800; color: #0F172A; margin-bottom: 8px;">Your Cart is Empty</h2>
        <p style="color: #64748B; margin-bottom: 20px;">Please add items to your cart before proceeding to checkout.</p>
        <a href="shop.html" class="btn btn-primary" style="font-weight: 700;">Return to Shop</a>
      </div>
    `;
    return;
  }

  const customerAuth = getCustomerAuth();
  const upiIntentUrl = `upi://pay?pa=${storeUpiId}&pn=Ayush%20Service%20Center&am=${summary.grandTotal}&cu=INR`;

  container.innerHTML = `
    <div class="checkout-grid-layout">
      <!-- Checkout Form -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 18px; padding: 22px; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
        


        <h2 style="font-size: 1.35rem; font-weight: 800; color: #0F172A; margin-bottom: 18px;">Customer & Delivery Details</h2>

        <form id="checkout-form">
          <div class="form-row-responsive">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="cust-name" class="form-control" placeholder="Enter your full name" required value="${customerAuth && customerAuth.name ? customerAuth.name : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Mobile Number *</label>
              <div style="display: flex; gap: 8px;">
                <span style="display: flex; align-items: center; padding: 0 12px; background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 10px; font-weight: 700; color: #0F172A;">+91</span>
                <input type="tel" id="cust-phone" class="form-control" placeholder="10-digit number (e.g. 9616932589)" maxlength="10" required value="${customerAuth ? customerAuth.phone : ''}" style="flex: 1; font-weight: 700;">
              </div>
            </div>
          </div>

          <!-- Fulfillment Choice -->
          <div class="form-group" style="margin-top: 14px;">
            <label class="form-label">Order Fulfillment Preference *</label>
            <div class="fulfillment-grid">
              <label class="fulfillment-card">
                <input type="radio" name="fulfillmentType" value="delivery" checked style="accent-color: #2563EB; width: 18px; height: 18px;">
                <div>
                  <div style="font-weight: 700; color: #0F172A; font-size: 0.95rem;">🏠 Home Delivery</div>
                  <div style="font-size: 0.75rem; color: #64748B;">Doorstep delivery in Chandauli</div>
                </div>
              </label>

              <label class="fulfillment-card">
                <input type="radio" name="fulfillmentType" value="pickup" style="accent-color: #2563EB; width: 18px; height: 18px;">
                <div>
                  <div style="font-weight: 700; color: #0F172A; font-size: 0.95rem;">🏪 Store Pickup</div>
                  <div style="font-size: 0.75rem; color: #64748B;">Tarajeevanpur Chauraha Store</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Address Fields (Hidden if Pickup) -->
          <div id="delivery-address-group">
            <div class="form-group">
              <label class="form-label">Delivery Address / Village / Locality *</label>
              <textarea id="cust-address" class="form-control" rows="2" placeholder="House / Village / Mohalla / Chauraha address" required></textarea>
            </div>

            <div class="form-row-responsive">
              <div class="form-group">
                <label class="form-label">Landmark</label>
                <input type="text" id="cust-landmark" class="form-control" placeholder="e.g. Near Budhiya Mai Mandir">
              </div>
              <div class="form-group">
                <label class="form-label">City / Pincode</label>
                <input type="text" id="cust-city" class="form-control" value="Chandauli - 232120" readonly>
              </div>
            </div>
          </div>

          <!-- Payment Method: Cash on Delivery Only -->
          <div class="form-group" style="margin-top: 18px;">
            <label class="form-label">Payment Method *</label>
            <div style="background: #F0FDF4; border: 1.5px solid #86EFAC; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
              <input type="radio" name="paymentMethod" value="Cash on Delivery" checked style="accent-color: #16A34A; width: 20px; height: 20px; cursor: pointer;">
              <div>
                <div style="font-weight: 800; color: #15803D; font-size: 1rem;">💵 Cash on Delivery (COD) / Pay at Store</div>
                <div style="font-size: 0.8rem; color: #166534; margin-top: 2px;">Delivery hone par ya counter par saaman prapt hone ke baad cash payment karein.</div>
              </div>
            </div>
          </div>

          <!-- Order Notes -->
          <div class="form-group" style="margin-top: 14px;">
            <label class="form-label">Special Delivery Note or Request (Optional)</label>
            <input type="text" id="cust-notes" class="form-control" placeholder="e.g. Call before delivery or deliver in evening">
          </div>

          <button type="submit" class="btn btn-primary btn-lg btn-full" id="submit-order-btn" style="margin-top: 22px; font-size: 1.08rem; font-weight: 700; height: 50px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);">
            Place Order via WhatsApp (₹${summary.grandTotal}) →
          </button>
        </form>
      </div>

      <!-- Order Review Sidebar -->
      <div>
        <div class="order-summary-card">
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #0F172A; margin: 0 0 16px;">Order Summary (${summary.totalQty} Items)</h3>
          
          <div style="max-height: 240px; overflow-y: auto; margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 10px;">
            ${summary.items.map(item => `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.88rem;">
                <div style="flex: 1; padding-right: 10px; min-width: 0;">
                  <div style="font-weight: 600; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</div>
                  <div style="font-size: 0.75rem; color: #64748B;">Qty: ${item.quantity} × ₹${item.price}</div>
                </div>
                <div style="font-weight: 700; color: #0F172A;">₹${item.price * item.quantity}</div>
              </div>
            `).join("")}
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; color: #475569;">
              <span>Subtotal:</span> <span style="font-weight: 600; color: #0F172A;">₹${summary.subtotal}</span>
            </div>
            ${summary.couponDiscount > 0 ? `
              <div style="display: flex; justify-content: space-between; color: #16A34A; font-weight: 600;">
                <span>Coupon Discount (${summary.coupon.code}):</span> <span>−₹${summary.couponDiscount}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; color: #475569;">
              <span>Delivery Fee:</span> <span>${summary.deliveryFee === 0 ? '<strong style="color: #16A34A;">FREE</strong>' : '₹' + summary.deliveryFee}</span>
            </div>
            <div style="height: 1px; background: #E2E8F0; margin: 4px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: 800; color: #0F172A;">
              <span>Total Payable:</span> <span style="color: #2563EB;">₹${summary.grandTotal}</span>
            </div>
          </div>

          <div style="background: #F8FAFC; border-radius: 10px; padding: 12px; font-size: 0.8rem; color: #64748B; line-height: 1.5; border: 1px solid #E2E8F0;">
            📍 <strong>Store Landmark:</strong> Budhiya Mai Mandir Ke Paas, Tarajeevanpur Chauraha, Chandauli • Call: +91 96169 32589
          </div>
        </div>
      </div>
    </div>
  `;



  // Toggle delivery address field based on fulfillment choice
  const radios = container.querySelectorAll("input[name='fulfillmentType']");
  const addressGroup = document.getElementById("delivery-address-group");
  const addressInput = document.getElementById("cust-address");

  radios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "pickup") {
        addressGroup.style.display = "none";
        addressInput.removeAttribute("required");
      } else {
        addressGroup.style.display = "block";
        addressInput.setAttribute("required", "required");
      }
    });
  });



  // Handle Checkout submission (Direct, No OTP Barrier)
  const form = document.getElementById("checkout-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const customerName = document.getElementById("cust-name").value.trim();
    const rawPhone = document.getElementById("cust-phone").value.trim().replace(/\D/g, "");
    if (rawPhone.length !== 10) {
      showToast("Kripya 10-digit ka sahi mobile number dalein", "error");
      document.getElementById("cust-phone").focus();
      return;
    }

    const submitBtn = document.getElementById("submit-order-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Placing Order & Connecting to WhatsApp...";

    const fulfillmentType = container.querySelector("input[name='fulfillmentType']:checked").value;
    const paymentMethod = "Cash on Delivery";
    const paymentStatus = "Pending (Cash on Delivery)";
    const utrNumber = "";

    setCustomerAuth(rawPhone, customerName);

    const orderPayload = {
      customerName: customerName,
      customerPhone: rawPhone,
      fulfillmentType: fulfillmentType,
      deliveryAddress: fulfillmentType === "delivery" 
        ? `${document.getElementById("cust-address").value.trim()} (Landmark: ${document.getElementById("cust-landmark").value.trim() || 'N/A'})`
        : "Store Pickup - Tarajeevanpur Chauraha",
      paymentMethod: paymentMethod,
      paymentStatus: paymentStatus,
      utrNumber: utrNumber,
      orderNotes: document.getElementById("cust-notes").value.trim(),
      items: summary.items,
      subtotal: summary.subtotal,
      couponCode: summary.coupon ? summary.coupon.code : null,
      discountAmount: summary.couponDiscount,
      deliveryFee: summary.deliveryFee,
      grandTotal: summary.grandTotal
    };

    const res = await createOrder(orderPayload);
    if (res.success) {
      const completeOrder = { ...orderPayload, orderNumber: res.orderNumber, orderId: res.orderId };
      
      // JAISE HI ORDER HO -> INSTANT WHATSAPP TO 9616932589 WITH INVOICE LINK
      const whatsappUrl = getWhatsAppOrderUrl(completeOrder);
      try {
        window.open(whatsappUrl, "_blank");
      } catch (err) {
        console.warn("Popup blocked or not supported:", err);
      }

      showOrderSuccessScreen(container, completeOrder);
    } else {
      showToast("Order creation error. Please try again.", "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Place Order via WhatsApp (₹${summary.grandTotal}) →`;
    }
  });
}

function showOrderSuccessScreen(container, order) {
  const whatsappUrl = getWhatsAppOrderUrl(order);
  const invoicePrintUrl = `invoice.html?id=${order.orderId}&print=1`;

  container.innerHTML = `
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; padding: 36px 20px; max-width: 640px; margin: 24px auto; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
      <div style="width: 72px; height: 72px; background: #DCFCE7; color: #16A34A; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 16px;">✓</div>
      
      <h1 style="font-size: 1.6rem; font-weight: 800; color: #0F172A; margin: 0 0 6px;">Order Placed Successfully!</h1>
      <p style="font-size: 0.95rem; color: #64748B; margin: 0 0 18px;">Thank you for shopping at Ayush Service Center.</p>

      <!-- Instant WhatsApp Alert Pill -->
      <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px; text-align: left; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 26px;">📲</span>
        <div style="font-size: 0.88rem; color: #065F46; line-height: 1.4;">
          <strong>Order details sent to Store WhatsApp (+91 96169 32589).</strong> Tap Send in your WhatsApp chat to confirm dispatch!
        </div>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; text-align: left; margin-bottom: 22px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
          <strong style="color: #64748B;">Order Number:</strong>
          <span style="font-weight: 800; color: #2563EB;">#${order.orderNumber}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
          <strong style="color: #64748B;">Customer:</strong>
          <span style="font-weight: 600; color: #0F172A;">${order.customerName} (+91 ${order.customerPhone})</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
          <strong style="color: #64748B;">Delivery / Pickup:</strong>
          <span style="font-weight: 600; color: #0F172A;">${order.fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</span>
        </div>
        ${order.deliveryAddress ? `
          <div style="margin-bottom: 8px; font-size: 0.85rem; color: #475569;">
            <strong style="color: #64748B;">Address:</strong> ${order.deliveryAddress}
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
          <strong style="color: #64748B;">Payment:</strong>
          <span style="font-weight: 700; color: ${order.paymentMethod.includes('Online') ? '#16A34A' : '#2563EB'};">
            ${order.paymentMethod} ${order.utrNumber ? `(UTR: ${order.utrNumber})` : ''}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 1.15rem; border-top: 1px solid #E2E8F0; padding-top: 10px; margin-top: 10px;">
          <strong style="color: #0F172A;">Total Amount:</strong>
          <span style="font-weight: 800; color: #2563EB;">₹${order.grandTotal}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp btn-lg btn-full" style="font-size: 1.02rem; font-weight: 700; margin-bottom: 12px; height: 48px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.3);">
        💬 Open WhatsApp Chat with Store (+91 96169 32589)
      </a>

      <!-- 1-Click Invoice Download / Print -->
      <a href="${invoicePrintUrl}" target="_blank" class="btn btn-primary btn-lg btn-full" style="font-size: 1rem; font-weight: 700; margin-bottom: 14px; height: 46px; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);">
        📥 Download Tax Invoice (PDF / Print)
      </a>

      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <a href="tel:+919616932589" class="btn btn-outline" style="font-weight: 600; flex: 1; min-width: 140px;">
          📞 Call Store
        </a>
        <a href="my-orders.html?phone=${encodeURIComponent(order.customerPhone)}" class="btn btn-navy" style="font-weight: 600; flex: 1; min-width: 140px;">
          📦 Track Order
        </a>
      </div>
    </div>
  `;
}

// ==========================================
// MY ORDERS TRACKING PAGE (my-orders.html)
// ==========================================
export function initMyOrdersPage() {
  const container = document.getElementById("my-orders-container");
  const searchInput = document.getElementById("order-search-input");
  const searchBtn = document.getElementById("order-search-btn");

  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const initialPhone = urlParams.get("phone") || "";
  const initialOrder = urlParams.get("order") || "";

  if (searchInput) {
    searchInput.value = initialPhone || initialOrder;
  }

  async function lookupOrders(term) {
    if (!term || term.trim().length < 3) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: #64748B;">
          Please enter your 10-digit mobile number or Order ID above to view your order history.
        </div>
      `;
      return;
    }

    container.innerHTML = `<div style="text-align: center; padding: 48px;">Searching records...</div>`;

    let matchedOrders = [];
    const cleanTerm = term.trim();

    try {
      // Query by phone
      const phoneQuery = query(collection(db, "orders"), where("customerPhone", "==", cleanTerm));
      const phoneSnap = await getDocs(phoneQuery);
      phoneSnap.forEach(d => matchedOrders.push({ id: d.id, ...d.data() }));

      // Also query by orderNumber if no matches or term starts with ASC
      if (matchedOrders.length === 0) {
        const numQuery = query(collection(db, "orders"), where("orderNumber", "==", cleanTerm.toUpperCase()));
        const numSnap = await getDocs(numQuery);
        numSnap.forEach(d => matchedOrders.push({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn("Orders remote search error:", e.message);
    }

    if (matchedOrders.length === 0) {
      container.innerHTML = `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 40px; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.2rem; font-weight: 700; color: #0F172A; margin-bottom: 6px;">No Orders Found</h3>
          <p style="color: #64748B; font-size: 0.9rem;">We couldn't find any orders matching "<strong>${cleanTerm}</strong>". Make sure the mobile number or Order ID is correct.</p>
        </div>
      `;
      return;
    }

    // Sort by latest
    matchedOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    let html = "";
    matchedOrders.forEach(ord => {
      const statusSteps = ["Pending", "Confirmed", "Preparing", "Ready for Pickup", "Completed"];
      const currentIdx = statusSteps.indexOf(ord.status);

      html += `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 16px;">
            <div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #2563EB;">Order #${ord.orderNumber}</div>
              <div style="font-size: 0.8rem; color: #64748B;">Placed on ${new Date(ord.createdAt).toLocaleDateString()} at ${new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style="text-align: right;">
              <span class="badge ${ord.status === 'Completed' ? 'badge-success' : 'badge-primary'}" style="font-size: 0.82rem; padding: 6px 12px;">
                ${ord.status}
              </span>
              <div style="font-size: 1.15rem; font-weight: 800; color: #0F172A; margin-top: 4px;">₹${ord.grandTotal}</div>
            </div>
          </div>

          <!-- Progress Timeline -->
          <div style="display: flex; justify-content: space-between; margin-bottom: 24px; position: relative;">
            <div style="position: absolute; top: 14px; left: 10px; right: 10px; height: 3px; background: #E2E8F0; z-index: 1;"></div>
            ${statusSteps.map((step, idx) => {
              const isPassed = currentIdx >= idx;
              return `
                <div style="display: flex; flex-direction: column; align-items: center; z-index: 2; width: 20%; text-align: center;">
                  <div style="width: 30px; height: 30px; border-radius: 50%; background: ${isPassed ? '#2563EB' : '#FFFFFF'}; border: 2px solid ${isPassed ? '#2563EB' : '#CBD5E1'}; color: ${isPassed ? '#FFF' : '#64748B'}; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-bottom: 6px;">
                    ${isPassed ? '✓' : idx + 1}
                  </div>
                  <span style="font-size: 0.72rem; font-weight: 600; color: ${isPassed ? '#0F172A' : '#94A3B8'}; line-height: 1.2;">${step}</span>
                </div>
              `;
            }).join("")}
          </div>

          <!-- Items list -->
          <div style="background: #F8FAFC; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
            ${(ord.items || []).map(i => `
              <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 6px;">
                <span>${i.name} × <strong>${i.quantity}</strong></span>
                <span style="font-weight: 600;">₹${i.price * i.quantity}</span>
              </div>
            `).join("")}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="font-size: 0.82rem; color: #64748B;">
              Fulfillment: <strong>${ord.fulfillmentType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
              <a href="invoice.html?id=${ord.id}" target="_blank" class="btn btn-sm btn-outline">
                🖨️ View Invoice
              </a>
              <a href="https://wa.me/919616932589?text=Hello,%20checking%20status%20for%20order%20#${ord.orderNumber}" target="_blank" class="btn btn-sm btn-whatsapp">
                💬 WhatsApp Store
              </a>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", () => lookupOrders(searchInput.value));
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") lookupOrders(searchInput.value);
    });
  }

  if (initialPhone || initialOrder) {
    lookupOrders(initialPhone || initialOrder);
  }
}

// ==========================================
// AUTO BOOKING PAGE (autobooking.html)
// ==========================================
export function initAutoBookingPage() {
  const form = document.getElementById("auto-booking-form");
  const container = document.getElementById("booking-container");
  if (!form || !container) return;

  // Set minimum date to today
  const dateInput = document.getElementById("ab-date");
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
    dateInput.value = today;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById("ab-submit-btn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting Booking...";

    const bookingPayload = {
      customerName: document.getElementById("ab-name").value.trim(),
      customerPhone: document.getElementById("ab-phone").value.trim(),
      pickupLocation: document.getElementById("ab-pickup").value.trim(),
      destination: document.getElementById("ab-destination").value.trim(),
      date: document.getElementById("ab-date").value,
      time: document.getElementById("ab-time").value,
      vehicleType: document.getElementById("ab-vehicle").value,
      passengers: document.getElementById("ab-passengers").value,
      notes: document.getElementById("ab-notes").value.trim()
    };

    const res = await createAutoBooking(bookingPayload);
    if (res.success) {
      showBookingConfirmation(container, { ...bookingPayload, bookingNumber: res.bookingNumber });
    } else {
      showToast("Booking submission error. Please contact directly on phone.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Book Auto Now";
    }
  });
}

function showBookingConfirmation(container, booking) {
  const whatsappUrl = getWhatsAppAutoBookingUrl(booking);

  container.innerHTML = `
    <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; padding: 40px 24px; max-width: 600px; margin: 30px auto; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
      <div style="font-size: 50px; margin-bottom: 12px;">🚗</div>
      <h2 style="font-size: 1.6rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">Auto Booking Request Received!</h2>
      <p style="color: #64748B; font-size: 0.95rem; margin-bottom: 24px;">Booking Reference: <strong style="color: #2563EB;">#${booking.bookingNumber}</strong></p>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; text-align: left; margin-bottom: 24px; font-size: 0.92rem; line-height: 1.6;">
        <div><strong>👤 Customer:</strong> ${booking.customerName} (${booking.customerPhone})</div>
        <div><strong>📍 Pickup:</strong> ${booking.pickupLocation}</div>
        <div><strong>🏁 Destination:</strong> ${booking.destination}</div>
        <div><strong>📅 Date & Time:</strong> ${booking.date} at ${booking.time}</div>
        <div><strong>🛺 Vehicle Type:</strong> ${booking.vehicleType} (${booking.passengers} Passengers)</div>
      </div>

      <p style="font-size: 0.9rem; color: #475569; margin-bottom: 20px;">
        Click below to send instant confirmation on WhatsApp to lock in your auto driver.
      </p>

      <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp btn-lg btn-full" style="font-size: 1.05rem; margin-bottom: 12px;">
        💬 Send Booking on WhatsApp
      </a>

      <a href="tel:+919616932589" class="btn btn-navy btn-full">
        📞 Call Driver Directly: +91 96169 32589
      </a>
    </div>
  `;
}

// ==========================================
// INVOICE & THERMAL RECEIPT (invoice.html)
// ==========================================
export async function initInvoicePage() {
  const container = document.getElementById("invoice-render-area");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("id") || urlParams.get("orderId");
  const settings = getCachedSettings();

  if (!orderId) {
    container.innerHTML = `<div style="text-align: center; padding: 40px;">No Order ID specified.</div>`;
    return;
  }

  let order = null;
  try {
    const docSnap = await getDoc(doc(db, "orders", orderId));
    if (docSnap.exists()) {
      order = { id: docSnap.id, ...docSnap.data() };
    }
  } catch (e) {
    console.warn("Remote invoice lookup failed, checking sales collection:", e.message);
  }

  if (!order) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <h2>Invoice Not Found</h2>
        <p>Could not retrieve invoice for #${orderId}</p>
        <button onclick="window.close()" class="btn btn-outline" style="margin-top: 14px;">Close Window</button>
      </div>
    `;
    return;
  }

  // Format date
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString();

  // Render A4 layout with print trigger
  container.innerHTML = `
    <div class="a4-invoice" id="printable-invoice-area">
      <!-- Header -->
      <div class="invoice-header">
        <div class="invoice-brand">
          <h2>${settings.storeName}</h2>
          <p>${settings.hindiTitle || 'आयुष सर्विस सेंटर'}</p>
          <p>${settings.address}</p>
          <p>📞 Phone: ${settings.phone} | ✉️ ${settings.email}</p>
          ${settings.enableGST && settings.gstin ? `<p><strong>GSTIN:</strong> ${settings.gstin}</p>` : ''}
        </div>
        <div class="invoice-meta">
          <div class="invoice-title">TAX / RETAIL INVOICE</div>
          <div class="invoice-meta-item"><strong>Invoice No:</strong> #${order.orderNumber || order.id}</div>
          <div class="invoice-meta-item"><strong>Date:</strong> ${dateStr}</div>
          <div class="invoice-meta-item"><strong>Payment Mode:</strong> ${order.paymentMethod || 'Cash'}</div>
        </div>
      </div>

      <!-- Bill To -->
      <div class="invoice-bill-to">
        <div style="font-weight: 700; color: #0F172A; margin-bottom: 4px;">Billed To:</div>
        <div style="font-size: 15px; font-weight: 600; color: #2563EB;">${order.customerName || 'Walk-in Customer'}</div>
        <div style="font-size: 13px; color: #475569;">📞 ${order.customerPhone || 'N/A'}</div>
        ${order.deliveryAddress ? `<div style="font-size: 13px; color: #475569;">📍 ${order.deliveryAddress}</div>` : ''}
      </div>

      <!-- Itemized Table -->
      <table class="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate (₹)</th>
            <th style="text-align: right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${(order.items || []).map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${item.name}</strong> ${item.unit ? `(${item.unit})` : ''}</td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${item.price}</td>
              <td style="text-align: right;"><strong>${item.price * item.quantity}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- Summary -->
      <div class="invoice-summary-box">
        <table class="summary-table">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right; font-weight: 600;">₹${order.subtotal}</td>
          </tr>
          ${order.discountAmount ? `
            <tr>
              <td style="color: #16A34A;">Discount:</td>
              <td style="text-align: right; color: #16A34A; font-weight: 600;">−₹${order.discountAmount}</td>
            </tr>
          ` : ''}
          ${order.deliveryFee ? `
            <tr>
              <td>Delivery Fee:</td>
              <td style="text-align: right; font-weight: 600;">₹${order.deliveryFee}</td>
            </tr>
          ` : ''}
          <tr class="total-row">
            <td>Grand Total:</td>
            <td style="text-align: right;">₹${order.grandTotal}</td>
          </tr>
        </table>
      </div>

      <!-- Footer Sign & Terms -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #E2E8F0; padding-top: 24px; font-size: 12px; color: #64748B;">
        <div>
          <p style="margin: 0 0 4px;"><strong>Terms & Conditions:</strong></p>
          <p style="margin: 0;">1. Goods once sold can be exchanged within 3 days with bill.</p>
          <p style="margin: 0;">2. Subject to Chandauli jurisdiction.</p>
          <p style="margin: 4px 0 0;">✨ <em>Thank you for shopping with Ayush Service Center!</em></p>
        </div>
        <div style="text-align: center;">
          <div style="height: 48px;"></div>
          <div style="border-top: 1px solid #0F172A; padding-top: 4px; font-weight: 700; color: #0F172A;">
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  `;
}

