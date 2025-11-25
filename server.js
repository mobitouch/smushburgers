const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Session configuration
app.use(
  session({
    secret: "smush-burgers-secret-key-2025",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Admin password - CHANGE THIS!
const ADMIN_PASSWORD = "smushadmin2025";

// Path to data file
const DATA_FILE = path.join(__dirname, "data.json");

// Helper function to read menu data
function readMenuData() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading menu data:", error);
    return [];
  }
}

// Helper function to write menu data
function writeMenuData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
    return true;
  } catch (error) {
    console.error("Error writing menu data:", error);
    return false;
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// ============================================
// AUTH ROUTES
// ============================================

// Login
app.post("/api/auth/login", (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed" });
    } else {
      res.json({ success: true, message: "Logged out successfully" });
    }
  });
});

// Check auth status
app.get("/api/auth/status", (req, res) => {
  res.json({ isAuthenticated: !!req.session.isAuthenticated });
});

// ============================================
// MENU CRUD ROUTES (Protected)
// ============================================

// Get all menu items
app.get("/api/menu", requireAuth, (req, res) => {
  const menuData = readMenuData();
  res.json(menuData);
});

// Add new menu item
app.post("/api/menu", requireAuth, (req, res) => {
  const menuData = readMenuData();
  const { name, category, price, description } = req.body;

  // Generate new ID
  const newId =
    menuData.length > 0 ? Math.max(...menuData.map((item) => item.id)) + 1 : 1;

  const newItem = {
    id: newId,
    name,
    category,
    price: parseFloat(price),
    description: description || "",
  };

  menuData.push(newItem);

  if (writeMenuData(menuData)) {
    res.json({
      success: true,
      item: newItem,
      message: "Item added successfully",
    });
  } else {
    res.status(500).json({ success: false, message: "Failed to save item" });
  }
});

// Update menu item
app.put("/api/menu/:id", requireAuth, (req, res) => {
  const menuData = readMenuData();
  const itemId = parseInt(req.params.id);
  const { name, category, price, description } = req.body;

  const itemIndex = menuData.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }

  menuData[itemIndex] = {
    id: itemId,
    name,
    category,
    price: parseFloat(price),
    description: description || "",
  };

  if (writeMenuData(menuData)) {
    res.json({
      success: true,
      item: menuData[itemIndex],
      message: "Item updated successfully",
    });
  } else {
    res.status(500).json({ success: false, message: "Failed to update item" });
  }
});

// Delete menu item
app.delete("/api/menu/:id", requireAuth, (req, res) => {
  const menuData = readMenuData();
  const itemId = parseInt(req.params.id);

  const filteredData = menuData.filter((item) => item.id !== itemId);

  if (filteredData.length === menuData.length) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }

  if (writeMenuData(filteredData)) {
    res.json({ success: true, message: "Item deleted successfully" });
  } else {
    res.status(500).json({ success: false, message: "Failed to delete item" });
  }
});

// ============================================
// PUBLIC MENU ROUTE (for main website)
// ============================================

// Public endpoint to get menu data (no auth required)
app.get("/data.json", (req, res) => {
  const menuData = readMenuData();
  res.json(menuData);
});

// Start server
app.listen(PORT, () => {
  console.log(`📊 Admin panel: http://localhost:${PORT}/loginadminonly.html`);
  console.log(`🏠 Main website: http://localhost:${PORT}/index.html`);
});
