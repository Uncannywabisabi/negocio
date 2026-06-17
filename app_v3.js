// ============================================================
//  LÓGICA DE LA PÁGINA PRINCIPAL
//  — Sistema de aprobación: las reservas van a estado "pendiente"
// ============================================================
import { db, RIFA_CONFIG } from "./firebase-config_v3.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const numerosRef = collection(db, "numeros");

// Estado: { "5": { estado: 'pendiente' | 'aprobado' } }
let numerosData = {};
let numeroSeleccionado = null;

// --- DOM ---
const grid = document.getElementById("numerosGrid");
const overlay = document.getElementById("modalOverlay");
const modalNum = document.getElementById("modalNum");
const inpNombre = document.getElementById("inpNombre");
const inpTelefono = document.getElementById("inpTelefono");
const btnCancelar = document.getElementById("btnCancelar");
const btnConfirmar = document.getElementById("btnConfirmar");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const disponiblesPill = document.getElementById("disponiblesPill");
const precioPill = document.getElementById("precioPill");
const toastEl = document.getElementById("toast");

// --- Configuración visible ---
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("brandName").textContent = RIFA_CONFIG.nombreRifa;
precioPill.textContent = `${RIFA_CONFIG.moneda} ${RIFA_CONFIG.precio}`;

// --- Mobile menu ---
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navLinks = document.querySelector(".nav-links");
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("open");
    const icon = mobileMenuBtn.querySelector("i");
    icon.className = navLinks.classList.contains("open")
      ? "fas fa-times"
      : "fas fa-bars";
  });
}

// Close mobile menu on link click
document.querySelectorAll(".nav-links a").forEach((a) => {
  a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    const icon = mobileMenuBtn?.querySelector("i");
    if (icon) icon.className = "fas fa-bars";
  });
});

// ============================================================
//  TOAST
// ============================================================
let toastTimer;
function mostrarToast(msg, tipo = "ok") {
  const icon = toastEl.querySelector(".toast-icon");
  const msgEl = toastEl.querySelector(".toast-msg");
  msgEl.textContent = msg;

  if (tipo === "ok") {
    icon.className = "toast-icon fas fa-check-circle";
  } else {
    icon.className = "toast-icon fas fa-exclamation-circle";
  }

  toastEl.className = `toast show ${tipo}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = "toast";
  }, 4000);
}

// ============================================================
//  RENDER GRID — 3 estados: disponible, pendiente, ocupado
// ============================================================
function renderGrid() {
  grid.innerHTML = "";
  let disponibles = 0;

  for (let i = 1; i <= RIFA_CONFIG.totalNumeros; i++) {
    const key = String(i);
    const cell = document.createElement("button"); // Changed to button for accessibility
    cell.className = "num-btn";

    const data = numerosData[key];

    if (data) {
      if (data.estado === "pendiente") {
        // Pendiente de aprobación → deshabilitado
        cell.classList.add("pendiente");
        cell.title = "En revisión — pendiente de aprobación";
        cell.innerHTML = `<span class="num-text">${String(i).padStart(
          2,
          "0"
        )}</span><i class="fas fa-clock num-state-icon" style="font-size:0.5em;margin-left:5px"></i>`;
      } else {
        // Aprobado / ocupado
        cell.classList.add("ocupado");
        cell.title = "Número ocupado";
        cell.innerHTML = `<span class="num-text">${String(i).padStart(
          2,
          "0"
        )}</span><i class="fas fa-lock num-state-icon" style="font-size:0.5em;margin-left:5px"></i>`;
      }
    } else {
      disponibles++;
      cell.innerHTML = `<span class="num-text">${String(i).padStart(
        2,
        "0"
      )}</span>`;
      cell.addEventListener("click", () => abrirModal(i));
    }

    // Entrance animation delay
    cell.style.animationDelay = `${i * 0.012}s`;
    grid.appendChild(cell);
  }

  disponiblesPill.textContent = `${disponibles} / ${RIFA_CONFIG.totalNumeros}`;
}

// ============================================================
//  MODAL
// ============================================================
function abrirModal(num) {
  numeroSeleccionado = num;
  modalNum.textContent = "#" + String(num).padStart(2, "0");
  inpNombre.value = "";
  inpTelefono.value = "";
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  setTimeout(() => inpNombre.focus(), 200);
}

function cerrarModal() {
  overlay.classList.remove("active");
  document.body.style.overflow = "";
  numeroSeleccionado = null;
}

btnCancelar.addEventListener("click", cerrarModal);
modalCloseBtn.addEventListener("click", cerrarModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) cerrarModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && overlay.classList.contains("active")) cerrarModal();
});

// ============================================================
//  CONFIRMAR SOLICITUD (va a estado "pendiente")
// ============================================================
btnConfirmar.addEventListener("click", async () => {
  const nombre = inpNombre.value.trim();
  const telefono = inpTelefono.value.trim();

  if (!nombre) {
    mostrarToast("Escribe tu nombre completo.", "err");
    inpNombre.focus();
    return;
  }
  if (!telefono) {
    mostrarToast("Escribe tu número de teléfono.", "err");
    inpTelefono.focus();
    return;
  }
  if (numeroSeleccionado == null) return;

  btnConfirmar.disabled = true;
  btnConfirmar.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Enviando...';

  try {
    const ref = doc(db, "numeros", String(numeroSeleccionado));

    // Verificar que no lo hayan tomado
    const snap = await getDoc(ref);
    if (snap.exists()) {
      mostrarToast(
        "Ese número ya no está disponible. Elige otro.",
        "err"
      );
      cerrarModal();
      return;
    }

    await setDoc(ref, {
      numero: numeroSeleccionado,
      nombre,
      telefono,
      pagado: false,
      estado: "pendiente",
      creado: serverTimestamp(),
    });

    mostrarToast(
      `¡Solicitud enviada! Tu número #${String(
        numeroSeleccionado
      ).padStart(
        2,
        "0"
      )} está pendiente de aprobación.`,
      "ok"
    );
    cerrarModal();
  } catch (err) {
    console.error("Error al reservar:", err);
    mostrarToast("Error al enviar solicitud. Revisa tu conexión.", "err");
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.innerHTML =
      '<i class="fas fa-paper-plane"></i> Enviar solicitud';
  }
});

// ============================================================
//  ESCUCHA EN TIEMPO REAL
// ============================================================
function escucharNumeros() {
  onSnapshot(
    numerosRef,
    (snapshot) => {
      numerosData = {};
      snapshot.forEach((d) => {
        const data = d.data();
        numerosData[d.id] = {
          estado: data.estado || "aprobado", // backward compat
        };
      });
      renderGrid();
    },
    (err) => {
      console.error("Error de Firestore:", err);
      grid.innerHTML =
        '<div class="loading"><i class="fas fa-exclamation-triangle"></i> Error de conexión. Recarga la página.</div>';
    }
  );
}

// ============================================================
//  INIT
// ============================================================
escucharNumeros();
