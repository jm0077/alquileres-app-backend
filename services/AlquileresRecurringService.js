/**
 * Servicio para generar automáticamente registros recurrentes mensuales para Alquileres
 * Versión SIN userId - estructura simple
 * Maneja transacciones recurrentes (egresos que se repiten cada mes)
 */
const admin = require('../config/firebase');
const { getStoragePath, getCollection } = require('../utils/hierarchicalPath');

const db = admin.firestore();

class AlquileresRecurringService {
  constructor() {
    this.db = db;
  }

  /**
   * Genera registros para el próximo mes basándose en los datos del mes anterior
   * @param {Object} options - Opciones de generación
   * @param {number} options.targetYear - Año destino (opcional, por defecto siguiente mes)
   * @param {number} options.targetMonth - Mes destino (opcional, por defecto siguiente mes)
   * @param {number} options.sourceYear - Año fuente (opcional, por defecto mes actual)
   * @param {number} options.sourceMonth - Mes fuente (opcional, por defecto mes actual)
   * @param {boolean} options.dryRun - Solo simular, no crear registros (default: false)
   * @returns {Promise<Object>} Resultado de la operación
   */
  async generateRecurringRecords(options = {}) {
    try {
      console.log(`Iniciando generación de registros recurrentes de alquileres...`);
      
      // Determinar fechas fuente y destino
      const dates = this._calculateDates(options);
      const { sourceYear, sourceMonth, targetYear, targetMonth } = dates;
      
      console.log(`Generando desde ${sourceYear}/${sourceMonth} hacia ${targetYear}/${targetMonth}`);
      
      // Verificar si ya existen datos en el mes destino
      const existingCheck = await this._checkExistingData(targetYear, targetMonth);
      
      if (existingCheck.hasData) {
        console.log('Advertencia: Ya existen algunas transacciones en el mes destino');
      }
      
      // Generar transacciones recurrentes (solo egresos)
      const results = {
        transactions: await this._generateRecurringTransactions(
          sourceYear, sourceMonth, targetYear, targetMonth, options.dryRun
        ),
        summary: {
          sourceYear,
          sourceMonth,
          targetYear,
          targetMonth,
          dryRun: options.dryRun || false,
          timestamp: new Date().toISOString()
        }
      };
      
      // Calcular totales
      results.summary.totalCreated = results.transactions.created;
      results.summary.totalSkipped = results.transactions.skipped;
      results.summary.totalErrors = results.transactions.errors.length;
      
      console.log(`Generación completada. Creados: ${results.summary.totalCreated}, Omitidos: ${results.summary.totalSkipped}, Errores: ${results.summary.totalErrors}`);
      
      return {
        success: true,
        ...results
      };
      
    } catch (error) {
      console.error('Error en generateRecurringRecords:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Limpia los datos para el nuevo período, removiendo campos relacionados con pagos
   * @private
   */
  _cleanDataForNewPeriod(data, targetYear, targetMonth) {
    const cleanData = { ...data };
    
    // Remover campos relacionados con pagos realizados
    delete cleanData.paymentDate;
    delete cleanData.paidDate;
    delete cleanData.receipt;
    delete cleanData.referenceNumber;
    
    // Actualizar período y fechas
    cleanData.year = targetYear;
    cleanData.month = targetMonth;
    
    // Actualizar fecha de vencimiento al siguiente mes
    if (cleanData.dueDate) {
      const currentDueDate = new Date(cleanData.dueDate);
      const newDueDate = new Date(currentDueDate);
      newDueDate.setMonth(newDueDate.getMonth() + 1);
      cleanData.dueDate = newDueDate.toISOString().split('T')[0];
    }
    
    // Resetear estado y fechas de control
    cleanData.status = 'pending';
    cleanData.createdAt = new Date().toISOString();
    cleanData.updatedAt = new Date().toISOString();
    
    return cleanData;
  }

  /**
   * Calcula las fechas fuente y destino
   * @private
   */
  _calculateDates(options) {
    const today = new Date();
    let sourceYear = options.sourceYear || today.getFullYear();
    let sourceMonth = options.sourceMonth || today.getMonth() + 1;
    
    let targetYear, targetMonth;
    
    if (options.targetYear && options.targetMonth) {
      targetYear = options.targetYear;
      targetMonth = options.targetMonth;
    } else {
      // Por defecto, generar para el siguiente mes
      targetMonth = sourceMonth + 1;
      targetYear = sourceYear;
      
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear++;
      }
    }
    
    return { sourceYear, sourceMonth, targetYear, targetMonth };
  }

  /**
   * Verifica si ya existen datos en el mes destino
   * @private
   */
  async _checkExistingData(year, month) {
    try {
      const collectionRef = getCollection(this.db, 'transactions', year, month);
      const snapshot = await collectionRef.limit(1).get();
      const hasData = !snapshot.empty;
      
      return { hasData, details: { transactions: hasData } };
    } catch (error) {
      console.warn('Error verificando datos existentes:', error);
      return { hasData: false, details: {} };
    }
  }

  /**
   * Genera transacciones recurrentes para el próximo mes
   * Solo genera egresos que están marcados como recurrentes
   * @private
   */
  async _generateRecurringTransactions(sourceYear, sourceMonth, targetYear, targetMonth, dryRun = false) {
    try {
      console.log('Generando transacciones recurrentes...');
      
      // Obtener transacciones del mes fuente que sean egresos y recurrentes
      const sourceCollection = getCollection(this.db, 'transactions', sourceYear, sourceMonth);
      const transactionsSnapshot = await sourceCollection
        .where('type', '==', 'expense')  // Solo egresos
        .where('isRecurring', '==', true)  // Solo los marcados como recurrentes
        .get();
      
      const results = { created: 0, skipped: 0, errors: [] };
      
      if (transactionsSnapshot.empty) {
        console.log('No se encontraron transacciones recurrentes en el mes fuente');
        return results;
      }
      
      // Obtener colección destino
      const targetCollection = getCollection(this.db, 'transactions', targetYear, targetMonth);
      
      for (const doc of transactionsSnapshot.docs) {
        try {
          const transactionData = doc.data();
          
          // Verificar si ya existe una transacción similar en el mes destino
          // Buscar por descripción y monto para evitar duplicados
          const existingQuery = await targetCollection
            .where('description', '==', transactionData.description)
            .where('amount', '==', transactionData.amount)
            .where('type', '==', 'expense')
            .get();
          
          if (!existingQuery.empty) {
            console.log(`Transacción ${transactionData.description} ya existe en el mes destino`);
            results.skipped++;
            continue;
          }
          
          // Crear nuevo registro usando la función de limpieza
          const newTransactionData = this._cleanDataForNewPeriod(transactionData, targetYear, targetMonth);
          
          // Agregar metadata de recurrencia
          newTransactionData.generatedFrom = {
            sourceDocId: doc.id,
            sourceYear,
            sourceMonth,
            generatedAt: new Date().toISOString()
          };
          
          if (!dryRun) {
            await targetCollection.add(newTransactionData);
          }
          
          console.log(`Transacción recurrente ${transactionData.description} generada para ${targetMonth}/${targetYear}`);
          results.created++;
          
        } catch (error) {
          console.error(`Error procesando transacción ${doc.id}:`, error);
          results.errors.push({
            type: 'transaction',
            id: doc.id,
            description: doc.data().description || 'Sin descripción',
            error: error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error en _generateRecurringTransactions:', error);
      return { created: 0, skipped: 0, errors: [{ type: 'transaction', error: error.message }] };
    }
  }

  /**
   * Obtiene un resumen de los datos disponibles
   * @param {number} year - Año
   * @param {number} month - Mes
   * @returns {Promise<Object>} Resumen de datos
   */
  async getDataSummary(year, month) {
    try {
      const collectionRef = getCollection(this.db, 'transactions', year, month);
      const snapshot = await collectionRef.get();
      
      const transactions = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        transactions.push({
          id: doc.id,
          description: data.description,
          amount: data.amount,
          type: data.type,
          isRecurring: data.isRecurring || false,
          category: data.category,
          propertyId: data.propertyId
        });
      });
      
      // Clasificar transacciones
      const summary = {
        transactions: {
          total: transactions.length,
          income: transactions.filter(t => t.type === 'income').length,
          expense: transactions.filter(t => t.type === 'expense').length,
          recurring: transactions.filter(t => t.isRecurring === true).length,
          recurringExpenses: transactions.filter(t => t.type === 'expense' && t.isRecurring === true).length,
          items: transactions
        }
      };
      
      return {
        success: true,
        year,
        month,
        summary
      };
      
    } catch (error) {
      console.error('Error en getDataSummary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Marca una transacción como recurrente o no recurrente
   * @param {number} year - Año
   * @param {number} month - Mes
   * @param {string} transactionId - ID de la transacción
   * @param {boolean} isRecurring - Si debe ser recurrente
   * @returns {Promise<Object>} Resultado de la operación
   */
  async setTransactionRecurring(year, month, transactionId, isRecurring) {
    try {
      const collectionRef = getCollection(this.db, 'transactions', year, month);
      const docRef = collectionRef.doc(transactionId);
      
      await docRef.update({
        isRecurring,
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: `Transacción marcada como ${isRecurring ? 'recurrente' : 'no recurrente'}`
      };
      
    } catch (error) {
      console.error('Error en setTransactionRecurring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene lista de transacciones recurrentes activas
   * @param {number} year - Año
   * @param {number} month - Mes
   * @returns {Promise<Object>} Lista de transacciones recurrentes
   */
  async getRecurringTransactions(year, month) {
    try {
      const collectionRef = getCollection(this.db, 'transactions', year, month);
      const snapshot = await collectionRef
        .where('type', '==', 'expense')
        .where('isRecurring', '==', true)
        .get();
      
      const recurringTransactions = [];
      snapshot.forEach(doc => {
        recurringTransactions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        year,
        month,
        count: recurringTransactions.length,
        transactions: recurringTransactions
      };
      
    } catch (error) {
      console.error('Error en getRecurringTransactions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AlquileresRecurringService;
