// ===================================================================
// SHOP SCRIPT (for shop.html)
// ===================================================================

(function() {
    'use strict';

    let PRODUCTS = [];
    let WISHLIST = [];
    let CART = [];

    // MODIFICATION: Intha hardcoded BRANDS object ah remove panrom
    // const BRANDS = { ... };

    let CURRENT_STATE = { brand: "all", minPrice: null, maxPrice: null, searchTerm: "" };
    let modalState = { product: null, currentImageIndex: 0, selectedVariantIndex: 0 };

    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);
    const Rs = n => `₹${Number(n).toLocaleString("en-IN")}`;

    function renderPriceHTML(price, mrp_price) {
        let sellingPrice = Math.min(price, mrp_price) > 0 ? Math.min(price, mrp_price) : Math.max(price, mrp_price);
        let mrp = Math.max(price, mrp_price);

        if (sellingPrice && mrp && sellingPrice < mrp) {
            const discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
            return `<span class="strikethrough-price-mrp">${Rs(mrp)}</span> <span class="discount-price-new">${Rs(sellingPrice)}</span> <span class="discount-badge">${discount}% off</span>`;
        }
        
        return sellingPrice ? `<span class="regular-price">${Rs(sellingPrice)}</span>` : `<span class="regular-price">Price not available</span>`;
    }

    function productCard(p) {
        const card = document.createElement("div");
        card.className = "product-card";
        const mainImage = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
        
        const displayPrice = (p.variants && p.variants.length > 0) ? p.variants[0].price : p.price;
        const mrpPrice = (p.variants && p.variants.length > 0) ? p.variants[0].mrp_price : p.mrp_price;
        
        const isWishlisted = isProductInWishlist(p.id);

        card.innerHTML = `
            <button class="wishlist-btn ${isWishlisted ? 'wishlisted' : ''}" data-product-id="${p.id}">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <img src="${mainImage}" alt="${p.title}" class="product-img"/>
            <div class="product-card-content">
                <div class="product-title">${p.title}</div>
                <div class="product-meta">
                    <div class="price-row">${renderPriceHTML(displayPrice, mrpPrice)}</div>
                    <button class="view-details-btn">View Details</button>
                </div>
            </div>`;
        
        card.querySelector(".view-details-btn").addEventListener('click', () => openDetails(p));
        card.querySelector(".product-img").addEventListener('click', () => openDetails(p));
        card.querySelector(".product-title").addEventListener('click', () => openDetails(p));
        card.querySelector(".wishlist-btn").addEventListener('click', (e) => toggleWishlist(e, p.id));

        return card;
    }

    function renderFiltered() {
        const grid = $("#productsGrid");
        if (!grid) return;
        grid.innerHTML = "";
        
        const filtered = PRODUCTS.filter(p => {
            // MODIFICATION: Ippo namma 'brand' vechi filter panrom, 'category' alla
            const brandMatch = (CURRENT_STATE.brand === "all" || (p.brand && p.brand.toLowerCase() === CURRENT_STATE.brand.toLowerCase()));
            const searchMatch = (!CURRENT_STATE.searchTerm || p.title.toLowerCase().includes(CURRENT_STATE.searchTerm.toLowerCase()));
            
            const priceForFilter = (p.variants && p.variants.length > 0) ? p.variants[0].mrp_price : p.mrp_price;
            const minPriceMatch = !CURRENT_STATE.minPrice || priceForFilter >= CURRENT_STATE.minPrice;
            const maxPriceMatch = !CURRENT_STATE.maxPrice || priceForFilter <= CURRENT_STATE.maxPrice;

            return brandMatch && searchMatch && minPriceMatch && maxPriceMatch;
        });

        if (filtered.length === 0) { 
            grid.innerHTML = `<p style="text-align: center; grid-column: 1 / -1; margin-top: 20px;">No products found matching your filters.</p>`; 
            return; 
        }
        filtered.forEach(p => grid.appendChild(productCard(p)));
    }

    // MODIFICATION: Intha function ippo DB-la irundhu categories-ah fetch pannum
    async function buildCategoryMenu() {
        const panel = $('#categoryPanel');
        if (!panel) return;
        
        panel.innerHTML = `
            <div class="filter-section">
                <h3 class="filter-title">Search Products</h3>
                <input type="text" id="searchInput" placeholder="Search Mobiles...">
            </div>
            <div class="filter-section">
                <h3 class="filter-title">Brands</h3>
                <div class="brand-list" id="brandList"><p>Loading brands...</p></div>
            </div>
            <div class="filter-section">
                <h3 class="filter-title">Price Range</h3>
                <input type="range" id="priceRange" min="0" max="150000" step="1000" value="150000">
                <div id="priceValue">Up to ₹1,50,000</div>
            </div>
            <div class="filter-section">
                <h3 class="filter-title">Custom Price</h3>
                <div class="custom-price-inputs">
                    <input type="number" id="minPrice" placeholder="Min">
                    <span>-</span>
                    <input type="number" id="maxPrice" placeholder="Max">
                </div>
            </div>
        `;

        const brandList = $('#brandList');
        try {
            const response = await fetch('http://localhost:5000/api/categories');
            if (!response.ok) throw new Error('Failed to fetch categories');
            const categories = await response.json();
            
            brandList.innerHTML = ''; // Clear loading text

            // "All Mobiles" button
            const allButton = document.createElement('button');
            allButton.className = 'brand-button active';
            allButton.dataset.brand = 'all';
            allButton.textContent = 'All Mobiles';
            brandList.appendChild(allButton);

            // Other brand buttons
            categories.forEach(cat => {
                const button = document.createElement('button');
                button.className = 'brand-button';
                button.dataset.brand = cat.toLowerCase();
                button.textContent = cat;
                brandList.appendChild(button);
            });

            // Add event listeners after creating buttons
            $$('.brand-button').forEach(button => {
                button.onclick = () => {
                    $$('.brand-button').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    CURRENT_STATE.brand = button.dataset.brand;
                    renderFiltered();
                };
            });

        } catch(error) {
            console.error("Error building category menu:", error);
            brandList.innerHTML = '<p>Could not load brands.</p>';
        }

        // Price and search listeners (no changes here)
        $('#searchInput').addEventListener('input', (e) => {
            CURRENT_STATE.searchTerm = e.target.value;
            renderFiltered();
        });

        const priceRange = $('#priceRange');
        const priceValue = $('#priceValue');
        priceRange.addEventListener('input', () => {
            priceValue.textContent = `Up to ${Rs(priceRange.value)}`;
            CURRENT_STATE.minPrice = 0;
            CURRENT_STATE.maxPrice = priceRange.value;
            $('#minPrice').value = '';
            $('#maxPrice').value = '';
            renderFiltered();
        });

        const minPriceInput = $('#minPrice');
        const maxPriceInput = $('#maxPrice');
        const handleCustomPriceChange = () => {
            CURRENT_STATE.minPrice = minPriceInput.value ? parseInt(minPriceInput.value) : null;
            CURRENT_STATE.maxPrice = maxPriceInput.value ? parseInt(maxPriceInput.value) : null;
            priceRange.value = CURRENT_STATE.maxPrice || 150000;
            priceValue.textContent = 'Custom Range';
            renderFiltered();
        };
        minPriceInput.addEventListener('input', handleCustomPriceChange);
        maxPriceInput.addEventListener('input', handleCustomPriceChange);
    }

    function openDetails(p) {
        document.body.classList.add('no-scroll');
        modalState = { product: p, currentImageIndex: 0, selectedVariantIndex: 0 };
        const overlay = $("#detailsOverlay");
        if (!overlay) return;
        overlay.hidden = false;
        
        const isWishlisted = isProductInWishlist(p.id);

        let variantsHTML = '';
        if (p.variants && p.variants.length > 0) {
            variantsHTML = `<div class="variant-selector"><h4>Select Variant:</h4><div id="variantButtons">${p.variants.map((v, i) => `<button class="variant-btn ${i === 0 ? 'active' : ''}" data-index="${i}">${v.specName}</button>`).join('')}</div></div>`;
        }
        const initialPrice = (p.variants && p.variants.length > 0) ? p.variants[0].price : p.price;
        const initialMRPPrice = (p.variants && p.variants.length > 0) ? p.variants[0].mrp_price : p.mrp_price;
        const mainImage = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
        let featuresHTML = p.specs ? Object.entries(p.specs).map(([key, value]) => `<li><b>${key}:</b> ${value}</li>`).join("") : '';

        overlay.innerHTML = `
        <div class="details-card" onclick="event.stopPropagation()">
            <button class="details-close">✕</button>
            <div class="details-image-section">
                <button class="wishlist-btn ${isWishlisted ? 'wishlisted' : ''}" id="modalWishlistBtn">
                    <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <div class="details-hero">
                    <img src="${mainImage}" id="mainDetailImg" alt="${p.title}">
                    <button class="details-nav-btn prev">❮</button>
                    <button class="details-nav-btn next">❯</button>
                </div>
                <div class="details-thumbs">${(p.images || []).map((src, i) => `<img src="${src}" class="${i === 0 ? "active" : ""}" data-index="${i}" alt="Thumbnail ${i+1}">`).join("")}</div>
                <div class="details-actions">
                     <button class="btn primary" id="modalAddToCartBtn">Add to Cart</button>
                     <button class="btn secondary" id="modalBuyNowBtn">Buy Now</button>
                </div>
            </div>
            <div class="details-info">
                <h3 class="product-title-details">${p.title}</h3>
                <div class="details-price-container">${renderPriceHTML(initialPrice, initialMRPPrice)}</div>
                ${variantsHTML}
                <h4>Features</h4>
                <ul class="specs">${featuresHTML}</ul>
                <h4>Description</h4>
                <p>${p.description || 'No description available.'}</p>
            </div>
        </div>`;
        
        $('.details-close').onclick = closeDetails;
        $('#modalWishlistBtn').onclick = (e) => toggleWishlist(e, p.id);
        $('.details-nav-btn.prev').onclick = () => navigateDetailImages(-1);
        $('.details-nav-btn.next').onclick = () => navigateDetailImages(1);
        $$('.details-thumbs img').forEach(thumb => thumb.onclick = () => switchToDetailImageByIndex(parseInt(thumb.dataset.index)));
        $$('#variantButtons .variant-btn').forEach(btn => btn.onclick = () => selectVariant(parseInt(btn.dataset.index)));
        
        $("#modalAddToCartBtn").onclick = () => {
            const productToAdd = modalState.product;
            const selectedVariant = (productToAdd.variants && productToAdd.variants.length > 0) ? productToAdd.variants[modalState.selectedVariantIndex] : null;
            addToCart(productToAdd, selectedVariant);
        };
        
        $("#modalBuyNowBtn").onclick = () => {
            const productToBuy = modalState.product;
            const selectedVariant = (productToBuy.variants && productToBuy.variants.length > 0) ? productToBuy.variants[modalState.selectedVariantIndex] : null;
            buyNow(productToBuy, selectedVariant);
        };
        
        overlay.onclick = closeDetails;
    }
    
    // =================================================================
    // === ITHU DHAAN UNGA CORRECTION-ODA MODIFY PANNA PUDHU FUNCTION ===
    // =================================================================
    function buyNow(product, selectedVariant = null) {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (!user) {
            if (typeof window.showToast === 'function') window.showToast("Please login to buy products.", true);
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            return;
        }

        // --- START OF CORRECTION ---
        const priceSource = selectedVariant || product;
        const p1 = parseFloat(priceSource.price) || 0;
        const p2 = parseFloat(priceSource.mrp_price) || 0;
        const sellingPrice = Math.min(p1, p2) > 0 ? Math.min(p1, p2) : Math.max(p1, p2);
        // --- END OF CORRECTION ---

        const itemToBuy = {
            ...product,
            qty: 1,
            price: sellingPrice, // Corrected price inga use panrom
            title: selectedVariant ? `${product.title} (${selectedVariant.specName})` : product.title,
            cartId: selectedVariant ? `${product.id}-${selectedVariant.specName}` : product.id,
            // Billing page-la image kaaturathuku idhu thevai
            image: (product.images && product.images.length > 0) ? product.images[0] : null
        };

        const subtotal = itemToBuy.price * itemToBuy.qty;
        const gst = subtotal * 0.05;
        const delivery = 40;
        const total = subtotal + gst + delivery;

        const billingInfo = {
            items: [itemToBuy],
            pricing: { subtotal, gst, delivery, total }
        };

        sessionStorage.setItem('itemsForBilling', JSON.stringify(billingInfo));
        window.location.href = 'billing.html';
    }

    function selectVariant(variantIndex) {
        if (!modalState.product || !modalState.product.variants) return;
        modalState.selectedVariantIndex = variantIndex;
        const selectedVariant = modalState.product.variants[variantIndex];
        $('.details-price-container').innerHTML = renderPriceHTML(selectedVariant.price, selectedVariant.mrp_price);
        $$('#variantButtons .variant-btn').forEach((btn, i) => btn.classList.toggle('active', i === variantIndex));
    }

    function navigateDetailImages(direction) {
        const { product, currentImageIndex } = modalState;
        if (!product.images || product.images.length === 0) return;
        const totalImages = product.images.length;
        const newIndex = (currentImageIndex + direction + totalImages) % totalImages;
        switchToDetailImageByIndex(newIndex);
    }

    function switchToDetailImageByIndex(index) {
        if (!modalState.product || index < 0 || index >= modalState.product.images.length) return;
        modalState.currentImageIndex = index;
        $('#mainDetailImg').src = modalState.product.images[index];
        $$('.details-thumbs img').forEach((thumb, i) => thumb.classList.toggle('active', i === index));
    }

    function closeDetails() {
        document.body.classList.remove('no-scroll');
        const overlay = $("#detailsOverlay");
        if (overlay) overlay.hidden = true;
    }

    function toggleWishlist(event, productId) {
        event.stopPropagation();
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (!user) {
            if (typeof window.showToast === 'function') window.showToast("Please login to use wishlist.", true);
            return;
        }
        
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) return;
        
        const index = WISHLIST.findIndex(item => item.id === productId);
        if (index > -1) {
            WISHLIST.splice(index, 1);
            if (typeof window.showToast === 'function') window.showToast(`${product.title} removed from wishlist.`);
        } else {
            WISHLIST.push(product);
            if (typeof window.showToast === 'function') window.showToast(`${product.title} added to wishlist.`);
        }
        
        saveWishlistToStorage();
        
        const cardButton = event.currentTarget;
        cardButton.classList.toggle('wishlisted', index === -1);

        const modalButton = $('#modalWishlistBtn');
        if (modalButton && modalState.product && modalState.product.id === productId) {
            modalButton.classList.toggle('wishlisted', index === -1);
        }
    }

    function isProductInWishlist(productId) {
        return WISHLIST.some(item => item.id === productId);
    }

    function saveWishlistToStorage() {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (user) { 
            localStorage.setItem(`wishlist_${user.email}`, JSON.stringify(WISHLIST));
        }
    }

    function addToCart(product, selectedVariant = null, quantity = 1) {
        if(typeof window.addToCart === 'function'){
            window.addToCart(product, selectedVariant, quantity);
        }
    }
    
    async function initializeApp() {
        await fetchProducts();
        
        if(typeof window.loadCartFromStorage === 'function') window.loadCartFromStorage();

        const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
        if (currentUser) {
            WISHLIST = JSON.parse(localStorage.getItem(`wishlist_${currentUser.email}`) || '[]');
        }
        
        if(typeof window.updateLoginStatus === 'function') window.updateLoginStatus(); 
        
        // MODIFICATION: Intha function ippo async function aagiruchu
        await buildCategoryMenu();
        renderFiltered(); 
    }

    async function fetchProducts() {
        try {
            const response = await fetch("http://localhost:5000/api/products");
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const productsFromServer = await response.json();
            PRODUCTS = productsFromServer.map(p => ({ 
                ...p, 
                id: p.id.toString(), 
                title: p.name, 
                specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : p.specs || {}, 
                images: typeof p.images === 'string' ? JSON.parse(p.images) : (p.images || []), 
                variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []), 
            }));
        } catch (error) {
            console.error("Could not fetch products:", error);
            if (typeof window.showToast === 'function') window.showToast("Failed to load products.", true);
        }
    }
    
    document.addEventListener("DOMContentLoaded", initializeApp);

})();
