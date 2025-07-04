const express = require('express');
const router = express.Router();
const AlquileresRecurringService = require('../../services/AlquileresRecurringService');

// Instancia del servicio
const recurringService = new AlquileresRecurringService();

/**
 * @swagger
 * /api/recurring/generate:
 *   post:
 *     summary: Genera expenses recurrentes para el próximo mes (Estructura Real)
 *     description: Crea automáticamente expenses recurrentes para el mes siguiente basándose en el mes actual. Procesa todas las propiedades.
 *     tags: [Recurring]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetYear:
 *                 type: number
 *                 description: Año destino (opcional, por defecto siguiente mes)
 *               targetMonth:
 *                 type: number
 *                 description: Mes destino (opcional, por defecto siguiente mes)
 *               sourceYear:
 *                 type: number
 *                 description: Año fuente (opcional, por defecto mes actual)
 *               sourceMonth:
 *                 type: number
 *                 description: Mes fuente (opcional, por defecto mes actual)
 *               dryRun:
 *                 type: boolean
 *                 description: Solo simular, no crear registros (default false)
 *             example:
 *               targetYear: 2025
 *               targetMonth: 7
 *               dryRun: false
 *     responses:
 *       200:
 *         description: Registros generados exitosamente
 *       400:
 *         description: Error en los parámetros de entrada
 *       500:
 *         description: Error interno del servidor
 */
router.post('/generate', async (req, res) => {
  try {
    const options = req.body || {};
    
    // Validar opciones
    if (options.targetYear && (options.targetYear < 2020 || options.targetYear > 2030)) {
      return res.status(400).json({ 
        success: false, 
        error: 'targetYear debe estar entre 2020 y 2030' 
      });
    }
    
    if (options.targetMonth && (options.targetMonth < 1 || options.targetMonth > 12)) {
      return res.status(400).json({ 
        success: false, 
        error: 'targetMonth debe estar entre 1 y 12' 
      });
    }
    
    if (options.sourceYear && (options.sourceYear < 2020 || options.sourceYear > 2030)) {
      return res.status(400).json({ 
        success: false, 
        error: 'sourceYear debe estar entre 2020 y 2030' 
      });
    }
    
    if (options.sourceMonth && (options.sourceMonth < 1 || options.sourceMonth > 12)) {
      return res.status(400).json({ 
        success: false, 
        error: 'sourceMonth debe estar entre 1 y 12' 
      });
    }
    
    console.log(`Iniciando generación de registros recurrentes de alquileres (estructura real)`, options);
    
    // Generar registros
    const result = await recurringService.generateRecurringRecords(options);
    
    if (result.success) {
      console.log(`Generación completada:`, result.summary);
      return res.status(200).json(result);
    } else {
      console.error(`Error en generación:`, result.error);
      return res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Error en endpoint de generación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/recurring/summary:
 *   get:
 *     summary: Obtiene resumen de datos disponibles para un período (Estructura Real)
 *     description: Muestra qué expenses están disponibles en un mes específico para todas las propiedades
 *     tags: [Recurring]
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: number
 *         description: Año
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: number
 *         description: Mes
 *     responses:
 *       200:
 *         description: Resumen obtenido exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error interno del servidor
 */
router.get('/summary', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren year y month' 
      });
    }
    
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ 
        success: false, 
        error: 'year debe estar entre 2020 y 2030' 
      });
    }
    
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'month debe estar entre 1 y 12' 
      });
    }
    
    // Obtener resumen
    const result = await recurringService.getDataSummary(yearNum, monthNum);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error en endpoint de resumen:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/recurring/validate:
 *   post:
 *     summary: Valida si es posible generar registros para un período (Estructura Real)
 *     description: Verifica requisitos y dependencias antes de generar registros
 *     tags: [Recurring]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetYear:
 *                 type: number
 *                 description: Año destino
 *               targetMonth:
 *                 type: number
 *                 description: Mes destino
 *               sourceYear:
 *                 type: number
 *                 description: Año fuente
 *               sourceMonth:
 *                 type: number
 *                 description: Mes fuente
 *     responses:
 *       200:
 *         description: Validación completada
 */
