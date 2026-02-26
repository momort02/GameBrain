// ============================================================
// game.js — Page d'un jeu : guides, favoris, recherche
// ============================================================

import { db, auth }  from "./firebase-config.js";
import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, doc, addDoc, deleteDoc,
  updateDoc, increment, serverTimestamp, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast, showLoader, hideLoader, filterByKeyword, timeAgo } from "./main.js";

// ──────────────────────────────────────────────
// 📌 État global de la page
// ──────────────────────────────────────────────

let currentGameId    = null;
let currentUser      = null;
let userFavorites    = new Set();
let lastDoc          = null; // Pour pagination
let allGuides        = [];   // Cache local pour filtrage
const PAGE_SIZE      = 9;

// ──────────────────────────────────────────────
// 🚀 Initialisation
// ──────────────────────────────────────────────

async function initGamePage() {
  // Récupérer l'ID du jeu depuis l'URL
  const params = new URLSearchParams(window.location.search);
  currentGameId = params.get("id");

  if (!currentGameId) {
    window.location.href = "index.html";
    return;
  }

  // Observer l'état de connexion
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      await loadUserFavorites(user.uid);
      document.getElementById("btn-create-guide")?.removeAttribute("hidden");
    }
  });

  // Charger les données du jeu
  await loadGameInfo();
  await loadGuides();
  initSearch();
  initSortFilter();
}

// ──────────────────────────────────────────────
// 🎮 Informations du jeu
// ──────────────────────────────────────────────

