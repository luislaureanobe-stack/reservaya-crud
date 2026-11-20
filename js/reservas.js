/* ============================================================
   reservas.js · Modelo y reglas del negocio
   Aquí vive el CRUD: validar, crear, consultar, actualizar y
   eliminar. No toca el DOM; solo datos.
   ============================================================ */

const Reservas = (function () {

  // Tarifa por hora según el tipo de cancha.
  const TARIFAS = {
    'Cancha 1 · Fútbol 5': 40000,
    'Cancha 2 · Fútbol 5': 40000,
    'Cancha 3 · Fútbol 7': 60000,
    'Cancha 4 · Fútbol 7': 60000
  };

  const CANCHAS = Object.keys(TARIFAS);

  // Horas de inicio disponibles (última reserva posible: 21:00).
  const HORAS = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'
  ];

  const ESTADOS = ['Pendiente', 'Pagada', 'Cancelada'];

  /* ---------------------------------------------------------- utilidades */

  function nuevoId() {
    // crypto.randomUUID existe en navegadores modernos; hay respaldo.
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function horaEnMinutos(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  function fechaDeHoy() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy;
  }

  /** Convierte 'AAAA-MM-DD' en un Date local a medianoche (sin desfase de zona). */
  function fechaLocal(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d);
  }

  function esFechaISOValida(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''));
  }

  function tarifaDe(cancha) {
    return TARIFAS[cancha] || 0;
  }

  function totalDe(cancha, duracion) {
    return tarifaDe(cancha) * Number(duracion || 0);
  }

  /* ---------------------------------------------------------- lectura */

  function listar() {
    return Almacen.cargar();
  }

  function obtener(id) {
    return listar().find((r) => r.id === id) || null;
  }

  /**
   * Indica si una reserva se cruza con otra ya registrada.
   * Se comparan cancha, fecha y el intervalo [inicio, inicio + duración).
   */
  function hayConflicto(datos, idExcluir) {
    const inicioNuevo = horaEnMinutos(datos.hora);
    const finNuevo = inicioNuevo + Number(datos.duracion) * 60;

    return listar().some((r) => {
      if (r.id === idExcluir) return false;
      if (r.cancha !== datos.cancha) return false;
      if (r.fecha !== datos.fecha) return false;
      if (r.estado === 'Cancelada') return false; // una cancelada libera el turno

      const inicio = horaEnMinutos(r.hora);
      const fin = inicio + Number(r.duracion) * 60;
      return inicioNuevo < fin && inicio < finNuevo;
    });
  }

  /* ---------------------------------------------------------- validación */

  /**
   * Devuelve un objeto { campo: mensaje }. Vacío significa que todo está bien.
   */
  function validar(datos, idExcluir) {
    const errores = {};

    const cliente = String(datos.cliente || '').trim();
    if (!cliente) {
      errores.cliente = 'Escribe el nombre del cliente.';
    } else if (cliente.length < 3) {
      errores.cliente = 'El nombre debe tener al menos 3 caracteres.';
    } else if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'-]+$/.test(cliente)) {
      errores.cliente = 'Usa solo letras, espacios y puntos.';
    }

    const telefono = String(datos.telefono || '').replace(/\s|-/g, '');
    if (!telefono) {
      errores.telefono = 'Escribe el teléfono de contacto.';
    } else if (!/^\d{10}$/.test(telefono)) {
      errores.telefono = 'El teléfono debe tener 10 dígitos.';
    }

    if (!datos.cancha || !CANCHAS.includes(datos.cancha)) {
      errores.cancha = 'Selecciona una cancha.';
    }

    if (!datos.fecha) {
      errores.fecha = 'Selecciona la fecha.';
    } else if (!esFechaISOValida(datos.fecha)) {
      errores.fecha = 'La fecha no tiene un formato válido.';
    } else if (fechaLocal(datos.fecha) < fechaDeHoy()) {
      errores.fecha = 'La fecha no puede ser anterior a hoy.';
    }

    if (!datos.hora || !HORAS.includes(datos.hora)) {
      errores.hora = 'Selecciona la hora de inicio.';
    }

    if (!['1', '2'].includes(String(datos.duracion))) {
      errores.duracion = 'La duración debe ser de 1 o 2 horas.';
    }

    // El turno no puede terminar después de las 23:00.
    if (datos.hora && HORAS.includes(datos.hora) && !errores.duracion) {
      if (horaEnMinutos(datos.hora) + Number(datos.duracion) * 60 > 23 * 60) {
        errores.hora = 'La reserva terminaría después de las 23:00.';
      }
    }

    if (datos.estado && !ESTADOS.includes(datos.estado)) {
      errores.estado = 'El estado no es válido.';
    }

    const notas = String(datos.notas || '').trim();
    if (notas.length > 120) {
      errores.notas = 'Las notas no pueden superar 120 caracteres.';
    }

    // Regla de negocio: una misma cancha no puede tener dos reservas cruzadas.
    if (Object.keys(errores).length === 0 && hayConflicto(datos, idExcluir)) {
      errores.conflicto = 'Esa cancha ya tiene una reserva en ese horario. Elige otra hora o revisa la duración.';
    }

    return errores;
  }

  /* ---------------------------------------------------------- escritura */

  function normalizar(datos, id) {
    return {
      id: id || nuevoId(),
      cliente: String(datos.cliente).trim().replace(/\s+/g, ' '),
      telefono: String(datos.telefono).replace(/\s|-/g, ''),
      cancha: datos.cancha,
      fecha: datos.fecha,
      hora: datos.hora,
      duracion: Number(datos.duracion),
      estado: datos.estado || 'Pendiente',
      notas: String(datos.notas || '').trim(),
      total: totalDe(datos.cancha, datos.duracion),
      creadaEn: new Date().toISOString()
    };
  }

  /** CREATE */
  function crear(datos) {
    const errores = validar(datos, null);
    if (Object.keys(errores).length > 0) {
      return { ok: false, errores };
    }

    const reserva = normalizar(datos);
    const lista = listar();
    lista.push(reserva);

    if (!Almacen.guardar(lista)) {
      return { ok: false, errores: { almacen: 'No se pudo guardar la reserva.' } };
    }
    return { ok: true, reserva };
  }

  /** UPDATE */
  function actualizar(id, datos) {
    const lista = listar();
    const indice = lista.findIndex((r) => r.id === id);

    if (indice === -1) {
      return { ok: false, errores: { general: 'La reserva ya no existe.' } };
    }

    const errores = validar(datos, id);
    if (Object.keys(errores).length > 0) {
      return { ok: false, errores };
    }

    const actualizada = normalizar(datos, id);
    actualizada.creadaEn = lista[indice].creadaEn || actualizada.creadaEn;
    lista[indice] = actualizada;

    if (!Almacen.guardar(lista)) {
      return { ok: false, errores: { almacen: 'No se pudo guardar los cambios.' } };
    }
    return { ok: true, reserva: actualizada };
  }

  /** DELETE */
  function eliminar(id) {
    const lista = listar();
    const filtrada = lista.filter((r) => r.id !== id);

    if (filtrada.length === lista.length) {
      return { ok: false, errores: { general: 'La reserva ya no existe.' } };
    }

    if (!Almacen.guardar(filtrada)) {
      return { ok: false, errores: { almacen: 'No se pudo eliminar la reserva.' } };
    }
    return { ok: true };
  }

  /* ---------------------------------------------------------- consulta con filtros */

  /**
   * Filtra, busca y ordena sin modificar los datos originales.
   */
  function consultar({ texto = '', estado = '', orden = 'fecha-asc' } = {}) {
    const busqueda = texto.trim().toLowerCase();
    let lista = listar();

    if (busqueda) {
      lista = lista.filter((r) =>
        r.cliente.toLowerCase().includes(busqueda) ||
        r.telefono.includes(busqueda) ||
        r.cancha.toLowerCase().includes(busqueda)
      );
    }

    if (estado) {
      lista = lista.filter((r) => r.estado === estado);
    }

    const comparadores = {
      'fecha-asc': (a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora),
      'fecha-desc': (a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora),
      'cliente': (a, b) => a.cliente.localeCompare(b.cliente, 'es'),
      'cancha': (a, b) => a.cancha.localeCompare(b.cancha, 'es') || (a.fecha + a.hora).localeCompare(b.fecha + b.hora)
    };

    return lista.slice().sort(comparadores[orden] || comparadores['fecha-asc']);
  }

  /** Totales para las tarjetas de resumen. */
  function resumen() {
    const lista = listar();
    const contar = (estado) => lista.filter((r) => r.estado === estado).length;

    const ingresos = lista
      .filter((r) => r.estado === 'Pagada')
      .reduce((suma, r) => suma + Number(r.total || 0), 0);

    return {
      total: lista.length,
      pendientes: contar('Pendiente'),
      pagadas: contar('Pagada'),
      canceladas: contar('Cancelada'),
      ingresos
    };
  }

  /* ---------------------------------------------------------- datos de ejemplo */

  /** Genera fechas futuras para que los ejemplos siempre estén vigentes. */
  function enDias(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  function datosDeEjemplo() {
    return [
      {
        id: nuevoId(), cliente: 'Andrés Medina', telefono: '3104567890',
        cancha: 'Cancha 1 · Fútbol 5', fecha: enDias(1), hora: '19:00',
        duracion: 2, estado: 'Pagada', notas: 'Llevan balón propio',
        total: totalDe('Cancha 1 · Fútbol 5', 2), creadaEn: new Date().toISOString()
      },
      {
        id: nuevoId(), cliente: 'Valentina Rojas', telefono: '3209876543',
        cancha: 'Cancha 3 · Fútbol 7', fecha: enDias(2), hora: '16:00',
        duracion: 1, estado: 'Pendiente', notas: '',
        total: totalDe('Cancha 3 · Fútbol 7', 1), creadaEn: new Date().toISOString()
      },
      {
        id: nuevoId(), cliente: 'Jorge Silva', telefono: '3015557788',
        cancha: 'Cancha 2 · Fútbol 5', fecha: enDias(3), hora: '10:00',
        duracion: 1, estado: 'Pagada', notas: 'Pago por Nequi',
        total: totalDe('Cancha 2 · Fútbol 5', 1), creadaEn: new Date().toISOString()
      },
      {
        id: nuevoId(), cliente: 'Marta Díaz', telefono: '3153332211',
        cancha: 'Cancha 4 · Fútbol 7', fecha: enDias(4), hora: '20:00',
        duracion: 2, estado: 'Cancelada', notas: '',
        total: totalDe('Cancha 4 · Fútbol 7', 2), creadaEn: new Date().toISOString()
      }
    ];
  }

  return {
    TARIFAS, CANCHAS, HORAS, ESTADOS,
    listar, obtener, validar, crear, actualizar, eliminar,
    consultar, resumen, datosDeEjemplo,
    tarifaDe, totalDe, fechaLocal, hayConflicto
  };
})();
