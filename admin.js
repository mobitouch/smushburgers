// ============================================
// ROUTING & STATE MANAGEMENT
// ============================================

let menuItems = [];
let editingItemId = null;

// Format price - remove .00 for whole numbers, keep decimals for .5, .75, etc.
function formatPrice(price) {
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) {
    return "0";
  }
  // If it's a whole number, return without decimals
  if (numPrice % 1 === 0) {
    return numPrice.toString();
  }
  // Otherwise, show decimals (remove trailing zeros)
  return numPrice.toString();
}

async function checkAuth() {
  try {
    const response = await fetch("/api/auth/status", {
      method: "GET",
      credentials: "include",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      showLogin();
      return;
    }

    const data = await response.json();

    if (data && data.isAuthenticated === true) {
      showDashboard();
      loadMenuItems();
    } else {
      showLogin();
    }
  } catch (error) {
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
// MENU CRUD OPERATIONS
// ============================================

async function loadMenuItems() {
  try {
    const response = await fetch("/api/menu", {
      credentials: "include", // Ensure cookies are sent
    });

    // Handle different error status codes
    if (!response.ok) {
      if (response.status === 401) {
        showMessage("Session expired. Please log in again.", "error");
        showLogin();
        return;
      } else if (response.status === 500) {
        const errorData = await response.json().catch(() => ({}));
        showMessage("Server error. Please try again later.", "error");
        return;
      } else {
        const errorData = await response.json().catch(() => ({}));
        showMessage(
          `Failed to load menu items (Status: ${response.status})`,
          "error"
        );
        return;
      }
    }

    menuItems = await response.json();
    renderMenuItems();
  } catch (error) {
    if (error.message && error.message.includes("Failed to fetch")) {
      showMessage(
        "Cannot connect to server. Please ensure the server is running.",
        "error"
      );
    } else {
      showMessage("Error loading menu items. Please try again.", "error");
    }
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
                <p class="item-price">$${formatPrice(item.price)}</p>
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

function initEventListeners() {
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");
  const itemForm = document.getElementById("item-form");
  const cancelBtn = document.getElementById("cancel-btn");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const password = document.getElementById("password-input").value;
      const errorElement = document.getElementById("login-error");

      errorElement.style.display = "none";
      errorElement.textContent = "";

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
          credentials: "include",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          if (response.status === 429) {
            errorElement.textContent =
              data.message || "Too many login attempts. Please try again later.";
            errorElement.style.display = "block";
            return;
          } else if (response.status === 401) {
            errorElement.textContent = data.message || "Incorrect password";
            errorElement.style.display = "block";
            return;
          } else {
            errorElement.textContent = data.message || "Login failed. Please try again.";
            errorElement.style.display = "block";
            return;
          }
        }

        if (data.success) {
          document.getElementById("password-input").value = "";
          errorElement.style.display = "none";
          
          setTimeout(() => {
            showDashboard();
            loadMenuItems();
          }, 100);
        } else {
          errorElement.textContent = data.message || "Incorrect password";
          errorElement.style.display = "block";
        }
      } catch (error) {
        if (error.message && error.message.includes("Failed to fetch")) {
          errorElement.textContent =
            "Cannot connect to server. Please ensure the server is running.";
        } else {
          errorElement.textContent = "Login failed. Please try again.";
        }
        errorElement.style.display = "block";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
        showLogin();
        menuItems = [];
        editingItemId = null;
      } catch (error) {
      }
    });
  }

  if (itemForm) {
    itemForm.addEventListener("submit", async (e) => {
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
          response = await fetch(`/api/menu/${editingItemId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemData),
            credentials: "include",
          });
        } else {
          response = await fetch("/api/menu", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itemData),
            credentials: "include",
          });
        }

        if (!response.ok) {
          if (response.status === 401) {
            showMessage("Session expired. Please log in again.", "error");
            showLogin();
            return;
          } else if (response.status === 400) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg =
              errorData.errors && errorData.errors.length > 0
                ? errorData.errors.map((e) => e.msg).join(", ")
                : errorData.message || "Validation failed";
            showMessage(errorMsg, "error");
            return;
          }
        }

        const data = await response.json();

        if (data.success) {
          showMessage(data.message, "success");
          loadMenuItems();
          resetForm();
        } else {
          showMessage(data.message || "Failed to save item", "error");
        }
      } catch (error) {
        if (error.message && error.message.includes("Failed to fetch")) {
          showMessage("Cannot connect to server.", "error");
        } else {
          showMessage("Failed to save item. Please try again.", "error");
        }
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetForm);
  }
}

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
      credentials: "include", // Ensure cookies are sent
    });

    if (!response.ok) {
      if (response.status === 401) {
        showMessage("Session expired. Please log in again.", "error");
        showLogin();
        return;
      }
    }

    const data = await response.json();

    if (data.success) {
      showMessage(data.message, "success");
      loadMenuItems();

      // If we're editing this item, reset the form
      if (editingItemId === id) {
        resetForm();
      }
    } else {
      showMessage(data.message || "Failed to delete item", "error");
    }
  } catch (error) {
    if (error.message && error.message.includes("Failed to fetch")) {
      showMessage("Cannot connect to server.", "error");
    } else {
      showMessage("Failed to delete item. Please try again.", "error");
    }
  }
}

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

function init() {
  initEventListeners();
  checkAuth();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
