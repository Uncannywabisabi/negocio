// ============================================================
//  LÓGICA DEL PANEL DE ADMINISTRACIÓN
// ============================================================
import { db, RIFA_CONFIG } from "./firebase-config.js";
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const numerosRef = collection(db, "numeros");

// --- DOM LOGIN ---
const loginView = document.getElementById("loginView");
const panelView = document.getElementById("panelView");
const inpClave = document.getElementById("inpClave");
const btnEntrar = document.getElementById("btnEntrar");
const loginError = document.getElementById("loginError");
const btnLogout = document.getElementById("btnLogout");

// --- TABS ---
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll(".panel");

navItems.forEach(btn => {
  btn.addEventListener("click", () => {
    navItems.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.target).classList.add("active");
  });
});

// --- STATE ---
let registros = [];
let unsub = null;
let editId = null;
let inversionBase = 0;

// --- TOAST ---
const toastContainer = document.getElementById("toastContainer");
function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `msg-box ${type}`;
  el.style.margin = "0";
  el.style.animation = "fadeInDown 0.3s ease-out forwards";
  el.innerHTML = type === "success" 
    ? `<i class="fas fa-check-circle"></i> ${msg}`
    : `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============================================================
//  LOGIN
// ============================================================
async function entrar() {
  const clave = inpClave.value.trim();
  if (!clave) return;
  
  btnEntrar.disabled = true;
  btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
  loginError.classList.add("hidden");

  try {
    const snap = await getDoc(doc(db, "config", "admin"));
    const claveGuardada = snap.exists() ? snap.data().password : null;

    if (clave === claveGuardada) {
      sessionStorage.setItem("admin_ok", "1");
      abrirPanel();
    } else {
      loginError.classList.remove("hidden");
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = "Error de conexión";
    loginError.classList.remove("hidden");
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.innerHTML = '<i class="fas fa-sign-in-alt"></i> Acceder al Panel';
  }
}

function abrirPanel() {
  loginView.classList.add("hidden");
  panelView.classList.remove("hidden");
  cargarConfigFinanzas();
  escucharNumeros();
}

function salir() {
  sessionStorage.removeItem("admin_ok");
  if (unsub) unsub();
  panelView.classList.add("hidden");
  loginView.classList.remove("hidden");
  inpClave.value = "";
}

btnEntrar.addEventListener("click", entrar);
inpClave.addEventListener("keydown", (e) => { if (e.key === "Enter") entrar(); });
btnLogout.addEventListener("click", salir);

if (sessionStorage.getItem("admin_ok") === "1") {
  abrirPanel();
}

// ============================================================
//  DATOS Y RENDER
// ============================================================
function escucharNumeros() {
  unsub = onSnapshot(numerosRef, (snapshot) => {
    registros = [];
    snapshot.forEach((d) => {
      registros.push({ id: d.id, ...d.data() });
    });
    registros.sort((a, b) => a.numero - b.numero);
    
    renderDashboard();
    renderAprobaciones();
    renderTablaTodos();
    renderAdminGrid();
    actualizarFinanzas();
    llenarSelectLibres();
  });
}

function formatearFecha(ts) {
  if (!ts) return "-";
  const d = ts.toDate();
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// ---- DASHBOARD ----
function renderDashboard() {
  const total = registros.length;
  const pendientes = registros.filter(r => r.estado === "pendiente").length;
  const pagados = registros.filter(r => r.pagado).length;

  document.getElementById("dashTotales").textContent = `${total}/${RIFA_CONFIG.totalNumeros}`;
  document.getElementById("dashPendientes").textContent = pendientes;
  document.getElementById("dashPagados").textContent = pagados;

  const badgeAprobaciones = document.getElementById("badgeAprobaciones");
  if (pendientes > 0) {
    badgeAprobaciones.textContent = pendientes;
    badgeAprobaciones.style.display = "inline-block";
  } else {
    badgeAprobaciones.style.display = "none";
  }

  // Recientes (últimos 5)
  const lista = document.getElementById("listaRecientes");
  lista.innerHTML = "";
  const recientes = [...registros].sort((a,b) => (b.creado?.toMillis() || 0) - (a.creado?.toMillis() || 0)).slice(0, 5);
  
  if (recientes.length === 0) {
    lista.innerHTML = '<li class="recent-empty">No hay actividad reciente.</li>';
  } else {
    recientes.forEach(r => {
      let icon = r.estado === 'pendiente' ? '<i class="fas fa-clock" style="color:var(--yellow)"></i>' : '<i class="fas fa-check" style="color:var(--green)"></i>';
      lista.innerHTML += `
        <li class="recent-item">
          <div class="recent-num">${r.numero}</div>
          <div style="flex:1;">
            <div class="recent-name">${r.nombre || "Sin nombre"} ${icon}</div>
            <div style="font-size:0.75rem; color:var(--text-muted)">${formatearFecha(r.creado)}</div>
          </div>
        </li>
      `;
    });
  }
}

// ---- APROBACIONES ----
function renderAprobaciones() {
  const tbody = document.getElementById("tablaAprobaciones");
  const pendientes = registros.filter(r => r.estado === "pendiente");

  if (pendientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No hay solicitudes pendientes.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  pendientes.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${String(r.numero).padStart(2, "0")}</strong></td>
      <td>${r.nombre}</td>
      <td>${r.telefono}</td>
      <td>${formatearFecha(r.creado)}</td>
      <td>
        <div class="btn-row" style="margin:0;">
          <button class="btn-primary" style="padding: 0.4rem 0.8rem;" onclick="aprobar('${r.id}')"><i class="fas fa-check"></i> Aprobar</button>
          <button class="btn-danger" style="padding: 0.4rem 0.8rem;" onclick="rechazar('${r.id}')"><i class="fas fa-times"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.aprobar = async (id) => {
  try {
    await updateDoc(doc(db, "numeros", id), { estado: "aprobado" });
    showToast("Solicitud aprobada");
  } catch(e) { showToast("Error al aprobar", "error"); }
}

window.rechazar = async (id) => {
  if (!confirm("¿Seguro que quieres rechazar y eliminar esta solicitud?")) return;
  try {
    await deleteDoc(doc(db, "numeros", id));
    showToast("Solicitud rechazada y número liberado");
  } catch(e) { showToast("Error al rechazar", "error"); }
}

// ---- CONTROL NÚMEROS Y BÚSQUEDA ----
function renderAdminGrid() {
  const grid = document.getElementById("adminGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= RIFA_CONFIG.totalNumeros; i++) {
    const r = registros.find(x => x.numero === i);
    const btn = document.createElement("button");
    btn.className = "admin-num";
    btn.textContent = String(i).padStart(2, "0");
    
    if (!r) {
      btn.classList.add("available");
      btn.title = "Disponible";
    } else if (r.pagado) {
      btn.classList.add("paid");
      btn.title = r.nombre + " - Pagado";
    } else {
      btn.classList.add("taken");
      btn.title = r.nombre + " - " + (r.estado === 'pendiente' ? 'Pendiente' : 'Aprobado/Sin Pagar');
    }
    grid.appendChild(btn);
  }
}

const inpBuscar = document.getElementById("inpBuscar");
function renderTablaTodos() {
  const tbody = document.getElementById("tablaTodos");
  const filtro = inpBuscar.value.trim().toLowerCase();
  
  const lista = registros.filter(r => {
    if (!filtro) return true;
    return String(r.numero).includes(filtro) || (r.nombre||"").toLowerCase().includes(filtro) || (r.telefono||"").toLowerCase().includes(filtro);
  });

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No hay coincidencias.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  lista.forEach(r => {
    const isPendiente = r.estado === "pendiente";
    const estadoBadge = isPendiente 
      ? '<span class="badge badge-yellow">Pendiente</span>' 
      : '<span class="badge badge-green">Aprobado</span>';
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${String(r.numero).padStart(2, "0")}</strong></td>
      <td>${r.nombre || "-"}</td>
      <td>${r.telefono || "-"}</td>
      <td>${estadoBadge}</td>
      <td>
        <button class="btn-ghost" style="padding:0.3rem 0.6rem; color: ${r.pagado ? 'var(--green)' : 'var(--text-muted)'}; border-color: ${r.pagado ? 'var(--green)' : 'var(--border2)'};" onclick="togglePago('${r.id}', ${r.pagado})">
          <i class="fas ${r.pagado ? 'fa-check-circle' : 'fa-circle'}"></i> ${r.pagado ? 'Pagado' : 'Marcar'}
        </button>
      </td>
      <td>
        <div class="btn-row" style="margin:0;">
          <button class="btn-ghost" style="padding:0.3rem 0.6rem;" onclick="abrirEdit('${r.id}')" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="btn-ghost" style="padding:0.3rem 0.6rem; color:var(--red);" onclick="liberar('${r.id}', ${r.numero})" title="Liberar/Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

inpBuscar.addEventListener("input", renderTablaTodos);

window.togglePago = async (id, actual) => {
  try {
    await updateDoc(doc(db, "numeros", id), { pagado: !actual, estado: "aprobado" }); // Si paga, automáticamente se aprueba
    showToast(!actual ? "Marcado como pagado" : "Pago retirado");
  } catch(e) { showToast("Error al actualizar pago", "error"); }
}

window.liberar = async (id, num) => {
  if (!confirm(`¿Seguro que quieres eliminar a la persona del número #${num}? El número quedará libre.`)) return;
  try {
    await deleteDoc(doc(db, "numeros", id));
    showToast(`Número #${num} liberado`);
  } catch(e) { showToast("Error al liberar", "error"); }
}

