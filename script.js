let menuData = [];

const menuGrid = document.getElementById("menu-grid");
const filterBtns = document.querySelectorAll(".filter-btn");

// XSS Protection: Escape HTML to prevent script injection
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return "";
  }
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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

// Function to render menu items
function renderMenu(items) {
  menuGrid.innerHTML = items
    .map(
      (item, index) => `
        <div class="menu-item" style="animation-delay: ${index * 0.05}s">
            <div class="item-header">
                <h3 class="item-name">${escapeHtml(item.name)}</h3>
                <span class="item-price">$${formatPrice(item.price)}</span>
            </div>
            <p class="item-desc">${escapeHtml(item.description || "")}</p>
            <span class="item-category">${escapeHtml(item.category)}</span>
        </div>
    `
    )
    .join("");
}

function loadMenuData() {
  const timestamp = new Date().getTime();
  fetch(`data.json?t=${timestamp}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (Array.isArray(data)) {
        menuData = data;
        renderMenu(menuData);
      } else {
        throw new Error("Invalid data format");
      }
    })
    .catch(() => {
      if (menuGrid) {
        menuGrid.innerHTML =
          '<p style="color: white; text-align: center; padding: 2rem;">Error loading menu. Please refresh the page.</p>';
      }
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadMenuData);
} else {
  loadMenuData();
}

// Filter functionality
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active class from all buttons
    filterBtns.forEach((b) => b.classList.remove("active"));
    // Add active class to clicked button
    btn.classList.add("active");

    const category = btn.getAttribute("data-category");

    if (category === "all") {
      renderMenu(menuData);
    } else {
      const filteredItems = menuData.filter(
        (item) => item.category === category
      );
      renderMenu(filteredItems);
    }
  });
});
