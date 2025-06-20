/**
 * Servicio para generar automáticamente registros recurrentes mensuales para Alquileres
 * Adaptado para la estructura REAL de la base de datos
 * Maneja expenses recurrentes por propiedad
 */
const admin = require('../config/firebase');
const { 
  getStoragePath, 
  getCollection, 
  listExpensePeriods, 
  getExpenses 
} = require('../utils/hierarchicalPath');

const db = admin.firestore();

class AlquileresRecurringService {
  constructor() {
    this.db = db;
  }

  /**
   * Genera registros para el próximo mes basándose en los datos del mes anterior
   * Solo procesa EXPENSES (no incomes, que son por unidad y requieren intervención manual)
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
      console.log(`Iniciando generación de registros recurrentes de alquileres (estructura real)...`);
      
      // Determinar fechas fuente y destino
      const dates = this._calculateDates(options);
      const { sourceYear, sourceMonth, targetYear, targetMonth } = dates;
      
      console.log(`Generando desde ${sourceYear}/${sourceMonth} hacia ${targetYear}/${targetMonth}`);
      
      // Obtener todas las propiedades
      const properties = await this._getAllProperties();
      
      if (properties.length === 0) {
        return {
          success: false,
          error: 'No se encontraron propiedades'
        };
      }
      
      console.log(`Procesando ${properties.length} propiedades`);
      
      // Procesar cada propiedad
      const results = {
        expenses: { created: 0, skipped: 0, errors: [] },
        summary: {
          sourceYear,
          sourceMonth,
          targetYear,
          targetMonth,
          dryRun: options.dryRun || false,
          timestamp: new Date().toISOString(),
          propertiesProcessed: 0
        }
      };
      
      for (const property of properties) {
        try {
          console.log(`Procesando propiedad: ${property.name || property.id}`);
          
          const propertyResult = await this._generateRecurringExpenses(
            property.id, sourceYear, sourceMonth, targetYear, targetMonth, options.dryRun
          );
          
          results.expenses.created += propertyResult.created;
          results.expenses.skipped += propertyResult.skipped;
          results.expenses.errors.push(...propertyResult.errors);
          results.summary.propertiesProcessed++;
          
        } catch (error) {
          console.error(`Error procesando propiedad ${property.id}:`, error);
          results.expenses.errors.push({
            type: 'property',
            propertyId: property.id,
            error: error.message
          });
        }
      }
      
      // Calcular totales
      results.summary.totalCreated = results.expenses.created;
      results.summary.totalSkipped = results.expenses.skipped;
      results.summary.totalErrors = results.expenses.errors.length;
      
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
   * Obtiene todas las propiedades
   * @private
   */
  async _getAllProperties() {
    try {
      const propertiesRef = this.db.collection('properties');
      const snapshot = await propertiesRef.get();
      const properties = [];
      
      snapshot.forEach(doc => {
        properties.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return properties;
    } catch (error) {
      console.error('Error obteniendo propiedades:', error);
      return [];
    }
  }

  /**
   * Genera expenses recurrentes para una propiedad específica
   * @private
   */
  async _generateRecurringExpenses(propertyId, sourceYear, sourceMonth, targetYear, targetMonth, dryRun = false) {
    try {
      console.log(`Generando expenses recurrentes para propiedad ${propertyId}...`);
      
      // Obtener expenses del mes fuente que sean recurrentes
      const sourceExpenses = await getExpenses(this.db, propertyId, sourceYear, sourceMonth);
      
      const results = { created: 0, skipped: 0, errors: [] };
      
      if (sourceExpenses.length === 0) {
        console.log(`No se encontraron expenses en el mes fuente para propiedad ${propertyId}`);
        return results;
      }
      
      // Filtrar solo los recurrentes
      const recurringExpenses = sourceExpenses.filter(expense => expense.isRecurring === true);
      
      if (recurringExpenses.length === 0) {
        console.log(`No se encontraron expenses recurrentes en el mes fuente para propiedad ${propertyId}`);
        return results;
      }
      
      console.log(`Encontrados ${recurringExpenses.length} expenses recurrentes en propiedad ${propertyId}`);
      
      // Obtener colección destino
      const targetCollection = getCollection(this.db, 'expenses', propertyId, null, targetYear, targetMonth);
      
      // Verificar si ya existen expenses en el mes destino
      const existingExpenses = await getExpenses(this.db, propertyId, targetYear, targetMonth);
      
      for (const expense of recurringExpenses) {
        try {
          // Verificar si ya existe un expense similar en el mes destino
          const duplicateExists = existingExpenses.some(existing => 
            existing.description === expense.description && 
            existing.amount === expense.amount
          );
          
          if (duplicateExists) {
            console.log(`Expense ${expense.description} ya existe en el mes destino`);
            results.skipped++;
            continue;
          }
          
          // Crear nuevo registro usando la función de limpieza
          const newExpenseData = this._cleanDataForNewPeriod(expense, targetYear, targetMonth);
          
          // Agregar metadata de recurrencia
          newExpenseData.generatedFrom = {
            sourceDocId: expense.id,
            sourceYear,
            sourceMonth,
            propertyId,
            generatedAt: new Date().toISOString()
          };
          
          if (!dryRun) {
            await targetCollection.add(newExpenseData);
          }
          
          console.log(`Expense recurrente ${expense.description} generado para ${targetMonth}/${targetYear} en propiedad ${propertyId}`);
          results.created++;
          
        } catch (error) {
          console.error(`Error procesando expense ${expense.id}:`, error);
          results.errors.push({
            type: 'expense',
            propertyId,
            expenseId: expense.id,
            description: expense.description || 'Sin descripción',
            error: error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error en _generateRecurringExpenses:', error);
      return { created: 0, skipped: 0, errors: [{ type: 'expense', propertyId, error: error.message }] };
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
    
    // Actualizar fecha de vencimiento al siguiente mes si existe
    if (cleanData.dueDate) {
      const currentDueDate = new Date(cleanData.dueDate);
      const newDueDate = new Date(currentDueDate);
      newDueDate.setMonth(newDueDate.getMonth() + 1);
      cleanData.dueDate = newDueDate.toISOString().split('T')[0];
    }
    
    // Resetear estado y fechas de control
    cleanData.isActive = true;
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
   * Obtiene un resumen de los datos disponibles para todas las propiedades
   * @param {number} year - Año
   * @param {number} month - Mes
   * @returns {Promise<Object>} Resumen de datos
   */
  async getDataSummary(year, month) {
    try {
      const properties = await this._getAllProperties();
      
      let totalExpenses = 0;
      let totalRecurringExpenses = 0;
      const propertiesSummary = [];
      
      for (const property of properties) {
        try {
          const expenses = await getExpenses(this.db, property.id, year, month);
          const recurringExpenses = expenses.filter(e => e.isRecurring === true);
          
          totalExpenses += expenses.length;
          totalRecurringExpenses += recurringExpenses.length;
          
          propertiesSummary.push({
            propertyId: property.id,
            propertyName: property.name || 'Sin nombre',
            totalExpenses: expenses.length,
            recurringExpenses: recurringExpenses.length,
            expenses: expenses.map(e => ({
              id: e.id,
              description: e.description,
              amount: e.amount,
              isRecurring: e.isRecurring || false
            }))
          });
        } catch (error) {
          console.warn(`Error obteniendo expenses de propiedad ${property.id}:`, error.message);
          propertiesSummary.push({
            propertyId: property.id,
            propertyName: property.name || 'Sin nombre',
            totalExpenses: 0,
            recurringExpenses: 0,
            expenses: [],
            error: error.message
          });
        }
      }
      
      const summary = {
        properties: properties.length,
        totalExpenses,
        totalRecurringExpenses,
        propertiesSummary
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
   * Marca un expense como recurrente o no recurrente
   * @param {string} propertyId - ID de la propiedad
   * @param {number} year - Año
   * @param {number} month - Mes
   * @param {string} expenseId - ID del expense
   * @param {boolean} isRecurring - Si debe ser recurrente
   * @returns {Promise<Object>} Resultado de la operación
   */
  async setExpenseRecurring(propertyId, year, month, expenseId, isRecurring) {
    try {
      const collectionRef = getCollection(this.db, 'expenses', propertyId, null, year, month);
      const docRef = collectionRef.doc(expenseId);
      
      await docRef.update({
        isRecurring,
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: `Expense marcado como ${isRecurring ? 'recurrente' : 'no recurrente'}`
      };
      
    } catch (error) {
      console.error('Error en setExpenseRecurring:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene lista de expenses recurrentes de una propiedad
   * @param {string} propertyId - ID de la propiedad
   * @param {number} year - Año
   * @param {number} month - Mes
   * @returns {Promise<Object>} Lista de expenses recurrentes
   */
  async getRecurringExpenses(propertyId, year, month) {
    try {
      const expenses = await getExpenses(this.db, propertyId, year, month);
      const recurringExpenses = expenses.filter(e => e.isRecurring === true);
      
      return {
        success: true,
        propertyId,
        year,
        month,
        count: recurringExpenses.length,
        expenses: recurringExpenses
      };
      
    } catch (error) {
      console.error('Error en getRecurringExpenses:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene todos los expenses recurrentes de todas las propiedades
   * @param {number} year - Año
   * @param {number} month - Mes
   * @returns {Promise<Object>} Lista de todos los expenses recurrentes
   */
  async getAllRecurringExpenses(year, month) {
    try {
      const properties = await this._getAllProperties();
      const allRecurringExpenses = [];
      
      for (const property of properties) {
        const result = await this.getRecurringExpenses(property.id, year, month);
        if (result.success && result.expenses.length > 0) {
          allRecurringExpenses.push({
            propertyId: property.id,
            propertyName: property.name || 'Sin nombre',
            expenses: result.expenses
          });
        }
      }
      
      const totalCount = allRecurringExpenses.reduce((sum, prop) => sum + prop.expenses.length, 0);
      
      return {
        success: true,
        year,
        month,
        totalCount,
        propertiesWithRecurring: allRecurringExpenses.length,
        propertiesData: allRecurringExpenses
      };
      
    } catch (error) {
      console.error('Error en getAllRecurringExpenses:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AlquileresRecurringService;
