const express = require('express');
const cors = require('cors');
// Importar Firebase desde la configuración centralizada
const admin = require('./config/firebase');

// Importar rutas
const backupRoutes = require('./api/routes/backup');
const recurringRoutes = require('./api/routes/recurring');

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3002;

// Habilitar CORS para permitir solicitudes desde el frontend
app.use(cors({
  origin: ['https://alquileres-app.vercel.app', 'http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// UTILIDAD CENTRALIZADA PARA TIMESTAMPS
// =====================================
const processFirestoreTimestamps = (data) => {
  if (!data) return data;
  
  if (data instanceof admin.firestore.Timestamp) {
    return data.toDate().toISOString();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return Object.keys(item).reduce((acc, key) => {
          acc[key] = processFirestoreTimestamps(item[key]);
          return acc;
        }, {});
      }
      return item;
    });
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.keys(data).reduce((acc, key) => {
      acc[key] = processFirestoreTimestamps(data[key]);
      return acc;
    }, {});
  }
  
  return data;
};

// Ruta de prueba para verificar que la API está funcionando
app.get('/', (req, res) => {
  res.status(200).send('🏠 API de Alquileres funcionando correctamente (Estructura Simple - Sin userId)');
});

// =======================================
// ===== ENDPOINTS PARA PROPIEDADES =====
// =======================================

// Obtener todas las propiedades
app.get('/api/properties', async (req, res) => {
  try {
    const propertiesRef = admin.firestore().collection('properties');
    const snapshot = await propertiesRef.get();
    const properties = [];
    
    snapshot.forEach(doc => {
      properties.push({
        id: doc.id,
        ...processFirestoreTimestamps(doc.data())
      });
    });
    
    return res.status(200).json(properties);
  } catch (error) {
    console.error('Error al obtener propiedades:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear una nueva propiedad
app.post('/api/properties', async (req, res) => {
  try {
    const propertyData = req.body;
    
    // Validar datos
    if (!propertyData.name) {
      return res.status(400).json({ error: 'Se requiere nombre de la propiedad' });
    }
    
    // Agregar timestamps
    propertyData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    propertyData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    const docRef = await admin.firestore()
      .collection('properties')
      .add(propertyData);
    
    return res.status(201).json({ 
      message: 'Propiedad creada con éxito',
      id: docRef.id 
    });
  } catch (error) {
    console.error('Error al crear propiedad:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener una propiedad específica
app.get('/api/properties/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const propertyDoc = await admin.firestore()
      .collection('properties')
      .doc(propertyId)
      .get();
    
    if (!propertyDoc.exists) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }
    
    return res.status(200).json({
      id: propertyDoc.id,
      ...processFirestoreTimestamps(propertyDoc.data())
    });
  } catch (error) {
    console.error('Error al obtener propiedad:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar una propiedad
app.put('/api/properties/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const propertyData = req.body;
    
    // Agregar timestamp de actualización
    propertyData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await admin.firestore()
      .collection('properties')
      .doc(propertyId)
      .update(propertyData);
    
    return res.status(200).json({ message: 'Propiedad actualizada con éxito' });
  } catch (error) {
    console.error('Error al actualizar propiedad:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar una propiedad
app.delete('/api/properties/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    await admin.firestore()
      .collection('properties')
      .doc(propertyId)
      .delete();
    
    return res.status(200).json({ message: 'Propiedad eliminada con éxito' });
  } catch (error) {
    console.error('Error al eliminar propiedad:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =======================================
// ===== ENDPOINTS PARA UNIDADES ========
// =======================================

// Obtener todas las unidades
app.get('/api/units', async (req, res) => {
  try {
    const { propertyId } = req.query;
    
    let unitsRef = admin.firestore().collection('units');
    
    // Filtrar por propiedad si se especifica
    if (propertyId) {
      unitsRef = unitsRef.where('propertyId', '==', propertyId);
    }
    
    const snapshot = await unitsRef.get();
    const units = [];
    
    snapshot.forEach(doc => {
      units.push({
        id: doc.id,
        ...processFirestoreTimestamps(doc.data())
      });
    });
    
    return res.status(200).json(units);
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear una nueva unidad
app.post('/api/units', async (req, res) => {
  try {
    const unitData = req.body;
    
    // Validar datos
    if (!unitData.name || !unitData.propertyId) {
      return res.status(400).json({ error: 'Se requiere nombre y propertyId de la unidad' });
    }
    
    // Agregar timestamps
    unitData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    unitData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    const docRef = await admin.firestore()
      .collection('units')
      .add(unitData);
    
    return res.status(201).json({ 
      message: 'Unidad creada con éxito',
      id: docRef.id 
    });
  } catch (error) {
    console.error('Error al crear unidad:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =======================================
// ===== ENDPOINTS PARA TRANSACCIONES ===
// =======================================

// Obtener transacciones de un período
app.get('/api/transactions/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const { getCollection } = require('./utils/hierarchicalPath');
    
    const collectionRef = getCollection(admin.firestore(), 'transactions', parseInt(year), parseInt(month));
    const snapshot = await collectionRef.get();
    const transactions = [];
    
    snapshot.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...processFirestoreTimestamps(doc.data())
      });
    });
    
    return res.status(200).json(transactions);
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear una nueva transacción
app.post('/api/transactions/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const transactionData = req.body;
    const { getCollection } = require('./utils/hierarchicalPath');
    
    // Validar datos
    if (!transactionData.description || !transactionData.amount || !transactionData.type) {
      return res.status(400).json({ error: 'Se requiere description, amount y type' });
    }
    
    // Agregar timestamps y período
    transactionData.year = parseInt(year);
    transactionData.month = parseInt(month);
    transactionData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    transactionData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    const collectionRef = getCollection(admin.firestore(), 'transactions', parseInt(year), parseInt(month));
    const docRef = await collectionRef.add(transactionData);
    
    return res.status(201).json({ 
      message: 'Transacción creada con éxito',
      id: docRef.id 
    });
  } catch (error) {
    console.error('Error al crear transacción:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Usar las rutas de la API
app.use('/api/backup', backupRoutes);
app.use('/api/recurring', recurringRoutes);

// Ruta para verificar conexión a Firestore
app.get('/check-firestore', async (req, res) => {
  try {
    // Comprobación simple para ver si Firestore está disponible
    const collection = admin.firestore().collection('test');
    const docRef = collection.doc('test-doc');
    
    await docRef.set({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return res.status(200).json({ message: 'Firestore está disponible' });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Error al conectar con Firestore', 
      details: error.message 
    });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🏠 Servidor de Alquileres App funcionando en http://localhost:${PORT}`);
  console.log('📋 Estructura: SIMPLE (Sin userId)');
  console.log('Endpoints disponibles:');
  
  // Endpoints principales
  console.log('\nEndpoints principales:');
  console.log('- GET  / - Health check');
  console.log('- GET  /check-firestore - Verificar conexión con Firestore');
  
  // Endpoints de propiedades
  console.log('\nEndpoints de propiedades:');
  console.log('- GET  /api/properties - Listar propiedades');
  console.log('- POST /api/properties - Crear propiedad');
  console.log('- GET  /api/properties/:propertyId - Detalle de propiedad');
  console.log('- PUT  /api/properties/:propertyId - Actualizar propiedad');
  console.log('- DEL  /api/properties/:propertyId - Eliminar propiedad');
  
  // Endpoints de unidades
  console.log('\nEndpoints de unidades:');
  console.log('- GET  /api/units?propertyId=X - Listar unidades (filtro opcional)');
  console.log('- POST /api/units - Crear unidad');
  
  // Endpoints de transacciones
  console.log('\nEndpoints de transacciones:');
  console.log('- GET  /api/transactions/:year/:month - Listar transacciones del período');
  console.log('- POST /api/transactions/:year/:month - Crear transacción');
  
  // Endpoints de backup
  console.log('\nEndpoints de backup:');
  console.log('- GET  /api/backup - Backup completo');
  console.log('- GET  /api/backup/collections - Listar colecciones');
  console.log('- GET  /api/backup/collection/:collectionName - Backup de una colección');
  
  // Endpoints de recurrentes
  console.log('\nEndpoints de generación recurrente:');
  console.log('- POST /api/recurring/generate - Generar registros recurrentes');
  console.log('- GET  /api/recurring/summary?year=X&month=Y - Resumen de datos');
  console.log('- POST /api/recurring/validate - Validar generación');
  console.log('- GET  /api/recurring/transactions/:year/:month/recurring - Transacciones recurrentes');
  console.log('- PUT  /api/recurring/transactions/:year/:month/:transactionId/recurring - Marcar/desmarcar como recurrente');
  console.log('- GET  /api/recurring/health - Estado del servicio');
  
  console.log('\n✅ Alquileres App Backend iniciado correctamente');
  console.log('🔗 Funcionalidades principales implementadas:');
  console.log('   • Export completo de datos de Firebase (estructura simple)');
  console.log('   • Generación automática de egresos recurrentes');
  console.log('   • Gestión básica de propiedades, unidades y transacciones');
  console.log('   • Estructura sin userId para simplicidad');
});
