/**
 * Utilidades para gestionar rutas jerárquicas en Firestore
 * Adaptado para la estructura REAL de alquileres
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
    path: `${year}-${month.toString().padStart(2, '0')}` // Formato: 2025-06
  };
}

/**
 * Obtiene referencia a colección con estructura jerárquica REAL
 * Estructura: properties/{propertyId}/expenses/{year-month}/items/
 * Estructura: properties/{propertyId}/units/{unitId}/incomes/{year-month}/
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} type - Tipo: 'expenses' | 'incomes' | 'units' | 'properties'
 * @param {string} propertyId - ID de la propiedad (opcional para 'units')
 * @param {string} unitId - ID de la unidad (solo para incomes)
 * @param {number|string} year - Año (opcional)
 * @param {number|string} month - Mes (opcional)
 * @returns {CollectionReference} - Referencia a la colección
 */
function getCollection(db, type, propertyId, unitId, year, month) {
  
  if (type === 'properties') {
    // Colección principal de propiedades
    return db.collection('properties');
  }
  
  if (type === 'units') {
    // Colección independiente de unidades
    return db.collection('units');
  }
  
  if (type === 'expenses') {
    // Estructura: properties/{propertyId}/expenses/{year-month}/items/
    if (!propertyId) {
      throw new Error('propertyId es requerido para expenses');
    }
    
    const propertyRef = db.collection('properties').doc(propertyId);
    
    if (!year || !month) {
      // Retornar la colección base de expenses
      return propertyRef.collection('expenses');
    }
    
    const periodKey = `${year}-${month.toString().padStart(2, '0')}`;
    return propertyRef
      .collection('expenses')
      .doc(periodKey)
      .collection('items');
  }
  
  if (type === 'incomes') {
    // Estructura: properties/{propertyId}/units/{unitId}/incomes/{year-month}/
    if (!propertyId || !unitId) {
      throw new Error('propertyId y unitId son requeridos para incomes');
    }
    
    const unitRef = db.collection('properties')
      .doc(propertyId)
      .collection('units')
      .doc(unitId);
    
    if (!year || !month) {
      // Retornar la colección base de incomes
      return unitRef.collection('incomes');
    }
    
    const periodKey = `${year}-${month.toString().padStart(2, '0')}`;
    return unitRef.collection('incomes').doc(periodKey);
  }
  
  throw new Error(`Tipo no soportado: ${type}`);
}

/**
 * Lista todos los períodos disponibles para expenses de una propiedad
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} propertyId - ID de la propiedad
 * @returns {Promise<Array>} - Array de períodos disponibles {year, month}
 */
async function listExpensePeriods(db, propertyId) {
  try {
    const expensesRef = db.collection('properties')
      .doc(propertyId)
      .collection('expenses');
    
    const periodsSnapshot = await expensesRef.listDocuments();
    const periods = [];
    
    for (const periodDoc of periodsSnapshot) {
      const periodKey = periodDoc.id; // Formato: "2025-06"
      const [year, month] = periodKey.split('-');
      
      // Verificar que tiene items
      const itemsRef = periodDoc.collection('items');
      const itemsSnapshot = await itemsRef.limit(1).get();
      
      if (!itemsSnapshot.empty) {
        periods.push({
          year: parseInt(year),
          month: parseInt(month),
          periodKey
        });
      }
    }
    
    // Ordenar por fecha
    return periods.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  } catch (error) {
    console.error('Error listando períodos de expenses:', error);
    return [];
  }
}

/**
 * Lista todos los períodos disponibles para incomes de una unidad
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} propertyId - ID de la propiedad
 * @param {string} unitId - ID de la unidad
 * @returns {Promise<Array>} - Array de períodos disponibles {year, month}
 */
async function listIncomePeriods(db, propertyId, unitId) {
  try {
    const incomesRef = db.collection('properties')
      .doc(propertyId)
      .collection('units')
      .doc(unitId)
      .collection('incomes');
    
    const periodsSnapshot = await incomesRef.listDocuments();
    const periods = [];
    
    for (const periodDoc of periodsSnapshot) {
      const periodKey = periodDoc.id; // Formato: "2025-06"
      const [year, month] = periodKey.split('-');
      
      periods.push({
        year: parseInt(year),
        month: parseInt(month),
        periodKey
      });
    }
    
    // Ordenar por fecha
    return periods.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  } catch (error) {
    console.error('Error listando períodos de incomes:', error);
    return [];
  }
}

/**
 * Obtiene todas las unidades de una propiedad
 * @param {Firestore} db - Instancia de Firestore  
 * @param {string} propertyId - ID de la propiedad
 * @returns {Promise<Array>} - Array de unidades
 */
async function getPropertyUnits(db, propertyId) {
  try {
    const unitsRef = db.collection('properties')
      .doc(propertyId)
      .collection('units');
    
    const snapshot = await unitsRef.get();
    const units = [];
    
    snapshot.forEach(doc => {
      units.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return units;
  } catch (error) {
    console.error('Error obteniendo unidades de la propiedad:', error);
    return [];
  }
}

/**
 * Obtiene todos los expenses de una propiedad en un período
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} propertyId - ID de la propiedad
 * @param {number} year - Año
 * @param {number} month - Mes
 * @returns {Promise<Array>} - Array de expenses
 */
async function getExpenses(db, propertyId, year, month) {
  try {
    const expensesRef = getCollection(db, 'expenses', propertyId, null, year, month);
    const snapshot = await expensesRef.get();
    const expenses = [];
    
    snapshot.forEach(doc => {
      expenses.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return expenses;
  } catch (error) {
    console.error('Error obteniendo expenses:', error);
    return [];
  }
}

/**
 * Obtiene todos los incomes de una unidad en un período
 * @param {Firestore} db - Instancia de Firestore
 * @param {string} propertyId - ID de la propiedad
 * @param {string} unitId - ID de la unidad
 * @param {number} year - Año
 * @param {number} month - Mes
 * @returns {Promise<Object>} - Datos del documento de income
 */
async function getIncomes(db, propertyId, unitId, year, month) {
  try {
    const incomeRef = getCollection(db, 'incomes', propertyId, unitId, year, month);
    const doc = await incomeRef.get();
    
    if (doc.exists) {
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error obteniendo incomes:', error);
    return null;
  }
}

module.exports = {
  getStoragePath,
  getCollection,
  listExpensePeriods,
  listIncomePeriods,
  getPropertyUnits,
  getExpenses,
  getIncomes
};
