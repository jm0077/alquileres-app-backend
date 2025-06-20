/**
 * Utilidades para gestionar rutas jerárquicas en Firestore
 * Versión SIN userId para Alquileres App
 */

/**
 * Extrae año y mes de una fecha para construir la ruta de almacenamiento
 * @param {string|Date} date - Fecha en formato ISO, objeto Date o cualquier formato válido para new Date()
 * @returns {Object} - Objeto con año, mes y ruta construida
 */
function getStoragePath(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 1-12
  return {
    year,
    month,
    yearStr: year.toString(),
    monthStr: month.toString().padStart(2, '0'),
    path: `${year}/${month.toString().padStart(2, '0')}`
  };
}

/**
 * Obtiene referencia a colección con estructura jerárquica SIN userId
 * Para alquileres: transactions (por año/mes), otras colecciones directas
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} collectionName - Nombre de la colección (transactions, properties, units, etc.)
 * @param {number|string} year - Año (opcional, solo para transactions)
 * @param {number|string} month - Mes (opcional, solo para transactions)
 * @returns {CollectionReference} - Referencia a la colección
 */
function getCollection(db, collectionName, year, month) {
  // Para transacciones, usar estructura jerárquica
  if (collectionName === 'transactions') {
    if (!year) {
      return db.collection('transactions');
    }
    
    const yearStr = year.toString();
    const yearRef = db.collection('transactions').doc(yearStr);
    
    if (!month) {
      return yearRef.collection('documents');
    }
    
    const monthStr = month.toString().padStart(2, '0');
    return yearRef.collection(monthStr);
  }
  
  // Para otras colecciones, usar estructura simple
  return db.collection(collectionName);
}

/**
 * Consulta documentos a través de múltiples colecciones mensuales
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} collectionName - Nombre de la colección
 * @param {Object} options - Opciones de consulta
 * @param {number|string} options.startYear - Año inicial
 * @param {number|string} options.startMonth - Mes inicial
 * @param {number|string} options.endYear - Año final
 * @param {number|string} options.endMonth - Mes final
 * @param {Array} options.where - Condiciones where [[campo, operador, valor], ...]
 * @returns {Promise<Array>} - Array de documentos encontrados
 */
async function queryAcrossPeriods(db, collectionName, options) {
  const { 
    startYear, 
    startMonth, 
    endYear = new Date().getFullYear(), 
    endMonth = new Date().getMonth() + 1,
    where = []
  } = options;
  
  // Si no se especifica período de inicio, devolver error
  if (!startYear || !startMonth) {
    throw new Error('Se requiere startYear y startMonth para consultas cross-period');
  }
  
  const results = [];
  
  // Calcular todos los pares año/mes en el rango
  const periods = [];
  let currentYear = parseInt(startYear);
  let currentMonth = parseInt(startMonth);
  const finalYear = parseInt(endYear);
  const finalMonth = parseInt(endMonth);
  
  while (
    currentYear < finalYear || 
    (currentYear === finalYear && currentMonth <= finalMonth)
  ) {
    periods.push({
      year: currentYear,
      month: currentMonth
    });
    
    // Avanzar al siguiente mes
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  // Consultar cada período
  for (const period of periods) {
    const collectionRef = getCollection(
      db, 
      collectionName, 
      period.year, 
      period.month
    );
    
    // Construir la consulta con las condiciones where
    let query = collectionRef;
    
    for (const condition of where) {
      const [field, operator, value] = condition;
      query = query.where(field, operator, value);
    }
    
    // Ejecutar la consulta
    const snapshot = await query.get();
    
    // Añadir resultados
    snapshot.forEach(doc => {
      results.push({
        id: doc.id,
        year: period.year,
        month: period.month,
        ...doc.data()
      });
    });
  }
  
  return results;
}

/**
 * Genera una lista de todas las colecciones mensuales para un tipo de colección
 * Útil para obtener un índice de qué meses tienen datos
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} collectionName - Nombre de la colección
 * @returns {Promise<Array>} - Array de períodos disponibles {year, month}
 */
async function listAvailablePeriods(db, collectionName) {
  // Solo aplicable para colecciones jerárquicas (transactions)
  if (collectionName !== 'transactions') {
    return [];
  }
  
  const baseCollectionRef = db.collection('transactions');
  
  // Obtener todos los documentos de año
  const yearsSnapshot = await baseCollectionRef.listDocuments();
  const periods = [];
  
  for (const yearDoc of yearsSnapshot) {
    const year = yearDoc.id;
    
    // Obtener todos los documentos de mes para este año
    const monthsSnapshot = await yearDoc.listCollections();
    
    for (const monthCollection of monthsSnapshot) {
      const month = monthCollection.id;
      periods.push({
        year: parseInt(year),
        month: parseInt(month)
      });
    }
  }
  
  // Ordenar por fecha
  return periods.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
}

module.exports = {
  getStoragePath,
  getCollection,
  queryAcrossPeriods,
  listAvailablePeriods
};
