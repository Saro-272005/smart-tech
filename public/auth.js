// ===================================================================
// AUTH SCRIPT (for login.html)
// ===================================================================

// --- Common Code Start ---
const $ = sel => document.querySelector(sel);

function showToast(message, isError = false) {
    const existingToast = $('.custom-toast');
    if (existingToast) existingToast.remove();
    const toast = document.createElement('div');
    toast.className = `custom-toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    
    // Intha page-la header illa, so top la irunthu position pannalam.
    toast.style.top = `20px`;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
// --- Common Code End ---


// --- Page-Specific Logic for login.html ---

function showLoginForm() {
    $('#registerFormContainer').style.display = 'none';
    $('#loginFormContainer').style.display = 'block';
}

function showRegisterForm() {
    $('#loginFormContainer').style.display = 'none';
    $('#registerFormContainer').style.display = 'block';
}

async function handleLogin(e) {
    e.preventDefault();
    const email = $('#loginEmail').value;
    const password = $('#loginPassword').value;

    try {
        const res = await fetch("http://localhost:5000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.status === "success") {
            sessionStorage.setItem("isLoggedIn", "true");
            sessionStorage.setItem("currentUser", JSON.stringify(data.user));
            showToast("Login Successful!");

            // Cart transfer logic
            const anonymousCart = JSON.parse(sessionStorage.getItem('cart_anonymous') || '[]');
            if (anonymousCart.length > 0) {
                const userEmail = data.user.email;
                let userCart = JSON.parse(localStorage.getItem(`cart_${userEmail}`) || '[]');
                
                anonymousCart.forEach(anonItem => {
                    const existingItem = userCart.find(userItem => userItem.cartId === anonItem.cartId);
                    if (existingItem) {
                        existingItem.qty += anonItem.qty;
                    } else {
                        userCart.push(anonItem);
                    }
                });
                
                localStorage.setItem(`cart_${userEmail}`, JSON.stringify(userCart));
                sessionStorage.removeItem('cart_anonymous');
            }


            if (data.user.role === "admin") {
                window.location.href = "/admin.html";
            } else {
                window.location.href = "/index.html";
            }
        } else {
            showToast(data.message || "Invalid email or password.", true);
        }
    } catch (err) {
        console.error("Login Error:", err);
        showToast("Something went wrong. Try again later.", true);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const first_name = $('#registerFirstName').value.trim();
    const last_name = $('#registerLastName').value.trim();
    const email = $('#registerEmail').value;
    const password = $('#registerPassword').value;
    const confirmPassword = $('#registerConfirmPassword').value;

    if (password !== confirmPassword) {
        showToast("Passwords do not match!", true);
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ first_name, last_name, email, password })
        });
        const data = await res.json();
        if (data.status === "success") {
            showToast("Registration successful! Please login.");
            showLoginForm();
        } else {
            showToast(data.message || "Registration failed.", true);
        }
    } catch (err) {
        console.error("Register Error:", err);
        showToast("Something went wrong. Try again later.", true);
    }
}

