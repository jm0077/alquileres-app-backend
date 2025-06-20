# 🔐 Configuración de Secrets para GitHub Actions

Para que los workflows funcionen correctamente, necesitas configurar estos secrets en tu repositorio de GitHub:

## 📋 Secrets Requeridos

### `ALQUILERES_API_URL`
**Descripción:** URL base de tu API desplegada en Render  
**Valor:** `https://tu-app-alquileres.onrender.com`  
**Ejemplo:** `https://alquileres-backend-abc123.onrender.com`

## 🛠️ Cómo Configurar los Secrets

1. **Ve a tu repositorio en GitHub**
2. **Click en "Settings"** (Configuración)
3. **En el menú lateral, click en "Secrets and variables"**
4. **Click en "Actions"**
5. **Click en "New repository secret"**
6. **Agrega cada secret:**

### Secret 1: ALQUILERES_API_URL
```
Name: ALQUILERES_API_URL
Secret: https://tu-app-en-render.onrender.com
```

## 🔍 Verificar la URL de tu API

Para encontrar la URL correcta de tu API en Render:

1. **Ve a tu dashboard de Render**
2. **Click en tu servicio de alquileres-app-backend**
3. **Copia la URL que aparece en la parte superior**
4. **Esa es la URL que debes usar (sin "/" al final)**

Ejemplo de URL válida:
```
https://alquileres-app-backend-xyz.onrender.com
```

## 🧪 Probar la Configuración

Una vez configurado el secret, puedes probar que funciona:

1. **Ve a la pestaña "Actions" de tu repositorio**
2. **Click en "Generate Recurring Expenses"**
3. **Click en "Run workflow"**
4. **Deja las opciones por defecto y click "Run workflow"**

Si está bien configurado, debería:
- ✅ Conectarse a tu API
- ✅ Generar egresos recurrentes  
- ✅ Mostrar estadísticas en el summary

## 📅 Programación de los Workflows

### Generación Recurrente
- **Automático:** Día 1 de cada mes a las 2:00 AM UTC
- **Manual:** Desde la pestaña Actions cuando quieras

### Backup Automático  
- **Automático:** Día 28 de cada mes a las 23:00 UTC
- **Manual:** Desde la pestaña Actions cuando quieras

## 🔧 Personalización

Si quieres cambiar la programación, edita los archivos:
- `.github/workflows/generate-recurring.yml` (línea 6-7)
- `.github/workflows/backup-automatic.yml` (línea 6-7)

### Formato Cron:
```
'0 2 1 * *'  = Día 1 de cada mes a las 2:00 AM
'0 23 28 * *' = Día 28 de cada mes a las 23:00 PM
```

## ⚠️ Notas Importantes

1. **Zona Horaria:** Los workflows usan UTC. Si estás en Perú (UTC-5), las 2:00 AM UTC = 9:00 PM del día anterior en Perú.

2. **API Activa:** Asegúrate de que tu API en Render esté siempre activa o configure auto-wake.

3. **Validación:** Los workflows incluyen validación de errores y reportes detallados.

4. **Logs:** Todos los logs están disponibles en la pestaña Actions de GitHub.

## 🎯 Estado de los Workflows

Una vez configurado, verás en GitHub Actions:
- 🟢 Verde: Todo funcionó correctamente
- 🔴 Rojo: Hubo un error (revisar logs)
- 🟡 Amarillo: En progreso

¡Con esto tendrás automatización completa de tu sistema de alquileres! 🚀
