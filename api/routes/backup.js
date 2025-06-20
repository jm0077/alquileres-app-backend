const express = require('express');
const router = express.Router();
const admin = require('../../config/firebase');

/**
 * @swagger
 * components:
 *   schemas:
 *     AlquileresBackupData:
 *       type: object
 *       properties:
 *         properties:
 *           type: array
 *           description: Propiedades principales
 *         units:
 *           type: array
 *           description: Collection independiente de unidades
 *         propertiesData:
 *           type: object
 *           description: Datos completos por propiedad (expenses + units con incomes)
 *         exportDate:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora del backup
 *         version:
 *           type: string
 *           description: Versión del formato del backup
 */

/**
 * Convierte Timestamps de Firestore a formato ISO string para JSON
 */
const processFirestoreData = (data) => {
  if (!data) return data;
  
  if (data instanceof admin.firestore.Timestamp) {
    return data.toDate().toISOString();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => processFirestoreData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const processed = {};
    for (const key in data) {
      processed[key] = processFirestoreData(data[key]);
    }
    return processed;
  }
  
  return data;
};

/**
 * Obtiene todos los documentos de una colección
 */
const getAllDocuments = async (collectionRef) => {
  try {
    const snapshot = await collectionRef.get();
    const documents = [];
    
    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...processFirestoreData(doc.data())
      });
    });
    
    return documents;
  } catch (error) {
    console.error('Error al obtener documentos:', error);
    return [];
  }
};

/**
 * Obtiene todos los expenses de una propiedad en todos los períodos
 */
const getAllExpenses = async (propertyId) => {
  try {
    const { listExpensePeriods, getExpenses } = require('../../utils/hierarchicalPath');
    
    const periods = await listExpensePeriods(admin.firestore(), propertyId);
    const expensesByPeriod = {};
    
    for (const period of periods) {
      const expenses = await getExpenses(admin.firestore(), propertyId, period.year, period.month);
      if (expenses.length > 0) {
        expensesByPeriod[period.periodKey] = expenses;
      }
    }
    
    return expensesByPeriod;
  } catch (error) {
    console.error(`Error al obtener expenses de propiedad ${propertyId}:`, error);
    return {};
  }
};

/**
 * Obtiene todos los incomes de una unidad en todos los períodos
 */
const getAllIncomes = async (propertyId, unitId) => {
  try {
    const { listIncomePeriods, getIncomes } = require('../../utils/hierarchicalPath');
    
    const periods = await listIncomePeriods(admin.firestore(), propertyId, unitId);
    const incomesByPeriod = {};
    
    for (const period of periods) {
      const income = await getIncomes(admin.firestore(), propertyId, unitId, period.year, period.month);
      if (income) {
        incomesByPeriod[period.periodKey] = income;
      }
    }
    
    return incomesByPeriod;
  } catch (error) {
    console.error(`Error al obtener incomes de unidad ${unitId}:`, error);
    return {};
  }
};

/**
 * Obtiene datos completos de una propiedad
 */
const getCompletePropertyData = async (propertyId, propertyData) => {
  try {
    const { getPropertyUnits } = require('../../utils/hierarchicalPath');
    
    // Obtener expenses de la propiedad
    const expenses = await getAllExpenses(propertyId);
    
    // Obtener unidades de la propiedad
    const propertyUnits = await getPropertyUnits(admin.firestore(), propertyId);
    
    // Para cada unidad, obtener sus incomes
    const unitsWithIncomes = [];
    for (const unit of propertyUnits) {
      const incomes = await getAllIncomes(propertyId, unit.id);
      unitsWithIncomes.push({
        ...unit,
        incomes
      });
    }
    
    return {
      ...propertyData,
      expenses,
      units: unitsWithIncomes
    };
  } catch (error) {
    console.error(`Error al obtener datos completos de propiedad ${propertyId}:`, error);
    return propertyData;
  }
};

