// Catalog Logic for Shop, Categories, Product Details & Offers Pages
import { 
  fetchProducts, 
  fetchProductById, 
  fetchCategories, 
  fetchOffers, 
  addToCart, 
  showToast,
  getWhatsAppProductInquiryUrl,
  getCachedSettings 
} from "./store.js";

// Helper to render standard product card HTML
export function renderProductCard(p) {
  const imgUrl = p.image || (p.images && p.images[0]) || "images/poster.jpg";
  const discount = p.mrp && p.mrp > p.price 
    ? Math.round(((p.mrp - p.price) / p.mrp) * 100) 
    : 0;

  const isOutOfStock = p.stock === 0 || p.stock === "Out of Stock";
  const whatsappUrl = getWhatsAppProductInquiryUrl(p);

  return `
    <div class="product-card" data-id="${p.id}">
      <div class="product-image-container" onclick="window.location.href='product.html?id=${p.id}'" style="cursor: pointer;">
        <img src="${imgUrl}" alt="${p.name}" class="product-image" loading="lazy">
        <div class="product-badges">
          ${discount > 0 ? `<span class="badge-discount">${discount}% OFF</span>` : ""}
          ${p.isFeatured ? `<span class="badge-featured">Featured</span>` : ""}
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-category">${p.category}</div>
        <a href="product.html?id=${p.id}" class="product-title" title="${p.name}">${p.name}</a>
        
        <div class="product-rating">
          <span>★</span> <span>${p.rating || '4.8'}</span>
          <span style="color: #94A3B8; font-weight: normal;">(${p.reviewsCount || '15'})</span>
        </div>

        <div class="product-price-row">
          <div class="product-price">₹${p.price}</div>
          ${p.mrp ? `<div class="product-mrp">₹${p.mrp}</div>` : ""}
          <div style="font-size: 0.75rem; color: #64748B; margin-left: auto;">/ ${p.unit || 'pc'}</div>
        </div>

        <div class="product-actions">
          ${isOutOfStock ? `
            <button class="btn btn-sm btn-outline" disabled style="opacity: 0.6; cursor: not-allowed; width: 100%;">
              Out of Stock
            </button>
          ` : `
            <button class="btn-add-cart" onclick="window.addCatalogItemToCart('${p.id}')">
              🛒 Add to Cart
            </button>
            <a href="${whatsappUrl}" target="_blank" class="btn-whatsapp-order">
              💬 Order on WhatsApp
            </a>
          `}
        </div>
      </div>
    </div>
  `;
}

// Global cart action from card
window.addCatalogItemToCart = async (productId) => {
  const product = await fetchProductById(productId);
  if (product) {
    addToCart(product, 1);
  }
};