async function loadGameInfo() {
  showLoader();
  try {
    const snap = await getDoc(doc(db, "games", currentGameId));
    if (!snap.exists()) {
      showToast("Jeu introuvable.", "error");
      window.location.href = "index.html";
      return;
    }

    const game = snap.data();

    // Mise à jour du DOM
    const titleEl = document.getElementById("game-title");
    const descEl  = document.getElementById("game-description");
    const imgEl   = document.getElementById("game-image");

    if (titleEl) titleEl.textContent    = game.name;
    if (descEl)  descEl.textContent     = game.description || "";
    if (imgEl)   {
      imgEl.src = game.image || "assets/game-placeholder.jpg";
      imgEl.alt = game.name;
    }

    document.title = `${game.name} — GameBrain`;

    // Lien création de guide
    const btnCreate = document.getElementById("btn-create-guide");
    if (btnCreate) btnCreate.href = `create-guide.html?gameId=${currentGameId}`;

  } catch (err) {
    console.error("Erreur chargement jeu :", err);
    showToast("Erreur lors du chargement du jeu.", "error");
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// 📚 Chargement des guides (avec pagination)
// ──────────────────────────────────────────────

async function loadGuides(isLoadMore = false) {
  const container = document.getElementById("guides-container");
  const btnMore   = document.getElementById("btn-load-more");
  if (!container) return;

  if (!isLoadMore) {
    container.innerHTML = `<div class="skeleton-grid">${"<div class='skeleton-card'></div>".repeat(6)}</div>`;
    lastDoc = null;
    allGuides = [];
  }

  showLoader();
  try {
    let q = query(
      collection(db, "guides"),
      where("gameId", "==", currentGameId),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    if (lastDoc) {
      q = query(
        collection(db, "guides"),
        where("gameId", "==", currentGameId),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
    }

    const snap = await getDocs(q);

    if (snap.empty && !isLoadMore) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <p>Aucun guide pour ce jeu.</p>
          <p>Sois le premier à contribuer !</p>
        </div>`;
      if (btnMore) btnMore.style.display = "none";
      return;
    }

    // Mettre à jour le curseur de pagination
    lastDoc = snap.docs[snap.docs.length - 1];

    // Afficher/masquer bouton "Charger plus"
    if (btnMore) {
      btnMore.style.display = snap.docs.length < PAGE_SIZE ? "none" : "block";
    }

    if (!isLoadMore) container.innerHTML = "";

    snap.forEach(d => {
      const guide = { id: d.id, ...d.data() };
      guide.isFavorite = userFavorites.has(guide.id);
      allGuides.push(guide);
      container.insertAdjacentHTML("beforeend", buildGuideCard(guide));
    });

  } catch (err) {
    console.error("Erreur guides :", err);
    container.innerHTML = `<p class="error-state">Impossible de charger les guides.</p>`;
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// 🃏 Construction d'une carte guide
// ──────────────────────────────────────────────

function buildGuideCard(guide) {
  const date     = timeAgo(guide.createdAt);
  const likes    = guide.likesCount || 0;
  const isFav    = guide.isFavorite;
  const verified = guide.authorVerified
    ? `<span class="badge-verified">✓ Vérifié</span>` : "";

  return `
    <article class="guide-card" data-id="${guide.id}">
      <div class="guide-card-header">
        ${verified}
        <button
          class="btn-favorite ${isFav ? "active" : ""}"
          data-guide-id="${guide.id}"
          onclick="handleFavorite('${guide.id}', this)"
          title="${isFav ? "Retirer des favoris" : "Ajouter aux favoris"}">
          ${isFav ? "★" : "☆"}
        </button>
      </div>
      <h3 class="guide-card-title">${guide.title}</h3>
      <p class="guide-card-preview">${(guide.content || "").substring(0, 150)}...</p>
      <footer class="guide-card-footer">
        <span class="guide-author">👤 ${guide.authorName || "Anonyme"}</span>
        <span class="guide-date">${date}</span>
        <div class="guide-actions">
          <button class="btn-like ${guide.userLiked ? "liked" : ""}"
                  onclick="handleLike('${guide.id}', this)">
            ❤ <span class="like-count">${likes}</span>
          </button>
          <a href="guide.html?id=${guide.id}" class="btn btn-sm btn-outline">Lire</a>
        </div>
      </footer>
    </article>
  `;
}

// ──────────────────────────────────────────────
// ⭐ Gestion des favoris
// ──────────────────────────────────────────────

async function loadUserFavorites(uid) {
  const snap = await getDocs(
    query(collection(db, "favorites"), where("userId", "==", uid))
  );
  userFavorites.clear();
  snap.forEach(d => userFavorites.add(d.data().guideId));
}

window.handleFavorite = async function(guideId, btn) {
  if (!currentUser) {
    showToast("Connecte-toi pour ajouter aux favoris.", "warning");
    return;
  }

  const favsRef = collection(db, "favorites");
  const existing = await getDocs(
    query(favsRef, where("userId", "==", currentUser.uid), where("guideId", "==", guideId))
  );

  if (existing.empty) {
    await addDoc(favsRef, {
      userId:    currentUser.uid,
      guideId,
      createdAt: serverTimestamp()
    });
    userFavorites.add(guideId);
    btn.classList.add("active");
    btn.textContent = "★";
    showToast("Ajouté aux favoris !", "success");
  } else {
    for (const docSnap of existing.docs) {
      await deleteDoc(doc(db, "favorites", docSnap.id));
    }
    userFavorites.delete(guideId);
    btn.classList.remove("active");
    btn.textContent = "☆";
    showToast("Retiré des favoris.", "info");
  }
};

// ──────────────────────────────────────────────
// ❤ Système de likes
// ──────────────────────────────────────────────

const likedGuides = new Set(); // Évite le double-like en session

window.handleLike = async function(guideId, btn) {
  if (!currentUser) {
    showToast("Connecte-toi pour liker.", "warning");
    return;
  }
  if (likedGuides.has(guideId)) {
    showToast("Tu as déjà liké ce guide !", "warning");
    return;
  }

  try {
    await updateDoc(doc(db, "guides", guideId), {
      likesCount: increment(1)
    });
    likedGuides.add(guideId);
    btn.classList.add("liked");
    const countEl = btn.querySelector(".like-count");
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
    showToast("Guide liké !", "success");
  } catch (err) {
    showToast("Erreur lors du like.", "error");
  }
};

// ──────────────────────────────────────────────
// 🔍 Recherche par mot-clé (client-side)
// ──────────────────────────────────────────────

function initSearch() {
  const searchInput = document.getElementById("guide-search");
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const keyword = searchInput.value.trim();
      const filtered = filterByKeyword(allGuides, keyword, ["title", "content"]);
      renderFilteredGuides(filtered);
    }, 300);
  });
}

function renderFilteredGuides(guides) {
  const container = document.getElementById("guides-container");
  if (!container) return;

  if (!guides.length) {
    container.innerHTML = `<p class="empty-state">Aucun résultat trouvé.</p>`;
    return;
  }

  container.innerHTML = guides.map(g => buildGuideCard(g)).join("");
}

// ──────────────────────────────────────────────
// 🔀 Tri et filtre
// ──────────────────────────────────────────────

function initSortFilter() {
  const sortSelect = document.getElementById("guide-sort");
  if (!sortSelect) return;

  sortSelect.addEventListener("change", () => {
    const sortBy = sortSelect.value;
    const sorted = [...allGuides].sort((a, b) => {
      if (sortBy === "likes") return (b.likesCount || 0) - (a.likesCount || 0);
      if (sortBy === "oldest") {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return ta - tb;
      }
      // newest (défaut)
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    renderFilteredGuides(sorted);
  });
}

// ──────────────────────────────────────────────
// 📄 Pagination — bouton Charger plus
// ──────────────────────────────────────────────

document.getElementById("btn-load-more")?.addEventListener("click", () => {
  loadGuides(true);
});

// Lancement
document.addEventListener("DOMContentLoaded", initGamePage);


