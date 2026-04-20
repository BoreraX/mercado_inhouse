const CONFIG = {
  dataFile: "produtos.csv",
  fallbackDataFiles: ["data/produtos.csv"],
  adminWhatsApp: "5519991065503",
  pixKey: "pix@mercadinhodocondominio.com.br",
  receiverName: "Mercado RESIDENCIAL ALTO DO PRATA",
};

const state = {
  products: [],
  filteredProducts: [],
  cart: new Map(),
  toastTimer: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  fillCheckoutInfo();
  loadProducts();
});

function cacheElements() {
  elements.productsGrid = document.querySelector("#products-grid");
  elements.productCount = document.querySelector("#product-count");
  elements.searchInput = document.querySelector("#search-input");
  elements.introScreen = document.querySelector("#intro-screen");
  elements.introStartButton = document.querySelector("#intro-start-button");
  elements.cartSummary = document.querySelector("#cart-summary");
  elements.cartTotal = document.querySelector("#cart-total");
  elements.pixTotal = document.querySelector("#pix-total");
  elements.cartItems = document.querySelector("#cart-items");
  elements.cartPanel = document.querySelector("#cart-panel");
  elements.cartOverlay = document.querySelector("#cart-overlay");
  elements.openCartButton = document.querySelector("#open-cart-button");
  elements.closeCartButton = document.querySelector("#close-cart-button");
  elements.whatsappButton = document.querySelector("#whatsapp-button");
  elements.copyPixButton = document.querySelector("#copy-pix-button");
  elements.pixKey = document.querySelector("#pix-key");
  elements.receiverName = document.querySelector("#receiver-name");
  elements.toast = document.querySelector("#toast");
}

function bindEvents() {
  elements.searchInput.addEventListener("input", applySearch);
  elements.introStartButton.addEventListener("click", closeIntroScreen);
  elements.productsGrid.addEventListener("click", handleProductClick);
  elements.cartItems.addEventListener("click", handleCartClick);
  elements.openCartButton.addEventListener("click", openCart);
  elements.closeCartButton.addEventListener("click", closeCart);
  elements.cartOverlay.addEventListener("click", closeCart);
  elements.whatsappButton.addEventListener("click", sendWhatsAppOrder);
  elements.copyPixButton.addEventListener("click", copyPixKey);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeIntroScreen();
      closeCart();
    }
  });
}

function fillCheckoutInfo() {
  elements.pixKey.textContent = CONFIG.pixKey;
  elements.receiverName.textContent = CONFIG.receiverName;
  elements.introStartButton.focus();
}

function closeIntroScreen() {
  elements.introScreen.classList.add("hidden");
  elements.searchInput.focus();
}

async function loadProducts() {
  try {
    const productData = await fetchProductData();
    const rows = productData.file.toLowerCase().endsWith(".json")
      ? JSON.parse(productData.text)
      : parseCsv(productData.text);

    state.products = rows
      .map(normalizeProduct)
      .filter(Boolean)
      .filter((product) => product.status === "desbloqueado")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    state.filteredProducts = [...state.products];
    renderProducts();
    renderCart();
  } catch (error) {
    elements.productCount.textContent = "Não foi possível carregar a base.";
    elements.productsGrid.innerHTML = `
      <p class="empty-state">
        Não consegui ler a lista de produtos. Confira o arquivo <strong>produtos.csv</strong>
        e abra a página por um servidor local ou hospedagem.
      </p>
    `;
    console.error(error);
  }
}

async function fetchProductData() {
  const files = [CONFIG.dataFile, ...(CONFIG.fallbackDataFiles || [])];

  for (const file of files) {
    const response = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });

    if (response.ok) {
      return {
        file,
        text: await response.text(),
      };
    }
  }

  throw new Error(`Arquivos não encontrados: ${files.join(", ")}`);
}