// ==========================================
// SHOP PAGE INITIALIZER
// ==========================================
export async function initShopPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get("category") || "all";
  const initialSearch = urlParams.get("search") || "";
  const initialSort = urlParams.get("sort") || "featured";

  const gridContainer = document.getElementById("shop-products-grid");
  const countDisplay = document.getElementById("shop-products-count");
  const categoryChipsContainer = document.getElementById("category-chips-wrapper");
  const searchInput = document.getElementById("shop-search-input");
  const sortSelect = document.getElementById("shop-sort-select");

  if (!gridContainer) return;

  // Load and render category filter chips
  const categories = await fetchCategories();
  if (categoryChipsContainer) {
    let chipsHtml = `
      <button class="btn btn-sm ${initialCategory === 'all' ? 'btn-primary' : 'btn-outline'} cat-filter-btn" data-category="all">
        All Items
      </button>
    `;
    categories.forEach(cat => {
      const activeClass = (initialCategory.toLowerCase() === cat.name.toLowerCase() || initialCategory.toLowerCase() === cat.slug.toLowerCase()) 
        ? "btn-primary" 
        : "btn-outline";
      chipsHtml += `
        <button class="btn btn-sm ${activeClass} cat-filter-btn" data-category="${cat.name}">
          ${cat.name}
        </button>
      `;
    });
    categoryChipsContainer.innerHTML = chipsHtml;
  }

  // Pre-fill search if provided in URL
  if (searchInput && initialSearch) {
    searchInput.value = initialSearch;
  }

  // Pre-select sort
  if (sortSelect && initialSort) {
    sortSelect.value = initialSort;
  }

  let currentCategory = initialCategory;
  let currentSearch = initialSearch;
  let currentSort = initialSort;

  async function loadAndRender() {
    gridContainer.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 0; color: #64748B;">
        <div style="font-size: 2rem; margin-bottom: 8px;">⏳</div>
        <div>Loading genuine catalog items...</div>
      </div>
    `;

    const products = await fetchProducts({
      category: currentCategory,
      search: currentSearch,
      sortBy: currentSort
    });

    if (countDisplay) {
      countDisplay.textContent = `Showing ${products.length} product${products.length === 1 ? '' : 's'}`;
    }

    if (products.length === 0) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 16px; border: 1px dashed #CBD5E1;">
          <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: #0F172A; margin-bottom: 8px;">No products found</h3>
          <p style="color: #64748B; font-size: 0.95rem; margin-bottom: 20px;">Try adjusting your search terms or selecting a different category.</p>
          <button class="btn btn-primary btn-sm" id="reset-filters-btn">View All Products</button>
        </div>
      `;
      const resetBtn = document.getElementById("reset-filters-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          currentCategory = "all";
          currentSearch = "";
          if (searchInput) searchInput.value = "";
          document.querySelectorAll(".cat-filter-btn").forEach(btn => {
            btn.className = btn.dataset.category === "all" ? "btn btn-sm btn-primary cat-filter-btn" : "btn btn-sm btn-outline cat-filter-btn";
          });
          loadAndRender();
        });
      }
      return;
    }

    gridContainer.innerHTML = products.map(renderProductCard).join("");
  }

  // Category chip clicks
  if (categoryChipsContainer) {
    categoryChipsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".cat-filter-btn");
      if (!btn) return;
      document.querySelectorAll(".cat-filter-btn").forEach(b => {
        b.className = "btn btn-sm btn-outline cat-filter-btn";
      });
      btn.className = "btn btn-sm btn-primary cat-filter-btn";
      currentCategory = btn.dataset.category;
      loadAndRender();
    });
  }

  // Search input live filtering
  if (searchInput) {
    let timer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        currentSearch = e.target.value.trim();
        loadAndRender();
      }, 300);
    });
  }

  // Sort changes
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSort = e.target.value;
      loadAndRender();
    });
  }

  // Initial load
  loadAndRender();
}

