// ============================================================
//  CONFIGURACIÓN DE FIREBASE
//  ------------------------------------------------------------
//  1. Entra a https://console.firebase.google.com
//  2. Crea un proyecto (o usa uno existente)
//  3. Agrega una "App Web" y copia el objeto firebaseConfig
//  4. Pega aquí abajo tus credenciales reales
//  5. Activa "Firestore Database" en modo producción o prueba
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

// Inicializa Firebase y Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ============================================================
//  CLAVE DEL PANEL ADMIN
//  ------------------------------------------------------------
//  Por seguridad, la contraseña NO está en el código:
//  se guarda en Firestore en el documento  config/admin
//  con el campo  password  (ver README, paso de configuración).
//  Crea ese documento con el valor:  bisc
// ============================================================

// ============================================================
//  CONFIGURACIÓN DEL SORTEO (edita a tu gusto)
// ============================================================
export const RIFA_CONFIG = {
  totalNumeros: 100,      // cantidad de números del sorteo
  precio: 500,            // precio por número
  moneda: "RD$",          // símbolo de moneda
  nombreRifa: "Gran Sorteo de Perfumes",
  descripcion: "Participa eligiendo tu número. El ganador se decide con el primer número de la Lotería Nacional Dominicana.",
};
