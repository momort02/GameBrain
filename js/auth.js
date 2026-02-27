// ============================================================
// auth.js — Gestion de l'authentification Firebase
// ============================================================
// Inscription, connexion, déconnexion, protection de pages
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast, showLoader, hideLoader } from "./main.js";

// ──────────────────────────────────────────────
// 📌 Surveillance de l'état de connexion
// ──────────────────────────────────────────────

/**
 * Retourne l'utilisateur courant ou null.
 * Utilise une Promise pour attendre l'initialisation Firebase Auth.
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Redirige vers login.html si l'utilisateur n'est pas connecté.
 * À appeler en haut de chaque page protégée.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
  }
  return user;
}

/**
 * Redirige vers dashboard.html si l'utilisateur est déjà connecté.
 * À appeler sur login.html et register.html.
 */
export async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "dashboard.html";
  }
}

// ──────────────────────────────────────────────
// 📝 Inscription
// ──────────────────────────────────────────────

/**
 * Crée un compte Firebase Auth + document Firestore dans /users/{uid}
 * @param {string} email
 * @param {string} password
 * @param {string} username
 */
export async function registerUser(email, password, username) {
  showLoader();
  try {
    // 1. Créer le compte Firebase Auth
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user  = cred.user;

    // 2. Mettre à jour le displayName
    await updateProfile(user, { displayName: username });

    // 3. Créer le document Firestore pour l'utilisateur
    await setDoc(doc(db, "users", user.uid), {
      uid:       user.uid,
      email:     email,
      username:  username,
      role:      "user",        // "user" | "admin"
      verified:  false,         // badge auteur vérifié
      createdAt: serverTimestamp()
    });

    showToast("Compte créé avec succès ! Bienvenue sur GameBrain 🎮", "success");
    window.location.href = "dashboard.html";
  } catch (err) {
    hideLoader();
    showToast(translateAuthError(err.code), "error");
    throw err;
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// 🔑 Connexion
// ──────────────────────────────────────────────

/**
 * Connecte l'utilisateur avec email/password.
 * @param {string} email
 * @param {string} password
 */
export async function loginUser(email, password) {
  showLoader();
  try {
    await signInWithEmailAndPassword(auth, email, password);
    showToast("Connexion réussie ! Content de te revoir 👾", "success");
    window.location.href = "dashboard.html";
  } catch (err) {
    hideLoader();
    showToast(translateAuthError(err.code), "error");
    throw err;
  } finally {
    hideLoader();
  }
}

// ──────────────────────────────────────────────
// 🚪 Déconnexion
// ──────────────────────────────────────────────

/**
 * Déconnecte l'utilisateur et redirige vers index.html.
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    showToast("Déconnexion réussie. À bientôt !", "info");
    window.location.href = "index.html";
  } catch (err) {
    showToast("Erreur lors de la déconnexion.", "error");
  }
}

// ──────────────────────────────────────────────
// 👤 Récupération profil Firestore
// ──────────────────────────────────────────────

/**
 * Récupère le profil complet de l'utilisateur depuis Firestore.
 * @param {string} uid
 * @returns {Object|null}
 */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Erreur récupération profil :", err);
    return null;
  }
}

// ──────────────────────────────────────────────
// 🌐 Mise à jour de la navbar selon l'état auth
// ──────────────────────────────────────────────

/**
 * Met à jour les éléments de navigation selon l'état de connexion.
 * Appelle cette fonction sur chaque page.
 */
export function initNavAuth() {
  onAuthStateChanged(auth, async (user) => {
    const navActions   = document.getElementById("nav-actions");
    const navUser      = document.getElementById("nav-user");
    const navUsername  = document.getElementById("nav-username");

    if (!navActions) return;

    if (user) {
      // Utilisateur connecté
      const profile  = await getUserProfile(user.uid);
      const username = profile?.username || user.displayName || "Joueur";
      const photoURL = profile?.photoURL || user.photoURL || null;

      if (navActions)  navActions.style.display = "none";
      if (navUser)     navUser.style.display     = "flex";
      if (navUsername) navUsername.textContent   = username;

      // Mettre à jour l'avatar dans la navbar
      const navAvatar = document.getElementById("nav-avatar");
      if (navAvatar) {
        navAvatar.style.cursor   = "pointer";
        navAvatar.style.overflow = "hidden";
        navAvatar.onclick        = () => window.location.href = "profile.html";
        if (photoURL) {
          navAvatar.innerHTML = `<img src="${photoURL}" alt="${username}"
            style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"
            onerror="this.parentElement.innerHTML='${username.charAt(0).toUpperCase()}'" />`;
        } else {
          navAvatar.textContent   = username.charAt(0).toUpperCase();
          navAvatar.style.fontSize = "1rem";
          navAvatar.style.fontWeight = "700";
          navAvatar.style.color = "var(--accent)";
        }
      }
    } else {
      // Visiteur
      if (navActions) navActions.style.display = "flex";
      if (navUser)    navUser.style.display    = "none";
    }
  });
}

// ──────────────────────────────────────────────
// 🔤 Traduction des erreurs Firebase Auth
// ──────────────────────────────────────────────

function translateAuthError(code) {
  const errors = {
    "auth/email-already-in-use":    "Cet email est déjà utilisé.",
    "auth/invalid-email":           "Adresse email invalide.",
    "auth/weak-password":           "Mot de passe trop faible (min. 6 caractères).",
    "auth/user-not-found":          "Aucun compte trouvé avec cet email.",
    "auth/wrong-password":          "Mot de passe incorrect.",
    "auth/too-many-requests":       "Trop de tentatives. Réessaie plus tard.",
    "auth/network-request-failed":  "Erreur réseau. Vérifie ta connexion.",
    "auth/invalid-credential":      "Identifiants invalides.",
  };
  return errors[code] || "Une erreur est survenue. Réessaie.";
}
