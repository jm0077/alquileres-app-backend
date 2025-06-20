# 🏠 Alquileres App Backend - Automatización Completa

Backend para gestión de alquileres con **automatización mediante GitHub Actions**.

## 🤖 **Automatización Implementada**

### **2 Workflows Principales:**

1. **🔄 Generación Recurrente** - Día 1 de cada mes a las 2:00 AM UTC
2. **📦 Backup Automático** - Día 28 de cada mes a las 23:00 UTC  

## 📅 **Calendario de Automatización**

```
📅 Cada mes:
├── Día 28 → 📦 Backup automático (23:00 UTC)
└── Día 1  → 🔄 Generar egresos recurrentes (2:00 AM UTC)
```

## 🛠️ **Configuración (YA HECHA)**

✅ **Secret configurado**: `ALQUILERES_API_URL = https://alquileres-app-backend.onrender.com`  
✅ **Workflows listos**: Solo 2 workflows activos  
✅ **Probado manualmente**: Debug ejecutado correctamente  

## 🎯 **Funcionalidades**

### **🔄 Generación Recurrente Automática**

**Qué hace:**
1. Busca todas las propiedades
2. Encuentra expenses con `isRecurring: true` del mes anterior  
3. Los replica al mes actual
4. Evita duplicados
5. Genera reporte detallado

**Ejemplo de expense recurrente:**
```javascript
{
  amount: 1020.2,
  description: "Cuota Tío Walter",
  isActive: true,
  isRecurring: true,    // ← Campo clave para recurrencia
  month: 6,
  year: 2025,
  unit: "general"
}
```

### **📦 Backup Automático**

**Qué hace:**
1. ✅ Descarga backup completo de la API
2. ✅ Valida integridad del JSON
3. ✅ **Guarda como GitHub Artifact** (90 días)
4. ✅ Genera reporte con estadísticas

**Para descargar el backup:**
1. Ve a **Actions** → **Backup Automático**
2. Click en la ejecución más reciente
3. Scroll abajo → **Artifacts**
4. Descarga el archivo ZIP

## 📊 **Estructura Real de tu BD**

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
│                   └── {year-month}/
└── units/                         # Collection independiente
    └── {unitId}                   # Info completa de unidades
```

## 🚀 **APIs Disponibles**

### **Backup**
```bash
GET /api/backup                                    # Backup completo
GET /api/backup/property/{propertyId}              # Backup de una propiedad
GET /api/backup/collections                        # Listar colecciones
```

### **Generación Recurrente**
```bash
POST /api/recurring/generate                       # Generar egresos recurrentes
GET /api/recurring/summary?year=2025&month=6       # Resumen por período
GET /api/recurring/expenses/2025/6/recurring       # Ver recurrentes globales
PUT /api/recurring/properties/{propertyId}/expenses/{year}/{month}/{expenseId}/recurring
```

## 📱 **Ejecutar Workflows Manualmente**

### **1. Generar Egresos Recurrentes:**
1. Ve a **Actions** → **"🔄 Generar Egresos Recurrentes"**
2. **"Run workflow"**
3. **Configurar parámetros:**
   - **Año destino:** `2025` (opcional)
   - **Mes destino:** `7` (opcional)  
   - **Solo simular:** `true` (para probar)
4. **"Run workflow"**

### **2. Backup Manual:**
1. Ve a **Actions** → **"📦 Backup Automático Alquileres"**
2. **"Run workflow"**
3. **"Run workflow"** (usar defaults)
4. **Descargar desde Artifacts** cuando termine

## 🔧 **Solución a Errores Anteriores**

### **✅ Problemas RESUELTOS:**

1. **URL duplicada en backup**: ❌ `/api/backup//api/backup` → ✅ `/api/backup`
2. **HTTP 400 en generación**: ❌ Payload mal formado → ✅ JSON válido  
3. **Workflows innecesarios**: ❌ 4 workflows → ✅ Solo 2 workflows
4. **Backup temporal**: ❌ Solo logs → ✅ **GitHub Artifacts** (descargable)

### **🎯 Diferencias con los Workflows Anteriores:**

| Aspecto | ❌ Antes | ✅ Ahora |
|---------|----------|----------|
| **Backup** | Solo logs temporales | **Archivo descargable** por 90 días |
| **URLs** | Duplicadas `/api/backup//api/backup` | Correctas `/api/backup` |
| **JSON** | Payload malformado | **JSON válido** con Content-Type |
| **Cantidad** | 4 workflows innecesarios | **Solo 2 workflows** esenciales |
| **Errores** | HTTP 400/404 | **Manejo robusto** de errores |

## 💡 **Cómo Marcar Expenses como Recurrentes**

Ve a Firebase y edita tus expenses agregando:

```javascript
// En properties/{propertyId}/expenses/{year-month}/items/{expenseId}
{
  // ... otros campos existentes ...
  "isRecurring": true     // ← Agregar este campo
}
```

## 📋 **Verificación de Funcionamiento**

### **Antes de la Automatización:**
1. **Marca al menos 1 expense** como `isRecurring: true`
2. **Prueba manualmente** la generación con `dryRun: true`
3. **Verifica el reporte** en el summary de GitHub

### **Monitoreo:**
- **GitHub Actions** → Ver estado de workflows (🟢/🔴)
- **Summary reports** → Estadísticas detalladas
- **Artifacts** → Backups descargables

## ⚙️ **Personalización**

### **Cambiar Horarios:**
Editar `.github/workflows/` y modificar:
```yaml
# Día 5 a las 10:00 AM UTC en lugar de día 1 a las 2:00 AM
schedule:
  - cron: '0 10 5 * *'
```

### **Cambiar Retención de Backups:**
En `backup-automatic.yml`:
```yaml
retention-days: 180  # En lugar de 90 días
```

## 🎉 **Resultado Final**

### **✅ Lo que tienes ahora:**

1. **🤖 Sistema completamente automático**
2. **📦 Backups descargables** cada mes  
3. **🔄 Egresos recurrentes** generados automáticamente
4. **📊 Reportes detallados** en GitHub
5. **🛡️ Manejo robusto de errores**
6. **📱 Ejecución manual** cuando quieras

### **🔄 Próximos Pasos:**

1. **Marca algunos expenses** como `isRecurring: true` en Firebase
2. **Ejecuta manualmente** con `dryRun: true` para probar
3. **Verifica el resultado** en el summary de GitHub
4. **¡Deja que funcione automáticamente!** 🚀

---

**🏠 Alquileres App Backend v2.0.0**  
*Sistema autónomo con GitHub Actions* ✨

¡Tu gestión de alquileres ahora funciona completamente sola! 🎉