function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, "").trim();

  if (!cleanText) {
    return [];
  }

  const delimiter = detectDelimiter(cleanText);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const nextChar = cleanText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  rows.push(row);

  const [headers, ...body] = rows;

  if (!headers) {
    return [];
  }

  return body
    .filter((line) => line.some((cell) => cell.trim() !== ""))
    .map((line) =>
      headers.reduce((item, header, index) => {
        item[header.trim()] = line[index] || "";
        return item;
      }, {}),
    );
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ";" : ",";
}

function normalizeProduct(row, index) {
  const name = readField(row, ["Nome do Produto", "Nome", "Produto"]);

  if (!name) {
    return null;
  }

  const rawBarcode = readField(row, ["Codigo de Barras", "Código de Barras", "Codigo", "EAN"]);
  const barcode = normalizeBarcode(rawBarcode);
  const status = readField(row, ["Status"]).toLowerCase();
  const price = parsePrice(readField(row, ["Preço Final (consumidor)", "Preco Final (consumidor)", "Preço", "Preco"]));
  const stock = Number(readField(row, ["Qtd.Estoque", "Qtd Estoque", "Estoque"])) || 0;
  const expiresAt = readField(row, ["Data de vencimento", "Vencimento"]);

  return {
    id: barcode ? `${barcode}-${index}` : `produto-${index}`,
    barcode,
    name,
    status,
    price,
    stock,
    expiresAt,
  };
}

function normalizeBarcode(value) {
  const barcode = String(value || "").trim();
  const normalized = normalizeSearch(barcode);
  const missingValues = new Set(["", "nao informado", "sem codigo", "sem codigo de barras", "n/a", "na", "-"]);

  return missingValues.has(normalized) ? "" : barcode;
}

function readField(row, aliases) {
  const normalizedAliases = aliases.map(normalizeKey);
  const foundKey = Object.keys(row).find((key) => normalizedAliases.includes(normalizeKey(key)));
  return foundKey ? String(row[foundKey]).trim() : "";
}

