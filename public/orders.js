// ===================================================================
// ORDER SCRIPT (for my_orders.html and order.html)
// ===================================================================

(function() {
    'use strict';

    // Helper functions
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);
    const Rs = n => `₹${Number(n).toLocaleString("en-IN")}`;
    
    // Toast message function
    function showToast(message, isError = false) {
        const existingToast = $('.custom-toast');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.className = `custom-toast ${isError ? 'error' : ''}`;
        toast.textContent = message;
        const headerHeight = $('#pageHeader')?.offsetHeight || 0;
        toast.style.top = `${headerHeight + 20}px`;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }


    // --- Page-Specific Logic for order.html (Success Page) ---
    function initOrderPage() {
        const container = $('#orderSuccessPageContainer');
        if (!container) return;
        
        const order = JSON.parse(sessionStorage.getItem('lastOrder'));
        if (!order) {
            container.innerHTML = "<h2>No order details found.</h2>";
            return;
        }

        if (order.status === 'Cancelled') {
            renderCancelledOrderView(container, order);
            return;
        }

        const itemsHTML = (order.items || []).map(item => `
            <div class="order-summary-item">
                <img src="${item.image || 'https://placehold.co/100x100'}" alt="${item.name}">
                <div><h4>${item.title || item.name}</h4><p>Qty: ${item.quantity || item.qty}</p></div>
                <span>${Rs((item.price || 0) * (item.quantity || item.qty))}</span>
            </div>`).join('');

        container.innerHTML = `
            <div class="checkout-stepper-container">
                <div class="stepper-item completed"><div class="stepper-circle">✓</div><div class="stepper-label">My Cart</div></div>
                <div class="stepper-item completed"><div class="stepper-circle">✓</div><div class="stepper-label">Billing</div></div>
                <div class="stepper-item active"><div class="stepper-circle">3</div><div class="stepper-label">Order Summary</div></div>
            </div>
            <div class="success-container">
                <div class="success-icon">✓</div>
                <h2>Order Placed Successfully!</h2>
                <p>Thank you for your purchase. Your order ID is <strong>${order.orderId}</strong>.</p>
                <div class="summary">
                    <h3>Order Summary</h3>
                    <div class="order-summary-items">${itemsHTML}</div>
                    <div class="order-summary-totals">
                        <div class="price-summary-row"><span>Subtotal</span><span>${Rs(order.pricing.subtotal.toFixed(2))}</span></div>
                        <div class="price-summary-row"><span>Delivery</span><span>${Rs(order.pricing.delivery.toFixed(2))}</span></div>
                        <div class="price-summary-row"><span>GST (5%)</span><span>${Rs(order.pricing.gst.toFixed(2))}</span></div>
                        <div class="price-summary-row price-summary-total"><span>Total</span><strong>${Rs(order.pricing.total.toFixed(2))}</strong></div>
                    </div>
                    <div class="delivery-details-summary">
                        <h4>Delivering to:</h4>
                        <p><strong>${order.customerName}</strong></p><p>${order.customerAddress}</p><p>Phone: ${order.customerPhone}</p>
                    </div>
                </div>
                <div class="action-buttons">
                    <a href="shop.html" class="btn secondary">Continue Shopping</a>
                    <button class="btn primary" id="downloadPdfBtn">Download PDF</button>
                </div>
            </div>`;
            
        // Ippo button-ku event listener ah inga add panrom
        $('#downloadPdfBtn').addEventListener('click', generateInvoicePDF);
    }
    
    function renderCancelledOrderView(container, order) {
        const itemsHTML = (order.items || []).map(item => `
            <div class="order-summary-item">
                <img src="${item.image || 'https://placehold.co/100x100'}" alt="${item.name}">
                <div><h4>${item.title || item.name}</h4><p>Qty: ${item.quantity || item.qty}</p></div>
                <span style="text-decoration: line-through;">${Rs((item.price || 0) * (item.quantity || item.qty))}</span>
            </div>`).join('');

        container.innerHTML = `
            <div class="success-container">
                <div class="cancel-icon" style="background-color: var(--danger-color); color: white; width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 48px;">✕</div>
                <h2>Order Cancelled</h2>
                <p>Your order with ID <strong>${order.orderId}</strong> has been cancelled.</p>
                 <p style="color: var(--muted-color); font-size: 0.9rem;">If you have already paid, your money will be refunded within 2 business days.</p>
                <div class="summary">
                    <h3>Order Summary</h3>
                    <div class="order-summary-items">${itemsHTML}</div>
                     <div class="delivery-details-summary">
                        <h4>Original Shipping Information</h4>
                        <p><strong>${order.customerName}</strong></p><p>${order.customerAddress}</p>
                    </div>
                </div>
                 <div class="action-buttons">
                    <a href="shop.html" class="btn secondary">Continue Shopping</a>
                    <a href="my_orders.html" class="btn primary">Back to My Orders</a>
                </div>
            </div>`;
    }

    // ===================================================================
    // === ITHU DHAAN FULL-AH MODIFY PANNA PUDHU PDF GENERATOR FUNCTION ===
    // ===================================================================
    function generateInvoicePDF() {
        const { jsPDF } = window.jspdf;
        const order = JSON.parse(sessionStorage.getItem('lastOrder'));
        if (!order) { 
            showToast("Order details not found!", true); 
            return; 
        }

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // Unga logo image-oda path (unga project-la irukura correct path-ah kudunga)
        const logoUrl = './logo.png'; 
        const GSTIN = "33ABCDE1234F1Z5"; // Unga GST number inga varum

        // Color and Font variables
        const primaryColor = '#1a73e8';
        const mutedColor = '#5f6368';
        const textColor = '#202124';

        // --- Document Header ---
        doc.addImage(logoUrl, 'PNG', 15, 12, 30, 10);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor);
        doc.text("Tax Invoice", 200, 20, { align: 'right' });

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(textColor);
        doc.text("Apple Mobile Store", 15, 30);
        doc.setFont("helvetica", "normal");
        doc.text("123 Tech Street, Gandhipuram", 15, 34);
        doc.text("Coimbatore, Tamil Nadu, 641012", 15, 38);
        doc.text(`GSTIN: ${GSTIN}`, 15, 42);

        // --- Order Details ---
        doc.setFont("helvetica", "bold");
        doc.text(`Order ID:`, 150, 30);
        doc.text(`Invoice Date:`, 150, 34);
        doc.setFont("helvetica", "normal");
        doc.text(`${order.orderId}`, 175, 30);
        doc.text(`${new Date(order.orderDate).toLocaleDateString()}`, 175, 34);
        
        doc.setLineWidth(0.5);
        doc.line(15, 50, 200, 50);

        // --- Billing and Shipping Address ---
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Bill To:", 15, 58);
        doc.setFont("helvetica", "normal");
        doc.text(order.customerName, 15, 63);
        const addressLines = doc.splitTextToSize(order.customerAddress, 80);
        doc.text(addressLines, 15, 67);
        let addressY = 67 + (addressLines.length * 4);
        doc.text(`Phone: ${order.customerPhone}`, 15, addressY);

        // --- Product Table ---
        const tableColumn = ["#", "Item Description", "Qty", "Rate", "Amount"];
        const tableRows = [];
        (order.items || []).forEach((item, index) => {
             const title = item.title || item.name;
            const quantity = item.quantity || item.qty;
            const price = item.price || 0;
            tableRows.push([
                index + 1, 
                title, 
                quantity, 
                Rs(price), 
                Rs(price * quantity)
            ]);
        });
        
        doc.autoTable({
            head: [tableColumn], 
            body: tableRows, 
            startY: addressY + 10,
            theme: 'grid',
            headStyles: { 
                fillColor: [22, 160, 133], 
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: { 
                font: "helvetica", 
                fontSize: 9,
                cellPadding: 2.5
            },
            columnStyles: { 
                0: { halign: 'center', cellWidth: 10 },
                1: { cellWidth: 'auto'},
                2: { halign: 'center', cellWidth: 15 }, 
                3: { halign: 'right', cellWidth: 30 }, 
                4: { halign: 'right', cellWidth: 30 }
            }
        });
        
        let finalY = doc.autoTable.previous.finalY;

        // --- Totals Section ---
        const rightAlignX = 195;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        doc.text("Subtotal:", 140, finalY + 8);
        doc.text(Rs(order.pricing.subtotal.toFixed(2)), rightAlignX, finalY + 8, { align: "right" });
        
        doc.text("Delivery Charges:", 140, finalY + 13);
        doc.text(Rs(order.pricing.delivery.toFixed(2)), rightAlignX, finalY + 13, { align: "right" });
        
        doc.text("GST (5%):", 140, finalY + 18);
        doc.text(Rs(order.pricing.gst.toFixed(2)), rightAlignX, finalY + 18, { align: "right" });
        
        doc.setLineWidth(0.3);
        doc.line(138, finalY + 22, 197, finalY + 22);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Total Amount:", 138, finalY + 28);
        doc.text(Rs(order.pricing.total.toFixed(2)), rightAlignX, finalY + 28, { align: "right" });

        // --- Footer Section ---
        const pageHeight = doc.internal.pageSize.height;
        doc.setLineWidth(0.5);
        doc.line(15, pageHeight - 40, 200, pageHeight - 40);

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Terms & Conditions:", 15, pageHeight - 35);
        doc.setFont("helvetica", "normal");
        doc.text("1. Goods once sold will not be taken back or exchanged.", 15, pageHeight - 30);
        
        doc.setFont("helvetica", "bold");
        doc.text("For Apple mobile store", 195, pageHeight - 30, { align: 'right' });
        doc.text("Authorised Signatory", 195, pageHeight - 15, { align: 'right' });
        
        doc.save(`Invoice-${order.orderId}.pdf`);
    }

    // --- Page-Specific Logic for my_orders.html ---
    async function initMyOrdersPage() {
        const container = $('#ordersListContainer');
        if (!container) return;
        
        const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/api/orders/user/${currentUser.email}`);
            const orders = await response.json();
            
            if (orders.length === 0) {
                container.innerHTML = `<div class="empty-orders-container"><h2>You have no orders yet!</h2><p>Your future orders will appear here.</p><a href="shop.html" class="btn primary">Start Shopping</a></div>`;
                return;
            }

            container.innerHTML = orders.map(order => {
                const statusClass = order.status.toLowerCase();
                let productImagesHTML = '';
                try {
                    const productSummary = JSON.parse(order.products_summary);
                    if (Array.isArray(productSummary)) {
                         productImagesHTML = productSummary.map(item => 
                            `<img src="${item.image || 'https://placehold.co/100x100'}" alt="${item.name}" class="product-preview-img">`
                        ).join('');
                    }
                } catch (e) { console.error("Could not parse products_summary", e); }
                
                const showCancelButton = order.status !== 'Delivered' && order.status !== 'Cancelled';

                return `
                <div class="order-item-card" data-order-id="${order.id}">
                    <div class="order-card-header">
                        <div class="order-info">
                            <span>Order ID: <strong>${order.orderId}</strong></span>
                            <span>Date: <strong>${new Date(order.orderDate).toLocaleDateString()}</strong></span>
                            <span>Total: <strong>${Rs(order.total)}</strong></span>
                        </div>
                        <div class="order-status-badge ${statusClass}">${order.status}</div>
                    </div>
                    <div class="order-card-body">
                        <div class="product-preview-list">${productImagesHTML}</div>
                        <div class="order-actions">
                            <button class="btn view-details-btn" data-order-id="${order.id}">View Details</button>
                            ${showCancelButton ? `<button class="btn danger cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>` : ''}
                        </div>
                    </div>
                </div>`;
            }).join('');
            
            // Add event listeners after rendering
            addEventListenersToOrderButtons();

        } catch (error) {
            container.innerHTML = `<p>Error fetching orders. Please try again later.</p>`;
        }
    }
    
    function addEventListenersToOrderButtons() {
        $$('.view-details-btn').forEach(button => {
            button.addEventListener('click', (e) => viewOrderDetails(e.currentTarget.dataset.orderId));
        });

        $$('.cancel-order-btn').forEach(button => {
            button.addEventListener('click', (e) => showCancelPopup(e.currentTarget.dataset.orderId));
        });
    }

    async function viewOrderDetails(orderId) {
        try {
            const res = await fetch(`http://localhost:5000/api/orders/${orderId}`);
            if(!res.ok) throw new Error("Order not found");
            const orderDetails = await res.json();
            
            let items = [];
            try {
                items = JSON.parse(orderDetails.products_summary);
            } catch (e) {
                console.error("Could not parse products summary for session storage", e);
            }

            const total = parseFloat(orderDetails.total);
            const delivery = 40;
            const subtotal = (total - delivery) / 1.05;
            const gst = subtotal * 0.05;

            const orderForSession = {
                ...orderDetails,
                items: items,
                pricing: {
                    total: total,
                    subtotal: subtotal,
                    delivery: delivery,
                    gst: gst
                }
            };
            sessionStorage.setItem('lastOrder', JSON.stringify(orderForSession));
            window.location.href = 'order.html';

        } catch (error) {
            console.error("Error in viewOrderDetails:", error);
            showToast("Could not fetch order details.", true);
        }
    }

    function showCancelPopup(orderId) {
        const popup = $('#cancelPopup');
        if(!popup) return;
        popup.hidden = false;
        // Store orderId on the confirmation button
        $('#confirmCancelBtn').dataset.orderId = orderId;
    }

    async function handleCancelOrder() {
        const orderId = $('#confirmCancelBtn').dataset.orderId;
        if (!orderId) return;

        try {
            const response = await fetch(`http://localhost:5000/api/orders/${orderId}/cancel`, {
                method: 'PUT'
            });

            if (response.ok) {
                showToast("Order has been cancelled.");
                // Update UI without reloading
                const card = $(`.order-item-card[data-order-id='${orderId}']`);
                if(card) {
                    const statusBadge = card.querySelector('.order-status-badge');
                    if (statusBadge) {
                        statusBadge.textContent = 'Cancelled';
                        statusBadge.className = 'order-status-badge cancelled';
                    }
                    const cancelButton = card.querySelector('.cancel-order-btn');
                    if (cancelButton) cancelButton.remove();
                }
            } else {
                const errorData = await response.json();
                showToast(errorData.message || "Failed to cancel the order.", true);
            }
        } catch (error) {
            console.error("Error in handleCancelOrder:", error);
            showToast("An error occurred. Please try again.", true);
        } finally {
            // Hide popup after action
            $('#cancelPopup').hidden = true;
        }
    }

    function setupPopupEventListeners() {
        const popup = $('#cancelPopup');
        if (!popup) return;
        
        $('#closePopupBtn').addEventListener('click', () => {
            popup.hidden = true;
        });

        $('#confirmCancelBtn').addEventListener('click', handleCancelOrder);
    }

    function initializeApp() {
        const path = window.location.pathname;
        if (path.endsWith('order.html')) {
            initOrderPage();
        } else if (path.endsWith('my_orders.html')) {
            initMyOrdersPage();
            // Setup listeners for the popup that exists on my_orders.html
            setupPopupEventListeners();
        }
    }

    document.addEventListener("DOMContentLoaded", initializeApp);

})();
