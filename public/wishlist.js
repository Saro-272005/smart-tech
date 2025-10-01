// ===================================================================
// WISHLIST SCRIPT (for wishlist.html)
// ===================================================================

(function() {
    'use strict';

    let PRODUCTS = [];
    let WISHLIST = [];
    let CART = [];
    let modalState = { product: null, currentImageIndex: 0, selectedVariantIndex: 0 };

    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);
    const Rs = n => `₹${Number(n).toLocaleString("en-IN")}`;

    function showToast(message, isError = false) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, isError);
            return;
        }
        const existingToast = $('.custom-toast');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.className = `custom-toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
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
            showToast("Failed to load product data.", true);
        }
    }
    
    function loadWishlistFromStorage() {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (user) {
            WISHLIST = JSON.parse(localStorage.getItem(`wishlist_${user.email}`) || '[]');
        } else {
            window.location.href = 'login.html';
        }
    }

    function renderWishlist() {
        const grid = $("#wishlistGrid");
        if (!grid) return;

        if (WISHLIST.length === 0) {
            grid.innerHTML = `<div class="empty-wishlist-container"><h2>Your Wishlist is Empty</h2><p>Looks like you haven't added anything to your wishlist yet.</p><a href="shop.html" class="btn primary">Start Shopping</a></div>`;
            return;
        }

        grid.innerHTML = WISHLIST.map(p => {
            const mainImage = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
            const displayPrice = (p.variants && p.variants.length > 0) ? p.variants[0].price : p.price;
            const mrpPrice = (p.variants && p.variants.length > 0) ? p.variants[0].mrp_price : p.mrp_price;
            
            return `
                <div class="wishlist-item-card">
                    <button class="remove-wishlist-btn" data-product-id="${p.id}">×</button>
                    <img src="${mainImage}" alt="${p.title}" class="product-image" data-product-id="${p.id}">
                    <div class="product-title">${p.title}</div>
                    <div class="product-price">${renderPriceHTML(displayPrice, mrpPrice)}</div>
                </div>
            `;
        }).join('');
        
        $$('.remove-wishlist-btn').forEach(btn => btn.addEventListener('click', handleRemoveFromWishlist));
        $$('.product-image').forEach(img => img.addEventListener('click', handleProductClick));
    }

    function handleRemoveFromWishlist(event) {
        const productId = event.currentTarget.dataset.productId;
        WISHLIST = WISHLIST.filter(p => p.id !== productId);
        saveWishlistToStorage();
        renderWishlist();
        showToast("Item removed from wishlist.");
    }

    function handleProductClick(event) {
        const productId = event.currentTarget.dataset.productId;
        const product = PRODUCTS.find(p => p.id === productId);
        if (product) {
            openDetails(product);
        } else {
            showToast("Sorry, product details could not be loaded.", true);
        }
    }
    
    function saveWishlistToStorage() {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (user) {
            localStorage.setItem(`wishlist_${user.email}`, JSON.stringify(WISHLIST));
        }
    }
    
    function renderPriceHTML(price, mrp_price) {
        let sellingPrice = Math.min(price, mrp_price) > 0 ? Math.min(price, mrp_price) : Math.max(price, mrp_price);
        let mrp = Math.max(price, mrp_price);
        if (sellingPrice && mrp && sellingPrice < mrp) {
            const discount = Math.round(((mrp - sellingPrice) / mrp) * 100);
            return `<span class="strikethrough-price-mrp">${Rs(mrp)}</span> <span class="discount-price-new">${Rs(sellingPrice)}</span> <span class="discount-badge">${discount}% off</span>`;
        }
        return sellingPrice ? `<span class="regular-price">${Rs(sellingPrice)}</span>` : `<span class="regular-price">Price not available</span>`;
    }

    function openDetails(p) {
        document.body.classList.add('no-scroll');
        modalState = { product: p, currentImageIndex: 0, selectedVariantIndex: 0 };
        const overlay = $("#detailsOverlay");
        if (!overlay) return;
        overlay.hidden = false;
        
        const isWishlisted = WISHLIST.some(item => item.id === p.id);

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
    
    function addToCart(product, selectedVariant = null, quantity = 1) {
        if (typeof window.addToCart === 'function') {
            window.addToCart(product, selectedVariant, quantity);
        }
    }

    async function initializeApp() {
        await fetchProducts();
        loadWishlistFromStorage();
        renderWishlist();
    }

    document.addEventListener("DOMContentLoaded", initializeApp);

})();
