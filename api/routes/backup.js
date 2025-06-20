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
 *           description: Propiedades del usuario
 *         units:
 *           type: array
 *           description: Unidades/subpropiedades
 *         transactions:
 *           type: object
 *           description: Transacciones por período (año-mes)
 *         guarantees:
 *           type: array
 *           description: Garantías de inquilinos
 *         services:
 *           type: array
 *           description: Control de servicios (electricidad, agua, etc.)
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
 * Obtiene datos jerárquicos por año/mes de forma recursiva (solo para transactions)
 */
const getHierarchicalData = async (collectionName) => {
  try {
    const { listAvailablePeriods, getCollection } = require('../../utils/hierarchicalPath');
    
    // Obtener todos los períodos disponibles
    const periods = await listAvailablePeriods(admin.firestore(), collectionName);
    
    if (periods.length === 0) {
      return {};
    }
    
    const hierarchicalData = {};
    
    // Obtener datos para cada período
    for (const period of periods) {
      const periodKey = `${period.year}-${period.month.toString().padStart(2, '0')}`;
      const collectionRef = getCollection(
        admin.firestore(), 
        collectionName, 
        period.year, 
        period.month
      );
      
      const documents = await getAllDocuments(collectionRef);
      if (documents.length > 0) {
        hierarchicalData[periodKey] = documents;
      }
    }
    
    return hierarchicalData;
  } catch (error) {
    console.error(`Error al obtener datos jerárquicos de ${collectionName}:`, error);
    return {};
  }
};

/**
 * @swagger
 * /api/backup:
 *   get:
 *     summary: Exportar backup completo (Alquileres)
 *     description: Exporta todos los datos de Firestore para alquileres en formato JSON
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
 *         name: includeHistory
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir historial completo de transacciones
 *     responses:
 *       200:
 *         description: Backup generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlquileresBackupData'
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             description: Nombre del archivo de descarga
 *             schema:
 *               type: string
 *       500:
 *         description: Error interno del servidor
 */