// ============================================================
//  FINANZAS
// ============================================================
async function cargarConfigFinanzas() {
  try {
    const snap = await getDoc(doc(db, "config", "finanzas"));
    if (snap.exists()) {
      inversionBase = snap.data().inversion || 0;
      document.getElementById("inpInversion").value = inversionBase;
    }
  } catch (e) { console.error("Error cargando finanzas"); }
}

document.getElementById("btnGuardarInversion").addEventListener("click", async () => {
  const val = Number(document.getElementById("inpInversion").value);
  if (isNaN(val) || val < 0) return;
  try {
    await setDoc(doc(db, "config", "finanzas"), { inversion: val }, { merge: true });
    inversionBase = val;
    document.getElementById("msgInversion").classList.remove("hidden");
    setTimeout(() => document.getElementById("msgInversion").classList.add("hidden"), 3000);
    actualizarFinanzas();
  } catch (e) { showToast("Error al guardar inversión", "error"); }
});

function actualizarFinanzas() {
  const aprobados = registros.filter(r => r.estado !== "pendiente");
  const pagados = aprobados.filter(r => r.pagado);
  
  const dineroRecaudado = pagados.length * RIFA_CONFIG.precio;
  const dineroPendiente = (aprobados.length - pagados.length) * RIFA_CONFIG.precio;
  const dineroEsperado = RIFA_CONFIG.totalNumeros * RIFA_CONFIG.precio;
  
  const gananciaActual = dineroRecaudado - inversionBase;
  const gananciaProyectada = dineroEsperado - inversionBase;

  const fmt = (num) => `${RIFA_CONFIG.moneda} ${num.toLocaleString()}`;

  document.getElementById("finInversion").textContent = fmt(inversionBase);
  document.getElementById("finRecaudado").textContent = fmt(dineroRecaudado);
  document.getElementById("finPendiente").textContent = fmt(dineroPendiente);
  document.getElementById("finEsperado").textContent = fmt(dineroEsperado);
  
  const eAct = document.getElementById("finGananciaActual");
  eAct.textContent = fmt(gananciaActual);
  eAct.style.color = gananciaActual >= 0 ? "var(--green)" : "var(--red)";

  const eProy = document.getElementById("finGananciaProyectada");
  eProy.textContent = fmt(gananciaProyectada);
  eProy.style.color = gananciaProyectada >= 0 ? "var(--gold)" : "var(--red)";
}

