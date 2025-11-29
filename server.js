require("dotenv").config();

const express = require("express");
const session = require("express-session");
const rateLimit = require("express-rate-limit");
const { body, validationResult, param } = require("express-validator");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);
app.set("x-powered-by", false);

const isProduction = process.env.NODE_ENV === "production";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(express.static(__dirname, {
  maxAge: isProduction ? "1d" : "0",
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith("data.json")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  },
}));

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  console.error("ERROR: SESSION_SECRET environment variable is required!");
  console.error("Please create a .env file with SESSION_SECRET set.");
  process.exit(1);
}

if (!process.env.ADMIN_PASSWORD) {
  console.error("ERROR: ADMIN_PASSWORD environment variable is required!");
  console.error("Please create a .env file with ADMIN_PASSWORD set.");
  process.exit(1);
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    name: "smush.sid",
    rolling: true,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
    proxy: isProduction,
  })
);

// Admin password from environment variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Path to data file
const DATA_FILE = path.join(__dirname, "data.json");

function readMenuData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    return [];
  }
}

function writeMenuData(data) {
  try {
    if (!Array.isArray(data)) {
      return false;
    }
    const jsonData = JSON.stringify(data, null, 2);
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, jsonData, "utf8");
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (error) {
    try {
      if (fs.existsSync(`${DATA_FILE}.tmp`)) {
        fs.unlinkSync(`${DATA_FILE}.tmp`);
      }
    } catch (e) {
    }
    return false;
  }
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Unauthorized: Session expired or not authenticated" });
  }
}

// ============================================
// RATE LIMITING
// ============================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// VALIDATION MIDDLEWARE
// ============================================

// Validation rules for menu items
const validateMenuItem = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Item name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Item name must be between 1 and 100 characters")
    .escape(), // Sanitize HTML
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isIn([
      "starters",
      "smush burgers",
      "chicken burgers",
      "sandwiches",
      "fries",
      "dessert",
      "drinks",
      "add ons",
      "dips",
    ])
    .withMessage("Invalid category"),
  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0, max: 200 })
    .withMessage("Price must be a positive number between 0 and 200"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters")
    .escape(), // Sanitize HTML
];

// Validation for ID parameter
const validateId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Invalid item ID")
    .toInt(),
];

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
}

// ============================================
// AUTH ROUTES
// ============================================

app.post(
  "/api/auth/login",
  loginLimiter,
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
  (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
      req.session.isAuthenticated = true;
      req.session.touch();
      
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ success: false, message: "Failed to save session" });
        }
        res.json({ success: true, message: "Login successful" });
      });
    } else {
      res.status(401).json({ success: false, message: "Incorrect password" });
    }
  }
);

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
  if (!req.session) {
    return res.json({ isAuthenticated: false });
  }
  const isAuth = !!req.session.isAuthenticated;
  res.json({ 
    isAuthenticated: isAuth,
    sessionId: req.sessionID || null
  });
});

// ============================================
// MENU CRUD ROUTES (Protected)
// ============================================

app.get("/api/menu", apiLimiter, requireAuth, (req, res) => {
  try {
    const menuData = readMenuData();
    res.json(menuData);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load menu items" });
  }
});

app.post(
  "/api/menu",
  apiLimiter,
  requireAuth,
  validateMenuItem,
  handleValidationErrors,
  (req, res) => {
    const menuData = readMenuData();
    const { name, category, price, description } = req.body;

    // Generate new ID
    const newId =
      menuData.length > 0
        ? Math.max(...menuData.map((item) => item.id)) + 1
        : 1;

    const newItem = {
      id: newId,
      name: name.trim(),
      category: category.trim(),
      price: parseFloat(price),
      description: (description || "").trim(),
    };

    menuData.push(newItem);

    const writeSuccess = writeMenuData(menuData);
    
    if (!writeSuccess) {
      return res.status(500).json({ success: false, message: "Failed to save item" });
    }

    const verifyData = readMenuData();
    const verifyItem = verifyData.find((item) => item.id === newItem.id);
    
    if (!verifyItem) {
      return res.status(500).json({ success: false, message: "Save verification failed" });
    }

    res.json({
      success: true,
      item: newItem,
      message: "Item added successfully",
    });
  }
);

app.put(
  "/api/menu/:id",
  apiLimiter,
  requireAuth,
  validateId,
  validateMenuItem,
  handleValidationErrors,
  (req, res) => {
    const menuData = readMenuData();
    const itemId = parseInt(req.params.id);
    const { name, category, price, description } = req.body;

    const itemIndex = menuData.findIndex((item) => item.id === itemId);

    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    const updatedItem = {
      id: itemId,
      name: name.trim(),
      category: category.trim(),
      price: parseFloat(price),
      description: (description || "").trim(),
    };

    menuData[itemIndex] = updatedItem;

    if (!writeMenuData(menuData)) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to update item" });
    }

    const verifyData = readMenuData();
    const verifyItem = verifyData.find((item) => item.id === itemId);
    
    if (!verifyItem || verifyItem.name !== updatedItem.name) {
      return res
        .status(500)
        .json({ success: false, message: "Update verification failed" });
    }

    res.json({
      success: true,
      item: updatedItem,
      message: "Item updated successfully",
    });
  }
);

app.delete(
  "/api/menu/:id",
  apiLimiter,
  requireAuth,
  validateId,
  handleValidationErrors,
  (req, res) => {
    const menuData = readMenuData();
    const itemId = parseInt(req.params.id);

    const filteredData = menuData.filter((item) => item.id !== itemId);

    if (filteredData.length === menuData.length) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    }

    if (!writeMenuData(filteredData)) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete item" });
    }

    const verifyData = readMenuData();
    const verifyDeleted = verifyData.find((item) => item.id === itemId);
    
    if (verifyDeleted) {
      return res
        .status(500)
        .json({ success: false, message: "Delete verification failed" });
    }

    res.json({ success: true, message: "Item deleted successfully" });
  }
);

// ============================================
// PUBLIC MENU ROUTE (for main website)
// ============================================

app.get("/data.json", apiLimiter, (req, res) => {
  try {
    const menuData = readMenuData();
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json(menuData);
  } catch (error) {
    res.status(500).json({ error: "Failed to load menu" });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

const server = app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/loginadminonly.html`);
  console.log(`🏠 Main website: http://localhost:${PORT}/index.html`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("=".repeat(50));
});

server.timeout = 30000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
