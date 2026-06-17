// ============================================================
//  LÓGICA DEL PANEL DE ADMINISTRACIÓN
// ============================================================
import { db, RIFA_CONFIG } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const numerosRef = collection(db, "numeros");

// --- DOM ---
const loginView = document.getElementById("loginView");
const panelView = document.getElementById("panelView");
const inpClave = document.getElementById("inpClave");
const btnEntrar = document.getElementById("btnEntrar");
const btnLogout = document.getElementById("btnLogout");
const tablaBody = document.getElementById("tablaBody");
const inpBuscar = document.getElementById("inpBuscar");
const toast = document.getElementById("toast");

// Estadísticas
const stOcupados = document.getElementById("stOcupados");
const stPagados = document.getElementById("stPagados");
const stPendientes = document.getElementById("stPendientes");
const stRecaudado = document.getElementById("stRecaudado");

// Datos en memoria
let registros = [];
let unsub = null;

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
//  LOGIN (clave validada contra Firestore: config/admin)
// ============================================================
async function entrar() {
  const clave = inpClave.value.trim();
  if (!clave) {
    mostrarToast("Escribe la contraseña.", "err");
    return;
  }
  btnEntrar.disabled = true;
  btnEntrar.textContent = "Verificando...";
  try {
    const snap = await getDoc(doc(db, "config", "admin"));
    const claveGuardada = snap.exists() ? snap.data().password : null;

    if (!claveGuardada) {
      mostrarToast("Falta crear el documento config/admin en Firestore.", "err");
      return;
    }
    if (clave === claveGuardada) {
      sessionStorage.setItem("admin_ok", "1");
      abrirPanel();
    } else {
      mostrarToast("Contraseña incorrecta.", "err");
    }
  } catch (err) {
    console.error("[v0] Error al validar la clave:", err);
    mostrarToast("Error de conexión. Revisa firebase-config.js", "err");
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = "Entrar";
  }
}

function abrirPanel() {
  loginView.classList.add("hidden");
  panelView.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
  escucharNumeros();
}

function salir() {
  sessionStorage.removeItem("admin_ok");
  if (unsub) unsub();
  panelView.classList.add("hidden");
  btnLogout.classList.add("hidden");
  loginView.classList.remove("hidden");
  inpClave.value = "";
}

btnEntrar.addEventListener("click", entrar);
inpClave.addEventListener("keydown", (e) => {
  if (e.key === "Enter") entrar();
});
btnLogout.addEventListener("click", (e) => {
  e.preventDefault();
  salir();
});

// Si ya inició sesión en esta pestaña
if (sessionStorage.getItem("admin_ok") === "1") {
  abrirPanel();
}

// ============================================================
//  ESCUCHA EN TIEMPO REAL (admin ve TODO, incluido pago)
// ============================================================
function escucharNumeros() {
  unsub = onSnapshot(
    numerosRef,
    (snapshot) => {
      registros = [];
      snapshot.forEach((d) => {
        registros.push({ id: d.id, ...d.data() });
      });
      registros.sort((a, b) => a.numero - b.numero);
      actualizarStats();
      renderTabla();
    },
    (err) => {
      console.error("[v0] Error de Firestore:", err);
      tablaBody.innerHTML =
        '<tr><td colspan="5" class="loading">Error de conexión. Revisa firebase-config.js</td></tr>';
    }
  );
}

// ============================================================
//  ESTADÍSTICAS
// ============================================================
function actualizarStats() {
  const total = registros.length;
  const pagados = registros.filter((r) => r.pagado).length;
  const pendientes = total - pagados;
  const recaudado = pagados * RIFA_CONFIG.precio;

  stOcupados.textContent = total;
  stPagados.textContent = pagados;
  stPendientes.textContent = pendientes;
  stRecaudado.textContent = `${RIFA_CONFIG.moneda} ${recaudado.toLocaleString()}`;
}

// ============================================================
//  RENDER DE LA TABLA
// ============================================================
function renderTabla() {
  const filtro = inpBuscar.value.trim().toLowerCase();
  const lista = registros.filter((r) => {
    if (!filtro) return true;
    return (
      String(r.numero).includes(filtro) ||
      (r.nombre || "").toLowerCase().includes(filtro) ||
      (r.telefono || "").toLowerCase().includes(filtro)
    );
  });

  if (lista.length === 0) {
    tablaBody.innerHTML =
      '<tr><td colspan="5" class="loading">No hay números que coincidan.</td></tr>';
    return;
  }

  tablaBody.innerHTML = "";
  lista.forEach((r) => {
    const tr = document.createElement("tr");

    const tdNum = document.createElement("td");
    tdNum.innerHTML = `<strong>#${String(r.numero).padStart(2, "0")}</strong>`;

    const tdNombre = document.createElement("td");
    tdNombre.textContent = r.nombre || "-";

    const tdTel = document.createElement("td");
    tdTel.textContent = r.telefono || "-";

    const tdEstado = document.createElement("td");
    tdEstado.innerHTML = r.pagado
      ? '<span class="badge pagado">Pagado</span>'
      : '<span class="badge pendiente">Pendiente</span>';

    const tdAcc = document.createElement("td");
    const acc = document.createElement("div");
    acc.className = "row-actions";

    // Botón marcar pago
    const btnPago = document.createElement("button");
    btnPago.className = r.pagado ? "btn btn-ghost" : "btn btn-primary";
    btnPago.textContent = r.pagado ? "Quitar pago" : "Marcar pagado";
    btnPago.addEventListener("click", () => togglePago(r));

    // Botón liberar número
    const btnDel = document.createElement("button");
    btnDel.className = "btn btn-danger";
    btnDel.textContent = "Liberar";
    btnDel.addEventListener("click", () => liberar(r));

    acc.appendChild(btnPago);
    acc.appendChild(btnDel);
    tdAcc.appendChild(acc);

    tr.append(tdNum, tdNombre, tdTel, tdEstado, tdAcc);
    tablaBody.appendChild(tr);
  });
}

inpBuscar.addEventListener("input", renderTabla);

// ============================================================
//  ACCIONES
// ============================================================
async function togglePago(r) {
  try {
    await updateDoc(doc(db, "numeros", r.id), { pagado: !r.pagado });
    mostrarToast(
      !r.pagado
        ? `Número #${String(r.numero).padStart(2, "0")} marcado como pagado.`
        : `Pago retirado del #${String(r.numero).padStart(2, "0")}.`
    );
  } catch (err) {
    console.error("[v0] Error al actualizar pago:", err);
    mostrarToast("No se pudo actualizar.", "err");
  }
}

async function liberar(r) {
  const ok = confirm(
    `¿Liberar el número #${String(r.numero).padStart(2, "0")} de ${
      r.nombre || "este cliente"
    }? Quedará disponible de nuevo.`
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "numeros", r.id));
    mostrarToast(`Número #${String(r.numero).padStart(2, "0")} liberado.`);
  } catch (err) {
    console.error("[v0] Error al liberar:", err);
    mostrarToast("No se pudo liberar.", "err");
  }
}
