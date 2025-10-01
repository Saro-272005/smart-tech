// ===================================================================
// GLOBAL SCRIPT - SMART TECH SHOP
// Intha file-ah unga website-oda ella HTML pages-layum link pannanum.
// ===================================================================

// Ella page-layum theva padra common functions and variables inga iruku.
(function() {
    'use strict';

    // Helper function to select elements
    window.$ = sel => document.querySelector(sel);

    // GLOBAL CART VARIABLE - Other scripts will use this.
    window.CART = [];

    // Toast message function
    window.showToast = function(message, isError = false) {
        const existingToast = $('.custom-toast');
        if (existingToast) existingToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `custom-toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        
        const header = $('#pageHeader');
        const headerHeight = header ? header.offsetHeight : 0;
        toast.style.top = `${headerHeight + 20}px`;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    // Function to load cart data from local/session storage
    window.loadCartFromStorage = function() {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (user) {
            window.CART = JSON.parse(localStorage.getItem(`cart_${user.email}`) || '[]');
        } else {
            window.CART = JSON.parse(sessionStorage.getItem('cart_anonymous') || '[]');
        }
        window.updateCartCount();
    }

    // Function to update the cart count badge in the header
    window.updateCartCount = function() {
        if (!window.CART) return;
        const count = window.CART.reduce((a, c) => a + (c.qty || 1), 0);
        const badge = $("#cartCountBadge");
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }
    
    // Function to save cart data to storage
    function saveCartToStorage() {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        if (user) { 
            localStorage.setItem(`cart_${user.email}`, JSON.stringify(window.CART)); 
        } else { 
            sessionStorage.setItem('cart_anonymous', JSON.stringify(window.CART)); 
        }
    }

    // =================================================================
    // === ITHU DHAAN UNGA CORRECTION-ODA MODIFY PANNA PUDHU FUNCTION ===
    // =================================================================
    window.addToCart = function(product, selectedVariant = null, quantity = 1) {
        
        // --- START OF CORRECTION ---
        // Step 1: Correct ana price-ah variant la irundho, illa product la irundho edukurom.
        const priceSource = selectedVariant || product;
        const p1 = parseFloat(priceSource.price) || 0;
        const p2 = parseFloat(priceSource.mrp_price) || 0;

        // Step 2: Rendu price la edhu kammiyo, adha thaan selling price ah edukanum.
        // Idhu thaan unga shop page la use panra athe logic.
        const sellingPrice = Math.min(p1, p2) > 0 ? Math.min(p1, p2) : Math.max(p1, p2);
        // --- END OF CORRECTION ---

        // Cart-ku oru unique ID create panrom (variant irundha adhayum serthu)
        const cartId = selectedVariant ? `${product.id}-${selectedVariant.specName}` : product.id;
        
        // Correct-ana title-ah eduka logic
        const title = selectedVariant ? `${product.title} (${selectedVariant.specName})` : product.title;

        // Ippo cart-la antha porul iruka-nu check panrom
        const existingItem = window.CART.find(item => item.cartId === cartId);

        if (existingItem) {
            // Item munnadiye irundha, quantity-ah mattum kootrom
            existingItem.qty += quantity;
        } else {
            // Illana, puthusa oru item-ah create panni cart-la add panrom
            const newItem = {
                id: product.id,
                cartId: cartId,
                title: title,
                price: sellingPrice, // Step 2 la kandupudicha correct ana price-ah inga use panrom
                qty: quantity,
                images: product.images, 
            };
            window.CART.push(newItem);
        }

        // Cart-ah storage-la save panrom
        saveCartToStorage();
        
        // Header-la cart count-ah update panrom
        window.updateCartCount();
        
        // User-ku message kaatrom
        window.showToast(`${title} added to cart!`);
    }


    // Function to handle user logout
    window.logout = function() {
        sessionStorage.clear();
        sessionStorage.removeItem('cart_anonymous');
        window.location.href = 'index.html'; // Logout aanona home page ku pogatum
    }

    // Function to update the login/profile button in the header
    window.updateLoginStatus = function() {
        const user = JSON.parse(sessionStorage.getItem("currentUser"));
        const profileBtnContainer = $("#profileBtnContainer");
        
        if (!profileBtnContainer) {
            return;
        }

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
            
            $('#profileContainer').addEventListener('click', (e) => {
                e.stopPropagation();
                $('#profileContainer').classList.toggle('open');
                $('#profileDropdown').classList.toggle('show');
            });

            $('#logoutBtn').addEventListener('click', (e) => {
                e.preventDefault();
                window.logout();
            });

        } else {
            profileBtnContainer.innerHTML = `<a href="login.html" class="nav-link login-btn-nav"><span>Login</span></a>`;
        }
    }

    // Intha script load aana odane, header-ah correct-ah vekurathuku intha functions run aaganum
    document.addEventListener("DOMContentLoaded", () => {
        window.loadCartFromStorage();
        window.updateLoginStatus();

        // Dropdown-ku veliya click panna, atha close panra logic
        document.addEventListener('click', (e) => {
            const profileContainer = $('#profileContainer');
            const profileDropdown = $('#profileDropdown');
            
            if (profileContainer && !profileContainer.contains(e.target)) {
                profileContainer.classList.remove('open');
                if (profileDropdown) {
                    profileDropdown.classList.remove('show');
                }
            }
        });
    });

})();