/**
 * @swagger
 * /api/backup:
 *   get:
 *     summary: Exportar backup completo (Alquileres - Estructura Real)
 *     description: Exporta todos los datos de Firestore según la estructura real de alquileres
 *     tags: [Backup]
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Formato del backup (solo JSON por ahora)
 *       - in: query
 *         name: includeDetails
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir detalles completos (expenses e incomes por período)
 *     responses:
 *       200:
 *         description: Backup generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlquileresBackupData'
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', async (req, res) => {
  try {
    const { format = 'json', includeDetails = 'true' } = req.query;
    
    console.log(`Iniciando backup de alquileres (estructura real)...`);
    
    // Inicializar objeto de backup
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      structure: 'real', // Estructura real de la BD
    };
    
    console.log('Obteniendo propiedades principales...');
    
    // 1. Obtener todas las propiedades
    const propertiesRef = admin.firestore().collection('properties');
    const propertiesSnapshot = await propertiesRef.get();
    const properties = [];
    
    propertiesSnapshot.forEach(doc => {
      properties.push({
        id: doc.id,
        ...processFirestoreData(doc.data())
      });
    });
    
    backupData.properties = properties;
    console.log(`Properties: ${properties.length} documentos`);
    
    // 2. Obtener collection independiente de units
    console.log('Obteniendo collection independiente de units...');
    const unitsRef = admin.firestore().collection('units');
    const units = await getAllDocuments(unitsRef);
    backupData.units = units;
    console.log(`Units (independiente): ${units.length} documentos`);
    
    // 3. Si se incluyen detalles, obtener datos completos por propiedad
    if (includeDetails === 'true') {
      console.log('Obteniendo datos completos por propiedad...');
      
      const propertiesData = {};
      let totalExpenses = 0;
      let totalIncomes = 0;
      let totalExpensePeriods = 0;
      let totalIncomePeriods = 0;
      
      for (const property of properties) {
        console.log(`Procesando propiedad: ${property.name || property.id}`);
        
        const completeData = await getCompletePropertyData(property.id, property);
        
        // Contar estadísticas
        const expensePeriods = Object.keys(completeData.expenses || {}).length;
        const expenseItems = Object.values(completeData.expenses || {}).reduce((sum, items) => 
          sum + (Array.isArray(items) ? items.length : 0), 0);
        
        let unitIncomes = 0;
        let unitIncomePeriods = 0;
        
        (completeData.units || []).forEach(unit => {
          const incomePeriods = Object.keys(unit.incomes || {}).length;
          unitIncomePeriods += incomePeriods;
          unitIncomes += incomePeriods; // Cada período es un income
        });
        
        totalExpenses += expenseItems;
        totalIncomes += unitIncomes;
        totalExpensePeriods += expensePeriods;
        totalIncomePeriods += unitIncomePeriods;
        
        propertiesData[property.id] = completeData;
        
        console.log(`  • ${property.name || property.id}: ${expenseItems} expenses en ${expensePeriods} períodos, ${unitIncomes} incomes en ${unitIncomePeriods} períodos`);
      }
      
      backupData.propertiesData = propertiesData;
      
      // Estadísticas detalladas
      backupData.detailedStats = {
        totalExpenses,
        totalIncomes,
        totalExpensePeriods,
        totalIncomePeriods,
        propertiesWithData: Object.keys(propertiesData).length
      };
    }
    
    // Generar estadísticas básicas
    const stats = {
      properties: properties.length,
      unitsIndependent: units.length
    };
    
    if (backupData.detailedStats) {
      Object.assign(stats, backupData.detailedStats);
    }
    
    backupData.stats = stats;
    
    console.log('Backup de alquileres completado. Estadísticas:', backupData.stats);
    
    // Configurar headers para descarga
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alquileres-backup-real-${timestamp}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    // Enviar el backup
    return res.status(200).json(backupData);
    
  } catch (error) {
    console.error('Error al generar backup de alquileres:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/backup/collections:
 *   get:
 *     summary: Listar colecciones disponibles (Estructura Real)
 *     description: Lista todas las colecciones según la estructura real de alquileres
 *     tags: [Backup]
 *     responses:
 *       200:
 *         description: Lista de colecciones obtenida exitosamente
 *       500:
 *         description: Error interno del servidor
 */