// ============================================================
//  MODALES (AGREGAR Y EDITAR)
// ============================================================
// Modal Logic
document.querySelectorAll(".modal-close, .modal-overlay").forEach(el => {
  el.addEventListener("click", (e) => {
    if (e.target === el || el.classList.contains("modal-close")) {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    }
  });
});

// ADD MANUAL
const modalAdd = document.getElementById("modalAdd");
const selNumAdd = document.getElementById("selNumAdd");

function llenarSelectLibres() {
  selNumAdd.innerHTML = "";
  for (let i = 1; i <= RIFA_CONFIG.totalNumeros; i++) {
    if (!registros.find(r => r.numero === i)) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Número #${String(i).padStart(2, "0")}`;
      selNumAdd.appendChild(opt);
    }
  }
}

document.getElementById("btnShowAddManual").addEventListener("click", () => {
  document.getElementById("inpAddNombre").value = "";
  document.getElementById("inpAddTel").value = "";
  document.getElementById("chkAddPagado").checked = false;
  modalAdd.classList.add("active");
});

document.getElementById("btnSaveAdd").addEventListener("click", async () => {
  const num = parseInt(selNumAdd.value);
  const nombre = document.getElementById("inpAddNombre").value.trim();
  const telefono = document.getElementById("inpAddTel").value.trim();
  const pagado = document.getElementById("chkAddPagado").checked;

  if (!num || !nombre) { showToast("Completa el nombre", "error"); return; }

  try {
    const ref = doc(db, "numeros", String(num));
    const snap = await getDoc(ref);
    if (snap.exists()) { showToast("Número ya ocupado", "error"); return; }

    await setDoc(ref, {
      numero: num, nombre, telefono, pagado, estado: "aprobado", creado: new Date()
    });
    modalAdd.classList.remove("active");
    showToast(`Número #${num} asignado a ${nombre}`);
  } catch (e) { showToast("Error al asignar", "error"); }
});

