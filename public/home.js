// ===================================================================
// HOME SCRIPT (for index.html)
// ===================================================================

// --- Common Code Start ---
let PRODUCTS = [];
let CART = [];
const $ = sel => document.querySelector(sel);
const Rs = n => `₹${Number(n).toLocaleString("en-IN")}`;

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
            rating: p.rating || 4.5, 
            reviews: p.reviews || 0, 
            ratingBreakdown: typeof p.ratingBreakdown === 'string' ? JSON.parse(p.ratingBreakdown) : p.ratingBreakdown || {}, 
            variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []), 
        }));
    } catch (error) {
        console.error("Could not fetch products:", error);
    }
}

function loadCartFromStorage() {
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    if (user) {
        CART = JSON.parse(localStorage.getItem(`cart_${user.email}`) || '[]');
    } else {
        CART = JSON.parse(sessionStorage.getItem('cart_anonymous') || '[]');
    }
    updateCartCount();
}

function updateCartCount() {
    const count = CART.reduce((a, c) => a + c.qty, 0);
    const badge = $("#cartCountBadge");
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// === MODIFIED FUNCTION ===
function updateLoginStatus() {
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    const profileBtnContainer = $("#profileBtnContainer"); // Assuming a container div now
    
    if (!profileBtnContainer) return;

    if (user) {
        profileBtnContainer.innerHTML = `
            <div class="profile-container" id="profileContainer">
                <svg class="profile-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                <span class="profile-name">${user.first_name}</span>
                <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
            <div class="profile-dropdown" id="profileDropdown">
                <a href="my_profile.html">My Profile</a>
                <a href="my_orders.html">My Orders</a>
                <a href="wishlist.html">My Wishlist</a>
                <div class="dropdown-divider"></div>
                <a href="#" id="logoutBtn">Logout</a>
            </div>
        `;
        
        $('#profileContainer').addEventListener('click', () => {
            $('#profileContainer').classList.toggle('open');
            $('#profileDropdown').classList.toggle('show');
        });

        $('#logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });

    } else {
        profileBtnContainer.innerHTML = `<a href="login.html" class="nav-link login-btn-nav" id="profileBtn">Login</a>`;
    }
}

function logout() {
    sessionStorage.clear();
    window.location.reload();
}

function renderPriceHTML(price, mrp_price) {
    if (mrp_price && mrp_price > 0 && price && price > 0 && price < mrp_price) {
        const discount = Math.round(((mrp_price - price) / mrp_price) * 100);
        return `<span class="strikethrough-price-mrp">MRP ${Rs(mrp_price)}</span> <span class="discount-price-new">${Rs(price)}</span> <span class="discount-badge">${discount}% off</span>`;
    }
    if (mrp_price && mrp_price > 0) return `<span class="regular-price">MRP ${Rs(mrp_price)}</span>`;
    if (price && price > 0) return `<span class="regular-price">${Rs(price)}</span>`;
    return `<span class="regular-price">Price not available</span>`;
}
// --- Common Code End ---

// --- Page-Specific Logic for index.html ---

function initHomePage() {
    const carousel = $("#hero-carousel");
    if (!carousel) return;
    const slides = ["https://i3-prod-assets.indiaistore.com/files/uploads/banners/home-page-hero/banner_1758204473_5263.jpg", "https://i3-prod-assets.indiaistore.com/files/uploads/banners/home-page-hero/banner_1758204590_7745.jpg", "https://i3-prod-assets.indiaistore.com/files/uploads/banners/home-page-hero/banner_1758204633_706.jpg"];
    let currentSlide = 0;
    carousel.innerHTML = slides.map(src => `<img src="${src}" alt="Carousel image" style="width: ${100 / slides.length}%">`).join('');
    carousel.style.width = `${slides.length * 100}%`;
    
    function showSlide(index) {
        currentSlide = (index + slides.length) % slides.length;
        carousel.style.transform = `translateX(-${currentSlide * (100 / slides.length)}%)`;
    }
    
    window.prevSlide = () => showSlide(currentSlide - 1);
    window.nextSlide = () => showSlide(currentSlide + 1);
    
    setInterval(() => window.nextSlide(), 5000);
}

function latestProductCard(p) {
    const card = document.createElement("div");
    card.className = "latest-product-card";
    const mainImage = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
    const displayPrice = (p.variants && p.variants.length > 0) ? p.variants[0].price : p.price;
    const mrpPrice = (p.variants && p.variants.length > 0) ? p.variants[0].mrp_price : p.mrp_price;
    
    card.innerHTML = `
        <img src="${mainImage}" alt="${p.title}" class="latest-product-img"/>
        <h4 class="latest-product-title">${p.title}</h4>
        <div class="product-meta">
            <div class="price-row">${renderPriceHTML(displayPrice, mrpPrice)}</div>
        </div>
    `;
    card.onclick = () => window.location.href = `shop.html`;
    return card;
}

function displayLatestProducts() {
    const latestProductsGrid = $('#latestProductsGrid');
    if (!latestProductsGrid) return;
    
    const latestProducts = PRODUCTS.slice(-4).reverse(); 
    if (latestProducts.length === 0) {
        latestProductsGrid.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">No products found.</p>`;
        return;
    }
    
    latestProductsGrid.innerHTML = '';
    latestProducts.forEach(p => {
        latestProductsGrid.appendChild(latestProductCard(p));
    });
}


// --- App Initializer for this page ---
async function initializeApp() {
    await fetchProducts();
    loadCartFromStorage();
    updateLoginStatus();
    
    initHomePage();
    displayLatestProducts();

    // Event listener for clicks outside the dropdown
    document.addEventListener('click', (e) => {
        const profileContainer = $('#profileContainer');
        if (profileContainer && !profileContainer.contains(e.target)) {
            profileContainer.classList.remove('open');
            $('#profileDropdown').classList.remove('show');
        }
    });
}

document.addEventListener("DOMContentLoaded", initializeApp);

