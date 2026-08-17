# Aporta

Aplicación web para registrar contribuciones y calcular la participación de un equipo universitario mediante evidencias y reglas explicables.

## Vinculación con Google Apps Script

El repositorio conserva el Script ID en `.clasp.json`, pero nunca almacena las
credenciales de `clasp`. Para sincronizar el código se utiliza `clasp push`.

## Configuración con recursos existentes

1. Ejecutar `inspectAportaResources` para localizar los recursos de la cuenta.
2. Ejecutar `previewAportaResourceCompatibility` con los IDs encontrados.
3. Si la vista previa indica `compatible: true`, ejecutar
   `configureAportaWithExistingResources` con los mismos IDs.
4. Desplegar como aplicación web ejecutada por el usuario que accede y limitada
   a usuarios con cuenta de Google.

Esta ruta reutiliza `Aporta - Base de Datos`, `Evidencias` y `Reportes`. Conserva
la pestaña `REPORTE`, agrega únicamente las pestañas administradas que falten y
no modifica una pestaña administrada si detecta encabezados incompatibles.

`setupAporta` se reserva para instalaciones nuevas. Si detecta recursos Aporta
existentes, se detiene antes de crear otros y obliga a usar la ruta de
reutilización.

## Estado actual

La aplicación permite:

- inicializar Sheets, Drive y el primer administrador;
- administrar integrantes y permisos sin eliminar su historial;
- crear actividades y entregables opcionales;
- asignar contribuciones con valoración automática de hasta 10 puntos;
- registrar evidencias como archivo, enlace, referencia, texto o participación presencial;
- reportar y resolver observaciones verificables;
- reasignar tareas pendientes o dividir trabajo parcial sin inflar su valor;
- cerrar y reabrir actividades conservando cada resultado histórico;
- calcular participación individual y relativa con desglose;
- consultar responsabilidades, valores, evidencias e historial desde cada actividad.

El cierre se revisa cada vez que se abre la aplicación. Los resultados definitivos se conservan en la hoja `RESULTADOS` y los provisionales se calculan en tiempo real.

## Cierre periódico opcional

Para culminar actividades aunque nadie abra la aplicación, el propietario puede
crear una vez un activador desde **Apps Script → Activadores → Añadir activador**:

- función: `closeExpiredActivities`;
- origen del evento: basado en tiempo;
- tipo: temporizador por minutos;
- intervalo recomendado: cada 15 minutos.

Se configura manualmente para no solicitar a todos los integrantes el permiso
amplio de administración de activadores. La función conserva el bloqueo, las
versiones y la protección contra cierres duplicados.
