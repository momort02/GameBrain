// ============================================================
// firebase-config.js — Configuration Firebase pour GameBrain
// ============================================================
// 🔧 IMPORTANT : Remplace les valeurs ci-dessous par celles
//    de ton propre projet Firebase (https://console.firebase.google.com)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ──────────────────────────────────────────────
// 🔑 Remplace ces valeurs par les tiennes
// ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCAxR0fU0IQgrP6B6_vDaZGCh20XTJXeZI",
    authDomain: "gamebrain-9a61d.firebaseapp.com",
    projectId: "gamebrain-9a61d",
    storageBucket: "gamebrain-9a61d.firebasestorage.app",
    messagingSenderId: "967376438159",
    appId: "1:967376438159:web:ff4147c8dcefa839d501fa",
    measurementId: "G-NYL6ZJ6DDD"
  };

// ──────────────────────────────────────────────
// 🚀 Initialisation Firebase
// ──────────────────────────────────────────────
const app = initializeApp(firebaseConfig);

// Services exportés
export const auth = getAuth(app);
export const db   = getFirestore(app);
export default app;