// EDIT CLIENTE
const modalEdit = document.getElementById("modalEdit");
window.abrirEdit = (id) => {
  const r = registros.find(x => x.id === id);
  if (!r) return;
  editId = id;
  document.getElementById("editNumTitle").textContent = `(#${r.numero})`;
  document.getElementById("inpEditNombre").value = r.nombre || "";
  document.getElementById("inpEditTel").value = r.telefono || "";
  modalEdit.classList.add("active");
}

document.getElementById("btnSaveEdit").addEventListener("click", async () => {
  if (!editId) return;
  const nombre = document.getElementById("inpEditNombre").value.trim();
  const telefono = document.getElementById("inpEditTel").value.trim();
  if (!nombre) { showToast("El nombre no puede estar vacío", "error"); return; }

  try {
    await updateDoc(doc(db, "numeros", editId), { nombre, telefono });
    modalEdit.classList.remove("active");
    showToast("Datos actualizados");
  } catch (e) { showToast("Error al editar", "error"); }
});
// ============================================================
//  LÓGICA DEL PANEL DE ADMINISTRACIÓN
// ============================================================
import { db, RIFA_CONFIG } from "./firebase-config.js";
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const numerosRef = collection(db, "numeros");

// --- DOM LOGIN ---
const loginView = document.getElementById("loginView");
const panelView = document.getElementById("panelView");
const inpClave = document.getElementById("inpClave");
const btnEntrar = document.getElementById("btnEntrar");
const loginError = document.getElementById("loginError");
const btnLogout = document.getElementById("btnLogout");

// --- TABS ---
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll(".panel");

navItems.forEach(btn => {
  btn.addEventListener("click", () => {
    navItems.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.target).classList.add("active");
  });
});

// --- STATE ---
let registros = [];
let unsub = null;
let editId = null;
let inversionBase = 0;

