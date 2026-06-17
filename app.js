// ============================================================
//  LÓGICA DE LA PÁGINA PRINCIPAL
// ============================================================
import { db, RIFA_CONFIG } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Referencia a la colección de números
const numerosRef = collection(db, "numeros");

// Estado en memoria: { "5": { nombre, telefono, ... } }
let ocupados = {};
let numeroSeleccionado = null;

// --- Elementos del DOM ---
const grid = document.getElementById("numerosGrid");
const overlay = document.getElementById("modalOverlay");
const modalNum = document.getElementById("modalNum");
const inpNombre = document.getElementById("inpNombre");
const inpTelefono = document.getElementById("inpTelefono");
const btnCancelar = document.getElementById("btnCancelar");
const btnConfirmar = document.getElementById("btnConfirmar");
const disponiblesPill = document.getElementById("disponiblesPill");
const precioPill = document.getElementById("precioPill");
const toast = document.getElementById("toast");

// --- Configuración visible ---
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("brandName").textContent = RIFA_CONFIG.nombreRifa;
document.getElementById("heroTitle").innerHTML = RIFA_CONFIG.nombreRifa.replace(
  /Perfumes/i,
  '<span class="accent">Perfumes</span>'
);
document.getElementById("heroDesc").textContent = RIFA_CONFIG.descripcion;
precioPill.textContent = `${RIFA_CONFIG.moneda} ${RIFA_CONFIG.precio}`;

// ============================================================
//  TOAST
// ============================================================
let toastTimer;
function mostrarToast(msg, tipo = "ok") {
  toast.textContent = msg;
  toast.className = `toast show ${tipo}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

// ============================================================
//  RENDER DE LA CUADRÍCULA
// ============================================================
function renderGrid() {
  grid.innerHTML = "";
  let disponibles = 0;

  for (let i = 1; i <= RIFA_CONFIG.totalNumeros; i++) {
    const key = String(i);
    const cell = document.createElement("div");
    cell.className = "numero";
    cell.textContent = String(i).padStart(2, "0");

    if (ocupados[key]) {
      cell.classList.add("ocupado");
      cell.title = "Número ocupado";
    } else {
      disponibles++;
      cell.addEventListener("click", () => abrirModal(i));
    }
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
  overlay.classList.add("open");
  inpNombre.focus();
}

function cerrarModal() {
  overlay.classList.remove("open");
  numeroSeleccionado = null;
}

btnCancelar.addEventListener("click", cerrarModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) cerrarModal();
});

// ============================================================
//  CONFIRMAR RESERVA
// ============================================================
btnConfirmar.addEventListener("click", async () => {
  const nombre = inpNombre.value.trim();
  const telefono = inpTelefono.value.trim();

  if (!nombre || !telefono) {
    mostrarToast("Completa nombre y teléfono.", "err");
    return;
  }
  if (numeroSeleccionado == null) return;

  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Reservando...";

  try {
    const ref = doc(db, "numeros", String(numeroSeleccionado));

    // Verifica que no lo hayan tomado mientras tanto
    const snap = await getDoc(ref);
    if (snap.exists()) {
      mostrarToast("Ese número acaba de ser ocupado. Elige otro.", "err");
      cerrarModal();
      return;
    }

    await setDoc(ref, {
      numero: numeroSeleccionado,
      nombre,
      telefono,
      pagado: false, // el admin lo marcará luego
      creado: serverTimestamp(),
    });

    mostrarToast(
      `¡Número ${String(numeroSeleccionado).padStart(2, "0")} reservado!`,
      "ok"
    );
    cerrarModal();
  } catch (err) {
    console.error("[v0] Error al reservar:", err);
    mostrarToast("Error al reservar. Revisa tu conexión.", "err");
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Reservar número";
  }
});

// ============================================================
//  ESCUCHA EN TIEMPO REAL
//  (los usuarios NO ven datos de pago, solo si está ocupado)
// ============================================================
function escucharNumeros() {
  onSnapshot(
    numerosRef,
    (snapshot) => {
      ocupados = {};
      snapshot.forEach((d) => {
        ocupados[d.id] = true; // solo guardamos que está ocupado
      });
      renderGrid();
    },
    (err) => {
      console.error("[v0] Error de Firestore:", err);
      grid.innerHTML =
        '<div class="loading">No se pudo conectar a la base de datos. Revisa firebase-config.js</div>';
    }
  );
}

// Inicia
escucharNumeros();
