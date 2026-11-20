/* ============================================================
   storage.js · Capa de persistencia
   Guarda las reservas en el navegador. Si localStorage no está
   disponible (por ejemplo, en algunos modos privados), trabaja en
   memoria para que la aplicación siga funcionando durante la sesión.
   ============================================================ */

const Almacen = (function () {
  const CLAVE = 'reservaya.reservas.v1';
  const CLAVE_SEMILLA = 'reservaya.semilla.v1';

  let memoria = [];          // respaldo cuando no hay localStorage
  let disponible = true;

  // Comprobación real: escribir y borrar una clave de prueba.
  try {
    const prueba = '__reservaya_prueba__';
    window.localStorage.setItem(prueba, '1');
    window.localStorage.removeItem(prueba);
  } catch (error) {
    disponible = false;
  }

  /**
   * Devuelve el arreglo de reservas guardado.
   * Si el contenido está corrupto, devuelve un arreglo vacío en vez de romper.
   */
  function cargar() {
    if (!disponible) return memoria.slice();

    try {
      const crudo = window.localStorage.getItem(CLAVE);
      if (!crudo) return [];
      const datos = JSON.parse(crudo);
      return Array.isArray(datos) ? datos : [];
    } catch (error) {
      console.warn('No se pudo leer el almacenamiento, se empieza vacío.', error);
      return [];
    }
  }

  /**
   * Persiste el arreglo completo. Devuelve true si pudo guardar.
   */
  function guardar(lista) {
    memoria = lista.slice();

    if (!disponible) return false;

    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(lista));
      return true;
    } catch (error) {
      console.warn('No se pudo guardar en localStorage.', error);
      disponible = false;
      return false;
    }
  }

  /**
   * Carga datos de ejemplo solo la primera vez, para que la aplicación
   * no arranque vacía. Una vez sembrado, borrar todo no vuelve a sembrar.
   */
  function sembrarSiHaceFalta(listaEjemplo) {
    if (!disponible) {
      if (memoria.length === 0) memoria = listaEjemplo.slice();
      return;
    }

    try {
      if (window.localStorage.getItem(CLAVE_SEMILLA)) return;
      window.localStorage.setItem(CLAVE_SEMILLA, '1');
    } catch (error) {
      return;
    }

    if (cargar().length === 0) guardar(listaEjemplo);
  }

  function modo() {
    return disponible ? 'localStorage' : 'memoria';
  }

  return {
    cargar,
    guardar,
    sembrarSiHaceFalta,
    modo,
    CLAVE,
    CLAVE_SEMILLA
  };
})();
