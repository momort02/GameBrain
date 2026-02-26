// ============================================================
// main.js — Utilitaires globaux GameBrain
// ============================================================
// Toast notifications, loader, helpers communs
// ============================================================

// ──────────────────────────────────────────────
// 🍞 Système de Toast Notifications
// ──────────────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

/**
 * Affiche un toast stylé.
 * @param {string} message - Message à afficher
 * @param {"success"|"error"|"info"|"warning"} type - Type de toast
 * @param {number} duration - Durée en ms (défaut 3500)
 */
export function showToast(message, type = "info", duration = 3500) {
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = {
    success: "✓",
    error:   "✕",
    info:    "ℹ",
    warning: "⚠"
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Animation d'entrée
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  // Auto-suppression
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ──────────────────────────────────────────────
// ⏳ Loader global
// ──────────────────────────────────────────────

let loaderEl = null;
let loaderCount = 0; // Évite les conflits si multiple appels

function getLoader() {
  if (!loaderEl) {
    loaderEl = document.createElement("div");
    loaderEl.id = "global-loader";
    loaderEl.innerHTML = `
      <div class="loader-backdrop">
        <div class="loader-spinner">
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <div class="spinner-ring"></div>
          <span class="loader-text">Chargement...</span>
        </div>
      </div>
    `;
    document.body.appendChild(loaderEl);
  }
  return loaderEl;
}

/** Affiche le loader global */
export function showLoader() {
  loaderCount++;
  const loader = getLoader();
  loader.style.display = "flex";
}

/** Cache le loader global */
export function hideLoader() {
  loaderCount = Math.max(0, loaderCount - 1);
  if (loaderCount === 0) {
    const loader = getLoader();
    loader.style.display = "none";
  }
}

// ──────────────────────────────────────────────
// 📅 Formatage de dates Firestore Timestamp
// ──────────────────────────────────────────────

/**
 * Convertit un Timestamp Firestore en date lisible.
 * @param {import("firebase/firestore").Timestamp} timestamp
 * @returns {string}
 */
export function formatDate(timestamp) {
  if (!timestamp) return "Date inconnue";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return new Intl.DateTimeFormat("fr-FR", {
    day:   "2-digit",
    month: "short",
    year:  "numeric"
  }).format(date);
}

/**
 * Retourne une date relative (ex: "il y a 2 jours").
 * @param {import("firebase/firestore").Timestamp} timestamp
 * @returns {string}
 */
export function timeAgo(timestamp) {
  if (!timestamp) return "";
  const date  = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins  < 1)  return "À l'instant";
  if (mins  < 60) return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days  < 30) return `il y a ${days}j`;
  return formatDate(timestamp);
}

// ──────────────────────────────────────────────
// 🔍 Utilitaire de recherche par mot-clé
// ──────────────────────────────────────────────

/**
 * Filtre une liste d'objets par un mot-clé sur des champs donnés.
 * @param {Array}    items    - Tableau d'objets
 * @param {string}   keyword  - Mot-clé
 * @param {string[]} fields   - Champs à chercher (ex: ["title","content"])
 * @returns {Array}
 */
export function filterByKeyword(items, keyword, fields = ["title"]) {
  if (!keyword.trim()) return items;
  const kw = keyword.toLowerCase();
  return items.filter(item =>
    fields.some(f => (item[f] || "").toLowerCase().includes(kw))
  );
}

// ──────────────────────────────────────────────
// 🃏 Créateur de carte guide (HTML)
// ──────────────────────────────────────────────

/**
 * Génère le HTML d'une carte guide.
 * @param {Object} guide
 * @param {boolean} showFavorite
 * @returns {string}
 */
export function createGuideCard(guide, showFavorite = false) {
  const date = timeAgo(guide.createdAt);
  const likes = guide.likesCount || 0;
  const verified = guide.authorVerified
    ? `<span class="badge-verified" title="Auteur vérifié">✓ Vérifié</span>`
    : "";

  return `
    <article class="guide-card" data-id="${guide.id}" onclick="window.location.href='guide.html?id=${guide.id}'">
      <div class="guide-card-header">
        <span class="guide-game-tag">${guide.gameName || "Jeu"}</span>
        ${verified}
        ${showFavorite ? `
          <button class="btn-favorite ${guide.isFavorite ? 'active' : ''}"
                  data-id="${guide.id}"
                  onclick="event.stopPropagation(); toggleFavorite('${guide.id}', this)">
            ${guide.isFavorite ? "★" : "☆"}
          </button>` : ""}
      </div>
      <h3 class="guide-card-title">${guide.title}</h3>
      <p class="guide-card-preview">${(guide.content || "").substring(0, 120)}...</p>
      <footer class="guide-card-footer">
        <span class="guide-author">👤 ${guide.authorName || "Anonyme"}</span>
        <span class="guide-date">${date}</span>
        <span class="guide-likes">❤ ${likes}</span>
      </footer>
    </article>
  `;
}

/**
 * Génère le HTML d'une carte build.
 * @param {Object} build
 * @returns {string}
 */
export function createBuildCard(build) {
  const date = timeAgo(build.createdAt);
  return `
    <article class="build-card">
      <div class="build-card-header">
        <span class="build-game-tag">${build.gameName || "Jeu"}</span>
      </div>
      <h3 class="build-card-title">${build.title}</h3>
      <p class="build-card-desc">${(build.description || "").substring(0, 100)}...</p>
      <footer class="build-card-footer">
        <span class="build-date">${date}</span>
      </footer>
    </article>
  `;
}

// ──────────────────────────────────────────────
// ♿ Accessibilité — Fermer modal avec Escape
// ──────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.active").forEach(m => m.classList.remove("active"));
  }
});


