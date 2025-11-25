// ============================================
// ROUTING & STATE MANAGEMENT
// ============================================

let menuItems = [];
let editingItemId = null;

// Check authentication status on load
async function checkAuth() {
  try {
    const response = await fetch("/api/auth/status");
    const data = await response.json();

    if (data.isAuthenticated) {
      showDashboard();
      loadMenuItems();
    } else {
      showLogin();
    }
  } catch (error) {
    console.error("Auth check failed:", error);
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-view").style.display = "block";
  document.getElementById("dashboard-view").style.display = "none";
}

function showDashboard() {
  document.getElementById("login-view").style.display = "none";
  document.getElementById("dashboard-view").style.display = "block";
}

// ============================================
// AUTHENTICATION
// ============================================

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = document.getElementById("password-input").value;
  const errorElement = document.getElementById("login-error");

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (data.success) {
      showDashboard();
      loadMenuItems();
      document.getElementById("password-input").value = "";
    } else {
      errorElement.textContent = data.message;
      errorElement.style.display = "block";
    }
  } catch (error) {
    console.error("Login error:", error);
    errorElement.textContent = "Login failed. Please try again.";
    errorElement.style.display = "block";
  }
});

document.getElementById("logout-btn").addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    await fetch("/api/auth/logout", { method: "POST" });
    showLogin();
    menuItems = [];
    editingItemId = null;
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// ============================================
// MENU CRUD OPERATIONS
// ============================================

async function loadMenuItems() {
  try {
    const response = await fetch("/api/menu");
    if (!response.ok) throw new Error("Failed to load menu items");

    menuItems = await response.json();
    renderMenuItems();
  } catch (error) {
    console.error("Error loading menu items:", error);
    showMessage("Error loading menu items", "error");
  }
}

function renderMenuItems() {
  const listContainer = document.getElementById("items-list");
  const countElement = document.getElementById("item-count");

  countElement.textContent = menuItems.length;

  if (menuItems.length === 0) {
    listContainer.innerHTML =
      '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">No items yet. Add your first item!</p>';
    return;
  }

  listContainer.innerHTML = menuItems
    .map(
      (item) => `
        <div class="item-card" data-id="${item.id}">
            <div class="item-info">
                <h3>${escapeHtml(item.name)}</h3>
                <span class="category-badge">${escapeHtml(item.category)}</span>
                <p class="item-description">${escapeHtml(item.description)}</p>
                <p class="item-price">$${item.price.toFixed(2)}</p>
            </div>
            <div class="item-actions">
                <button class="btn-edit" onclick="editItem(${
                  item.id
                })">Edit</button>
                <button class="btn-delete" onclick="deleteItem(${
                  item.id
                })">Delete</button>
            </div>
        </div>
    `
    )
    .join("");
}

// Form submission (Add or Edit)
document.getElementById("item-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const itemData = {
    name: document.getElementById("item-name").value,
    category: document.getElementById("item-category").value,
    price: parseFloat(document.getElementById("item-price").value),
    description: document.getElementById("item-description").value,
  };

  try {
    let response;

    if (editingItemId) {
      // Update existing item
      response = await fetch(`/api/menu/${editingItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      });
    } else {
      // Add new item
      response = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData),
      });
    }

    const data = await response.json();

    if (data.success) {
      showMessage(data.message, "success");
      loadMenuItems();
      resetForm();
    } else {
      showMessage(data.message, "error");
    }
  } catch (error) {
    console.error("Error saving item:", error);
    showMessage("Failed to save item", "error");
  }
});

// Edit item
function editItem(id) {
  const item = menuItems.find((i) => i.id === id);
  if (!item) return;

  editingItemId = id;

  document.getElementById("item-id").value = item.id;
  document.getElementById("item-name").value = item.name;
  document.getElementById("item-category").value = item.category;
  document.getElementById("item-price").value = item.price;
  document.getElementById("item-description").value = item.description;

  document.getElementById("form-title").textContent = "Edit Item";
  document.getElementById("submit-btn").textContent = "Update Item";
  document.getElementById("cancel-btn").style.display = "inline-block";

  // Scroll to form
  document
    .querySelector(".form-section")
    .scrollIntoView({ behavior: "smooth" });
}

// Delete item
async function deleteItem(id) {
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    const response = await fetch(`/api/menu/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (data.success) {
      showMessage(data.message, "success");
      loadMenuItems();

      // If we're editing this item, reset the form
      if (editingItemId === id) {
        resetForm();
      }
    } else {
      showMessage(data.message, "error");
    }
  } catch (error) {
    console.error("Error deleting item:", error);
    showMessage("Failed to delete item", "error");
  }
}

// Cancel edit
document.getElementById("cancel-btn").addEventListener("click", resetForm);

function resetForm() {
  editingItemId = null;

  document.getElementById("item-form").reset();
  document.getElementById("item-id").value = "";

  document.getElementById("form-title").textContent = "Add New Item";
  document.getElementById("submit-btn").textContent = "Add Item";
  document.getElementById("cancel-btn").style.display = "none";
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showMessage(message, type = "success") {
  const messageElement = document.getElementById("success-message");
  messageElement.textContent = message;
  messageElement.className = type;
  messageElement.style.display = "block";

  setTimeout(() => {
    messageElement.style.display = "none";
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// INITIALIZE
// ============================================

checkAuth();
