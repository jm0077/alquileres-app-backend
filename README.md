# 🏠 Alquileres App Backend

Backend para la aplicación de gestión de alquileres con **estructura simple sin userId**. Proporciona APIs para backup de datos y generación automática de egresos recurrentes.

## 🚀 Características Principales

### ✅ **Export de Información**
- **Backup completo**: Exporta todos los datos de Firebase
- **Backup por colección**: Exporta datos específicos de una colección
- **Formato JSON**: Datos listos para importar o analizar
- **Timestamps procesados**: Convierte automáticamente fechas de Firestore

### ✅ **Generación Automática de Egresos Recurrentes**
- **Proceso programado**: Replica automáticamente egresos recurrentes al siguiente mes
- **Detección inteligente**: Solo procesa transacciones marcadas como `isRecurring: true`
- **Prevención de duplicados**: Evita crear registros que ya existen
- **Modo de prueba**: Simula la generación sin crear registros reales
- **Seguimiento completo**: Logs detallados y manejo de errores

## 📋 Estructura de Datos

### 🔄 **Estructura Simplificada (Sin userId)**

```
Firebase Database:
├── properties/              # Propiedades directamente en root
├── units/                   # Unidades directamente en root
├── guarantees/              # Garantías directamente en root
├── services/                # Servicios directamente en root
└── transactions/            # Transacciones jerárquicas por año/mes
    └── {year}/
        └── {month}/
            └── {transactionId}
```

### 💡 **¿Por qué Sin userId?**

Como observaste correctamente, para alquileres no necesitas múltiples usuarios. Esta estructura:
- **Simplifica** el acceso a los datos
- **Reduce** la complejidad de las URLs
- **Mantiene** toda la funcionalidad
- **Permite** escalar a múltiples usuarios en el futuro si es necesario

## 🛠 Instalación

1. **Clonar y configurar**:
   ```bash
   cd D:\development\Personal\alquileres-app-backend
   npm install
   ```

2. **Iniciar el servidor**:
   ```bash
   npm start
   # Disponible en http://localhost:3002
   ```

## 📚 API Endpoints

### 🔐 **Backup (Estructura Simple)**

```bash
# Backup completo
GET /api/backup

# Listar colecciones disponibles
GET /api/backup/collections

# Backup de una colección específica
GET /api/backup/collection/{collectionName}
```

### 🔄 **Generación Recurrente (Sin userId)**

```bash
# Generar registros recurrentes
POST /api/recurring/generate

# Obtener resumen de un período
GET /api/recurring/summary?year=2025&month=6

# Validar generación antes de ejecutar
POST /api/recurring/validate

# Listar transacciones recurrentes
GET /api/recurring/transactions/{year}/{month}/recurring

# Marcar/desmarcar transacción como recurrente
PUT /api/recurring/transactions/{year}/{month}/{transactionId}/recurring

# Estado del servicio
GET /api/recurring/health
```

### 🏠 **Gestión Básica (Estructura Simple)**

```bash
# Propiedades
GET /api/properties
POST /api/properties
GET /api/properties/{propertyId}
PUT /api/properties/{propertyId}
DELETE /api/properties/{propertyId}

# Unidades
GET /api/units?propertyId=X    # Filtro opcional
POST /api/units

# Transacciones (por período)
GET /api/transactions/{year}/{month}
POST /api/transactions/{year}/{month}
```

## 🎯 Uso de Scripts

### Generar Registros Recurrentes

```bash
# Generar para el siguiente mes automático
node scripts/generate-recurring.js

# Generar para un mes específico
node scripts/generate-recurring.js 2025 7
```

### Probar Funcionalidades

```bash
# Probar backup
node scripts/test-backup.js full
node scripts/test-backup.js collections
node scripts/test-backup.js collection transactions

# Probar generación recurrente
node scripts/test-recurring.js
```

## 💡 Cómo Funciona la Generación Recurrente

### 1. **Marcado de Transacciones**
Las transacciones deben tener el campo `isRecurring: true`:

```javascript
{
  id: "trans123",
  type: "expense",
  description: "Luz ENEL",
  amount: 120,
  isRecurring: true,  // ← Campo clave
  category: "utilities",
  propertyId: "prop123",
  year: 2025,
  month: 6
}
```

