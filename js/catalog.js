// Catalog Logic for Shop, Categories, Product Details & Offers Pages
import { 
  fetchProducts, 
  fetchProductById, 
  fetchCategories, 
  fetchOffers, 
  addToCart, 
  showToast,
  getWhatsAppProductInquiryUrl,
  getCachedSettings,
  normalizeCategory
} from "./store.js";

// Helper to render standard product card HTML (Inspired by SG Stores clean retail presentation)
export function renderProductCard(p) {
  const cat = (p.category || "").toLowerCase();
  let defaultFallback = "images/poster.jpg";
  if (cat.includes("steel")) defaultFallback = "images/1bartan.jpg";
  else if (cat.includes("plastic")) defaultFallback = "images/1plastic.jpg";
  else if (cat.includes("mobile")) defaultFallback = "images/1mobile.jpg";
  else if (cat.includes("cold")) defaultFallback = "images/1colddrink.jpg";
  else if (cat.includes("cosmetic")) defaultFallback = "images/facewash.jpg";
  else if (cat.includes("dona")) defaultFallback = "images/1dona-pattal.jpg";
  else if (cat.includes("gas")) defaultFallback = "images/1gas.jpg";
  else if (cat.includes("auto")) defaultFallback = "images/1autobooking.jpg";

  const imgUrl = p.image || (p.images && p.images[0]) || defaultFallback;
  const discount = p.mrp && p.mrp > p.price 
    ? Math.round(((p.mrp - p.price) / p.mrp) * 100) 
    : 0;
  const savings = p.mrp && p.mrp > p.price ? (p.mrp - p.price) : 0;

  const isOutOfStock = p.stock === 0 || p.stock === "Out of Stock";
  const whatsappUrl = getWhatsAppProductInquiryUrl(p);

  return `
    <div class="product-card sg-product-card" data-id="${p.id}">
      <div class="product-image-container" onclick="window.location.href='product.html?id=${p.id}'" style="cursor: pointer;">
        <img src="${imgUrl}" alt="${p.name}" class="product-image" loading="lazy" onerror="this.onerror=null; this.src='${defaultFallback}';">
        <div class="product-badges">
          ${discount > 0 ? `<span class="badge-discount">${discount}% OFF</span>` : ""}
          ${p.isFeatured ? `<span class="badge-featured">Bestseller</span>` : ""}
        </div>
        <span class="product-stock-tag ${isOutOfStock ? 'out-of-stock' : 'in-stock'}">
          <span class="stock-dot"></span> ${isOutOfStock ? 'Unavailable' : 'In Stock'}
        </span>
      </div>
      <div class="product-card-body">
        <div class="product-category">${p.category}</div>
        <a href="product.html?id=${p.id}" class="product-title" title="${p.name}">${p.name}</a>
        ${p.nameHindi ? `<div class="product-hindi-name">${p.nameHindi}</div>` : ""}
        
        <div class="product-rating">
          <span>★</span> <span>${p.rating || '4.8'}</span>
          <span style="color: #94A3B8; font-weight: normal;">(${p.reviewsCount || '15'})</span>
        </div>

        <div class="product-price-row">
          <div class="product-price">₹${p.price}</div>
          ${p.mrp && p.mrp > p.price ? `<div class="product-mrp">₹${p.mrp}</div>` : ""}
          ${savings > 0 ? `<span class="product-save">Save ₹${savings}</span>` : ""}
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
              💬 WhatsApp
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
  const normInitial = initialCategory === 'all' ? 'all' : normalizeCategory(initialCategory);

  if (categoryChipsContainer) {
    let chipsHtml = `
      <button class="btn btn-sm ${normInitial === 'all' ? 'btn-primary' : 'btn-outline'} cat-filter-btn" data-category="all">
        All Items
      </button>
    `;
    categories.forEach(cat => {
      const isAuto = (cat.slug === "autobooking" || cat.name.toLowerCase().includes("auto"));
      const isCatActive = normInitial !== 'all' && (
        normInitial === normalizeCategory(cat.name) || 
        normInitial === normalizeCategory(cat.slug)
      );
      const activeClass = isCatActive ? "btn-primary" : "btn-outline";
      const filterVal = isAuto ? "autobooking" : (cat.slug || cat.name);
      chipsHtml += `
        <button class="btn btn-sm ${activeClass} cat-filter-btn" data-category="${filterVal}">
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
      const selectedCat = btn.dataset.category;
      if (selectedCat === "autobooking") {
        window.location.href = "autobooking.html";
        return;
      }
      document.querySelectorAll(".cat-filter-btn").forEach(b => {
        b.className = "btn btn-sm btn-outline cat-filter-btn";
      });
      btn.className = "btn btn-sm btn-primary cat-filter-btn";
      currentCategory = selectedCat;
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

  const subItemsMap = {
    steel: ["प्रेशर कुकर", "थाली सेट", "पतीला", "कढ़ाई", "चम्मच"],
    plastic: ["मजबूत बाल्टी", "नहाने का मग", "स्टूल / पटला", "किचन डिब्बा", "डस्टबिन"],
    mobile: ["Type-C केबल", "फास्ट चार्जर", "नेकबैंड", "टेम्पर्ड ग्लास", "बैक कवर"],
    colddrink: ["थम्स अप", "स्प्राइट", "कोका-कोला", "माज़ा", "मिनरल वाटर"],
    cosmetics: ["फेस वॉश", "फेयरनेस क्रीम", "नारियल तेल", "बॉडी लोशन", "साबुन"],
    "dona-pattal": ["सिल्वर दोना", "बफर प्लेट", "पत्तल", "चाय कप", "एल्युमिनियम फॉइल"],
    gas: ["2-बर्नर चूल्हा", "ISI रेगुलेटर", "स्टील वायर पाइप", "पीतल बर्नर", "लाइटर"],
    autobooking: ["माल ढुलाई लोडर", "सवारी ऑटो", "शादी स्पेशल", "स्टेशन ड्राप"]
  };

  let html = "";
  categories.forEach(cat => {
    const isAuto = (cat.slug === "autobooking" || cat.name.toLowerCase().includes("auto"));
    const targetUrl = isAuto ? "autobooking.html" : `shop.html?category=${encodeURIComponent(cat.slug || cat.name)}`;
    const catNorm = normalizeCategory(cat.slug || cat.name);
    const count = allProducts.filter(p => {
      const pCatNorm = normalizeCategory(p.category);
      const pSlugNorm = normalizeCategory(p.categorySlug);
      return pCatNorm === catNorm || pSlugNorm === catNorm;
    }).length;

    const tags = subItemsMap[cat.slug] || ["Verified Items", "Honest Pricing", "Store Stock"];

    html += `
      <div class="category-card-premium" style="display: flex; flex-direction: column; cursor: pointer;" onclick="if (!event.target.closest('a')) window.location.href='${targetUrl}'">
        <div class="category-card-img-wrapper">
          <img src="${cat.image || 'images/poster.jpg'}" alt="${cat.name}" loading="lazy" onerror="this.onerror=null; this.src='images/poster.jpg';">
          <div style="position: absolute; top: 12px; right: 12px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); color: #FFF; font-size: 0.75rem; font-weight: 700; padding: 4px 12px; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            ${isAuto ? `${count || 20} Services` : `${count || 25} Products`}
          </div>
          <div style="position: absolute; bottom: 10px; left: 12px; background: rgba(22, 163, 74, 0.9); color: #FFF; font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
            ✓ Store Stock Ready
          </div>
        </div>
        <div class="category-card-body-premium">
          <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px;">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 0;">
              <a href="${targetUrl}" style="color: inherit; text-decoration: none;">${cat.name}</a>
            </h3>
            ${cat.nameHindi ? `<span style="font-size: 0.95rem; color: #2563EB; font-weight: 700;">${cat.nameHindi}</span>` : ""}
          </div>
          <p style="font-size: 0.88rem; color: #64748B; margin: 6px 0 12px; line-height: 1.5; flex: 1;">
            ${cat.description || 'Quality retail and wholesale items available at best local rates.'}
          </p>

          <!-- Popular Tags Pill -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">
            ${tags.map(t => `<span style="font-size: 0.72rem; background: #F1F5F9; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 600;">#${t}</span>`).join("")}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 14px; border-top: 1px solid #F1F5F9;">
            <a href="${targetUrl}" class="btn btn-primary btn-sm" style="font-weight: 700; text-align: center; font-size: 0.82rem; padding: 9px 8px;">
              🛍️ ${isAuto ? 'Book Service' : 'View Catalog'}
            </a>
            <a href="https://wa.me/919616932589?text=Hello%20Ayush%20Service%20Center,%20I%20am%20interested%20in%20${encodeURIComponent(cat.name)}" target="_blank" class="btn btn-whatsapp btn-sm" style="font-weight: 700; text-align: center; font-size: 0.82rem; padding: 9px 8px;">
              💬 WhatsApp
            </a>
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
    <nav style="font-size: 0.88rem; color: #64748B; margin-bottom: 24px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
      <a href="index.html" style="color: #2563EB; font-weight: 500;">🏠 Home</a> <span>/</span>
      <a href="shop.html" style="color: #2563EB; font-weight: 500;">Shop</a> <span>/</span>
      <a href="shop.html?category=${encodeURIComponent(product.category)}" style="color: #2563EB; font-weight: 500;">${product.category}</a> <span>/</span>
      <span style="color: var(--navy, #0F172A); font-weight: 700;">${product.name}</span>
    </nav>

    <div style="display: grid; grid-template-columns: 1fr; gap: 36px; align-items: start;" class="product-details-grid">
      <!-- Left Column: Image Gallery & Assurance Badges -->
      <div>
        <div class="product-gallery-frame" style="background: var(--card-bg, #FFFFFF); border: 1px solid var(--border, #E2E8F0); border-radius: 20px; padding: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);">
          <div style="aspect-ratio: 1 / 1; max-height: 440px; overflow: hidden; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; border-radius: 14px; background: var(--bg-light, #F8FAFC); border: 1px solid var(--border-light, #F1F5F9); position: relative;">
            <img src="${imgUrl}" alt="${product.name}" id="main-product-img" style="max-height: 100%; max-width: 100%; object-fit: contain; padding: 18px; transition: transform 0.3s;" onerror="this.onerror=null; this.src='images/poster.jpg';">
            ${discount > 0 ? `<span class="badge badge-danger" style="position: absolute; top: 12px; left: 12px; font-size: 0.8rem; font-weight: 800; padding: 4px 10px; border-radius: 6px;">${discount}% OFF</span>` : ""}
            <span class="badge badge-success" style="position: absolute; bottom: 12px; left: 12px; font-size: 0.78rem; font-weight: 700;">● Verified ASC Stock</span>
          </div>

          ${product.images && product.images.length > 1 ? `
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
              ${product.images.map((img, idx) => `
                <img src="${img}" onclick="document.getElementById('main-product-img').src='${img}'" style="width: 62px; height: 62px; object-fit: contain; padding: 4px; background: var(--card-bg, #FFF); border-radius: 10px; border: 2px solid ${idx === 0 ? '#2563EB' : 'var(--border, #E2E8F0)'}; cursor: pointer; transition: all 0.2s;" onerror="this.onerror=null; this.src='images/poster.jpg';">
              `).join("")}
            </div>
          ` : ""}
        </div>

        <!-- Assurance Strip -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; text-align: center;">
          <div style="background: var(--card-bg, #FFF); border: 1px solid var(--border, #E2E8F0); border-radius: 12px; padding: 12px 8px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B);">
            🛡️ 100% Genuine
          </div>
          <div style="background: var(--card-bg, #FFF); border: 1px solid var(--border, #E2E8F0); border-radius: 12px; padding: 12px 8px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B);">
            🏪 25+ Yrs Store
          </div>
          <div style="background: var(--card-bg, #FFF); border: 1px solid var(--border, #E2E8F0); border-radius: 12px; padding: 12px 8px; font-size: 0.75rem; font-weight: 600; color: var(--text-muted, #64748B);">
            ⚡ Instant Pickup
          </div>
        </div>
      </div>

      <!-- Right Column: Info, Pricing & Actions -->
      <div style="display: flex; flex-direction: column;">
        <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center;">
          <span class="badge badge-primary" style="font-size: 0.8rem; font-weight: 700; padding: 4px 10px;">${product.category}</span>
          <span style="font-size: 0.85rem; color: #F59E0B; font-weight: 700;">★ 4.8</span>
          <span style="font-size: 0.82rem; color: var(--text-muted, #64748B);">(15+ Verified Reviews)</span>
        </div>

        <h1 style="font-size: 2rem; font-weight: 800; color: var(--navy, #0F172A); margin-bottom: 6px; line-height: 1.25;">
          ${product.name}
        </h1>
        ${product.nameHindi ? `<div style="font-size: 1.15rem; color: #64748B; font-weight: 600; margin-bottom: 18px;">${product.nameHindi}</div>` : ""}

        <!-- Price Breakdown -->
        <div style="display: flex; align-items: baseline; gap: 14px; margin-bottom: 22px; padding: 16px 20px; background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.15); border-radius: 14px; flex-wrap: wrap;">
          <span style="font-size: 2.3rem; font-weight: 800; color: #2563EB;">₹${product.price}</span>
          ${product.mrp && product.mrp > product.price ? `
            <span style="font-size: 1.3rem; color: #94A3B8; text-decoration: line-through;">₹${product.mrp}</span>
            <span class="badge badge-success" style="font-size: 0.82rem; font-weight: 700;">Save ₹${savings}</span>
          ` : ""}
          <span style="font-size: 0.85rem; color: var(--text-muted, #64748B); margin-left: auto;">(Inclusive of all taxes)</span>
        </div>

        <!-- Product Overview -->
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--navy, #0F172A); margin-bottom: 8px;">Product Overview:</h4>
          <p style="font-size: 0.95rem; color: var(--text-muted, #334155); line-height: 1.6; margin: 0;">${product.description || "High-quality genuine retail product available at Ayush Service Center, Tarajeevanpur Chauraha, Chandauli."}</p>
        </div>

        <!-- Specifications Table -->
        <div class="spec-box" style="background: var(--bg-light, #F8FAFC); border: 1px solid var(--border, #E2E8F0); border-radius: 14px; padding: 18px; margin-bottom: 28px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted, #64748B); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Specifications & Availability:</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; font-size: 0.88rem;">
            <div><span style="color: var(--text-muted, #64748B);">SKU Code:</span> <strong style="color: var(--navy, #0F172A);">${product.sku || 'ASC-GEN'}</strong></div>
            <div><span style="color: var(--text-muted, #64748B);">Unit:</span> <strong style="color: var(--navy, #0F172A);">${product.unit || 'Piece'}</strong></div>
            <div><span style="color: var(--text-muted, #64748B);">Stock Status:</span> <strong style="color: #16A34A;">● In Stock at Store</strong></div>
            <div><span style="color: var(--text-muted, #64748B);">Store Location:</span> <strong style="color: var(--navy, #0F172A);">Tarajeevanpur Chauraha</strong></div>
          </div>
        </div>

        <!-- Quantity & Purchase Action Buttons -->
        <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 18px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; border: 1px solid var(--border, #CBD5E1); border-radius: 12px; overflow: hidden; background: var(--card-bg, #FFFFFF);">
            <button type="button" id="qty-dec-btn" style="width: 46px; height: 46px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--navy, #0F172A);">−</button>
            <input type="number" id="detail-qty-input" value="1" min="1" max="50" style="width: 52px; text-align: center; border: none; font-size: 1.1rem; font-weight: 700; background: transparent; color: var(--navy, #0F172A);">
            <button type="button" id="qty-inc-btn" style="width: 46px; height: 46px; background: none; border: none; font-size: 20px; cursor: pointer; color: var(--navy, #0F172A);">+</button>
          </div>

          <div style="font-weight: 700; color: #2563EB; font-size: 1.1rem;" id="detail-total-price">
            Total: ₹${product.price}
          </div>
        </div>

        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px;">
          <button type="button" class="btn btn-primary btn-lg" id="detail-add-cart-btn" style="flex: 1.2; min-width: 180px; font-weight: 700;">
            🛒 Add to Cart
          </button>
          
          <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp btn-lg" id="detail-whatsapp-link" style="flex: 1.2; min-width: 180px; font-weight: 700;">
            💬 Order on WhatsApp
          </a>

          <a href="tel:+919616932589" class="btn btn-outline btn-lg" style="font-weight: 700; padding: 12px 18px;">
            📞 Call
          </a>
        </div>
      </div>
    </div>

    <!-- Related Products -->
    <div style="margin-top: 60px; padding-top: 36px; border-top: 1px solid var(--border, #E2E8F0);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 12px;">
        <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--navy, #0F172A); margin: 0;">Similar Products in ${product.category}</h2>
        <a href="shop.html?category=${encodeURIComponent(product.category)}" class="btn btn-sm btn-outline">View All →</a>
      </div>
      <div class="product-grid" id="related-products-grid"></div>
    </div>
  `;

  // Quantity button logic with live price update
  const qtyInput = document.getElementById("detail-qty-input");
  const totalDisplay = document.getElementById("detail-total-price");
  const waLink = document.getElementById("detail-whatsapp-link");

  const updateQuantityAndPrice = (newVal) => {
    const val = Math.max(1, Math.min(50, newVal));
    qtyInput.value = val;
    if (totalDisplay) {
      totalDisplay.textContent = `Total: ₹${product.price * val}`;
    }
    if (waLink) {
      const text = encodeURIComponent(
        `Hello Ayush Service Center,\nI would like to order: *${product.name}* (Qty: ${val}, Unit Price: ₹${product.price}, Total: ₹${product.price * val}).\nIs this available in stock?`
      );
      waLink.href = `https://wa.me/919616932589?text=${text}`;
    }
  };

  document.getElementById("qty-dec-btn").addEventListener("click", () => {
    const val = parseInt(qtyInput.value) || 1;
    updateQuantityAndPrice(val - 1);
  });
  document.getElementById("qty-inc-btn").addEventListener("click", () => {
    const val = parseInt(qtyInput.value) || 1;
    updateQuantityAndPrice(val + 1);
  });
  qtyInput.addEventListener("change", () => {
    updateQuantityAndPrice(parseInt(qtyInput.value) || 1);
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
      <div class="coupon-ticket-card" style="background: var(--card-bg, #FFFFFF); border: 2px dashed #2563EB; border-radius: 20px; padding: 26px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <span class="badge badge-primary" style="font-size: 0.78rem; font-weight: 800; padding: 4px 10px; border-radius: 6px;">PROMO CODE</span>
            <span style="font-size: 0.82rem; color: #16A34A; font-weight: 700;">● Active Offer</span>
          </div>
          <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--navy, #0F172A); margin-bottom: 8px;">${o.title}</h3>
          <p style="font-size: 0.92rem; color: var(--text-muted, #475569); margin-bottom: 20px; line-height: 1.55;">${o.description}</p>
        </div>
        
        <div>
          <div class="coupon-code-box" style="background: var(--bg-light, #F1F5F9); border: 1px solid var(--border, #E2E8F0); border-radius: 12px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div style="font-family: monospace; font-size: 1.3rem; font-weight: 800; color: #2563EB; letter-spacing: 1.5px;">${o.code}</div>
            <button class="btn btn-sm btn-primary copy-code-btn" data-code="${o.code}" style="font-weight: 700; padding: 6px 14px;">Copy Code</button>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted, #94A3B8);">
            <span>Min Order: <strong>₹${o.minOrderAmount || 0}</strong></span>
            <a href="shop.html" style="color: #2563EB; font-weight: 700; text-decoration: none;">Shop Now →</a>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll(".copy-code-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Copied coupon code ${code}! Apply it in cart or WhatsApp.`, "success");
        const originalText = btn.textContent;
        btn.textContent = "✓ Copied!";
        btn.style.backgroundColor = "#10B981";
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = "";
        }, 2200);
      });
    });
  });
}