router.post('/validate', async (req, res) => {
  try {
    const options = req.body || {};
    
    // Calcular fechas usando la misma lógica del servicio
    const today = new Date();
    let sourceYear = options.sourceYear || today.getFullYear();
    let sourceMonth = options.sourceMonth || today.getMonth() + 1;
    
    let targetYear, targetMonth;
    
    if (options.targetYear && options.targetMonth) {
      targetYear = options.targetYear;
      targetMonth = options.targetMonth;
    } else {
      targetMonth = sourceMonth + 1;
      targetYear = sourceYear;
      
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear++;
      }
    }
    
    // Obtener resúmenes de ambos períodos
    const [sourceData, targetData] = await Promise.all([
      recurringService.getDataSummary(sourceYear, sourceMonth),
      recurringService.getDataSummary(targetYear, targetMonth)
    ]);
    
    const warnings = [];
    const errors = [];
    let canGenerate = true;
    
    // Verificar si hay datos fuente
    if (!sourceData.success) {
      errors.push('Error al obtener datos del período fuente');
      canGenerate = false;
    } else {
      const recurringExpenses = sourceData.summary.totalRecurringExpenses;
      
      if (recurringExpenses === 0) {
        warnings.push('No hay expenses recurrentes en el período fuente');
      }
    }
    
    // Verificar datos en período destino
    if (targetData.success) {
      const totalActiveTarget = targetData.summary.totalExpenses;
      
      if (totalActiveTarget > 0) {
        warnings.push(`Ya existen ${totalActiveTarget} expenses en el período destino`);
      }
    }
    
    // Verificar fechas válidas
    if (targetYear === sourceYear && targetMonth === sourceMonth) {
      errors.push('El período destino no puede ser igual al período fuente');
      canGenerate = false;
    }
    
    if (targetYear < sourceYear || (targetYear === sourceYear && targetMonth < sourceMonth)) {
      warnings.push('El período destino es anterior al período fuente');
    }
    
    return res.status(200).json({
      success: true,
      canGenerate,
      sourceData: sourceData.success ? sourceData.summary : null,
      targetData: targetData.success ? targetData.summary : null,
      periods: {
        source: { year: sourceYear, month: sourceMonth },
        target: { year: targetYear, month: targetMonth }
      },
      warnings,
      errors
    });
    
  } catch (error) {
    console.error('Error en endpoint de validación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/recurring/expenses/{year}/{month}/recurring:
 *   get:
 *     summary: Obtiene todos los expenses recurrentes de un período específico
 *     description: Lista todos los expenses marcados como recurrentes en un mes de todas las propiedades
 *     tags: [Recurring]
 *     parameters:
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: number
 *         description: Año
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: number
 *         description: Mes
 *     responses:
 *       200:
 *         description: Lista obtenida exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error interno del servidor
 */
router.get('/expenses/:year/:month/recurring', async (req, res) => {
  try {
    const { year, month } = req.params;
    
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ 
        success: false, 
        error: 'year debe estar entre 2020 y 2030' 
      });
    }
    
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'month debe estar entre 1 y 12' 
      });
    }
    
    // Obtener todos los expenses recurrentes
    const result = await recurringService.getAllRecurringExpenses(yearNum, monthNum);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error en endpoint de expenses recurrentes:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/recurring/properties/{propertyId}/expenses/{year}/{month}/recurring:
 *   get:
 *     summary: Obtiene expenses recurrentes de una propiedad específica
 *     description: Lista todos los expenses marcados como recurrentes en un mes de una propiedad
 *     tags: [Recurring]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la propiedad
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: number
 *         description: Año
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: number
 *         description: Mes
 *     responses:
 *       200:
 *         description: Lista obtenida exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error interno del servidor
 */
router.get('/properties/:propertyId/expenses/:year/:month/recurring', async (req, res) => {
  try {
    const { propertyId, year, month } = req.params;
    
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ 
        success: false, 
        error: 'year debe estar entre 2020 y 2030' 
      });
    }
    
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'month debe estar entre 1 y 12' 
      });
    }
    
    // Obtener expenses recurrentes de la propiedad
    const result = await recurringService.getRecurringExpenses(propertyId, yearNum, monthNum);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error en endpoint de expenses recurrentes por propiedad:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/recurring/properties/{propertyId}/expenses/{year}/{month}/{expenseId}/recurring:
 *   put:
 *     summary: Marca o desmarca un expense como recurrente
 *     description: Actualiza el estado de recurrencia de un expense específico
 *     tags: [Recurring]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la propiedad
 *       - in: path
 *         name: year
 *         required: true
 *         schema:
 *           type: number
 *         description: Año
 *       - in: path
 *         name: month
 *         required: true
 *         schema:
 *           type: number
 *         description: Mes
 *       - in: path
 *         name: expenseId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del expense
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isRecurring:
 *                 type: boolean
 *                 description: Si el expense debe ser recurrente
 *             required:
 *               - isRecurring
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 *       400:
 *         description: Error en los parámetros
 *       500:
 *         description: Error interno del servidor
 */
router.put('/properties/:propertyId/expenses/:year/:month/:expenseId/recurring', async (req, res) => {
  try {
    const { propertyId, year, month, expenseId } = req.params;
    const { isRecurring } = req.body;
    
    // Validar parámetros
    if (!propertyId || !expenseId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere propertyId y expenseId' 
      });
    }
    
    if (typeof isRecurring !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        error: 'isRecurring debe ser boolean' 
      });
    }
    
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ 
        success: false, 
        error: 'year debe estar entre 2020 y 2030' 
      });
    }
    
    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'month debe estar entre 1 y 12' 
      });
    }
    
    // Actualizar estado de recurrencia
    const result = await recurringService.setExpenseRecurring(
      propertyId, yearNum, monthNum, expenseId, isRecurring
    );
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('Error en endpoint de actualización de recurrencia:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/recurring/health:
 *   get:
 *     summary: Verifica el estado del servicio de generación recurrente (Estructura Real)
 *     description: Endpoint de salud para verificar que el servicio está funcionando
 *     tags: [Recurring]
 *     responses:
 *       200:
 *         description: Servicio funcionando correctamente
 */
router.get('/health', async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      service: 'AlquileresRecurringService',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      structure: 'real',
      note: 'Adaptado para la estructura real de la base de datos',
      supportedOperations: [
        'Generate recurring expenses by property',
        'Mark expenses as recurring/non-recurring',
        'Get summary by period across all properties',
        'Validate generation feasibility'
      ]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error en servicio de generación recurrente de alquileres'
    });
  }
});

module.exports = router;