// --- TOAST ---
const toastContainer = document.getElementById("toastContainer");
function showToast(msg, type = "success") {
  const el = document.createElement("div");
  el.className = `msg-box ${type}`;
  el.style.margin = "0";
  el.style.animation = "fadeInDown 0.3s ease-out forwards";
  el.innerHTML = type === "success" 
    ? `<i class="fas fa-check-circle"></i> ${msg}`
    : `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ============================================================
//  LOGIN
// ============================================================
async function entrar() {
  const clave = inpClave.value.trim();
  if (!clave) return;
  
  btnEntrar.disabled = true;
  btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
  loginError.classList.add("hidden");

  try {
    const snap = await getDoc(doc(db, "config", "admin"));
    const claveGuardada = snap.exists() ? snap.data().password : null;

    if (clave === claveGuardada) {
      sessionStorage.setItem("admin_ok", "1");
      abrirPanel();
    } else {
      loginError.classList.remove("hidden");
    }
  } catch (err) {
    console.error(err);
    loginError.textContent = "Error de conexión";
    loginError.classList.remove("hidden");
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.innerHTML = '<i class="fas fa-sign-in-alt"></i> Acceder al Panel';
  }
}

function abrirPanel() {
  loginView.classList.add("hidden");
  panelView.classList.remove("hidden");
  cargarConfigFinanzas();
  escucharNumeros();
}

function salir() {
  sessionStorage.removeItem("admin_ok");
  if (unsub) unsub();
  panelView.classList.add("hidden");
  loginView.classList.remove("hidden");
  inpClave.value = "";
}

btnEntrar.addEventListener("click", entrar);
inpClave.addEventListener("keydown", (e) => { if (e.key === "Enter") entrar(); });
btnLogout.addEventListener("click", salir);

if (sessionStorage.getItem("admin_ok") === "1") {
  abrirPanel();
}

// ============================================================
//  DATOS Y RENDER
// ============================================================
function escucharNumeros() {
  unsub = onSnapshot(numerosRef, (snapshot) => {
    registros = [];
    snapshot.forEach((d) => {
      registros.push({ id: d.id, ...d.data() });
    });
    registros.sort((a, b) => a.numero - b.numero);
    
    renderDashboard();
    renderAprobaciones();
    renderTablaTodos();
    renderAdminGrid();
    actualizarFinanzas();
    llenarSelectLibres();
  });
}

function formatearFecha(ts) {
  if (!ts) return "-";
  const d = ts.toDate();
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// ---- DASHBOARD ----
function renderDashboard() {
  const total = registros.length;
  const pendientes = registros.filter(r => r.estado === "pendiente").length;
  const pagados = registros.filter(r => r.pagado).length;

  document.getElementById("dashTotales").textContent = `${total}/${RIFA_CONFIG.totalNumeros}`;
  document.getElementById("dashPendientes").textContent = pendientes;
  document.getElementById("dashPagados").textContent = pagados;

  const badgeAprobaciones = document.getElementById("badgeAprobaciones");
  if (pendientes > 0) {
    badgeAprobaciones.textContent = pendientes;
    badgeAprobaciones.style.display = "inline-block";
  } else {
    badgeAprobaciones.style.display = "none";
  }

  // Recientes (últimos 5)
  const lista = document.getElementById("listaRecientes");
  lista.innerHTML = "";
  const recientes = [...registros].sort((a,b) => (b.creado?.toMillis() || 0) - (a.creado?.toMillis() || 0)).slice(0, 5);
  
  if (recientes.length === 0) {
    lista.innerHTML = '<li class="recent-empty">No hay actividad reciente.</li>';
  } else {
    recientes.forEach(r => {
      let icon = r.estado === 'pendiente' ? '<i class="fas fa-clock" style="color:var(--yellow)"></i>' : '<i class="fas fa-check" style="color:var(--green)"></i>';
      lista.innerHTML += `
        <li class="recent-item">
          <div class="recent-num">${r.numero}</div>
          <div style="flex:1;">
            <div class="recent-name">${r.nombre || "Sin nombre"} ${icon}</div>
            <div style="font-size:0.75rem; color:var(--text-muted)">${formatearFecha(r.creado)}</div>
          </div>
        </li>
      `;
    });
  }
}

// ---- APROBACIONES ----
function renderAprobaciones() {
  const tbody = document.getElementById("tablaAprobaciones");
  const pendientes = registros.filter(r => r.estado === "pendiente");

  if (pendientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No hay solicitudes pendientes.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  pendientes.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${String(r.numero).padStart(2, "0")}</strong></td>
      <td>${r.nombre}</td>
      <td>${r.telefono}</td>
      <td>${formatearFecha(r.creado)}</td>
      <td>
        <div class="btn-row" style="margin:0;">
          <button class="btn-primary" style="padding: 0.4rem 0.8rem;" onclick="aprobar('${r.id}')"><i class="fas fa-check"></i> Aprobar</button>
          <button class="btn-danger" style="padding: 0.4rem 0.8rem;" onclick="rechazar('${r.id}')"><i class="fas fa-times"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.aprobar = async (id) => {
  try {
    await updateDoc(doc(db, "numeros", id), { estado: "aprobado" });
    showToast("Solicitud aprobada");
  } catch(e) { showToast("Error al aprobar", "error"); }
}

window.rechazar = async (id) => {
  if (!confirm("¿Seguro que quieres rechazar y eliminar esta solicitud?")) return;
  try {
    await deleteDoc(doc(db, "numeros", id));
    showToast("Solicitud rechazada y número liberado");
  } catch(e) { showToast("Error al rechazar", "error"); }
}

// ---- CONTROL NÚMEROS Y BÚSQUEDA ----
function renderAdminGrid() {
  const grid = document.getElementById("adminGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= RIFA_CONFIG.totalNumeros; i++) {
    const r = registros.find(x => x.numero === i);
    const btn = document.createElement("button");
    btn.className = "admin-num";
    btn.textContent = String(i).padStart(2, "0");
    
    if (!r) {
      btn.classList.add("available");
      btn.title = "Disponible";
    } else if (r.pagado) {
      btn.classList.add("paid");
      btn.title = r.nombre + " - Pagado";
    } else {
      btn.classList.add("taken");
      btn.title = r.nombre + " - " + (r.estado === 'pendiente' ? 'Pendiente' : 'Aprobado/Sin Pagar');
    }
    grid.appendChild(btn);
  }
}

const inpBuscar = document.getElementById("inpBuscar");
function renderTablaTodos() {
  const tbody = document.getElementById("tablaTodos");
  const filtro = inpBuscar.value.trim().toLowerCase();
  
  const lista = registros.filter(r => {
    if (!filtro) return true;
    return String(r.numero).includes(filtro) || (r.nombre||"").toLowerCase().includes(filtro) || (r.telefono||"").toLowerCase().includes(filtro);
  });

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No hay coincidencias.</td></tr>';
    return;
  }

  tbody.innerHTML = "";
  lista.forEach(r => {
    const isPendiente = r.estado === "pendiente";
    const estadoBadge = isPendiente 
      ? '<span class="badge badge-yellow">Pendiente</span>' 
      : '<span class="badge badge-green">Aprobado</span>';
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>#${String(r.numero).padStart(2, "0")}</strong></td>
      <td>${r.nombre || "-"}</td>
      <td>${r.telefono || "-"}</td>
      <td>${estadoBadge}</td>
      <td>
        <button class="btn-ghost" style="padding:0.3rem 0.6rem; color: ${r.pagado ? 'var(--green)' : 'var(--text-muted)'}; border-color: ${r.pagado ? 'var(--green)' : 'var(--border2)'};" onclick="togglePago('${r.id}', ${r.pagado})">
          <i class="fas ${r.pagado ? 'fa-check-circle' : 'fa-circle'}"></i> ${r.pagado ? 'Pagado' : 'Marcar'}
        </button>
      </td>
      <td>
        <div class="btn-row" style="margin:0;">
          <button class="btn-ghost" style="padding:0.3rem 0.6rem;" onclick="abrirEdit('${r.id}')" title="Editar"><i class="fas fa-pen"></i></button>
          <button class="btn-ghost" style="padding:0.3rem 0.6rem; color:var(--red);" onclick="liberar('${r.id}', ${r.numero})" title="Liberar/Eliminar"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

inpBuscar.addEventListener("input", renderTablaTodos);

window.togglePago = async (id, actual) => {
  try {
    await updateDoc(doc(db, "numeros", id), { pagado: !actual, estado: "aprobado" }); // Si paga, automáticamente se aprueba
    showToast(!actual ? "Marcado como pagado" : "Pago retirado");
  } catch(e) { showToast("Error al actualizar pago", "error"); }
}

window.liberar = async (id, num) => {
  if (!confirm(`¿Seguro que quieres eliminar a la persona del número #${num}? El número quedará libre.`)) return;
  try {
    await deleteDoc(doc(db, "numeros", id));
    showToast(`Número #${num} liberado`);
  } catch(e) { showToast("Error al liberar", "error"); }
}

