/* ============================================================
   ui.js · Capa de interfaz
   Traduce los datos a HTML y conecta los eventos del usuario con
   el modelo. Toda la manipulación del DOM vive aquí.
   ============================================================ */

const UI = (function () {

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const formatoMoneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  });

  const formatoFecha = new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  });

  let focoAnterior = null;   // para devolver el foco al cerrar un modal
  let idAEliminar = null;

  const el = {};

  /* ---------------------------------------------------------- formato */

  function moneda(valor) {
    return formatoMoneda.format(Number(valor || 0));
  }

  function fechaLegible(iso) {
    const texto = formatoFecha.format(Reservas.fechaLocal(iso));
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ---------------------------------------------------------- avisos */

  function aviso(mensaje, tipo) {
    const nodo = document.createElement('div');
    nodo.className = 'aviso' + (tipo ? ' aviso--' + tipo : '');
    nodo.textContent = mensaje;
    el.avisos.appendChild(nodo);

    setTimeout(() => {
      nodo.style.opacity = '0';
      setTimeout(() => nodo.remove(), 250);
    }, 3200);
  }

  /* ---------------------------------------------------------- render */

  function render() {
    const filtros = {
      texto: el.buscar.value,
      estado: el.filtroEstado.value,
      orden: el.ordenar.value
    };

    const visibles = Reservas.consultar(filtros);
    const resumen = Reservas.resumen();

    el.statTotal.textContent = resumen.total;
    el.statPendientes.textContent = resumen.pendientes;
    el.statPagadas.textContent = resumen.pagadas;
    el.statIngresos.textContent = moneda(resumen.ingresos);

    el.cuerpo.innerHTML = visibles.map(fila).join('');

    const total = resumen.total;
    el.contador.textContent = total === 0
      ? 'Sin reservas registradas.'
      : `Mostrando ${visibles.length} de ${total} ${total === 1 ? 'reserva' : 'reservas'}.`;

    // Estado vacío: distingue "no hay nada" de "los filtros no encontraron nada".
    if (visibles.length === 0) {
      el.vacio.hidden = false;
      el.tablaEnvoltura.hidden = true;

      if (total === 0) {
        el.vacioTitulo.textContent = 'Aún no hay reservas';
        el.vacioTexto.innerHTML = 'Crea la primera con el botón <strong>Nueva reserva</strong>.';
        el.vacioBoton.textContent = 'Crear reserva';
        el.vacioBoton.dataset.accionVacio = 'crear';
      } else {
        el.vacioTitulo.textContent = 'Sin coincidencias';
        el.vacioTexto.textContent = 'Ninguna reserva coincide con la búsqueda o el filtro aplicado.';
        el.vacioBoton.textContent = 'Limpiar filtros';
        el.vacioBoton.dataset.accionVacio = 'limpiar';
      }
    } else {
      el.vacio.hidden = true;
      el.tablaEnvoltura.hidden = false;
    }
  }

  function fila(r) {
    const clase = r.estado.toLowerCase();
    return `
      <tr>
        <td data-etiqueta="Cliente" class="celda-cliente">
          <strong>${escapar(r.cliente)}</strong>
          <span>${escapar(r.telefono)}</span>
        </td>
        <td data-etiqueta="Cancha">${escapar(r.cancha)}</td>
        <td data-etiqueta="Fecha">${fechaLegible(r.fecha)}</td>
        <td data-etiqueta="Hora">${escapar(r.hora)}</td>
        <td data-etiqueta="Duración">${r.duracion} h</td>
        <td data-etiqueta="Estado"><span class="etiqueta etiqueta--${clase}">${escapar(r.estado)}</span></td>
        <td data-etiqueta="Total">${moneda(r.total)}</td>
        <td data-etiqueta="Acciones">
          <div class="acciones">
            <button type="button" class="boton boton--secundario boton--pequeno"
                    data-accion="editar" data-id="${r.id}"
                    aria-label="Editar la reserva de ${escapar(r.cliente)}">Editar</button>
            <button type="button" class="boton boton--peligro boton--pequeno"
                    data-accion="eliminar" data-id="${r.id}"
                    aria-label="Eliminar la reserva de ${escapar(r.cliente)}">Eliminar</button>
          </div>
        </td>
      </tr>`;
  }

  /* ---------------------------------------------------------- formulario */

  function limpiarErrores() {
    $$('#formulario .campo').forEach((campo) => campo.classList.remove('campo--invalido'));
    $$('#formulario .campo__error').forEach((p) => { p.textContent = ''; });
    $$('#formulario [aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
    el.avisoConflicto.hidden = true;
    el.avisoConflicto.textContent = '';
  }

  function mostrarErrores(errores) {
    let primerCampo = null;

    Object.entries(errores).forEach(([campo, mensaje]) => {
      if (campo === 'conflicto') {
        el.avisoConflicto.textContent = mensaje;
        el.avisoConflicto.hidden = false;
        return;
      }

      const caja = document.getElementById('error-' + campo);
      if (!caja) return;

      caja.textContent = mensaje;
      const contenedor = caja.closest('.campo');
      if (contenedor) contenedor.classList.add('campo--invalido');

      const input = document.getElementById(campo);
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        if (!primerCampo) primerCampo = input;
      }
    });

    if (primerCampo) primerCampo.focus();
  }

  function abrirFormulario(id) {
    limpiarErrores();
    el.formulario.reset();
    if (id) {
      const r = Reservas.obtener(id);
      if (!r) { aviso('La reserva ya no existe.', 'error'); render(); return; }

      el.id.value = r.id;
      el.cliente.value = r.cliente;
      el.telefono.value = r.telefono;
      el.cancha.value = r.cancha;
      el.fecha.value = r.fecha;
      el.hora.value = r.hora;
      el.duracion.value = String(r.duracion);
      el.estado.value = r.estado;
      el.notas.value = r.notas || '';
      el.tituloFormulario.textContent = 'Editar reserva';
      el.btnGuardar.textContent = 'Guardar cambios';
    } else {
      el.id.value = '';
      el.fecha.value = '';
      el.hora.value = '';
      el.duracion.value = '1';
      el.estado.value = 'Pendiente';
      el.tituloFormulario.textContent = 'Nueva reserva';
      el.btnGuardar.textContent = 'Guardar reserva';
    }

    el.contadorNotas.textContent = el.notas.value.length;
    actualizarTotal();

    focoAnterior = document.activeElement;
    el.modalFormulario.hidden = false;
    el.cliente.focus();
  }

  /** Muestra el precio del turno mientras se elige cancha y duración. */
  function actualizarTotal() {
    const total = Reservas.totalDe(el.cancha.value, el.duracion.value);
    el.totalCalculado.textContent = moneda(total);
  }

  function cerrarFormulario() {
    el.modalFormulario.hidden = true;
    if (focoAnterior) focoAnterior.focus();
  }

  function enviarFormulario(evento) {
    evento.preventDefault();
    limpiarErrores();

    const datos = {
      cliente: el.cliente.value,
      telefono: el.telefono.value,
      cancha: el.cancha.value,
      fecha: el.fecha.value,
      hora: el.hora.value,
      duracion: el.duracion.value,
      estado: el.estado.value,
      notas: el.notas.value
    };

    const id = el.id.value;
    const resultado = id ? Reservas.actualizar(id, datos) : Reservas.crear(datos);

    if (!resultado.ok) {
      const { almacen, general, ...campos } = resultado.errores;
      if (almacen || general) aviso(almacen || general, 'error');
      mostrarErrores(campos);
      return;
    }

    cerrarFormulario();
    render();
    aviso(id ? 'Reserva actualizada correctamente.' : 'Reserva creada correctamente.', 'exito');
  }

  /* ---------------------------------------------------------- eliminar */

  function abrirEliminar(id) {
    const r = Reservas.obtener(id);
    if (!r) { aviso('La reserva ya no existe.', 'error'); render(); return; }

    idAEliminar = id;
    el.textoEliminar.textContent =
      `Se eliminará la reserva de ${r.cliente} en ${r.cancha}, el ${fechaLegible(r.fecha)} a las ${r.hora}. Esta acción no se puede deshacer.`;

    focoAnterior = document.activeElement;
    el.modalEliminar.hidden = false;
    el.btnConfirmarEliminar.focus();
  }

  function cerrarEliminar() {
    el.modalEliminar.hidden = true;
    idAEliminar = null;
    if (focoAnterior) focoAnterior.focus();
  }

  function confirmarEliminar() {
    if (!idAEliminar) return;

    const resultado = Reservas.eliminar(idAEliminar);
    if (!resultado.ok) {
      aviso('No se pudo eliminar la reserva.', 'error');
      return;
    }

    cerrarEliminar();
    render();
    aviso('Reserva eliminada.', 'exito');
  }

  /* ---------------------------------------------------------- eventos */

  function conectar() {
    el.buscar.addEventListener('input', render);
    el.filtroEstado.addEventListener('change', render);
    el.ordenar.addEventListener('change', render);

    $('#btn-nueva').addEventListener('click', () => abrirFormulario());
    el.formulario.addEventListener('submit', enviarFormulario);

    el.notas.addEventListener('input', () => {
      el.contadorNotas.textContent = el.notas.value.length;
    });

    el.cancha.addEventListener('change', actualizarTotal);
    el.duracion.addEventListener('change', actualizarTotal);

    // Delegación: un solo listener resuelve todas las filas.
    el.cuerpo.addEventListener('click', (evento) => {
      const boton = evento.target.closest('button[data-accion]');
      if (!boton) return;

      const id = boton.dataset.id;
      if (boton.dataset.accion === 'editar') abrirFormulario(id);
      if (boton.dataset.accion === 'eliminar') abrirEliminar(id);
    });

    el.vacioBoton.addEventListener('click', () => {
      if (el.vacioBoton.dataset.accionVacio === 'limpiar') {
        el.buscar.value = '';
        el.filtroEstado.value = '';
        el.ordenar.value = 'fecha-asc';
        render();
      } else {
        abrirFormulario();
      }
    });

    $$('[data-cerrar-modal]').forEach((n) => n.addEventListener('click', cerrarFormulario));
    $$('[data-cerrar-eliminar]').forEach((n) => n.addEventListener('click', cerrarEliminar));
    $$('[data-abrir-formulario]').forEach((n) => n.addEventListener('click', () => abrirFormulario()));

    el.btnConfirmarEliminar.addEventListener('click', confirmarEliminar);

    // Escape cierra el modal que esté abierto.
    document.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Escape') return;
      if (!el.modalEliminar.hidden) { cerrarEliminar(); return; }
      if (!el.modalFormulario.hidden) cerrarFormulario();
    });
  }

  /* ---------------------------------------------------------- arranque */

  function iniciar() {
    el.statTotal = $('#stat-total');
    el.statPendientes = $('#stat-pendientes');
    el.statPagadas = $('#stat-pagadas');
    el.statIngresos = $('#stat-ingresos');

    el.buscar = $('#buscar');
    el.filtroEstado = $('#filtro-estado');
    el.ordenar = $('#ordenar');
    el.contador = $('#contador');
    el.cuerpo = $('#cuerpo-tabla');
    el.tablaEnvoltura = $('.tabla-envoltura');
    el.vacio = $('#vacio');
    el.vacioTitulo = $('.vacio__titulo');
    el.vacioTexto = $('.vacio__texto');
    el.vacioBoton = $('.vacio .boton');
    el.avisos = $('#avisos');

    el.modalFormulario = $('#modal-formulario');
    el.formulario = $('#formulario');
    el.id = $('#id');
    el.cliente = $('#cliente');
    el.telefono = $('#telefono');
    el.cancha = $('#cancha');
    el.fecha = $('#fecha');
    el.hora = $('#hora');
    el.duracion = $('#duracion');
    el.estado = $('#estado');
    el.notas = $('#notas');
    el.contadorNotas = $('#contador-notas');
    el.tituloFormulario = $('#titulo-formulario');
    el.btnGuardar = $('#btn-guardar');
    el.avisoConflicto = $('#aviso-conflicto');
    el.totalCalculado = $('#total-calculado');

    el.modalEliminar = $('#modal-eliminar');
    el.textoEliminar = $('#texto-eliminar');
    el.btnConfirmarEliminar = $('#btn-confirmar-eliminar');

    // Horas disponibles en el selector.
    el.hora.innerHTML = '<option value="">Selecciona la hora</option>' +
      Reservas.HORAS.map((h) => `<option value="${h}">${h}</option>`).join('');

    // La fecha mínima es hoy: el navegador ayuda, y el modelo lo vuelve a validar.
    const hoy = new Date();
    el.fecha.min = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    // Datos de ejemplo la primera vez.
    Almacen.sembrarSiHaceFalta(Reservas.datosDeEjemplo());

    const modo = Almacen.modo();
    $('#pie-almacenamiento').textContent = modo === 'localStorage'
      ? 'Datos guardados en este navegador.'
      : 'Modo memoria: los datos no se conservarán al cerrar.';

    conectar();
    render();
  }

  return { iniciar, render, abrirFormulario };
})();
