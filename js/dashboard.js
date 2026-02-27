// ============================================================
// dashboard.js — Logique du tableau de bord utilisateur
// ============================================================

import { db, auth }    from "./firebase-config.js";
import { requireAuth, getUserProfile, logoutUser } from "./auth.js";
import {
  collection, query, where, orderBy, limit,
  getDocs, doc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast, hideLoader, showLoader, createGuideCard, createBuildCard } from "./main.js";

// ──────────────────────────────────────────────
// 🚀 Initialisation du dashboard
// ──────────────────────────────────────────────

async function initDashboard() {
  // Protection de la page — redirige si non connecté
  const user = await requireAuth();
  const profile = await getUserProfile(user.uid);

  // Affichage du pseudo et rôle
  const usernameEl = document.getElementById("dash-username");
  const roleEl     = document.getElementById("dash-role");
  if (usernameEl) usernameEl.textContent = profile?.username || user.displayName || "Joueur";
  if (roleEl)     roleEl.textContent     = profile?.role === "admin" ? "👑 Admin" : "🎮 Joueur";

  // Bouton déconnexion
  document.getElementById("btn-logout")?.addEventListener("click", () => logoutUser());

  // Chargement parallèle des sections
  await Promise.all([
    loadRecentGuides(user.uid),
    loadMyBuilds(user.uid),
    loadMyFavorites(user.uid),
    loadStats(user.uid)
  ]);
}

// ──────────────────────────────────────────────
// 📊 Statistiques
// ──────────────────────────────────────────────

async function loadStats(uid) {
  showLoader();
  try {
    // Compter les guides de l'utilisateur
    const guidesQ = query(collection(db, "guides"), where("authorId", "==", uid));
    const buildsQ = query(collection(db, "builds"), where("userId", "==", uid));
    const favsQ   = query(collection(db, "favorites"), where("userId", "==", uid));

    const [guidesSnap, buildsSnap, favsSnap] = await Promise.all([
      getDocs(guidesQ),
      getDocs(buildsQ),
      getDocs(favsQ)
    ]);

    setStatEl("stat-guides",    guidesSnap.size);
    setStatEl("stat-builds",    buildsSnap.size);
    setStatEl("stat-favorites", favsSnap.size);
  } catch (err) {
    console.error("Erreur stats :", err);
  } finally {
    hideLoader();
  }
}

function setStatEl(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    el.classList.add("stat-animate");
  }
}

// ──────────────────────────────────────────────
// 📖 Guides récents (de toute la plateforme)
// ──────────────────────────────────────────────

