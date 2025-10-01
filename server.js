/* server.js */
import express from "express";
import mysql from "mysql2";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import Razorpay from "razorpay";
import crypto from "crypto";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// --- STATIC FILE SERVING CHANGES ---
// Serve all files directly under /public (e.g., /index.html)
app.use(express.static(path.join(__dirname, "public")));
// Serve user-uploaded files from /uploads (e.g., /uploads/image.jpg)
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
// ADDED THIS LINE: Explicitly serve /images from public/images for general assets
app.use("/images", express.static(path.join(__dirname, "public/images")));
// --- END STATIC FILE SERVING CHANGES ---

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

// --- START: MODIFIED DATABASE CONNECTION FOR TIDB CLOUD ---
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 4000, // Port for TiDB Cloud
  ssl: {
    // TiDB Cloud requires SSL connection
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});
// --- END: MODIFIED DATABASE CONNECTION FOR TIDB CLOUD ---

db.connect((err) => {
  if (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  } else {
    console.log("✅ MySQL (TiDB Cloud) connected successfully!");
  }
});
const createServicesTableSql = `
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    deviceType VARCHAR(50) NOT NULL,
    model VARCHAR(255),
    issue TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`;
db.query(createServicesTableSql, (err) => {
  if (err) {
    console.error("❌ Error creating services table:", err);
  }
});
const createOrdersTableSql = `
    CREATE TABLE IF NOT EXISTS orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        orderId VARCHAR(100),
        orderDate DATE NOT NULL,
        userEmail VARCHAR(255) NOT NULL,
        customerName VARCHAR(255) NOT NULL,
        customerPhone VARCHAR(255) NOT NULL,
        customerAddress TEXT NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        status ENUM('Pending', 'Paid', 'Shipped', 'Cancelled', 'Delivered') DEFAULT 'Pending',
        products_summary JSON,
        payment_method VARCHAR(50) DEFAULT 'Online Pay',
        razorpay_order_id VARCHAR(255),
        razorpay_payment_id VARCHAR(255),
        email_summary JSON,
        userId INT, 
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL 
    );
`;
db.query(createOrdersTableSql, (err) => {
    if (err) {
        console.error("❌ Error creating orders table:", err);
    }
});
const createAdvertisementsTableSql = `
    CREATE TABLE IF NOT EXISTS advertisements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;
db.query(createAdvertisementsTableSql, (err) => {
    if (err) {
        console.error("❌ Error creating advertisements table:", err);
    }
});
const otpStore = new Map();
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'sts.smarttechshop2025@gmail.com',
        pass: 'klqf bctp emuj tmtv'
    }
});
const formatOrderSummary = (summaryJson) => {
    try {
        const products = (typeof summaryJson === 'string') ? JSON.parse(summaryJson) : summaryJson;
        let productDetails = '';
        if (!Array.isArray(products) || products.length === 0) {
             return '<p style="margin: 5px 0; color: #e74c3c;">Product details unavailable.</p>';
        }
        products.forEach(p => {
            const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const itemQty = p.quantity || 1;
            productDetails += `
                <p style="margin: 5px 0; padding-bottom: 5px; border-bottom: 1px dashed #eee;">
                    <strong style="color: #333;">Product:</strong> ${p.name} (Qty: ${itemQty})<br>
                    <strong style="color: #555;">Price (Unit):</strong> ₹${price}
                </p>
            `;
        });
        return productDetails;
    } catch (e) {
        console.error("Error parsing products_summary for email:", e);
        return '<p style="margin: 5px 0; color: #e74c3c;">Error loading product details.</p>';
    }
};
const sendOrderConfirmationEmail = (orderData) => {
    try {
        const summary = JSON.parse(orderData.email_summary);
        const customerFirstName = orderData.customerName.split(' ')[0] || 'Valued Customer';
        const productDetailsHtml = summary.products.map(p => {
            const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const itemQty = p.quantity || 1;
            return `
                <div style="margin: 5px 0; padding: 5px 0; border-bottom: 1px dashed #eee;">
                    <p style="margin: 0; font-weight: bold; color: #333;">Product: ${p.name}</p>
                    <p style="margin: 0 0 5px 0; color: #555; font-size: 14px;">Price: ₹${price} x ${itemQty}</p>
                </div>
            `;
        }).join('');
        const totalAmount = parseFloat(summary.totals.total).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const subtotal = parseFloat(summary.totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const gst = parseFloat(summary.totals.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const delivery = parseFloat(summary.totals.delivery).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const paymentStatusText = summary.paymentStatus;
        const paymentStatusColor = paymentStatusText.includes('Paid') ? '#2ecc71' : '#e74c3c';
        const paymentMethodDisplay = orderData.paymentMethod.toLowerCase().includes('cod') 
            ? 'Cash on Delivery' 
            : orderData.paymentMethod.toUpperCase().replace('-', ' - ');
        const mailOptions = {
            from: process.env.MAIL_USER || 'sts.smarttechshop2025@gmail.com',
            to: orderData.userEmail,
            subject: `🎉 Smart Tech Order #${orderData.orderId} Confirmed!`,
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                    <h2 style="color: #333; text-align: center;">Smart Tech Shop</h2>
                    <h3 style="color: #4CAF50; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 15px;">Your Order Has Been Placed!</h3>
                    <p>Hello **${customerFirstName}**, </p>
                    <p>Thank you for your order! Your order details are below:</p>
                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 20px; background-color: #f9f9f9;">
                        <p style="margin: 5px 0; font-size: 1.1em; font-weight: bold; color: #333;">Order ID: ${orderData.orderId}</p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                        ${productDetailsHtml}
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                        <table style="width: 100%; font-size: 14px; color: #555;">
                            <tr><td style="padding: 3px 0;">Subtotal:</td><td style="text-align: right;">₹${subtotal}</td></tr>
                            <tr><td style="padding: 3px 0;">GST (5%):</td><td style="text-align: right;">+ ₹${gst}</td></tr>
                            <tr><td style="padding: 3px 0; border-bottom: 1px solid #ddd;">Delivery Charges:</td><td style="text-align: right; border-bottom: 1px solid #ddd;">+ ₹${delivery}</td></tr>
                            <tr><td style="padding: 8px 0; font-size: 1.2em; font-weight: bold; color: #333;">Total Amount:</td><td style="text-align: right; font-size: 1.2em; font-weight: bold; color: #2ecc71;">₹${totalAmount}</td></tr>
                        </table>
                        <p style="margin: 15px 0 5px 0;">
                            <strong>Payment Status:</strong> <span style="font-weight: bold; color: ${paymentStatusColor};">${paymentStatusText}</span>
                        </p>
                        <p style="margin: 5px 0;">
                            <strong>Payment Method:</strong> ${paymentMethodDisplay}
                        </p>
                    </div>
                    <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #333;">Shipping Address</h4>
                        <p style="margin: 0; font-size: 14px; color: #555;">${summary.shippingAddress || 'N/A'}</p>
                    </div>
                    <p style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">Thank you for shopping with Smart Tech!</p>
                </div>
            `
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.error("❌ Nodemailer Error (Order Confirmation):", error);
            }
        });
    } catch (e) {
        console.error("❌ Error sending Order Confirmation Email:", e);
    }
}
const sendOrderStatusEmail = (order, orderId) => {
    if (order.status === 'Cancelled' || order.status === 'Delivered' || order.status === 'Shipped' || order.status === 'Paid') {
        try {
            const summary = (typeof order.email_summary === 'string') ? JSON.parse(order.email_summary) : order.email_summary;
            if (!summary || !summary.products || !summary.totals) {
                console.error("❌ Cannot send status email: email_summary is missing or malformed.");
                return;
            }
            const customerFirstName = order.customerName.split(' ')[0] || 'Valued Customer';
            const statusTitles = {
                'Paid': '✅ Your Smart Tech Order is Confirmed and Paid!',
                'Shipped': '🚚 Your Smart Tech Order Has Been Shipped!',
                'Delivered': '🎉 Your Smart Tech Order Has Been Delivered!',
                'Cancelled': '❌ Your Smart Tech Order Has Been Cancelled',
            };
            const statusSubject = statusTitles[order.status] || `Smart Tech Order #${order.orderId || orderId} Status Update: ${order.status}`;
            const productDetailsHtml = summary.products.map(p => {
                const price = parseFloat(p.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                const itemQty = p.quantity || 1;
                return `
                    <div style="margin: 5px 0; padding: 5px 0; border-bottom: 1px dashed #eee;">
                        <p style="margin: 0; font-weight: bold; color: #333;">Product: ${p.name}</p>
                        <p style="margin: 0 0 5px 0; color: #555; font-size: 14px;">Price: ₹${price} x ${itemQty}</p>
                    </div>
                `;
            }).join('');
            const totalAmount = parseFloat(summary.totals.total).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const subtotal = parseFloat(summary.totals.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const gst = parseFloat(summary.totals.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const delivery = parseFloat(summary.totals.delivery).toLocaleString('en-IN', { minimumFractionDigits: 2 });
            const paymentStatusText = summary.paymentStatus;
            const paymentStatusColor = paymentStatusText.includes('Paid') ? '#2ecc71' : '#e74c3c';
            const paymentMethodDisplay = order.payment_method.toLowerCase().includes('cod') 
                ? 'Cash on Delivery' 
                : order.payment_method.toUpperCase().replace('-', ' - ');
            const mailOptions = {
                from: process.env.MAIL_USER || 'sts.smarttechshop2025@gmail.com', 
                to: order.userEmail, 
                subject: statusSubject,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #333; text-align: center;">Smart Tech Shop</h2>
                        <h3 style="color: ${order.status === 'Cancelled' ? '#e74c3c' : '#4CAF50'}; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 15px;">${statusSubject}</h3>
                        <p>Hello **${customerFirstName}**, </p>
                        <p>Your order **#${order.orderId || orderId}** status has been updated to **${order.status}**.</p>
                        <p>
                            ${order.status === 'Paid' ? 'Your payment has been successfully processed. We are now preparing your order for shipment!' :
                              order.status === 'Shipped' ? 'Your package is on its way and should arrive soon! Check your email for tracking details if applicable.' : 
                              order.status === 'Delivered' ? 'We hope you enjoy your new tech! Thank you for your purchase.' :
                              order.status === 'Cancelled' ? 'The order has been cancelled as requested or due to an issue. Please contact support for any refund queries.' : ''}
                        </p>
                        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 20px; background-color: #f9f9f9;">
                            <p style="margin: 5px 0; font-size: 1.1em; font-weight: bold; color: #333;">Order ID: ${order.orderId || orderId}</p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                            ${productDetailsHtml}
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                            <table style="width: 100%; font-size: 14px; color: #555;">
                                <tr><td style="padding: 3px 0;">Subtotal:</td><td style="text-align: right;">₹${subtotal}</td></tr>
                                <tr><td style="padding: 3px 0;">GST (5%):</td><td style="text-align: right;">+ ₹${gst}</td></tr>
                                <tr><td style="padding: 3px 0; border-bottom: 1px solid #ddd;">Delivery Charges:</td><td style="text-align: right; border-bottom: 1px solid #ddd;">+ ₹${delivery}</td></tr>
                                <tr><td style="padding: 8px 0; font-size: 1.2em; font-weight: bold; color: #333;">Total Amount:</td><td style="text-align: right; font-size: 1.2em; font-weight: bold; color: #2ecc71;">₹${totalAmount}</td></tr>
                            </table>
                            <p style="margin: 15px 0 5px 0;">
                                <strong>Payment Status:</strong> <span style="font-weight: bold; color: ${paymentStatusColor};">${paymentStatusText}</span>
                            </p>
                            <p style="margin: 5px 0;">
                                <strong>Payment Method:</strong> ${paymentMethodDisplay}
                            </p>
                        </div>
                        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; margin-top: 15px;">
                            <h4 style="margin: 0 0 10px 0; color: #333;">Shipping Address</h4>
                            <p style="margin: 0; font-size: 14px; color: #555;">${order.customerAddress || 'N/A'}</p>
                        </div>
                        <p style="margin-top: 20px; text-align: center; font-size: 12px; color: #777;">Thank you for shopping with Smart Tech!</p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    return console.error("❌ Nodemailer Error (Order Status):", error);
                }
            });
        } catch (e) {
            console.error("❌ Error sending Order Status Email (Parsing/Data Error):", e);
        }
    }
};
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RH4lIyt42awGG1",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "igS5C3h1Oiuv7TK1E2gB3wLg",
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT id, first_name, last_name, email, password, role FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("❌ Login DB error:", err);
      return res.status(500).json({ status: "error", message: "Internal server error." });
    }
    if (results.length === 0) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Invalid email or password." });
    }
    if (user.role === 'admin') {
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ 
        status: "success", 
        message: "Admin login successful.", 
        user: userWithoutPassword,
        otp_required: false,
      });
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = Date.now() + 5 * 60 * 1000;
    otpStore.set(email, { otp, expiry, user });
    const mailOptions = {
        from: process.env.MAIL_USER || 'sts.smarttechshop2025@gmail.com',
        to: email,
        subject: 'Smart Tech Shop - Your One-Time Password (OTP)',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                <h3 style="color: #333; text-align: center;">Smart Tech Shop Login OTP</h3>
                <p>Hello ${user.first_name},</p>
                <p>Please use the following One-Time Password (OTP) to complete your login:</p>
                <h1 style="color: #4CAF50; text-align: center; font-size: 36px; padding: 10px; border: 2px dashed #4CAF50; border-radius: 5px;">${otp}</h1>
                <p>This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>
                <p style="margin-top: 20px; font-size: 12px; color: #777;">Thank you for shopping with Smart Tech!</p>
            </div>
        `
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("❌ Nodemailer Error (OTP):", error);
            otpStore.delete(email);
            return res.status(500).json({ status: "error", message: "Failed to send OTP. Please try again." });
        }
        res.json({ 
            status: "pending_otp", 
            message: "OTP sent to your email. Please verify.", 
            email: email, 
            otp_required: true 
        });
    });
  });
});
app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    const otpData = otpStore.get(email);
    if (!otpData) {
        return res.status(401).json({ status: "error", message: "OTP not found. Please resend or log in again." });
    }
    if (Date.now() > otpData.expiry) {
        otpStore.delete(email);
        return res.status(401).json({ status: "error", message: "OTP expired. Please log in again." });
    }
    if (otpData.otp !== otp) {
        return res.status(401).json({ status: "error", message: "Invalid OTP." });
    }
    otpStore.delete(email);
    const { password: _, ...userWithoutPassword } = otpData.user;
    res.json({ 
        status: "success", 
        message: "Login successful.", 
        user: userWithoutPassword 
    });
});
app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const sql = "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)";
  db.query(sql, [first_name, last_name, email, hashedPassword], (err, result) => {
    if (err) {
      console.error("❌ Registration DB error:", err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ status: "error", message: "Email already registered." });
      }
      return res.status(500).json({ status: "error", message: "Internal server error." });
    }
    res.status(201).json({ status: "success", message: "Registration successful." });
  });
});
app.post('/api/orders', (req, res) => {
    const { orderId, userEmail, customerName, customerPhone, customerAddress, total, products_summary, razorpay_order_id, paymentMethod, userId, email_summary, status } = req.body;
    const summaryToStore = typeof products_summary === 'string' ? products_summary : JSON.stringify(products_summary);
    const emailSummaryToStore = typeof email_summary === 'string' ? email_summary : JSON.stringify(email_summary);
    const initialStatus = status || 'Pending'; 
    const sql = `
        INSERT INTO orders (orderId, orderDate, userEmail, customerName, customerPhone, customerAddress, total, status, products_summary, email_summary, razorpay_order_id, payment_method, userId) 
        VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)
    `;
    const params = [
        orderId, 
        userEmail, 
        customerName, 
        customerPhone, 
        customerAddress, 
        total, 
        initialStatus, 
        summaryToStore, 
        emailSummaryToStore,
        razorpay_order_id || null, 
        paymentMethod || 'Online Pay',
        userId 
    ];
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('❌ Error creating order:', err);
            console.error('SQL:', sql);
            console.error('Params:', params);
            return res.status(500).json({ error: 'Internal Server Error', details: err.sqlMessage });
        }
        sendOrderConfirmationEmail(req.body); 
        res.status(201).json({ message: 'Order created successfully', id: result.insertId, orderId: orderId });
    });
});
app.get('/api/orders', (req, res) => {
    const sql = 'SELECT * FROM orders ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('❌ Error fetching orders:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.status(200).json(results);
    });
});
app.get('/api/orders/user/:email', (req, res) => {
    const { email } = req.params;
    const sql = 'SELECT * FROM orders WHERE userEmail = ? ORDER BY id DESC';
    db.query(sql, [email], (err, result) => {
        if (err) {
            console.error('❌ Error fetching user orders:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        res.status(200).json(result);
    });
});
app.get('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM orders WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error fetching order:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(result[0]);
    });
});
app.get('/api/sales-report', (req, res) => {
    const { startDate, endDate } = req.query;
    let dateFilter = '1=1';
    const params = [];
    if (startDate) {
        dateFilter += ' AND orderDate >= ?';
        params.push(startDate);
    }
    if (endDate) {
        dateFilter += ' AND orderDate <= ?';
        params.push(endDate);
    }
    const sql = `
        SELECT 
            products_summary,
            orderDate,
            total
        FROM orders
        WHERE status IN ('Paid', 'Delivered') AND ${dateFilter}
        ORDER BY orderDate DESC;
    `;
    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('❌ Error fetching sales report:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err.sqlMessage });
        }
        const productSalesSummary = {};
        let grandTotal = 0;
        results.forEach(order => {
            let products = [];
            try {
                products = (typeof order.products_summary === 'string') ? JSON.parse(order.products_summary) : order.products_summary;
            } catch (e) {
                console.error("Error parsing product summary for sales report:", e);
                return;
            }
            if (Array.isArray(products)) {
                products.forEach(product => {
                    const name = product.name + (product.specName ? ` (${product.specName})` : '');
                    const qty = parseInt(product.quantity || 0);
                    const price = parseFloat(product.price || product.mrp_price || 0);
                    const saleAmount = price * qty;
                    if (productSalesSummary[name]) {
                        productSalesSummary[name].totalSales += saleAmount;
                        productSalesSummary[name].totalQty += qty;
                    } else {
                        productSalesSummary[name] = {
                            name: name,
                            totalSales: saleAmount,
                            totalQty: qty
                        };
                    }
                });
            }
            grandTotal += parseFloat(order.total || 0);
        });
        const reportData = Object.values(productSalesSummary).sort((a, b) => b.totalSales - a.totalSales);
        res.status(200).json({
            report: reportData,
            grandTotal: grandTotal,
            totalOrders: results.length
        });
    });
});
app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const checkSql = 'SELECT orderId, payment_method, status FROM orders WHERE id = ?';
    db.query(checkSql, [id], (err, results) => {
        if (err) {
            console.error('❌ Error checking payment method:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        const currentPaymentMethod = results[0].payment_method;
        let newPaymentMethod = currentPaymentMethod;
        if (currentPaymentMethod === 'cod' || currentPaymentMethod === 'COD - Paid') {
            if (status === 'Delivered') {
                newPaymentMethod = 'COD - Paid';
            } else if (currentPaymentMethod === 'COD - Paid' && status !== 'Delivered') {
                newPaymentMethod = 'cod';
            }
        } 
        const updateSql = 'UPDATE orders SET status = ?, payment_method = ? WHERE id = ?';
        const params = [status, newPaymentMethod, id];
        db.query(updateSql, params, (err, result) => {
            if (err) {
                console.error('❌ Error updating order status/payment:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Order not found or no changes made' });
            }
            const fetchOrderDetailsSql = `
                SELECT 
                    orderId, userEmail, customerName, customerAddress, total, status, products_summary, payment_method, email_summary
                FROM orders 
                WHERE id = ?
            `;
            db.query(fetchOrderDetailsSql, [id], (fetchErr, fetchResults) => {
                if (fetchErr) {
                    console.error("❌ Error fetching order details for email:", fetchErr);
                    return res.status(200).json({ message: "Order status updated successfully (Email failed to send)." });
                }
                if (fetchResults.length > 0) {
                    const order = fetchResults[0];
                    sendOrderStatusEmail(order, id);
                    return res.status(200).json({ message: "Order status updated successfully and email sent." });
                }
                res.status(200).json({ message: "Order status updated successfully (Order details not found for email)." });
            });
        });
    });
});
app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM orders WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('❌ Error deleting order:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        const countSql = "SELECT COUNT(*) AS count FROM orders";
        db.query(countSql, (countErr, countResult) => {
            if (countErr) {
                console.error("❌ Error checking order count after deletion:", countErr);
                return res.json({ message: "✅ Order deleted, but failed to check table count." });
            }
            if (countResult[0].count === 0) {
                const resetSql = "ALTER TABLE orders AUTO_INCREMENT = 1";
                db.query(resetSql, (resetErr, resetResult) => {
                    if (resetErr) {
                        console.error("❌ Error resetting AUTO_INCREMENT:", resetErr);
                        return res.json({ message: "✅ Order deleted, but failed to reset ID counter." });
                    }
                    return res.json({ message: "✅ Order deleted and ID counter reset." });
                });
            } else {
                res.json({ message: "✅ Order deleted" });
            }
        });
    });
});
app.post('/api/create-razorpay-order', async (req, res) => {
  const { amount, receipt } = req.body;
  try {
    const order = await razorpay.orders.create({
      amount: amount,
      currency: "INR",
      receipt: receipt,
      payment_capture: 1
    });
    res.json(order);
  } catch (error) {
    console.error("❌ Razorpay error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } =
    req.body;
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const RAZORPAY_KEY_SECRET =
    process.env.RAZORPAY_KEY_SECRET || "igS5C3h1Oiuv7TK1E2gB3wLg";
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");
  if (expectedSignature === razorpay_signature) {
    res.json({ status: "success", message: "Payment verified successfully" });
  } else {
    res
      .status(400)
      .json({ status: "failure", message: "Invalid Razorpay signature" });
  }
});
app.get('/api/products/alter-table-for-prices-null', (req, res) => {
  const sql = `
    ALTER TABLE products 
    MODIFY COLUMN price DECIMAL(10,2) NULL DEFAULT NULL,
    MODIFY COLUMN mrp_price DECIMAL(10,2) NULL DEFAULT NULL;
  `;
  db.query(sql, (err, result) => {
    if (err) {
      console.error("❌ Error altering 'price' and 'mrp_price' columns:", err);
      return res.status(500).json({ status: "error", message: `DB alter table error: ${err.sqlMessage}` });
    }
    res.json({ status: "success", message: "✅ 'price' and 'mrp_price' columns altered successfully to allow NULL values." });
  });
});
app.put("/api/products/update-stock", (req, res) => {
    const { items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided for stock update." });
    }
    const updates = items.map(item => {
        const productId = item.id;
        const quantity = item.qty;
        const variantSpecName = item.variantSpecName; 
        return new Promise((resolve, reject) => {
            const getSql = "SELECT variants, stock, category FROM products WHERE id = ?";
            db.query(getSql, [productId], (err, results) => {
                if (err) {
                    console.error("❌ Error fetching product variants for stock update:", err);
                    return reject({ productId, error: err.sqlMessage });
                }
                if (results.length === 0) {
                    return reject({ productId, error: "Product not found" });
                }
                let product = results[0];
                let currentVariants = product.variants; 
                let mainStock = parseInt(product.stock) || 0;
                let category = product.category;
                let isVariantProduct = false;
                try {
                    if (typeof currentVariants === 'string') {
                        currentVariants = JSON.parse(currentVariants || '[]');
                    } else if (currentVariants === null || currentVariants === undefined) {
                        currentVariants = [];
                    }
                    if (Array.isArray(currentVariants) && currentVariants.length > 0) {
                        isVariantProduct = true;
                    } else {
                        currentVariants = [];
                    }
                } catch (e) {
                    console.error(`❌ Error parsing variants for product ID ${productId}:`, e);
                    return reject({ productId, error: "Internal variant data error" });
                }
                const isVariantCategory = ['mobiles', 'laptops', 'seconds'].includes(category);
                if (isVariantCategory && isVariantProduct && variantSpecName) {
                    const variantToUpdate = currentVariants.find(v => v.specName === variantSpecName);
                    if (!variantToUpdate) {
                        console.error(`❌ Variant Not Found: Product ID ${productId} requested variant '${variantSpecName}' not found.`);
                        return reject({ productId, error: `Variant '${variantSpecName}' not found for product.` });
                    }
                    let variantStock = parseInt(variantToUpdate.stock) || 0;
                    if (variantStock < quantity) {
                        return reject({ productId, error: `Not enough stock for variant '${variantSpecName}'. Available: ${variantStock}, Requested: ${quantity}` });
                    }
                    variantStock -= quantity;
                    variantToUpdate.stock = variantStock;
                    mainStock = currentVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
                } else if (!isVariantCategory || (!isVariantProduct && !variantSpecName)) {
                    if (mainStock < quantity) {
                         return reject({ productId, error: "Not enough stock for this simple product." });
                    }
                    mainStock -= quantity;
                } else {
                    const errorMsg = isVariantCategory && isVariantProduct && !variantSpecName 
                        ? `Product is a variant type, but no variantSpecName provided in the order item.`
                        : `Invalid order data for product ID ${productId}.`;
                    return reject({ productId, error: errorMsg });
                }
                const updateSql = "UPDATE products SET variants = ?, stock = ? WHERE id = ?";
                db.query(updateSql, [JSON.stringify(currentVariants), mainStock, productId], (err, result) => {
                    if (err) {
                        console.error("❌ Error updating product stock with variants:", err);
                        return reject({ productId, error: err.sqlMessage });
                    }
                    if (result.affectedRows === 0) {
                        return reject({ productId, error: "Product not found during update" });
                    }
                    resolve({ productId, message: "Stock updated successfully" });
                });
            });
        });
    });
    Promise.all(updates.map(p => p.catch(e => e)))
        .then(results => {
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.warn("⚠️ Some stock updates failed:", errors);
                return res.status(500).json({ message: "Some stock updates failed.", errors });
            }
            res.json({ message: "✅ All stock updated successfully" });
        })
        .catch(err => {
            console.error("❌ Overall stock update error:", err);
            res.status(500).json({ error: "Internal server error during stock update." });
        });
});
app.get("/api/products", (req, res) => {
  const sql = "SELECT id, name, category, brand, price, mrp_price, stock, images, description, specs, rating, reviews, ratingBreakdown, created_at, variants, discount_end_date FROM products ORDER BY id ASC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching products:", err);
      return res.status(500).json({ error: "DB fetch error" });
    }
    const cleanedResults = results.map(product => {
      let variants = product.variants;
      let specs = product.specs;
      try {
          if (typeof variants === 'string' && variants !== 'null' && !variants.startsWith('[') && !variants.startsWith('{')) {
               console.warn(`❌ Malformed variants data for product ID ${product.id}. Resetting to empty array.`);
               variants = '[]';
          }
      } catch (e) {
          console.warn(`❌ Error parsing variants for product ID ${product.id}. Resetting to empty array.`);
          variants = '[]';
      }
      try {
          if (typeof specs === 'string' && specs !== 'null' && !specs.startsWith('{')) {
               console.warn(`❌ Malformed specs data for product ID ${product.id}. Resetting to empty object.`);
               specs = '{}';
          }
      } catch (e) {
          console.warn(`❌ Error parsing specs for product ID ${product.id}. Resetting to empty object.`);
          specs = '{}';
      }
      return { ...product, variants, specs };
    });
    res.json(cleanedResults);
  });
});
app.get("/api/products/:id", (req, res) => {
  const sql = "SELECT id, name, category, brand, price, mrp_price, stock, images, description, specs, rating, reviews, ratingBreakdown, created_at, variants, discount_end_date FROM products WHERE id = ?";
  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error("❌ Error fetching product:", err);
      return res.status(500).json({ error: "Internal server error." });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    const product = results[0];
    let variants = product.variants;
    let specs = product.specs;
    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch (e) {
        console.warn(`❌ Error parsing variants for product ID ${product.id}. Using default empty array.`);
        variants = [];
      }
    }
    if (typeof specs === 'string') {
      try {
        specs = JSON.parse(specs);
      } catch (e) {
        console.warn(`❌ Error parsing specs for product ID ${product.id}. Using default empty object.`);
        specs = {};
      }
    }
    res.json({ ...product, variants, specs });
  });
});
app.post("/api/products", upload.array('images', 3), (req, res) => {
  const { name, category, brand, price, mrp_price, stock, description, specs, variants, discount_end_date } = req.body;
  const images = req.files ? req.files.map(file => `/uploads/${file.filename}`) : [];
const finalPrice = (!price || price === 'null' || isNaN(parseFloat(price))) 
  ? null 
  : parseFloat(price);
const finalMrpPrice = (!mrp_price || mrp_price === 'null' || isNaN(parseFloat(mrp_price))) 
  ? null 
  : parseFloat(mrp_price);
const finalStock = (!stock || stock === 'null' || isNaN(parseInt(stock))) 
  ? 0
  : parseInt(stock);
let finalDiscountEndDate = null;
if (discount_end_date && discount_end_date !== 'null' && discount_end_date.trim() !== '') {
  finalDiscountEndDate = discount_end_date.split('T')[0]; 
}
  if (finalMrpPrice === null || isNaN(finalMrpPrice)) {
      return res.status(400).json({ error: "MRP is required and must be a valid number." });
  }
  if (finalStock === null || isNaN(finalStock)) {
      return res.status(400).json({ error: "Stock is required and must be a valid number." });
  }
  const sql = `INSERT INTO products (name, category, brand, price, mrp_price, stock, description, specs, images, variants, discount_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.query(sql, [name, category, brand || null, finalPrice, finalMrpPrice, finalStock, description || null, specs || '{}', JSON.stringify(images), variants || '[]', finalDiscountEndDate], (err, result) => {
    if (err) {
      console.error("❌ Error inserting product:", err);
      return res.status(500).json({ error: `DB insert error: ${err.sqlMessage}` });
    }
    res.status(201).json({ message: "✅ Product added", id: result.insertId });
  });
});
app.put("/api/products/:id", upload.array('images', 3), (req, res) => {
  const { name, category, brand, price, mrp_price, stock, description, specs, existingImages, variants, discount_end_date } = req.body;
  let finalImages = existingImages ? JSON.parse(existingImages) : [];
  if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      finalImages = finalImages.concat(newImages);
  }
  const finalPrice = (price === '' || price === 'null' || isNaN(parseFloat(price))) ? null : parseFloat(price);
  const finalMrpPrice = (mrp_price === '' || mrp_price === 'null' || isNaN(parseFloat(mrp_price))) ? null : parseFloat(mrp_price);
  const finalStock = (stock === '' || stock === 'null' || isNaN(parseInt(stock))) ? null : parseInt(stock);
  const finalDiscountEndDate = (discount_end_date === '' || discount_end_date === 'null') ? null : discount_end_date;
  const sql = `UPDATE products SET name=?, category=?, brand=?, price=?, mrp_price=?, stock=?, description=?, specs=?, images=?, variants=?, discount_end_date=? WHERE id=?`;
  db.query(sql, [name, category, brand, finalPrice, finalMrpPrice, finalStock, description, specs, JSON.stringify(finalImages), variants, finalDiscountEndDate, req.params.id], (err, result) => {
    if (err) {
      console.error("❌ Error updating product:", err);
      console.error("SQL Error Message:", err.sqlMessage);
      return res.status(500).json({ error: `DB update error: ${err.sqlMessage}` });
    }
    if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "✅ Product updated" });
  });
});
app.put("/api/products/rate/:id", (req, res) => {
    const { id } = req.params;
    const { rating, reviews, ratingBreakdown } = req.body;
    try {
        const sql = "UPDATE products SET rating = ?, reviews = ?, ratingBreakdown = ? WHERE id = ?";
        db.query(sql, [rating, reviews, JSON.stringify(ratingBreakdown), id], (err, result) => {
            if (err) {
                console.error("❌ Error updating product rating:", err);
                return res.status(500).json({ error: `DB update error: ${err.sqlMessage}` });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Product not found" });
            }
            res.json({ message: "✅ Product rating updated" });
        });
    } catch (error) {
        console.error("❌ Server-side error:", error);
        res.status(500).json({ error: `Server-side error: ${error.message}` });
    }
});
app.get("/api/products/add-rating-breakdown-column", (req, res) => {
    const sql = "ALTER TABLE products ADD COLUMN ratingBreakdown JSON NOT NULL DEFAULT ('{}')";
    db.query(sql, (err) => {
        if (err) {
            console.error("❌ Error adding ratingBreakdown column:", err);
            return res.status(500).json({ error: `DB alter table error: ${err.sqlMessage}` });
        }
        res.json({ message: "✅ 'ratingBreakdown' column added successfully." });
    });
});

