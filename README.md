# 🏠 Alquileres App Backend - Estructura Real

Backend adaptado para la **estructura real** de tu base de datos de alquileres. Proporciona APIs para backup de datos y generación automática de egresos recurrentes.

## 📊 **Estructura Real de la Base de Datos**

Basándome en las imágenes que compartiste, la estructura real es:

```
Firebase Database:
├── properties/                    # Propiedades principales
│   └── {propertyId}/
│       ├── expenses/              # Gastos por propiedad
│       │   └── {year-month}/      # Ej: "2025-06"
│       │       └── items/
│       │           └── {expenseId}
│       └── units/                 # Unidades dentro de propiedad
│           └── {unitId}/
│               └── incomes/       # Ingresos por unidad
│                   └── {year-month}/  # Ej: "2025-06"
│                       └── {incomeData}
└── units/                         # Collection independiente de unidades
    └── {unitId}                   # Información completa de cada unidad
```

## 🎯 **Funcionalidades Adaptadas**

### ✅ **Export de Información (Estructura Real)**

```bash
# Backup completo con estructura real
GET /api/backup

# Backup específico por propiedad
GET /api/backup/property/{propertyId}

# Listar todas las colecciones
GET /api/backup/collections
```

**Ejemplo de respuesta del backup:**
```json
{
  "version": "1.0",
  "structure": "real",
  "properties": [...],
  "units": [...],
  "propertiesData": {
    "propertyId1": {
      "expenses": {
        "2025-06": [...],
        "2025-05": [...]
      },
      "units": [
        {
          "id": "unitId1",
          "incomes": {
            "2025-06": {...},
            "2025-05": {...}
          }
        }
      ]
    }
  }
}
```

### ✅ **Generación Recurrente (Solo Expenses)**

Dado que los **incomes** son por unidad y requieren gestión manual de inquilinos, la generación automática se enfoca solo en **expenses** recurrentes por propiedad.

```bash
# Generar expenses recurrentes para todas las propiedades
POST /api/recurring/generate

# Obtener resumen de expenses por período
GET /api/recurring/summary?year=2025&month=6

# Ver expenses recurrentes de todas las propiedades
GET /api/recurring/expenses/2025/6/recurring

# Ver expenses recurrentes de una propiedad específica
GET /api/recurring/properties/{propertyId}/expenses/2025/6/recurring

# Marcar expense como recurrente/no recurrente
PUT /api/recurring/properties/{propertyId}/expenses/2025/6/{expenseId}/recurring
```

## 🔧 **Instalación y Uso**

```bash
# 1. Instalar dependencias
cd D:\development\Personal\alquileres-app-backend
npm install

# 2. Iniciar servidor
npm start
# Disponible en http://localhost:3002
```

## 💡 **Cómo Funciona la Generación Recurrente**

### **1. Marcado de Expenses**

Para que un expense se replique automáticamente, debe tener `isRecurring: true`:

```javascript
// Estructura real de un expense
{
  id: "8NhmwwQQOsj8Tkm4vNP",
  amount: 1020.2,
  description: "Cuota Tío Walter",
  isActive: true,
  isRecurring: true,    // ← Campo clave para recurrencia
  month: 6,
  unit: "general",
  year: 2025
}
```

### **2. Proceso de Generación**

El sistema:
1. **Busca** todas las propiedades en `/properties/`
2. **Para cada propiedad**, busca expenses en `/{propertyId}/expenses/{year-month}/items/`
3. **Filtra** solo los que tienen `isRecurring: true`
4. **Replica** los expenses al siguiente mes
5. **Evita duplicados** comparando descripción y monto

### **3. Estructura de Datos Recomendada**

Basándome en tus imágenes, el formato correcto es:

