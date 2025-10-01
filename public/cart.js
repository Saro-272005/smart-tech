// ===================================================================
// CART & BILLING SCRIPT (for cart.html and billing.html)
// ===================================================================

const $$ = sel => document.querySelectorAll(sel);
const Rs = n => `₹${Number(n).toLocaleString("en-IN")}`;

function requireLogin(actionCallback, message = "You need to log in to access this feature.") {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";
    if (isLoggedIn) {
        actionCallback();
    } else {
        showToast(message, true); 
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}

// --- Page-Specific Logic for cart.html ---

function initCartPage() {
    const section = $('#cartSection');
    if (!section) return;

    if (CART.length === 0) {
        section.innerHTML = `
            <div class="empty-cart-container">
                <h2>Your cart is empty!</h2>
                <a href="shop.html">Continue Shopping</a>
            </div>`;
        return;
    }

    let cartItemsHTML = CART.map((item, index) => {
        const mainImage = (item.images && item.images.length > 0) ? item.images[0] : 'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
        return `
        <div class="cart-item-card">
            <div class="cart-item-img"><img src="${mainImage}" alt="${item.title}"></div>
            <div class="cart-item-info">
                <h3>${item.title}</h3>
                <p class="cart-item-price">${Rs(item.price)}</p>
                <div class="cart-item-actions">
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="changeQuantity(${index}, -1)">-</button>
                        <span>${item.qty}</span>
                        <button class="qty-btn" onclick="changeQuantity(${index}, 1)">+</button>
                    </div>
                    <button class="remove-item-btn" onclick="removeItemFromCart(${index})">Remove</button>
                </div>
            </div>
        </div>`;
    }).join('');

    section.innerHTML = `
        <div class="cart-layout">
            <div class="cart-items-column">
                ${cartItemsHTML}
            </div>
            <div class="price-details-column" id="priceDetailsColumn">
                <!-- Price details will be injected here -->
            </div>
        </div>`;
    
    updateCartTotals();
}

function updateCartTotals() {
    const priceColumn = $('#priceDetailsColumn');
    if (!priceColumn) return;

    const subtotal = CART.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const gst = subtotal * 0.05; 
    const deliveryCharge = 40;
    const total = subtotal + gst + deliveryCharge;

    priceColumn.innerHTML = `
        <div class="price-details-card">
            <h2>PRICE DETAILS</h2>
            <div class="price-summary-row">
                <span>Price (${CART.reduce((acc, item) => acc + item.qty, 0)} items)</span>
                <span>${Rs(subtotal.toFixed(2))}</span>
            </div>
            <div class="price-summary-row">
                <span>Delivery Charges</span>
                <span>+ ${Rs(deliveryCharge.toFixed(2))}</span>
            </div>
             <div class="price-summary-row">
                <span>GST (5%)</span>
                <span>+ ${Rs(gst.toFixed(2))}</span>
            </div>
            <div class="price-summary-row price-summary-total">
                <span>Total Amount</span>
                <span>${Rs(total.toFixed(2))}</span>
            </div>
            <button class="proceed-btn" onclick="goBilling()">Proceed to Pay</button>
        </div>
    `;
}

function saveCartToStorage() {
    const user = JSON.parse(sessionStorage.getItem("currentUser"));
    if (user) { 
        localStorage.setItem(`cart_${user.email}`, JSON.stringify(CART)); 
    } else { 
        sessionStorage.setItem('cart_anonymous', JSON.stringify(CART)); 
    }
}

function changeQuantity(index, delta) {
    if (!CART[index]) return;
    CART[index].qty += delta;
    if (CART[index].qty <= 0) {
        removeItemFromCart(index);
        return;
    }
    saveCartToStorage();
    loadCartFromStorage();
    initCartPage();
}

function removeItemFromCart(index) {
    CART.splice(index, 1);
    saveCartToStorage();
    loadCartFromStorage();
    initCartPage();
}

function goBilling() {
    if (CART.length === 0) {
        showToast("Your cart is empty.", true);
        return;
    }
    
    requireLogin(() => {
        const subtotal = CART.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const gst = subtotal * 0.05;
        const delivery = 40;
        const total = subtotal + gst + delivery;
        const billingInfo = {
            items: CART,
            pricing: { subtotal, gst, delivery, total }
        };
        sessionStorage.setItem('itemsForBilling', JSON.stringify(billingInfo));
        window.location.href = 'billing.html';
    }, "Please log in to proceed to checkout.");
}

// --- Page-Specific Logic for billing.html ---

function initBillingPage() {
    const container = $('#billingPageContainer');
    if (!container) return;

    const billingInfo = JSON.parse(sessionStorage.getItem('itemsForBilling'));
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

    if (!currentUser || !billingInfo || !billingInfo.items.length) {
        container.innerHTML = '<div class="empty-cart-container" style="margin-top: 2rem;"><h2>Your order list is empty!</h2><a href="shop.html" class="shop-now-btn">Shop Now</a></div>';
        return;
    }

    const { items, pricing } = billingInfo;

    const orderSummaryItemsHTML = items.map(item => `
        <div class="order-summary-item">
            <img src="${item.images[0] || 'https://placehold.co/60x60'}" alt="${item.title}">
            <div class="order-summary-info">
                <div>${item.title}</div>
                <small>Qty: ${item.qty}</small>
            </div>
            <div class="order-summary-price">${Rs(item.price * item.qty)}</div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="checkout-stepper-container">
            <div class="stepper-item completed"><div class="stepper-circle">✓</div><div class="stepper-label">My Cart</div></div>
            <div class="stepper-item active"><div class="stepper-circle">2</div><div class="stepper-label">Billing</div></div>
            <div class="stepper-item"><div class="stepper-circle">3</div><div class="stepper-label">Order Summary</div></div>
        </div>
        <div class="billing-layout">
            <section class="billing-form-section">
                <h3>Billing Details</h3>
                <form id="billingForm">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input type="text" id="firstName" value="${currentUser.first_name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input type="text" id="lastName" value="${currentUser.last_name || ''}" required>
                    </div>
                    <div class="form-group full-width">
                        <label for="customerAddress">Street address *</label>
                        <textarea id="customerAddress" placeholder="House number and street name" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="customerCity">Town / City *</label>
                        <input type="text" id="customerCity" required>
                    </div>
                    <div class="form-group">
                        <label for="customerPincode">PIN Code *</label>
                        <input type="text" id="customerPincode" required>
                    </div>
                     <div class="form-group">
                        <label for="customerPhone">Phone *</label>
                        <input type="tel" id="customerPhone" required>
                    </div>
                     <div class="form-group">
                        <label for="customerEmail">Email address *</label>
                        <input type="email" id="customerEmail" value="${currentUser.email || ''}" required>
                    </div>
                </form>
            </section>
            <section class="billing-summary-section">
                <h3>Your Order</h3>
                <div id="orderSummaryItems">
                    ${orderSummaryItemsHTML}
                </div>
                <div class="price-breakdown">
                    <div class="price-summary-row"><span>Subtotal</span><span>${Rs(pricing.subtotal.toFixed(2))}</span></div>
                    <div class="price-summary-row"><span>Delivery</span><span>+ ${Rs(pricing.delivery.toFixed(2))}</span></div>
                    <div class="price-summary-row"><span>GST (5%)</span><span>+ ${Rs(pricing.gst.toFixed(2))}</span></div>
                    <div class="price-summary-row price-summary-total"><span>Total</span><span>${Rs(pricing.total.toFixed(2))}</span></div>
                </div>
                <div class="payment-info">
                    <h4>Payment Information</h4>
                    <div class="payment-option selected" data-payment="cod">
                        <input type="radio" name="paymentMethod" id="cod" value="cod" checked>
                        <label for="cod">Cash on Delivery</label>
                    </div>
                    <div class="payment-option" data-payment="upi">
                        <input type="radio" name="paymentMethod" id="upi" value="upi">
                        <label for="upi">UPI / QR Code</label>
                    </div>
                </div>
                <div id="qrCodeContainer" class="qr-code-container hidden">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=your-upi-id@okhdfcbank%26pn=YourName%26am=${pricing.total.toFixed(2)}%26cu=INR" alt="UPI QR Code">
                    <p>Scan to pay ${Rs(pricing.total.toFixed(2))}</p>
                </div>
                <button class="place-order-btn" type="submit" form="billingForm">Place Order</button>
            </section>
        </div>
    `;
    
    // Payment option selection logic
    $$('.payment-option').forEach(option => {
        option.addEventListener('click', () => {
            $$('.payment-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            const radio = option.querySelector('input[type="radio"]');
            radio.checked = true;

            const qrContainer = $('#qrCodeContainer');
            if (radio.value === 'upi') {
                qrContainer.classList.remove('hidden');
            } else {
                qrContainer.classList.add('hidden');
            }
        });
    });
    
    $('#billingForm').addEventListener('submit', placeOrder);
}

async function placeOrder(event) {
    event.preventDefault();
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    const billingInfo = JSON.parse(sessionStorage.getItem('itemsForBilling') || 'null');
    
    if (!currentUser || !billingInfo || billingInfo.items.length === 0) {
        showToast("Error processing order.", true);
        return;
    }

    const fullName = `${$('#firstName').value} ${$('#lastName').value}`;
    const fullAddress = `${$('#customerAddress').value}, ${$('#customerCity').value} - ${$('#customerPincode').value}`;
    const productsSummaryString = JSON.stringify(billingInfo.items.map(item => ({ id: item.id, name: item.title, quantity: item.qty, image: (item.images && item.images.length > 0) ? item.images[0] : '' })));

    const orderData = {
        orderId: `ST-${Date.now()}`,
        orderDate: new Date().toISOString().slice(0, 10),
        userEmail: currentUser.email,
        customerName: fullName,
        customerPhone: $('#customerPhone').value,
        customerAddress: fullAddress,
        total: billingInfo.pricing.total,
        status: 'Pending',
        products_summary: productsSummaryString,
        items: billingInfo.items,
    };

    try {
        const response = await fetch('http://localhost:5000/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });
        const result = await response.json();
        if (response.ok) {
            CART = [];
            saveCartToStorage();
            updateCartCount();
            sessionStorage.removeItem('itemsForBilling');

            // === ITHU DHAAN CORRECTED LINE ===
            // Inga `orderData` object-kulla irukara `items` property-ah vechi, `pricing` details-ah serthu anuprom.
            sessionStorage.setItem('lastOrder', JSON.stringify({ ...orderData, pricing: billingInfo.pricing }));
            
            window.location.href = 'order.html';
        } else {
            showToast(result.error || 'Error placing order.', true);
        }
    } catch (error) {
        console.error("Order placing error:", error);
        showToast('A network error occurred.', true);
    }
}

// --- App Initializer for Cart/Billing ---
function initializeApp() {
    loadCartFromStorage();
    const path = window.location.pathname;
    if (path.endsWith('cart.html')) {
        initCartPage();
    } else if (path.endsWith('billing.html')) {
        initBillingPage();
    }
}

initializeApp();