// ==========================================
// CATEGORIES OVERVIEW PAGE INITIALIZER
// ==========================================
export async function initCategoriesPage() {
  const container = document.getElementById("all-categories-grid");
  if (!container) return;

  const categories = await fetchCategories();
  const allProducts = await fetchProducts();

  let html = "";
  categories.forEach(cat => {
    const count = allProducts.filter(p => 
      (p.category && p.category.toLowerCase() === cat.name.toLowerCase()) ||
      (p.categorySlug && p.categorySlug.toLowerCase() === cat.slug.toLowerCase())
    ).length;

    html += `
      <div class="category-card-premium" onclick="window.location.href='shop.html?category=${encodeURIComponent(cat.name)}'" style="cursor: pointer;">
        <div class="category-card-img-wrapper">
          <img src="${cat.image || 'images/poster.jpg'}" alt="${cat.name}" loading="lazy" onerror="this.onerror=null; this.src='images/poster.jpg';">
          <div style="position: absolute; top: 12px; right: 12px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); color: #FFF; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 9999px;">
            ${count} Items
          </div>
        </div>
        <div class="category-card-body-premium">
          <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 0;">${cat.name}</h3>
            ${cat.nameHindi ? `<span style="font-size: 0.9rem; color: #2563EB; font-weight: 700;">${cat.nameHindi}</span>` : ""}
          </div>
          <p style="font-size: 0.88rem; color: #64748B; margin: 6px 0 16px; line-height: 1.5; flex: 1;">
            ${cat.description || 'Quality retail and wholesale items available at best local rates.'}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid #F1F5F9;">
            <span style="font-size: 0.82rem; font-weight: 700; color: #16A34A; background: #DCFCE7; padding: 3px 8px; border-radius: 6px;">
              ✓ In Stock
            </span>
            <span style="font-size: 0.9rem; font-weight: 700; color: #2563EB; display: flex; align-items: center; gap: 4px;">
              Explore Category →
            </span>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==========================================
// PRODUCT DETAILS PAGE INITIALIZER
// ==========================================
export async function initProductDetailsPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");

  const container = document.getElementById("product-detail-container");
  if (!container) return;

  if (!productId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 0;">
        <h2>Product Not Found</h2>
        <p>No product ID was specified.</p>
        <a href="shop.html" class="btn btn-primary" style="margin-top: 16px;">Browse All Products</a>
      </div>
    `;
    return;
  }

  const product = await fetchProductById(productId);
  if (!product) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 0;">
        <h2>Product Not Found</h2>
        <p>The product you are looking for may have been archived or removed.</p>
        <a href="shop.html" class="btn btn-primary" style="margin-top: 16px;">Back to Shop</a>
      </div>
    `;
    return;
  }

  // Update Page Title
  document.title = `${product.name} - Ayush Service Center`;

  const imgUrl = product.image || (product.images && product.images[0]) || "images/poster.jpg";
  const discount = product.mrp && product.mrp > product.price 
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100) 
    : 0;

  const savings = product.mrp ? Math.max(0, product.mrp - product.price) : 0;
  const whatsappUrl = getWhatsAppProductInquiryUrl(product);

  container.innerHTML = `
    <!-- Breadcrumb -->
    <nav style="font-size: 0.85rem; color: #64748B; margin-bottom: 24px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <a href="index.html" style="color: #2563EB;">Home</a> <span>/</span>
      <a href="shop.html" style="color: #2563EB;">Shop</a> <span>/</span>
      <a href="shop.html?category=${encodeURIComponent(product.category)}" style="color: #2563EB;">${product.category}</a> <span>/</span>
      <span style="color: #0F172A; font-weight: 600;">${product.name}</span>
    </nav>

    <div style="display: grid; grid-template-columns: 1fr; gap: 36px;" class="product-details-grid">
      <!-- Image Gallery -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; padding: 24px; text-align: center;">
        <div style="aspect-ratio: 1 / 1; max-height: 440px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; border-radius: 12px; background: #F8FAFC;">
          <img src="${imgUrl}" alt="${product.name}" id="main-product-img" style="max-height: 100%; max-width: 100%; object-fit: contain;">
        </div>
        ${product.images && product.images.length > 1 ? `
          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            ${product.images.map((img, idx) => `
              <img src="${img}" onclick="document.getElementById('main-product-img').src='${img}'" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid ${idx === 0 ? '#2563EB' : '#E2E8F0'}; cursor: pointer;">
            `).join("")}
          </div>
        ` : ""}
      </div>

      <!-- Info & Purchase -->
      <div style="display: flex; flex-direction: column;">
        <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
          <span class="badge badge-primary">${product.category}</span>
          ${discount > 0 ? `<span class="badge badge-danger">${discount}% DISCOUNT</span>` : ""}
          <span class="badge badge-success">Verified Genuine Stock</span>
        </div>

        <h1 style="font-size: 1.85rem; font-weight: 800; color: #0F172A; margin-bottom: 6px; line-height: 1.25;">
          ${product.name}
        </h1>
        ${product.nameHindi ? `<div style="font-size: 1.05rem; color: #64748B; font-weight: 500; margin-bottom: 16px;">${product.nameHindi}</div>` : ""}

        <div style="display: flex; align-items: baseline; gap: 14px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #E2E8F0;">
          <span style="font-size: 2.2rem; font-weight: 800; color: #2563EB;">₹${product.price}</span>
          ${product.mrp ? `<span style="font-size: 1.3rem; color: #94A3B8; text-decoration: line-through;">₹${product.mrp}</span>` : ""}
          ${savings > 0 ? `<span class="badge badge-success" style="font-size: 0.85rem;">You Save ₹${savings}</span>` : ""}
          <span style="font-size: 0.9rem; color: #64748B; margin-left: auto;">(Inclusive of all taxes)</span>
        </div>

        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: #0F172A; margin-bottom: 8px;">Product Overview:</h4>
          <p style="font-size: 0.95rem; color: #334155; line-height: 1.6;">${product.description || "High-quality genuine product available at Ayush Service Center, Tarajeevanpur Chauraha, Chandauli."}</p>
        </div>

        <!-- Specifications Table -->
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 0.88rem;">
            <div><strong style="color: #64748B;">SKU Code:</strong> <span style="color: #0F172A; font-weight: 600;">${product.sku || 'ASC-GEN'}</span></div>
            <div><strong style="color: #64748B;">Unit:</strong> <span style="color: #0F172A; font-weight: 600;">${product.unit || 'Piece'}</span></div>
            <div><strong style="color: #64748B;">Stock Status:</strong> <span style="color: #16A34A; font-weight: 600;">Available in Store</span></div>
            <div><strong style="color: #64748B;">Store Location:</strong> <span style="color: #0F172A; font-weight: 600;">Tarajeevanpur Chauraha</span></div>
          </div>
        </div>

        <!-- Quantity & Purchase Action Buttons -->
        <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden; background: #FFFFFF;">
            <button type="button" id="qty-dec-btn" style="width: 44px; height: 44px; background: none; border: none; font-size: 20px; cursor: pointer; color: #0F172A;">−</button>
            <input type="number" id="detail-qty-input" value="1" min="1" max="50" style="width: 50px; text-align: center; border: none; font-size: 1.05rem; font-weight: 700;">
            <button type="button" id="qty-inc-btn" style="width: 44px; height: 44px; background: none; border: none; font-size: 20px; cursor: pointer; color: #0F172A;">+</button>
          </div>

          <button type="button" class="btn btn-primary btn-lg" id="detail-add-cart-btn" style="flex: 1; min-width: 200px;">
            🛒 Add to Cart
          </button>
          
          <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp btn-lg" style="flex: 1; min-width: 200px;">
            💬 Order on WhatsApp
          </a>
        </div>

        <!-- Trust Badges Strip -->
        <div style="display: flex; gap: 16px; font-size: 0.82rem; color: #64748B; padding-top: 16px; border-top: 1px solid #E2E8F0;">
          <div style="display: flex; align-items: center; gap: 6px;">🛡️ 100% Genuine Quality</div>
          <div style="display: flex; align-items: center; gap: 6px;">🏪 25+ Years Store Trust</div>
          <div style="display: flex; align-items: center; gap: 6px;">⚡ Fast Local Delivery / Pickup</div>
        </div>
      </div>
    </div>

    <!-- Related Products -->
    <div style="margin-top: 64px;">
      <h2 style="font-size: 1.45rem; font-weight: 800; color: #0F172A; margin-bottom: 24px;">Similar Products in ${product.category}</h2>
      <div class="product-grid" id="related-products-grid"></div>
    </div>
  `;

  // Quantity button logic
  const qtyInput = document.getElementById("detail-qty-input");
  document.getElementById("qty-dec-btn").addEventListener("click", () => {
    const val = parseInt(qtyInput.value) || 1;
    if (val > 1) qtyInput.value = val - 1;
  });
  document.getElementById("qty-inc-btn").addEventListener("click", () => {
    const val = parseInt(qtyInput.value) || 1;
    qtyInput.value = val + 1;
  });

  // Add to cart trigger
  document.getElementById("detail-add-cart-btn").addEventListener("click", () => {
    const qty = parseInt(qtyInput.value) || 1;
    addToCart(product, qty);
  });

  // Load related products
  const relatedProducts = await fetchProducts({ category: product.category });
  const filteredRelated = relatedProducts.filter(p => p.id !== product.id).slice(0, 4);
  const relatedGrid = document.getElementById("related-products-grid");
  if (relatedGrid && filteredRelated.length > 0) {
    relatedGrid.innerHTML = filteredRelated.map(renderProductCard).join("");
  }
}

// ==========================================
// OFFERS & COUPONS PAGE INITIALIZER
// ==========================================
export async function initOffersPage() {
  const container = document.getElementById("offers-list-container");
  if (!container) return;

  const offers = await fetchOffers();
  let html = "";

  offers.forEach(o => {
    html += `
      <div style="background: #FFFFFF; border: 2px dashed #2563EB; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span class="badge badge-primary" style="font-size: 0.8rem; padding: 4px 10px;">PROMO CODE</span>
          <span style="font-size: 0.82rem; color: #16A34A; font-weight: 700;">● Active Offer</span>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">${o.title}</h3>
        <p style="font-size: 0.92rem; color: #475569; margin-bottom: 18px; line-height: 1.5;">${o.description}</p>
        
        <div style="background: #F1F5F9; border-radius: 10px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="font-family: monospace; font-size: 1.25rem; font-weight: 800; color: #2563EB; letter-spacing: 1.5px;">${o.code}</div>
          <button class="btn btn-sm btn-primary copy-code-btn" data-code="${o.code}">Copy Code</button>
        </div>

        <div style="font-size: 0.8rem; color: #94A3B8;">
          Min Order: ₹${o.minOrderAmount || 0} • Valid Until: ${o.validUntil || '2026-12-31'}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll(".copy-code-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Copied ${code} to clipboard! Apply it at checkout.`, "success");
        btn.textContent = "Copied! ✓";
        setTimeout(() => btn.textContent = "Copy Code", 2500);
      });
    });
  });
}

