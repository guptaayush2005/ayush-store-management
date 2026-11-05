// Public Website Application Logic: Header, Navigation, Cart Badges, Search & Quick View
import { 
  getCartSummary, 
  addToCart, 
  fetchProducts, 
  fetchProductById, 
  getCachedSettings, 
  fetchStoreSettings,
  getWhatsAppProductInquiryUrl 
} from "./store.js";

// Initialize UI elements across all public pages
document.addEventListener("DOMContentLoaded", async () => {
  initHeader();
  initCartBadges();
  initSearchAutocomplete();
  initMobileDrawer();
  initQuickViewModal();

  // Load fresh store settings in background if available
  fetchStoreSettings().then(settings => {
    updateDynamicBusinessElements(settings);
  });
});

// Update cart counter badges
export function initCartBadges() {
  const updateBadges = (summary) => {
    const badges = document.querySelectorAll(".cart-count-badge");
    badges.forEach(badge => {
      badge.textContent = summary.totalQty;
      badge.style.display = summary.totalQty > 0 ? "flex" : "none";
    });
  };

  // Initial update
  updateBadges(getCartSummary());

  // Listen to store events
  window.addEventListener("asc-cart-updated", (e) => {
    updateBadges(e.detail);
  });
}

// Mobile Slide-over Drawer
function initMobileDrawer() {
  const menuBtn = document.getElementById("mobile-menu-toggle");
  const drawer = document.getElementById("mobile-drawer");
  const backdrop = document.getElementById("mobile-drawer-backdrop");
  const closeBtn = document.getElementById("drawer-close-btn");

  if (!menuBtn || !drawer || !backdrop) return;

  const openDrawer = () => {
    drawer.classList.add("active");
    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  const closeDrawer = () => {
    drawer.classList.remove("active");
    backdrop.classList.remove("active");
    document.body.style.overflow = "";
  };

  menuBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
}

// Search with Real-Time Autocomplete Dropdown
function initSearchAutocomplete() {
  const searchInput = document.getElementById("header-search-input");
  const searchDropdown = document.getElementById("header-search-dropdown");
  const searchForm = document.getElementById("header-search-form");

  if (!searchInput || !searchDropdown) return;

  let debounceTimer;

  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      searchDropdown.style.display = "none";
      searchDropdown.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      const results = await fetchProducts({ search: query });
      renderSearchSuggestions(results.slice(0, 6), searchDropdown);
    }, 250);
  });

  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();
      if (query) {
        window.location.href = `shop.html?search=${encodeURIComponent(query)}`;
      }
    });
  }

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.style.display = "none";
    }
  });
}

function renderSearchSuggestions(products, dropdown) {
  if (!products || products.length === 0) {
    dropdown.innerHTML = `<div style="padding: 14px; text-align: center; color: #64748B; font-size: 0.85rem;">No products found matching your search.</div>`;
    dropdown.style.display = "block";
    return;
  }

  let html = "";
  products.forEach(p => {
    const imgUrl = p.image || (p.images && p.images[0]) || "images/poster.jpg";
    html += `
      <div class="search-suggestion-item" onclick="window.location.href='product.html?id=${p.id}'">
        <img src="${imgUrl}" alt="${p.name}">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 0.88rem; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
          <div style="font-size: 0.75rem; color: #64748B;">${p.category} • <strong style="color: #2563EB;">₹${p.price}</strong></div>
        </div>
      </div>
    `;
  });

  dropdown.innerHTML = html;
  dropdown.style.display = "block";
}

// Quick View Modal
function initQuickViewModal() {
  let modalBackdrop = document.getElementById("quick-view-modal");
  if (!modalBackdrop) {
    modalBackdrop = document.createElement("div");
    modalBackdrop.id = "quick-view-modal";
    modalBackdrop.className = "admin-modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="admin-modal" style="max-width: 680px;">
        <div class="admin-modal-header">
          <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0;" id="qv-title">Product Details</h3>
          <button type="button" id="qv-close-btn" style="background: none; border: none; font-size: 22px; cursor: pointer; color: #64748B;">✕</button>
        </div>
        <div class="admin-modal-body" id="qv-body" style="padding: 20px;">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;
    document.body.appendChild(modalBackdrop);

    document.getElementById("qv-close-btn").addEventListener("click", () => {
      modalBackdrop.classList.remove("active");
    });
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) modalBackdrop.classList.remove("active");
    });
  }

  // Global trigger
  window.openQuickView = async (productId) => {
    const product = await fetchProductById(productId);
    if (!product) return;

    const qvBody = document.getElementById("qv-body");
    const qvTitle = document.getElementById("qv-title");
    qvTitle.textContent = product.name;

    const imgUrl = product.image || (product.images && product.images[0]) || "images/poster.jpg";
    const discount = product.mrp && product.mrp > product.price 
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100) 
      : 0;

    const whatsappUrl = getWhatsAppProductInquiryUrl(product);

    qvBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr; gap: 20px;" class="qv-grid">
        <div style="background: #F1F5F9; border-radius: 12px; overflow: hidden; max-height: 280px; display: flex; align-items: center; justify-content: center;">
          <img src="${imgUrl}" alt="${product.name}" style="max-height: 280px; width: 100%; object-fit: contain;">
        </div>
        <div>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <span class="badge badge-primary">${product.category}</span>
            ${discount > 0 ? `<span class="badge badge-danger">${discount}% OFF</span>` : ""}
            <span class="badge badge-success">In Stock</span>
          </div>
          <h2 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">${product.name}</h2>
          ${product.nameHindi ? `<p style="font-size: 0.88rem; color: #64748B; margin-bottom: 12px;">${product.nameHindi}</p>` : ""}
          
          <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px;">
            <span style="font-size: 1.6rem; font-weight: 800; color: #2563EB;">₹${product.price}</span>
            ${product.mrp ? `<span style="font-size: 1.1rem; color: #94A3B8; text-decoration: line-through;">₹${product.mrp}</span>` : ""}
            <span style="font-size: 0.85rem; color: #64748B;">/ ${product.unit || 'piece'}</span>
          </div>

          <p style="font-size: 0.9rem; color: #334155; line-height: 1.5; margin-bottom: 18px;">${product.description || ""}</p>
          
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button type="button" class="btn btn-primary" id="qv-add-cart-btn" style="flex: 1;">
              🛒 Add to Cart
            </button>
            <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp" style="flex: 1;">
              💬 Order on WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;

    document.getElementById("qv-add-cart-btn").addEventListener("click", () => {
      addToCart(product, 1);
      modalBackdrop.classList.remove("active");
    });

    modalBackdrop.classList.add("active");
  };
}

// Background updater for dynamic store details
function updateDynamicBusinessElements(settings) {
  const storeNames = document.querySelectorAll(".dynamic-store-name");
  storeNames.forEach(el => el.textContent = settings.storeName);

  const phoneLinks = document.querySelectorAll(".dynamic-phone-link");
  phoneLinks.forEach(el => {
    el.href = `tel:${settings.phone}`;
    el.textContent = settings.phone;
  });

  const waLinks = document.querySelectorAll(".dynamic-wa-link");
  waLinks.forEach(el => {
    el.href = `https://wa.me/${(settings.whatsappNumber || "919616932589").replace(/\D/g, "")}`;
  });
}

function initHeader() {
  // Mobile search toggle if needed
}