### 2. **Estructura de Datos Recomendada**

```javascript
// Propiedades
{
  id: "prop123",
  name: "SURCO",
  address: "Av. Principal 123",
  type: "mixed",
  unitsCount: 3
}

// Unidades
{
  id: "unit456",
  propertyId: "prop123",
  name: "Dpto 3er Piso",
  rent: 800,
  isOccupied: true,
  tenant: {
    name: "Juan Pérez",
    documentNumber: "12345678",
    phone: "+51 999 888 777"
  }
}

// Transacciones
{
  id: "trans789",
  type: "expense",        // "income" | "expense"
  description: "Luz ENEL",
  amount: 120,
  isRecurring: true,      // Campo para recurrencia
  category: "utilities",
  propertyId: "prop123",
  unitId: "unit456",      // Opcional
  year: 2025,
  month: 6,
  status: "pending"       // "pending" | "paid"
}
```

## 📊 Ejemplos de Uso

### 1. **Crear Transacción Recurrente**

```bash
curl -X POST http://localhost:3002/api/transactions/2025/6 \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "description": "Luz ENEL",
    "amount": 120,
    "isRecurring": true,
    "category": "utilities",
    "propertyId": "prop123"
  }'
```

### 2. **Generar Egresos del Siguiente Mes**

```bash
curl -X POST http://localhost:3002/api/recurring/generate \
  -H "Content-Type: application/json" \
  -d '{
    "targetYear": 2025,
    "targetMonth": 7,
    "dryRun": false
  }'
```

### 3. **Exportar Backup Completo**

```bash
curl http://localhost:3002/api/backup > alquileres-backup.json
```

## 🔄 Comparación con Estructura de Usuario

| Aspecto | **Con userId** | **Sin userId (Actual)** |
|---------|----------------|--------------------------|
| URL | `/api/backup/{userId}` | `/api/backup` |
| Complejidad | Mayor | Menor |
| Escalabilidad | Multi-usuario | Mono-usuario |
| Simplicidad | ❌ | ✅ |
| Para alquileres | Innecesario | Perfecto |

## 🚨 Consideraciones Importantes

### ⚠️ **Datos Recurrentes**
- Solo los **egresos** marcados con `isRecurring: true` se replican
- Los **ingresos** NO se generan automáticamente (requieren intervención manual)
- Se recomienda revisar los registros generados antes de marcarlos como pagados

### 🔒 **Seguridad**
- Usar el mismo proyecto Firebase que `finanzas-app-backend`
- Las credenciales deben ser las mismas
- CORS configurado para dominios específicos

### 📈 **Migración Futura**
Si en el futuro necesitas múltiples usuarios, puedes:
1. Mantener los datos actuales como usuario "main"
2. Agregar estructura de usuarios encima
3. Migrar gradualmente

```javascript
// Estructura futura con usuarios
users/
├── main/              # Datos actuales
│   ├── properties/
│   ├── units/
│   └── transactions/
└── user2/             # Nuevo usuario
    ├── properties/
    ├── units/
    └── transactions/
```

## 🤝 Integración con Frontend

### Endpoints Recomendados para Frontend:
```javascript
// Obtener resumen mensual
fetch('/api/recurring/summary?year=2025&month=6')

// Generar registros del siguiente mes
fetch('/api/recurring/generate', { method: 'POST' })

// Exportar datos completos
fetch('/api/backup')

// Obtener propiedades
fetch('/api/properties')

// Obtener transacciones del mes
fetch('/api/transactions/2025/6')
```

## 📄 Ejemplo de Flujo Completo

```bash
# 1. Probar el estado actual
node scripts/test-recurring.js

# 2. Si hay transacciones recurrentes, generar
node scripts/generate-recurring.js 2025 7

# 3. Verificar resultados
node scripts/test-recurring.js

# 4. Hacer backup de seguridad
node scripts/test-backup.js full
```

---

**🏠 Alquileres App Backend v1.0.0**  
*Gestión simple de alquileres sin complejidad de usuarios múltiples*