router.get('/collections', async (req, res) => {
  try {
    const collections = [];
    
    // 1. Properties (principal)
    const propertiesRef = admin.firestore().collection('properties');
    const propertiesSnapshot = await propertiesRef.get();
    collections.push({
      name: 'properties',
      documentCount: propertiesSnapshot.size,
      type: 'main',
      path: 'properties'
    });
    
    // 2. Units (independiente)
    const unitsRef = admin.firestore().collection('units');
    const unitsSnapshot = await unitsRef.get();
    collections.push({
      name: 'units',
      documentCount: unitsSnapshot.size,
      type: 'independent',
      path: 'units'
    });
    
    // 3. Analizar estructura jerárquica por propiedad
    let totalExpenses = 0;
    let totalIncomes = 0;
    let totalExpensePeriods = 0;
    let totalIncomePeriods = 0;
    
    for (const propertyDoc of propertiesSnapshot.docs) {
      const propertyId = propertyDoc.id;
      
      // Contar expenses
      const { listExpensePeriods, getPropertyUnits, listIncomePeriods } = require('../../utils/hierarchicalPath');
      
      const expensePeriods = await listExpensePeriods(admin.firestore(), propertyId);
      totalExpensePeriods += expensePeriods.length;
      
      for (const period of expensePeriods) {
        const expensesRef = admin.firestore()
          .collection('properties')
          .doc(propertyId)
          .collection('expenses')
          .doc(period.periodKey)
          .collection('items');
        
        const expensesSnapshot = await expensesRef.get();
        totalExpenses += expensesSnapshot.size;
      }
      
      // Contar incomes por unidades
      const propertyUnits = await getPropertyUnits(admin.firestore(), propertyId);
      
      for (const unit of propertyUnits) {
        const incomePeriods = await listIncomePeriods(admin.firestore(), propertyId, unit.id);
        totalIncomePeriods += incomePeriods.length;
        totalIncomes += incomePeriods.length; // Cada período es un documento
      }
    }
    
    // Agregar resúmenes jerárquicos
    collections.push({
      name: 'expenses',
      documentCount: totalExpenses,
      type: 'hierarchical',
      path: 'properties/{propertyId}/expenses/{year-month}/items/',
      periods: totalExpensePeriods
    });
    
    collections.push({
      name: 'incomes',
      documentCount: totalIncomes,
      type: 'hierarchical',
      path: 'properties/{propertyId}/units/{unitId}/incomes/{year-month}',
      periods: totalIncomePeriods
    });
    
    return res.status(200).json({
      collections,
      totalCollections: collections.length,
      structure: 'real', // Estructura real
      summary: {
        properties: propertiesSnapshot.size,
        units: unitsSnapshot.size,
        expenses: totalExpenses,
        incomes: totalIncomes,
        expensePeriods: totalExpensePeriods,
        incomePeriods: totalIncomePeriods
      }
    });
    
  } catch (error) {
    console.error('Error al listar colecciones:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

/**
 * @swagger
 * /api/backup/property/{propertyId}:
 *   get:
 *     summary: Backup de una propiedad específica con todos sus datos
 *     description: Exporta datos completos de una propiedad (expenses + units con incomes)
 *     tags: [Backup]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la propiedad
 *     responses:
 *       200:
 *         description: Backup de propiedad generado exitosamente
 *       404:
 *         description: Propiedad no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get('/property/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    // Verificar que la propiedad existe
    const propertyDoc = await admin.firestore()
      .collection('properties')
      .doc(propertyId)
      .get();
    
    if (!propertyDoc.exists) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    
    const propertyData = {
      id: propertyDoc.id,
      ...processFirestoreData(propertyDoc.data())
    };
    
    // Obtener datos completos
    const completeData = await getCompletePropertyData(propertyId, propertyData);
    
    const backupData = {
      propertyId,
      exportDate: new Date().toISOString(),
      data: completeData
    };
    
    // Configurar headers para descarga
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alquileres-property-${propertyId}-${timestamp}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    return res.status(200).json(backupData);
    
  } catch (error) {
    console.error('Error al generar backup de propiedad:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

module.exports = router;
