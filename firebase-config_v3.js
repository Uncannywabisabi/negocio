// ============================================================
//  CONFIGURACIÓN DE FIREBASE
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB58EWHRSu74h758t_5BOP4OFlsSzD5UYI",
  authDomain: "proyectos-de-github.firebaseapp.com",
  projectId: "proyectos-de-github",
  storageBucket: "proyectos-de-github.firebasestorage.app",
  messagingSenderId: "545577917016",
  appId: "1:545577917016:web:cd10f7438eb965051a482d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ============================================================
//  CONFIGURACIÓN DEL SORTEO
// ============================================================
export const RIFA_CONFIG = {
  totalNumeros: 100,
  precio: 100,
  moneda: "RD$",
  nombreRifa: "Gran Sorteo de Perfumes",
  descripcion: "Participa eligiendo tu número. El ganador se decide con el primer número de la Lotería Nacional Dominicana.",
};