// --- START: CORRECTED DELETE PRODUCT ROUTE (Always resets AUTO_INCREMENT to MAX(id) + 1) ---
app.delete("/api/products/:id", (req, res) => {
  const productId = req.params.id;
  const deleteSql = "DELETE FROM products WHERE id = ?";
  
  db.query(deleteSql, [productId], (err, result) => {
    if (err) {
      console.error("❌ Error deleting product:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // 1. Find the new maximum ID after deletion.
    const maxIdSql = "SELECT MAX(id) AS maxId FROM products";
    db.query(maxIdSql, (maxIdErr, maxIdResult) => {
      if (maxIdErr) {
        console.error("❌ Error checking max ID after deletion:", maxIdErr);
        // Still report success, as deletion worked.
        return res.json({ message: "✅ Product deleted, but failed to check max ID for counter reset." });
      }

      // Determine the value the AUTO_INCREMENT counter should be set to:
      // It should be the current max ID + 1. If the table is empty, maxIdResult[0].maxId is null, so we use 0 + 1 = 1.
      const currentMaxId = maxIdResult[0].maxId || 0;
      const nextAutoIncrementValue = currentMaxId + 1;

      // 2. Reset the AUTO_INCREMENT counter. This will ensure the next insert uses 
      //    the lowest available ID (MAX(id) + 1), ignoring the previous high count.
      const resetSql = `ALTER TABLE products AUTO_INCREMENT = ${nextAutoIncrementValue}`;
      db.query(resetSql, (resetErr) => {
        if (resetErr) {
          console.error("❌ Error resetting AUTO_INCREMENT:", resetErr);
          return res.json({ message: "✅ Product deleted, but failed to reset ID counter." });
        }
        
        // Final success response
        return res.json({ message: `✅ Product deleted and ID counter reset to ${nextAutoIncrementValue}.` });
      });
    });
  });
});
// --- END: CORRECTED DELETE PRODUCT ROUTE ---

app.post("/api/services", (req, res) => {
    const { name, phone, email, deviceType, model, issue } = req.body;
    const sql = `INSERT INTO services (name, phone, email, deviceType, model, issue) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [name, phone, email || null, deviceType, model || null, issue], (err, result) => {
        if (err) {
            console.error("❌ Error submitting service request:", err);
            return res.status(500).json({ error: "DB insert error" });
        }
        res.status(201).json({ message: "✅ Service request submitted", id: result.insertId });
    });
});
app.get("/api/services", (req, res) => {
    const sql = `SELECT * FROM services ORDER BY createdAt DESC`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching service requests:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        res.status(200).json(results);
    });
});
app.put("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const sql = `UPDATE services SET status = ? WHERE id = ?`;
    db.query(sql, [status, id], (err, result) => {
        if (err) {
            console.error("❌ Error updating service status:", err);
            return res.status(500).json({ error: "DB update error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Service request not found or no changes made' });
        }
        res.status(200).json({ message: '✅ Service status updated successfully' });
    });
});
app.delete("/api/services/:id", (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM services WHERE id = ?`;
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("❌ Error deleting service request:", err);
            return res.status(500).json({ error: "DB deletion error" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Service request not found" });
        }
        const countSql = "SELECT COUNT(*) AS count FROM services";
        db.query(countSql, (countErr, countResult) => {
            if (countErr) {
                console.error("❌ Error checking service count after deletion:", countErr);
                return res.json({ message: "✅ Service request deleted, but failed to check table count." });
            }
            if (countResult[0].count === 0) {
                const resetSql = "ALTER TABLE services AUTO_INCREMENT = 1";
                db.query(resetSql, (resetErr) => {
                    if (resetErr) {
                        console.error("❌ Error resetting AUTO_INCREMENT:", resetErr);
                        return res.json({ message: "✅ Service request deleted, but failed to reset ID counter." });
                    }
                    return res.json({ message: "✅ Service request deleted and ID counter reset." });
                });
            } else {
                res.json({ message: "✅ Service request deleted" });
            }
        });
    });
});
app.post("/api/send-message", (req, res) => {
    const { type, phone, email, message } = req.body;
    try {
        if (type === 'email' && email) {
            const mailOptions = {
                from: process.env.MAIL_USER,
                to: email,
                subject: 'Smart Tech Shop - Service Request Update',
                text: message
            };
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("❌ Email sending failed:", error);
                    return res.status(500).json({ error: "Email sending failed." });
                }
                res.status(200).json({ message: "Email sent successfully!" });
            });
        } else {
            res.status(400).json({ error: "Invalid request type or missing recipient." });
        }
    } catch (err) {
        console.error("❌ Unexpected server error:", err);
        res.status(500).json({ error: `Unexpected server error: ${err.message}` });
    }
});
app.post("/api/advertisements", upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Image file is required." });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    const { description } = req.body;
    const sql = `INSERT INTO advertisements (image_url, description) VALUES (?, ?)`;
    db.query(sql, [imageUrl, description || null], (err, result) => {
        if (err) {
            console.error("❌ Error inserting advertisement:", err);
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("❌ Error deleting failed upload:", unlinkErr);
            });
            return res.status(500).json({ error: `DB insert error: ${err.sqlMessage}` });
        }
        res.status(201).json({ message: "✅ Advertisement added", id: result.insertId, image_url: imageUrl });
    });
});
app.get("/api/advertisements", (req, res) => {
    const sql = `SELECT * FROM advertisements ORDER BY created_at ASC`;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching advertisements:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        res.status(200).json(results);
    });
});
app.delete("/api/advertisements/:id", (req, res) => {
    const { id } = req.params;
    const selectSql = `SELECT image_url FROM advertisements WHERE id = ?`;
    db.query(selectSql, [id], (err, results) => {
        if (err) {
            console.error("❌ Error fetching ad URL for deletion:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Advertisement not found" });
        }
        const imageUrl = results[0].image_url;
        const filePath = path.join(__dirname, "public", imageUrl);
        const deleteSql = `DELETE FROM advertisements WHERE id = ?`;
        db.query(deleteSql, [id], (err, result) => {
            if (err) {
                console.error("❌ Error deleting advertisement:", err);
                return res.status(500).json({ error: "Internal Server Error" });
            }
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.warn(`⚠️ Could not delete physical file: ${filePath}. DB record deleted.`, unlinkErr);
                }
            });
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Advertisement not found" });
            }
            res.json({ message: "✅ Advertisement deleted" });
        });
    });
});
app.get('/api/monthly-revenue', (req, res) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const sql = 'SELECT SUM(total) AS monthlyRevenue FROM orders WHERE MONTH(orderDate) = ? AND YEAR(orderDate) = ? AND status = "Paid"';
    db.query(sql, [currentMonth, currentYear], (err, result) => {
        if (err) {
            console.error("❌ Dashboard monthly revenue error:", err);
            return res.status(500).json({ status: "error", message: "DB error" });
        }
        const monthlyRevenue = result[0].monthlyRevenue || 0;
        res.json({ status: "success", monthlyRevenue: monthlyRevenue });
    });
});
app.get("/api/top-selling-products", (req, res) => {
    const sql = `
        SELECT JSON_UNQUOTE(JSON_EXTRACT(products_summary, '$[0].name')) AS name,
               SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(products_summary, '$[0].quantity')) AS UNSIGNED)) AS units
        FROM orders
        GROUP BY name
        ORDER BY units DESC
        LIMIT 5
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching top selling products:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        res.json(results);
    });
});
app.get("/api/dashboard/monthly-orders", (req, res) => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const sql = `SELECT COUNT(*) AS total FROM orders WHERE MONTH(orderDate) = ? AND YEAR(orderDate) = ? AND status = 'Paid'`;
    db.query(sql, [currentMonth, currentYear], (err, result) => {
        if (err) {
            console.error("❌ Dashboard monthly orders error:", err);
            return res.status(500).json({ status: "error", message: "DB error" });
        }
        res.json({ status: "success", monthlyOrders: result[0].total });
    });
});
app.get("/api/customers", (req, res) => {
  const sql = "SELECT id, first_name, last_name, email, role, created_at FROM users WHERE role = 'user' ORDER BY created_at ASC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Customers fetch error:", err);
      return res.status(500).json({ status: "error", message: "DB error" });
    }
    res.json({ status: "success", customers: results });
  });
});
app.get("/api/review-report", (req, res) => {
    const { startDate, endDate } = req.query;
    let dateFilter = '1=1'; 
    const params = [];
    if (startDate) {
        dateFilter += ' AND r.createdAt >= ?';
        params.push(startDate);
    }
    if (endDate) {
        const nextDay = new Date(endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        dateFilter += ' AND r.createdAt < ?';
        params.push(nextDay.toISOString().split('T')[0]);
    }
    const sql = `
        SELECT 
            r.id, 
            r.rating, 
            r.comment, 
            r.createdAt, 
            u.email AS user_email,           -- Added user email
            p.name AS product_name           -- Existing product name
        FROM reviews r
        JOIN users u ON r.userId = u.id
        JOIN products p ON r.productId = p.id
        WHERE ${dateFilter}
        ORDER BY r.createdAt DESC
    `;
    db.query(sql, params, (err, results) => {
        if (err) {
            console.error("❌ Error fetching review report:", err);
            return res.status(500).json({ error: "DB fetch error" });
        }
        const formattedResults = results.map(row => ({
            id: row.id,
            product_name: row.product_name,
            user_email: row.user_email, // Changed from user_name to user_email
            rating: row.rating,
            comment: row.comment,
            createdAt: row.createdAt
        }));
        res.json(formattedResults);
    });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