async function loadRecentGuides(uid) {
  const container = document.getElementById("recent-guides");
  if (!container) return;

  showLoader();
  try {
    const q = query(
      collection(db, "guides"),
      orderBy("createdAt", "desc"),
      limit(6)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `<p class="empty-state">Aucun guide disponible pour le moment.</p>`;
      return;
    }

    // Récupérer les favoris de l'utilisateur pour marquer les cartes
    const favsSnap = await getDocs(
      query(collection(db, "favorites"), where("userId", "==", uid))
    );
    const favIds = new Set(favsSnap.docs.map(d => d.data().guideId));

    // Récupérer les jeux pour afficher le nom
    const gamesSnap = await getDocs(collection(db, "games"));
    const gamesMap  = {};
    gamesSnap.forEach(d => { gamesMap[d.id] = d.data().name; });

    let html = "";
    snap.forEach(d => {
      const guide = { id: d.id, ...d.data() };
      guide.gameName   = gamesMap[guide.gameId] || "Jeu";
      guide.isFavorite = favIds.has(guide.id);
      html += createGuideCard(guide, true);
    });
    container.innerHTML = html;

  } catch (err) {
    console.error("Erreur guides récents :", err);
    container.innerHTML = `<p class="error-state">Impossible de charger les guides.</p>`;
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// 🔧 Mes Builds
// ──────────────────────────────────────────────

async function loadMyBuilds(uid) {
  const container = document.getElementById("my-builds");
  if (!container) return;

  showLoader();
  try {
    const q = query(
      collection(db, "builds"),
      where("userId", "==", uid),
      limit(20)
    );
    const snap      = await getDocs(q);
    const gamesSnap = await getDocs(collection(db, "games"));
    const gamesMap  = {};
    gamesSnap.forEach(d => { gamesMap[d.id] = d.data().name; });

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Aucun build créé.</p>
          <a href="create-build.html" class="btn btn-primary">Créer mon premier build</a>
        </div>`;
      return;
    }

    let html = "";
    snap.forEach(d => {
      const build = { id: d.id, ...d.data() };
      build.gameName = gamesMap[build.gameId] || "Jeu";
      html += createBuildCard(build);
    });
    container.innerHTML = html;

  } catch (err) {
    console.error("Erreur mes builds :", err);
    container.innerHTML = `<p class="error-state">Impossible de charger les builds.</p>`;
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// ⭐ Mes Favoris
// ──────────────────────────────────────────────

async function loadMyFavorites(uid) {
  const container = document.getElementById("my-favorites");
  if (!container) return;

  showLoader();
  try {
    const favsSnap = await getDocs(
      query(collection(db, "favorites"), where("userId", "==", uid), limit(6))
    );

    if (favsSnap.empty) {
      container.innerHTML = `<p class="empty-state">Aucun favori enregistré.</p>`;
      return;
    }

    // Récupérer les guides correspondants
    const guideIds   = favsSnap.docs.map(d => d.data().guideId);
    const gamesSnap  = await getDocs(collection(db, "games"));
    const gamesMap   = {};
    gamesSnap.forEach(d => { gamesMap[d.id] = d.data().name; });

    let html = "";
    // Firestore ne supporte pas "in" avec >10 éléments — pagination simple ici
    for (const guideId of guideIds.slice(0, 6)) {
      const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const guideSnap  = await getDoc(doc(db, "guides", guideId));
      if (guideSnap.exists()) {
        const guide    = { id: guideSnap.id, ...guideSnap.data(), isFavorite: true };
        guide.gameName = gamesMap[guide.gameId] || "Jeu";
        html += createGuideCard(guide, true);
      }
    }
    container.innerHTML = html || `<p class="empty-state">Favoris introuvables.</p>`;

  } catch (err) {
    console.error("Erreur mes favoris :", err);
    container.innerHTML = `<p class="error-state">Impossible de charger les favoris.</p>`;
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// 🎛️ Gestion des onglets du dashboard
// ──────────────────────────────────────────────

function initTabs() {
  const tabs    = document.querySelectorAll(".tab-btn");
  const panels  = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;

      tabs.forEach(t   => t.classList.remove("active"));
      panels.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`panel-${target}`)?.classList.add("active");

      // Charger l'historique au premier clic
      if (target === "history") loadHistory();
    });
  });
}

// ──────────────────────────────────────────────
// 🕘 Historique des guides consultés
// ──────────────────────────────────────────────

const HISTORY_KEY = "gb_history";
const HISTORY_MAX = 20;

export function trackGuideView(guideId, guideTitle, gameName, authorName) {
  try {
    const history = getHistory();
    // Éviter les doublons — retire l'entrée existante si déjà présente
    const filtered = history.filter(h => h.id !== guideId);
    // Ajouter en tête
    filtered.unshift({
      id:         guideId,
      title:      guideTitle,
      gameName:   gameName,
      authorName: authorName,
      viewedAt:   Date.now()
    });
    // Garder seulement les MAX derniers
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, HISTORY_MAX)));
  } catch {}
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
}

async function loadHistory() {
  const container = document.getElementById("history-guides");
  if (!container) return;

  const history = getHistory();

  if (!history.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-icon">🕘</div>
        <p>Tu n'as pas encore consulté de guides.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top:var(--gap-md);">Explorer les jeux</a>
      </div>`;
    return;
  }

  function timeAgoMs(ms) {
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    if (h < 24) return `Il y a ${h}h`;
    return `Il y a ${d}j`;
  }

  container.innerHTML = history.map(h => `
    <article class="guide-card fade-in" onclick="window.location.href='guide.html?id=${h.id}'">
      <div class="guide-card-header">
        <span class="guide-game-tag">${h.gameName || "Jeu"}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">${timeAgoMs(h.viewedAt)}</span>
      </div>
      <h3 class="guide-card-title">${h.title || "Guide"}</h3>
      <footer class="guide-card-footer">
        <span class="guide-author">👤 ${h.authorName || "Auteur"}</span>
        <a href="guide.html?id=${h.id}" class="btn btn-sm btn-outline">Relire</a>
      </footer>
    </article>
  `).join("");
}

window.clearHistory = function() {
  localStorage.removeItem(HISTORY_KEY);
  loadHistory();
  showToast("Historique effacé.", "info");
};

// ──────────────────────────────────────────────
// 🌐 Exposition globale (pour les onclick HTML)
// ──────────────────────────────────────────────
window.toggleFavorite = toggleFavorite;

async function toggleFavorite(guideId, btn) {
  const user = auth.currentUser;
  if (!user) { showToast("Connecte-toi pour ajouter aux favoris.", "warning"); return; }

  const { getDocs: gd, query: q, where: wh, addDoc, deleteDoc: dd, doc: d2 }
    = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

  const favsRef = collection(db, "favorites");
  const existing = await getDocs(
    query(favsRef, where("userId", "==", user.uid), where("guideId", "==", guideId))
  );

  if (existing.empty) {
    // Ajouter aux favoris
    await addDoc(favsRef, { userId: user.uid, guideId, createdAt: serverTimestamp() });
    btn.classList.add("active");
    btn.textContent = "★";
    showToast("Ajouté aux favoris !", "success");
  } else {
    // Retirer des favoris
    existing.forEach(async docSnap => await deleteDoc(doc(db, "favorites", docSnap.id)));
    btn.classList.remove("active");
    btn.textContent = "☆";
    showToast("Retiré des favoris.", "info");
  }
}

// Lancement
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initDashboard();
});