// ============================================================
//  FINANZAS
// ============================================================
async function cargarConfigFinanzas() {
  try {
    const snap = await getDoc(doc(db, "config", "finanzas"));
    if (snap.exists()) {
      inversionBase = snap.data().inversion || 0;
      document.getElementById("inpInversion").value = inversionBase;
    }
  } catch (e) { console.error("Error cargando finanzas"); }
}

document.getElementById("btnGuardarInversion").addEventListener("click", async () => {
  const val = Number(document.getElementById("inpInversion").value);
  if (isNaN(val) || val < 0) return;
  try {
    await setDoc(doc(db, "config", "finanzas"), { inversion: val }, { merge: true });
    inversionBase = val;
    document.getElementById("msgInversion").classList.remove("hidden");
    setTimeout(() => document.getElementById("msgInversion").classList.add("hidden"), 3000);
    actualizarFinanzas();
  } catch (e) { showToast("Error al guardar inversión", "error"); }
});

function actualizarFinanzas() {
  const aprobados = registros.filter(r => r.estado !== "pendiente");
  const pagados = aprobados.filter(r => r.pagado);
  
  const dineroRecaudado = pagados.length * RIFA_CONFIG.precio;
  const dineroPendiente = (aprobados.length - pagados.length) * RIFA_CONFIG.precio;
  const dineroEsperado = RIFA_CONFIG.totalNumeros * RIFA_CONFIG.precio;
  
  const gananciaActual = dineroRecaudado - inversionBase;
  const gananciaProyectada = dineroEsperado - inversionBase;

  const fmt = (num) => `${RIFA_CONFIG.moneda} ${num.toLocaleString()}`;

  document.getElementById("finInversion").textContent = fmt(inversionBase);
  document.getElementById("finRecaudado").textContent = fmt(dineroRecaudado);
  document.getElementById("finPendiente").textContent = fmt(dineroPendiente);
  document.getElementById("finEsperado").textContent = fmt(dineroEsperado);
  
  const eAct = document.getElementById("finGananciaActual");
  eAct.textContent = fmt(gananciaActual);
  eAct.style.color = gananciaActual >= 0 ? "var(--green)" : "var(--red)";

  const eProy = document.getElementById("finGananciaProyectada");
  eProy.textContent = fmt(gananciaProyectada);
  eProy.style.color = gananciaProyectada >= 0 ? "var(--gold)" : "var(--red)";
}

