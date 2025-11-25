let menuData = [];

const menuGrid = document.getElementById("menu-grid");
const filterBtns = document.querySelectorAll(".filter-btn");

// Function to render menu items
function renderMenu(items) {
  menuGrid.innerHTML = items
    .map(
      (item, index) => `
        <div class="menu-item" style="animation-delay: ${index * 0.05}s">
            <div class="item-header">
                <h3 class="item-name">${item.name}</h3>
                <span class="item-price">$${item.price}</span>
            </div>
            <p class="item-desc">${item.description}</p>
            <span class="item-category">${item.category}</span>
        </div>
    `
    )
    .join("");
}

// Load menu data from JSON
fetch("data.json")
  .then((response) => response.json())
  .then((data) => {
    menuData = data;
    renderMenu(menuData);
  })
  .catch((error) => {
    console.error("Error loading menu data:", error);
    menuGrid.innerHTML =
      '<p style="color: white; text-align: center;">Error loading menu. Please refresh the page.</p>';
  });

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