router.get('/', async (req, res) => {
  try {
    const { format = 'json', includeHistory = 'true' } = req.query;
    
    console.log(`Iniciando backup de alquileres...`);
    
    // Inicializar objeto de backup
    const backupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      structure: 'simple', // Sin userId
    };
    
    console.log('Obteniendo todas las colecciones...');
    
    // Lista de colecciones principales de alquileres
    const mainCollections = ['properties', 'units', 'guarantees', 'services'];
    
    // Procesar colecciones simples
    for (const collectionName of mainCollections) {
      console.log(`Procesando colección: ${collectionName}`);
      
      try {
        const collectionRef = admin.firestore().collection(collectionName);
        const documents = await getAllDocuments(collectionRef);
        backupData[collectionName] = documents;
        
        console.log(`${collectionName}: ${documents.length} documentos`);
      } catch (collectionError) {
        console.error(`Error al procesar colección ${collectionName}:`, collectionError.message);
        backupData[collectionName] = [];
      }
    }
    
    // Procesar transacciones (colección jerárquica)
    console.log('Procesando transacciones (estructura jerárquica)...');
    try {
      backupData.transactions = await getHierarchicalData('transactions');
      
      // Calcular total de transacciones
      const totalTransactions = Object.values(backupData.transactions).reduce((sum, periodDocs) => {
        return sum + (Array.isArray(periodDocs) ? periodDocs.length : 0);
      }, 0);
      
      console.log(`transactions: ${totalTransactions} documentos en ${Object.keys(backupData.transactions).length} períodos`);
    } catch (error) {
      console.error('Error al procesar transacciones:', error.message);
      backupData.transactions = {};
    }
    
    // Generar estadísticas
    const stats = {};
    
    // Estadísticas de colecciones simples
    mainCollections.forEach(collectionName => {
      stats[collectionName] = backupData[collectionName] ? backupData[collectionName].length : 0;
    });
    
    // Estadísticas de transacciones
    const hierarchicalData = backupData.transactions || {};
    const totalDocs = Object.values(hierarchicalData).reduce((sum, periodDocs) => {
      return sum + (Array.isArray(periodDocs) ? periodDocs.length : 0);
    }, 0);
    stats.transactions = totalDocs;
    stats.transactionPeriods = Object.keys(hierarchicalData).length;
    
    backupData.stats = stats;
    
    console.log('Backup de alquileres completado. Estadísticas:', backupData.stats);
    
    // Configurar headers para descarga
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alquileres-backup-${timestamp}.json`;
    
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
 *     summary: Listar colecciones disponibles para backup (Alquileres)
 *     description: Obtiene una lista de todas las colecciones disponibles en el sistema de alquileres
 *     tags: [Backup]
 *     responses:
 *       200:
 *         description: Lista de colecciones obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       documentCount:
 *                         type: number
 *       500:
 *         description: Error interno del servidor
 */
router.get('/collections', async (req, res) => {
  try {
    const collections = [];
    
    // Lista de colecciones principales
    const mainCollections = ['properties', 'units', 'guarantees', 'services', 'transactions'];
    
    for (const collectionName of mainCollections) {
      try {
        if (collectionName === 'transactions') {
          // Para transacciones, contar documentos en todos los períodos
          const hierarchicalData = await getHierarchicalData('transactions');
          const totalDocs = Object.values(hierarchicalData).reduce((sum, periodDocs) => {
            return sum + (Array.isArray(periodDocs) ? periodDocs.length : 0);
          }, 0);
          
          collections.push({
            name: collectionName,
            documentCount: totalDocs,
            type: 'hierarchical',
            periods: Object.keys(hierarchicalData).length,
            path: collectionName
          });
        } else {
          // Para otras colecciones, contar directamente
          const collectionRef = admin.firestore().collection(collectionName);
          const snapshot = await collectionRef.get();
          
          collections.push({
            name: collectionName,
            documentCount: snapshot.size,
            type: 'simple',
            path: collectionName
          });
        }
      } catch (error) {
        console.warn(`Error al contar documentos en ${collectionName}:`, error.message);
        collections.push({
          name: collectionName,
          documentCount: 0,
          type: 'unknown',
          error: error.message
        });
      }
    }
    
    return res.status(200).json({
      collections,
      totalCollections: collections.length,
      structure: 'simple' // Sin userId
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
 * /api/backup/collection/{collectionName}:
 *   get:
 *     summary: Backup de una colección específica (Alquileres)
 *     description: Exporta solo los datos de una colección específica del sistema de alquileres
 *     tags: [Backup]
 *     parameters:
 *       - in: path
 *         name: collectionName
 *         required: true
 *         schema:
 *           type: string
 *         description: Nombre de la colección a exportar
 *     responses:
 *       200:
 *         description: Backup de colección generado exitosamente
 *       404:
 *         description: Colección no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get('/collection/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    
    let backupData;
    
    // Verificar si es una colección jerárquica
    if (collectionName === 'transactions') {
      // Colección jerárquica
      const hierarchicalData = await getHierarchicalData('transactions');
      
      if (Object.keys(hierarchicalData).length === 0) {
        return res.status(404).json({ error: 'Colección no encontrada o vacía' });
      }
      
      backupData = {
        collection: collectionName,
        exportDate: new Date().toISOString(),
        isHierarchical: true,
        periods: Object.keys(hierarchicalData).length,
        totalDocuments: Object.values(hierarchicalData).reduce((sum, periodDocs) => 
          sum + (Array.isArray(periodDocs) ? periodDocs.length : 0), 0),
        data: hierarchicalData
      };
    } else {
      // Colección simple
      const collectionRef = admin.firestore().collection(collectionName);
      const documents = await getAllDocuments(collectionRef);
      
      if (documents.length === 0) {
        return res.status(404).json({ error: 'Colección no encontrada o vacía' });
      }
      
      backupData = {
        collection: collectionName,
        exportDate: new Date().toISOString(),
        isHierarchical: false,
        count: documents.length,
        data: documents
      };
    }
    
    // Configurar headers para descarga
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `alquileres-${collectionName}-backup-${timestamp}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    return res.status(200).json(backupData);
    
  } catch (error) {
    console.error('Error al generar backup de colección:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

module.exports = router;