// ============================================================
//  MODALES (AGREGAR Y EDITAR)
// ============================================================
// Modal Logic
document.querySelectorAll(".modal-close, .modal-overlay").forEach(el => {
  el.addEventListener("click", (e) => {
    if (e.target === el || el.classList.contains("modal-close")) {
      document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
    }
  });
});

// ADD MANUAL
const modalAdd = document.getElementById("modalAdd");
const selNumAdd = document.getElementById("selNumAdd");

function llenarSelectLibres() {
  selNumAdd.innerHTML = "";
  for (let i = 1; i <= RIFA_CONFIG.totalNumeros; i++) {
    if (!registros.find(r => r.numero === i)) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Número #${String(i).padStart(2, "0")}`;
      selNumAdd.appendChild(opt);
    }
  }
}

document.getElementById("btnShowAddManual").addEventListener("click", () => {
  document.getElementById("inpAddNombre").value = "";
  document.getElementById("inpAddTel").value = "";
  document.getElementById("chkAddPagado").checked = false;
  modalAdd.classList.add("active");
});

document.getElementById("btnSaveAdd").addEventListener("click", async () => {
  const num = parseInt(selNumAdd.value);
  const nombre = document.getElementById("inpAddNombre").value.trim();
  const telefono = document.getElementById("inpAddTel").value.trim();
  const pagado = document.getElementById("chkAddPagado").checked;

  if (!num || !nombre) { showToast("Completa el nombre", "error"); return; }

  try {
    const ref = doc(db, "numeros", String(num));
    const snap = await getDoc(ref);
    if (snap.exists()) { showToast("Número ya ocupado", "error"); return; }

    await setDoc(ref, {
      numero: num, nombre, telefono, pagado, estado: "aprobado", creado: new Date()
    });
    modalAdd.classList.remove("active");
    showToast(`Número #${num} asignado a ${nombre}`);
  } catch (e) { showToast("Error al asignar", "error"); }
});

// EDIT CLIENTE
const modalEdit = document.getElementById("modalEdit");
window.abrirEdit = (id) => {
  const r = registros.find(x => x.id === id);
  if (!r) return;
  editId = id;
  document.getElementById("editNumTitle").textContent = `(#${r.numero})`;
  document.getElementById("inpEditNombre").value = r.nombre || "";
  document.getElementById("inpEditTel").value = r.telefono || "";
  modalEdit.classList.add("active");
}

document.getElementById("btnSaveEdit").addEventListener("click", async () => {
  if (!editId) return;
  const nombre = document.getElementById("inpEditNombre").value.trim();
  const telefono = document.getElementById("inpEditTel").value.trim();
  if (!nombre) { showToast("El nombre no puede estar vacío", "error"); return; }

  try {
    await updateDoc(doc(db, "numeros", editId), { nombre, telefono });
    modalEdit.classList.remove("active");
    showToast("Datos actualizados");
  } catch (e) { showToast("Error al editar", "error"); }
});