function normalizeKey(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parsePrice(value) {
  if (typeof value === "number") {
    return value;
  }

  const raw = String(value).replace(/[^\d,.-]/g, "");

  if (!raw) {
    return 0;
  }

  const hasCommaDecimal = raw.includes(",") && raw.lastIndexOf(",") > raw.lastIndexOf(".");
  const normalized = hasCommaDecimal
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(/,/g, "");

  return Number(normalized) || 0;
}

function applySearch() {
  const term = normalizeSearch(elements.searchInput.value);
  state.filteredProducts = state.products.filter((product) => normalizeSearch(product.name).includes(term));
  renderProducts();
}

function normalizeSearch(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function renderProducts() {
  const total = state.products.length;
  const showing = state.filteredProducts.length;

  elements.productCount.textContent = total === showing
    ? `${total} produtos disponíveis`
    : `${showing} de ${total} produtos`;

  if (!showing) {
    elements.productsGrid.innerHTML = '<p class="empty-state">Nenhum produto encontrado nesta base. Confira a digitação ou fale com o administrador.</p>';
    return;
  }

  elements.productsGrid.innerHTML = state.filteredProducts.map(renderProductCard).join("");
}

function renderProductCard(product) {
  const cartItem = state.cart.get(product.id);
  const quantity = cartItem ? cartItem.quantity : 0;
  const barcode = product.barcode
    ? `<p class="barcode">Cód. barras: ${escapeHtml(product.barcode)}</p>`
    : "";

  const action = quantity > 0
    ? renderQuantityControl(product.id, quantity)
    : `<button class="add-button" type="button" data-action="add" data-id="${escapeAttribute(product.id)}">Adicionar</button>`;

  return `
    <article class="product-card">
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        ${barcode}
      </div>
      <div class="product-actions">
        <strong class="price">${formatCurrency(product.price)}</strong>
        ${action}
      </div>
    </article>
  `;
}

function renderQuantityControl(id, quantity) {
  return `
    <div class="quantity-control" aria-label="Quantidade">
      <button type="button" data-action="decrease" data-id="${escapeAttribute(id)}" aria-label="Diminuir quantidade">-</button>
      <span>${quantity}</span>
      <button type="button" data-action="increase" data-id="${escapeAttribute(id)}" aria-label="Aumentar quantidade">+</button>
    </div>
  `;
}

function handleProductClick(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  changeCart(button.dataset.id, button.dataset.action);
}

function handleCartClick(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  changeCart(button.dataset.id, button.dataset.action);
}

function changeCart(id, action) {
  const current = state.cart.get(id);
  const product = current ? current.product : state.products.find((item) => item.id === id);

  if (!product) {
    return;
  }

  if (action === "add" || action === "increase") {
    const quantity = current ? current.quantity + 1 : 1;
    state.cart.set(id, { product, quantity });
    if (action === "add") {
      showToast("Produto adicionado à sacola.");
    }
  }

  if (action === "decrease") {
    if (!current || current.quantity <= 1) {
      state.cart.delete(id);
    } else {
      state.cart.set(id, { product, quantity: current.quantity - 1 });
    }
  }

  if (action === "remove") {
    state.cart.delete(id);
  }

  renderProducts();
  renderCart();
}

function renderCart() {
  const { quantity, total } = getCartTotals();
  elements.cartSummary.textContent = quantity
    ? `${quantity} ${quantity === 1 ? "item" : "itens"} · ${formatCurrency(total)}`
    : "Vazia";
  elements.cartTotal.textContent = formatCurrency(total);
  elements.pixTotal.textContent = formatCurrency(total);
  elements.whatsappButton.disabled = quantity === 0;

  if (!quantity) {
    elements.cartItems.innerHTML = '<p class="empty-state">Sua sacola está vazia.</p>';
    return;
  }

  elements.cartItems.innerHTML = Array.from(state.cart.values())
    .map(renderCartItem)
    .join("");
}

function renderCartItem({ product, quantity }) {
  const subtotal = product.price * quantity;

  return `
    <article class="cart-item">
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="muted">${formatCurrency(product.price)} cada · Subtotal ${formatCurrency(subtotal)}</p>
      </div>
      <div class="cart-item-actions">
        ${renderQuantityControl(product.id, quantity)}
        <button class="danger-button" type="button" data-action="remove" data-id="${escapeAttribute(product.id)}">
          Remover
        </button>
      </div>
    </article>
  `;
}

function getCartTotals() {
  return Array.from(state.cart.values()).reduce(
    (totals, { product, quantity }) => ({
      quantity: totals.quantity + quantity,
      total: totals.total + product.price * quantity,
    }),
    { quantity: 0, total: 0 },
  );
}

function openCart() {
  elements.cartPanel.classList.remove("hidden");
  elements.cartOverlay.classList.remove("hidden");
  elements.openCartButton.setAttribute("aria-expanded", "true");
}

function closeCart() {
  elements.cartPanel.classList.add("hidden");
  elements.cartOverlay.classList.add("hidden");
  elements.openCartButton.setAttribute("aria-expanded", "false");
}

function sendWhatsAppOrder() {
  const { quantity, total } = getCartTotals();

  if (!quantity) {
    showToast("Adicione pelo menos um produto.");
    return;
  }

  const items = Array.from(state.cart.values()).map(({ product, quantity: itemQuantity }) => {
    const subtotal = product.price * itemQuantity;
    return `* ${itemQuantity}x ${product.name} - ${formatCurrency(subtotal)}`;
  });

  const message = [
    "Olá! Segue meu pedido do mini-mercado:",
    "",
    ...items,
    "",
    `Total: ${formatCurrency(total)}`,
    "",
    "Após o pagamento, vou enviar o comprovante por aqui.",
  ].join("\n");

  const phone = CONFIG.adminWhatsApp.replace(/\D/g, "");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
}

async function copyPixKey() {
  try {
    await navigator.clipboard.writeText(CONFIG.pixKey);
    showToast("Chave Pix copiada.");
  } catch (error) {
    showToast("Copie a chave Pix exibida na tela.");
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");

  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2600);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
