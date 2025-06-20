# 🏠 Alquileres App Backend - Estructura Real + GitHub Actions

Backend adaptado para la **estructura real** de tu base de datos de alquileres con **automatización completa** mediante GitHub Actions.

## 🚀 **Nuevas Funcionalidades con GitHub Actions**

### 🤖 **Automatización Completa**

El sistema ahora incluye 3 workflows automáticos:

1. **🔄 Generación Recurrente** - Día 1 de cada mes a las 2:00 AM UTC
2. **📦 Backup Automático** - Día 28 de cada mes a las 23:00 UTC  
3. **🏥 Monitor de Salud** - Diariamente a las 8:00 AM UTC

## 📅 **Calendario de Automatización**

```
📅 Mes típico:
├── Día 1  → 🔄 Generar egresos recurrentes (2:00 AM UTC)
├── Día 8  → 🏥 Verificar salud del sistema (8:00 AM UTC)
├── Día 15 → 🏥 Verificar salud del sistema (8:00 AM UTC)
├── Día 22 → 🏥 Verificar salud del sistema (8:00 AM UTC)
└── Día 28 → 📦 Backup automático (23:00 UTC)
```

## 🛠️ **Configuración Inicial**

### **1. Configurar Secret en GitHub**

Ve a tu repositorio → Settings → Secrets and variables → Actions → New repository secret:

```
Name: ALQUILERES_API_URL
Secret: https://tu-app-en-render.onrender.com
```

### **2. Activar Workflows**

Los workflows se activarán automáticamente una vez que hagas push a GitHub con los archivos `.github/workflows/`.

### **3. Probar Manualmente**

Puedes probar cada workflow manualmente:

1. **Ve a la pestaña "Actions"** de tu repositorio
2. **Selecciona el workflow** que quieres probar
3. **Click en "Run workflow"**
4. **Ejecutar con parámetros por defecto**

## 📊 **Estructura Real de la Base de Datos**

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

## 🎯 **APIs Disponibles**

### **Backup (Estructura Real)**
```bash
# Backup completo con estructura real
GET /api/backup

# Backup específico por propiedad
GET /api/backup/property/{propertyId}

# Listar todas las colecciones
GET /api/backup/collections
```

### **Generación Recurrente (Solo Expenses)**
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

## 🔄 **Cómo Funciona la Automatización**

### **1. Generación Recurrente Automática**

**Cuándo:** Día 1 de cada mes a las 2:00 AM UTC (9:00 PM día anterior en Perú)

**Qué hace:**
1. ✅ Busca todas las propiedades
2. ✅ Para cada propiedad, busca expenses con `isRecurring: true` del mes anterior
3. ✅ Replica esos expenses al mes actual
4. ✅ Evita duplicados
5. ✅ Genera reporte detallado

**Ejemplo de reporte:**
```
📊 Generación Completada ✅
• Propiedades procesadas: 1
• Egresos creados: 3
• Egresos omitidos: 0
• Errores: 0
```

### **2. Backup Automático**

**Cuándo:** Día 28 de cada mes a las 23:00 UTC (6:00 PM en Perú)

**Qué hace:**
1. ✅ Descarga backup completo de la API
2. ✅ Valida integridad del JSON
3. ✅ Genera reporte con estadísticas
4. ✅ Calcula hash MD5 para verificación

**Ejemplo de reporte:**
```
📦 Backup Completado ✅
• Archivo: alquileres-backup-2025-07-28_23-15-30.json
• Tamaño: 2.45 MB
• Propiedades: 1
• Unidades: 8
• Egresos: 45
• Ingresos: 32
```

### **3. Monitor de Salud**

**Cuándo:** Diariamente a las 8:00 AM UTC (3:00 AM en Perú)

**Qué hace:**
1. ✅ Verifica que la API esté respondiendo
2. ✅ Prueba endpoint de backup
3. ✅ Prueba endpoint de recurrencia
4. ✅ Mide tiempo de respuesta
5. ✅ Alerta si hay problemas

## 💡 **Marcado de Expenses Recurrentes**

Para que un expense se replique automáticamente:

```javascript
// En Firebase, agregar este campo a tus expenses:
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

## 📱 **Monitoreo desde GitHub**

### **Ver Estado de Workflows**
1. **Ve a tu repo → Actions**
2. **Verás el estado de cada workflow:**
   - 🟢 Verde: Ejecutado exitosamente
   - 🔴 Rojo: Falló (revisar logs)
   - 🟡 Amarillo: En progreso

### **Ver Reportes Detallados**
1. **Click en cualquier workflow ejecutado**
2. **Ver el "Summary" para estadísticas**
3. **Ver logs detallados en cada step**

### **Ejecutar Manualmente**
1. **Actions → Seleccionar workflow**
2. **"Run workflow" → Configurar parámetros**
3. **Ver ejecución en tiempo real**

## 🚨 **Qué Hacer si Algo Falla**

### **Si falla la Generación Recurrente:**
1. ✅ Verificar que la API esté activa en Render
2. ✅ Verificar que haya expenses con `isRecurring: true`
3. ✅ Revisar logs del workflow en GitHub Actions
4. ✅ Ejecutar manualmente para debugging

### **Si falla el Backup:**
1. ✅ Verificar conectividad con la API
2. ✅ Verificar que Firebase esté respondiendo
3. ✅ Revisar permisos de Firebase
4. ✅ Probar backup manual: `GET /api/backup`

### **Si falla el Monitor de Salud:**
1. ✅ Verificar que Render no haya pausado el servicio
2. ✅ Verificar que la URL del secret sea correcta
3. ✅ Revisar logs de Render para errores

## ⚙️ **Personalización**

### **Cambiar Horarios**
Editar los archivos en `.github/workflows/` y modificar las líneas `cron`:

```yaml
# Ejemplo: Cambiar a día 5 de cada mes a las 10:00 AM UTC
schedule:
  - cron: '0 10 5 * *'
```

### **Cambiar Parámetros**
Modificar los workflows para incluir parámetros específicos como propiedades particulares o rangos de fechas.

## 🎯 **Beneficios de la Automatización**

1. **🔄 Nunca olvides generar egresos recurrentes**
2. **📦 Backups automáticos para seguridad**
3. **🏥 Monitoreo continuo del sistema**
4. **📊 Reportes detallados de cada operación**
5. **⚡ Ejecución confiable sin intervención manual**
6. **🔍 Logs completos para debugging**
7. **📱 Notificaciones visuales en GitHub**

## 🔗 **Enlaces Útiles**

- **API en Render:** https://tu-app.onrender.com
- **GitHub Actions:** Tu repo → Actions tab
- **Configuración:** [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md)
- **Firebase Console:** https://console.firebase.google.com

---

**🏠 Alquileres App Backend v2.0.0 - Automatización Completa**  
*Estructura real + GitHub Actions = Sistema autónomo* 🚀

¡Tu sistema de alquileres ahora funciona completamente solo! 🎉