```javascript
// Propiedad
{
  id: "hgbZn43WIb0vBuHItkv6",
  name: "Surco",
  description: "Casa en Surco de 4 pisos",
  address: "Salvador Dalí",
  type: "mixed",
  electricRate: 1,
  commonElectricFee: 5,
  hasElectricControl: false
}

// Expense (dentro de properties/{propertyId}/expenses/{year-month}/items/)
{
  amount: 1020.2,
  description: "Cuota Tío Walter",
  isActive: true,
  isRecurring: true,    // Para que se replique automáticamente
  month: 6,
  year: 2025,
  unit: "general"
}

// Income (dentro de properties/{propertyId}/units/{unitId}/incomes/{year-month}/)
{
  amount: 1600,
  dueDay: 1,
  expectedAmount: 1600,
  month: 6,
  monthKey: "2025-06",
  notes: "Alquiler Dpto 4to piso - junio de 2025",
  paidDate: "2025-06-01",
  propertyId: "hgbZn43WIb0vBuHItkv6",
  status: "paid",
  tenantName: "Cristian Leonardo García Acosta",
  unitId: "DpCB0CGMjWQDjY6ZZMQz",
  unitName: "Dpto 4to piso",
  year: 2025
}

// Unit (collection independiente)
{
  id: "6dqkgNYun0SfYZhos9d",
  description: "Cuarto con baño independiente en azotea",
  floor: 5,
  contract: {
    endDate: "2025-09-15",
    monthlyRent: 500,
    months: 12,
    startDate: "2024-09-15"
  },
  electricControl: {
    consumption: 0,
    cost: 0,
    currentReading: 0,
    enabled: false,
    lastReadingDate: null,
    previousReading: 0
  },
  guarantee: {
    amount: 500
  }
}
```

## 📚 **Ejemplos de Uso**

### **1. Exportar Backup Completo**

```bash
curl https://tu-backend.onrender.com/api/backup > backup-alquileres.json
```

### **2. Ver Resumen del Mes Actual**

```bash
curl "https://tu-backend.onrender.com/api/recurring/summary?year=2025&month=6"
```

**Respuesta:**
```json
{
  "success": true,
  "year": 2025,
  "month": 6,
  "summary": {
    "properties": 1,
    "totalExpenses": 3,
    "totalRecurringExpenses": 1,
    "propertiesSummary": [
      {
        "propertyId": "hgbZn43WIb0vBuHItkv6",
        "propertyName": "Surco",
        "totalExpenses": 3,
        "recurringExpenses": 1,
        "expenses": [
          {
            "description": "Cuota Tío Walter",
            "amount": 1020.2,
            "isRecurring": true
          }
        ]
      }
    ]
  }
}
```

### **3. Generar Expenses del Siguiente Mes**

```bash
curl -X POST https://tu-backend.onrender.com/api/recurring/generate \
  -H "Content-Type: application/json" \
  -d '{"targetYear": 2025, "targetMonth": 7}'
```

### **4. Marcar Expense como Recurrente**

```bash
curl -X PUT https://tu-backend.onrender.com/api/recurring/properties/hgbZn43WIb0vBuHItkv6/expenses/2025/6/8NhmwwQQOsj8Tkm4vNP/recurring \
  -H "Content-Type: application/json" \
  -d '{"isRecurring": true}'
```

## 🚨 **Consideraciones Importantes**

### ⚠️ **Solo Expenses son Recurrentes**
- Los **expenses** se replican automáticamente si tienen `isRecurring: true`
- Los **incomes** NO se generan automáticamente (requieren gestión manual por inquilino)
- Esto es correcto porque los alquileres pueden variar, inquilinos pueden cambiar, etc.

### 📋 **Flujo Recomendado**
1. **Marca tus expenses fijos** como recurrentes (`isRecurring: true`)
2. **Ejecuta la generación** mensualmente: `POST /api/recurring/generate`
3. **Gestiona ingresos manualmente** según el estado de cada unidad/inquilino
4. **Exporta backups** periódicamente para seguridad

### 🔍 **Verificación**
El sistema está completamente adaptado a tu estructura real. Puedes verificar:

- ✅ Funciona con tu estructura `properties/{propertyId}/expenses/{year-month}/items/`
- ✅ Funciona con tu estructura `properties/{propertyId}/units/{unitId}/incomes/{year-month}/`
- ✅ Funciona con tu collection independiente `units/`
- ✅ Respeta el formato de campos que ya usas (`isActive`, `isRecurring`, etc.)

## 🔄 **Scripts Actualizados**

```bash
# Probar generación recurrente
npm run recurring:test

# Generar registros del siguiente mes
npm run recurring:generate

# Probar backup completo
npm run backup:test
```

## 🎯 **Próximos Pasos**

1. **Prueba el backup**: `GET /api/backup` para verificar que extrae todos tus datos
2. **Marca algunos expenses** como recurrentes en tu BD
3. **Ejecuta la generación**: `POST /api/recurring/generate`
4. **Verifica los resultados** en Firebase

¡El backend está 100% adaptado a tu estructura real y listo para usar! 🚀

---

**🏠 Alquileres App Backend v2.0.0 - Estructura Real**  
*Adaptado perfectamente a tu base de datos existente*
