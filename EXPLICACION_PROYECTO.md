# EXPLICACIÓN DEL PROYECTO APORTA

## 1. ¿Qué es Aporta?

Aporta es una aplicación web para organizar el trabajo de un equipo y convertir cada responsabilidad en una participación clara, medible y demostrable.

El sistema permite:

- registrar integrantes y diferenciar administradores de integrantes;
- crear actividades con una fecha límite;
- definir los entregables esperados;
- dividir el trabajo en contribuciones individuales;
- valorar automáticamente cada contribución según su tipo, alcance y complejidad;
- registrar evidencias del trabajo realizado;
- observar una entrega cuando existe un problema verificable;
- calcular la participación individual y relativa de cada integrante;
- conservar un historial de acciones y resultados de cierre.

La idea principal es que la participación no dependa únicamente de una apreciación subjetiva. Cada persona recibe responsabilidades concretas, cada responsabilidad tiene un valor explicado y el trabajo solo se considera efectivo cuando se registra una evidencia.

## 2. Conceptos principales

### Actividad

Es el trabajo general que realizará el equipo. Por ejemplo: elaborar una encuesta, preparar un informe o desarrollar una presentación.

Cada actividad tiene nombre, descripción, fecha límite, estado y una versión de cierre. Puede estar:

- **Pendiente:** todavía admite entregables, contribuciones, evidencias y cambios.
- **Culminada:** alcanzó su fecha límite y sus resultados quedaron guardados.

### Entregable

Es un producto esperado dentro de una actividad, como un documento, Excel, encuesta, presentación, PDF, video o formulario. Es opcional: una actividad puede tener contribuciones aunque todavía no se haya definido un entregable.

### Contribución

Es una responsabilidad concreta asignada a una persona. Incluye:

- descripción del trabajo;
- responsable;
- entregable relacionado, si corresponde;
- tipo de tarea;
- alcance;
- complejidad;
- valor calculado;
- estado y evidencias.

Una contribución puede estar **Pendiente**, **Entregada** u **Observada**.

### Evidencia

Es la prueba de que la contribución se realizó. Puede ser:

- archivo;
- enlace;
- referencia;
- texto;
- participación presencial.

### Observación

Es un reporte sobre una contribución entregada cuya evidencia falta, no corresponde o no puede comprobarse. No es una eliminación automática: un administrador debe revisarla y decidir si la confirma o la descarta.

### Resultado

Es el resumen de puntos y porcentajes obtenidos por cada integrante dentro de una actividad. Mientras la actividad está abierta es provisional; cuando se cierra se guarda como resultado final de una versión concreta.

## 3. Acceso, identidad y permisos

Aporta se publica como una aplicación web de Google Apps Script y se ejecuta con la cuenta de Google de la persona que accede.

El flujo de acceso es el siguiente:

1. Google identifica la cuenta que abrió la aplicación.
2. Apps Script obtiene su correo mediante `Session.getActiveUser().getEmail()`.
3. El sistema busca ese correo en la hoja `INTEGRANTES`.
4. Solo permite continuar si el registro existe y está activo.
5. El rol registrado determina si la persona es **Administrador** o **Integrante**.

Ocultar botones en la interfaz no es la única protección. Todas las operaciones sensibles vuelven a comprobar el usuario y su rol en Apps Script. Por ejemplo, aunque alguien intentara llamar manualmente a la función para crear una actividad, el servidor ejecutaría `requireAdmin_()` y rechazaría la operación si no es administrador.

Cuando un administrador registra a una persona activa, Aporta también intenta compartir con ella la hoja de cálculo y la carpeta de evidencias. Cuando la desactiva o cambia su correo, retira ese acceso. Los integrantes desactivados conservan su historial, pero ya no pueden ingresar.

Por seguridad, Aporta obliga a conservar al menos un administrador activo y no permite que un administrador desactive la cuenta que está utilizando en ese momento.

> Nota de acceso: Google Apps Script puede presentar problemas cuando una misma sesión del navegador mantiene varias cuentas de Google abiertas. En ese caso, debe utilizarse una sesión con una sola cuenta o una ventana de incógnito.

## 4. Diferencias entre roles

| Función | Administrador | Integrante |
|---|:---:|:---:|
| Ver Inicio | Sí | Sí |
| Ver actividades y su detalle | Sí | Sí |
| Ver resultados | Sí | Sí |
| Ver evidencias y observaciones | Sí | Sí |
| Registrar evidencia propia | Sí | Sí |
| Registrar evidencia de otra persona | Sí | No |
| Observar una entrega ajena | Sí | Sí |
| Crear actividades | Sí | No |
| Crear entregables | Sí | No |
| Asignar contribuciones | Sí | No |
| Reasignar o dividir contribuciones | Sí | No |
| Cambiar el plazo o reabrir una actividad | Sí | No |
| Revisar observaciones | Sí | No |
| Administrar integrantes y roles | Sí | No |

El administrador dispone de la vista adicional **Equipo** y de botones de gestión dentro de Inicio, Actividades y el detalle de cada actividad. El integrante solo ve Inicio, Actividades y Resultados.

## 5. Vista Inicio

Inicio funciona como un resumen personal. Su contenido se adapta al usuario autenticado.

### Encabezado

Muestra el nombre, las iniciales y el rol de la cuenta actual. El saludo utiliza el primer nombre y cambia según la hora del día.

### Tarjeta de resumen

Informa si la persona tiene contribuciones pendientes. Si el usuario es administrador, también muestra el botón **Nueva actividad**.

### Indicadores

- **Actividades abiertas:** cantidad de actividades cuyo estado actual es `Pendiente`.
- **Mis pendientes:** contribuciones vigentes asignadas al usuario cuyo estado es `Pendiente`.
- **Mis entregas:** contribuciones vigentes asignadas al usuario cuyo estado es `Entregado`.

Una contribución `Observada` no se cuenta como pendiente ni como entregada hasta que se registre una corrección.

### Próximos cierres

Muestra hasta cinco actividades, ordenadas por fecha límite. Desde cada elemento se puede abrir el detalle de la actividad.

### Mi trabajo

Muestra hasta cinco contribuciones asignadas a la persona, también ordenadas por la fecha límite de su actividad. Indica la descripción, la actividad y el valor en puntos. Mientras la actividad siga abierta aparece el botón para registrar evidencia.

## 6. Vista Actividades

Esta vista presenta todas las actividades del equipo mediante tarjetas.

Cada tarjeta muestra:

- estado;
- identificador;
- nombre y descripción;
- cantidad de entregables;
- cantidad de contribuciones vigentes;
- fecha de cierre;
- acceso al detalle.

Si todavía no existen actividades, aparece el estado vacío **Crea la primera actividad**. Para el administrador se muestra además el botón **Nueva actividad**; el integrante puede consultar las actividades, pero no crearlas.

### Crear una actividad

El administrador registra:

- nombre;
- descripción opcional;
- fecha y hora límite futura.

El servidor valida los datos, genera un identificador correlativo, guarda la actividad con estado `Pendiente` y registra la acción en el historial.

## 7. Detalle de una actividad

Al abrir una actividad se muestra toda su información operativa en un solo lugar.

### Cabecera

Incluye estado, identificador, nombre, descripción y fecha límite. El administrador puede:

- cambiar el plazo si la actividad está abierta;
- reabrirla si está culminada;
- agregar entregables;
- asignar contribuciones.

Los botones para crear entregables y contribuciones solo aparecen mientras la actividad se encuentre abierta.

### Entregables

Cada entregable muestra tipo, nombre, descripción y enlace principal, si lo tiene. El enlace debe comenzar con `http://` o `https://`.

### Contribuciones

Cada contribución muestra:

- identificador y estado;
- descripción y tipo;
- responsable;
- valor en puntos;
- explicación de la valoración;
- enlaces o referencias de evidencia;
- observaciones relacionadas;
- acciones disponibles según el usuario, el estado y el plazo.

### Acciones sobre una contribución

#### Registrar evidencia

Puede hacerlo el responsable o un administrador mientras la actividad esté abierta. Al registrarla:

1. se crea una fila en `EVIDENCIAS`;
2. la contribución cambia a `Entregado`;
3. se registra la fecha de entrega;
4. se añade el movimiento al historial;
5. si existía una observación confirmada, se marca como resuelta.

Los archivos tienen un límite de 5 MB. Para los archivos, Aporta crea una estructura dentro de Drive por actividad y entregable. Para un enlace se exige una URL válida; para referencia, texto o presencial se exige una descripción.

Registrar varias evidencias para una misma contribución no multiplica sus puntos: el valor de la responsabilidad se cuenta una sola vez.

#### Observar

Cualquier usuario puede observar una contribución entregada de otra persona mientras la actividad siga abierta. No puede observar su propia contribución ni crear una segunda observación abierta sobre la misma responsabilidad.

El motivo debe describir un problema verificable y tener al menos 10 caracteres. La observación se crea con estado `Reportada`.

El administrador puede:

- **Confirmarla:** la observación pasa a `Confirmada` y la contribución a `Observado`. Sus puntos dejan de ser efectivos provisionalmente.
- **Descartarla:** la observación pasa a `Descartada` y la entrega conserva su validez.

Cuando el responsable vuelve a registrar evidencia sobre una contribución observada, esta regresa a `Entregado` y la observación confirmada pasa a `Resuelta`.

#### Reasignar

Solo el administrador puede reasignar una contribución. La operación se permite cuando:

- la actividad está abierta;
- la contribución sigue pendiente;
- no tiene evidencia;
- no tiene una observación abierta;
- el nuevo responsable está activo y es distinto del actual.

Si ya existe trabajo registrado, debe utilizarse **Dividir** para no atribuir todo el trabajo a una persona nueva.

#### Dividir

Permite representar un trabajo realizado parcialmente por una persona y continuado por otra. Siempre produce exactamente dos contribuciones nuevas y marca la original como no vigente.

El valor total original se conserva. Para ello, el sistema calcula primero un valor bruto para cada parte y reparte proporcionalmente los puntos originales:

```text
valor_parte_1 = valor_original × bruto_parte_1 / (bruto_parte_1 + bruto_parte_2)
valor_parte_2 = valor_original - valor_parte_1
```

Los valores se redondean a dos decimales y la segunda parte absorbe la diferencia de redondeo. Por ello, la suma siempre coincide con el valor original y dividir una tarea no infla los puntos de la actividad.

Si la contribución original ya tenía evidencia, esa evidencia pasa a la primera parte y su responsable original debe mantenerse como responsable de dicha parte. La primera parte queda `Entregada` y la segunda `Pendiente`.

### Historial reciente

El detalle muestra hasta doce movimientos relacionados con la actividad, sus entregables o contribuciones. Incluye creación, asignación, entrega, observaciones, reasignación, división, cambio de plazo, reapertura y cierre.

## 8. Vista Resultados

Resultados contiene la matriz de participación. El selector superior permite elegir una actividad.

La pantalla muestra, por integrante:

- puntos efectivos y puntos asignados;
- participación individual;
- participación relativa;
- una barra visual del cumplimiento individual.

El resultado se etiqueta como:

- **Provisional:** la actividad continúa abierta y se calcula en tiempo real.
- **Final:** la actividad está culminada y se lee de la versión de cierre almacenada.

## 9. Cálculo del valor de una contribución

El valor se calcula con tres componentes:

```text
valor = mínimo(10, valor_base + nivel_de_alcance + nivel_de_complejidad)
```

### Alcance

| Nivel | Valor agregado |
|---|---:|
| Pequeño | 0 |
| Medio | 1 |
| Amplio | 2 |
| Excepcional | 3 |

### Complejidad

| Nivel | Valor agregado |
|---|---:|
| Básica | 0 |
| Estructurada | 1 |
| Analítica o técnica | 2 |

### Valores base por tipo de tarea

| Tipo | Base |
|---|---:|
| Recolección de datos | 2 |
| Revisión | 2 |
| Redacción | 3 |
| Resolución de preguntas | 3 |
| Gráficos y visualización | 3 |
| Presentación | 3 |
| Diseño gráfico | 3 |
| Exposición | 3 |
| Trabajo de campo | 3 |
| Coordinación demostrable | 3 |
| Investigación | 4 |
| Diseño de instrumento | 4 |
| Excel y datos | 4 |
| Consolidación | 4 |
| Análisis e interpretación | 5 |

La fórmula se calcula primero en la interfaz para mostrar una vista previa, pero el servidor vuelve a calcularla antes de guardar. De este modo, no es posible alterar el puntaje modificando únicamente el navegador.

### Ejemplo

Una contribución de **Investigación** tiene base 4. Si su alcance es amplio (`+2`) y su complejidad es analítica (`+2`):

```text
4 + 2 + 2 = 8 puntos
```

Si una combinación supera los 10 puntos, el valor final se limita a 10.

## 10. Cálculo de la matriz de participación

Los cálculos se realizan por actividad y solo consideran contribuciones vigentes.

### Valor asignado

Es la suma de los puntos de todas las contribuciones vigentes asignadas a una persona:

```text
valor_asignado = suma de los valores de sus contribuciones
```

### Valor efectivo

Es la suma de los puntos de sus contribuciones cuyo estado es exactamente `Entregado`:

```text
valor_efectivo = suma de los valores entregados
```

Las contribuciones pendientes u observadas aportan cero al valor efectivo.

### Participación individual

Representa el cumplimiento de las responsabilidades asignadas a la propia persona:

```text
participación_individual = valor_efectivo / valor_asignado × 100
```

Ejemplo: una persona recibió 10 puntos y entregó correctamente 8:

```text
8 / 10 × 100 = 80 %
```

Si no tiene puntos asignados, el porcentaje aparece como **N/C** porque no es calculable.

### Participación relativa

Representa cuánto del trabajo efectivo total del equipo produjo esa persona:

```text
participación_relativa = valor_efectivo_persona / valor_efectivo_equipo × 100
```

Ejemplo: el equipo produjo 20 puntos efectivos y una persona produjo 8:

```text
8 / 20 × 100 = 40 %
```

Si nadie ha entregado trabajo, la participación relativa aparece como **N/C**.

Para que la suma sea exactamente `100,00 %`, Aporta trabaja internamente con unidades de centésima de porcentaje. Primero asigna la parte entera de cada cálculo y luego distribuye las centésimas restantes según los mayores residuos decimales. Si existe un empate, utiliza el identificador del integrante para mantener un resultado determinista.

### Ejemplo completo

| Integrante | Asignado | Efectivo | Individual | Relativa |
|---|---:|---:|---:|---:|
| Persona A | 10 | 8 | 80,00 % | 61,54 % |
| Persona B | 5 | 5 | 100,00 % | 38,46 % |

El equipo produjo 13 puntos efectivos. La participación relativa se distribuye usando esos 13 puntos, mientras que la individual compara a cada persona únicamente con lo que se le asignó.

## 11. Cierre, reapertura y versiones

Cada vez que se abre la aplicación, el servidor revisa las fechas límite. Si una actividad venció y todavía no está culminada:

1. descarta las observaciones que quedaron solamente `Reportadas` y nunca fueron confirmadas;
2. calcula la matriz de participación;
3. guarda una fila de resultado por integrante;
4. incrementa la versión de cierre;
5. marca la actividad como `Culminada`;
6. registra el cierre en el historial.

La función pública `closeExpiredActivities()` también permite ejecutar esa sincronización manualmente o desde un activador temporal configurado aparte. El proyecto actual no crea automáticamente ese activador durante la instalación; la comprobación garantizada ocurre al abrir la aplicación.

Cuando un administrador reabre una actividad:

- debe elegir una nueva fecha futura;
- el resultado de la versión anterior se conserva;
- la actividad vuelve a `Pendiente`;
- los resultados visibles vuelven a ser provisionales;
- el próximo cierre crea una versión nueva sin sobrescribir la anterior.

La interfaz muestra como resultado final la versión de cierre más reciente, mientras que las versiones anteriores permanecen almacenadas en la hoja `RESULTADOS`.

## 12. Vista Equipo — solo administrador

Esta vista muestra nombre, correo, rol, estado y opción de edición para cada persona.

El administrador puede:

- agregar integrantes;
- modificar nombre y correo;
- cambiar entre `Integrante` y `Administrador`;
- activar o desactivar cuentas.

El correo debe ser único. Al desactivar una persona no se eliminan sus actividades, contribuciones, evidencias, resultados ni historial. Esto conserva la trazabilidad del proyecto.

Los integrantes no reciben los correos del resto dentro de los datos enviados a la interfaz y no pueden acceder a la vista Equipo.

## 13. Datos almacenados en Google Sheets

La hoja de cálculo funciona como base de datos. Aporta administra las siguientes pestañas:

| Pestaña | Contenido |
|---|---|
| `INTEGRANTES` | Identidad, correo, rol, estado y fecha de alta. |
| `ACTIVIDADES` | Actividades, fechas límite, estado y versiones de cierre. |
| `ENTREGABLES` | Productos relacionados con cada actividad. |
| `CONTRIBUCIONES` | Responsables, valoración, estados, divisiones y fechas de entrega. |
| `EVIDENCIAS` | Tipo, enlace, archivo de Drive, descripción, autor y fecha. |
| `OBSERVACIONES` | Motivo, estado, revisión, confirmación y resolución. |
| `HISTORIAL` | Bitácora cronológica de acciones y detalle serializado. |
| `CONFIGURACION_VALORACION` | Reglas de valoración, bases, versiones y estado activo. |
| `RESULTADOS` | Matrices definitivas guardadas por actividad y versión de cierre. |
| `CONFIGURACION` | Versión del esquema, zona horaria y contadores correlativos. |

La pestaña `REPORTE` que existía antes de configurar el sistema se conserva, pero actualmente no es administrada ni utilizada por el código. No se elimina ni se sobrescribe.

Los identificadores se generan mediante contadores guardados en `CONFIGURACION`, con formatos como `ACT-0001`, `CTR-0001` o `EVI-0001`.

## 14. Archivos almacenados en Google Drive

Cuando la evidencia es un archivo, Aporta la guarda dentro de la carpeta de evidencias existente con esta organización:

```text
Evidencias/
└── ACT-0001 - Nombre de la actividad/
    ├── ENT-0001 - Nombre del entregable/
    │   └── CTR-0001__fecha-hora__archivo.ext
    └── _General/
        └── CTR-0002__fecha-hora__archivo.ext
```

`_General` se usa cuando la contribución no está asociada a un entregable. Los nombres se limpian para evitar caracteres incompatibles con Drive y se limitan a una longitud segura.

La carpeta `Reportes` está vinculada en la configuración para uso futuro, pero la versión actual todavía no genera documentos dentro de ella.

## 15. Funcionamiento dentro del código

### Flujo general

```text
Navegador
   ↓
Index.html + Styles.html + Scripts.html
   ↓ google.script.run
Funciones api... de Code.gs
   ↓
Servicios de negocio y validación
   ↓
Repository.gs
   ↓
Google Sheets y Google Drive
```

1. `doGet()` prepara y entrega `Index.html`.
2. `Index.html` define las vistas, formularios y ventanas modales.
3. `Styles.html` contiene la presentación visual y el diseño adaptable.
4. `Scripts.html` carga los datos, controla la navegación, renderiza las vistas y envía las acciones al servidor mediante `google.script.run`.
5. `Code.gs` expone una función `api...` por cada acción disponible.
6. Los servicios autentican al usuario, validan permisos y ejecutan las reglas de negocio.
7. `Repository.gs` traduce los objetos del sistema a filas de Google Sheets.
8. Después de cada cambio, el servidor devuelve nuevamente los datos actualizados y la interfaz se vuelve a renderizar.

### Responsabilidad de cada archivo

| Archivo | Función principal |
|---|---|
| `Code.gs` | Entrada de la aplicación y API entre navegador y servidor. |
| `Config.gs` | Configuración, esquemas de hojas y reglas iniciales de valoración. |
| `AppService.gs` | Carga general, autenticación, resumen y creación de actividades. |
| `FeatureService.gs` | Integrantes, entregables, contribuciones y evidencias. |
| `EvaluationService.gs` | Fórmula de valoración y validación de niveles. |
| `AssignmentService.gs` | Reasignación y división proporcional de contribuciones. |
| `ObservationService.gs` | Reporte, revisión y resolución de observaciones. |
| `LifecycleService.gs` | Cierre, reapertura, versiones y matriz de participación. |
| `DriveService.gs` | Validación y almacenamiento de archivos en Drive. |
| `Repository.gs` | Lectura, escritura, actualización e identificadores en Sheets. |
| `SetupService.gs` | Reutilización segura de los recursos existentes y compatibilidad. |
| `Verification.gs` | Verificación técnica de que la instalación está lista. |
| `Index.html` | Estructura de vistas y formularios. |
| `Scripts.html` | Interacción, navegación y representación de los datos. |
| `Styles.html` | Estilos visuales. |
| `appsscript.json` | Zona horaria, ejecución de la aplicación y permisos de Google. |

### Datos de carga inicial

`apiGetBootstrap()` devuelve en una sola respuesta:

- usuario actual;
- resumen personal;
- actividades;
- entregables;
- contribuciones;
- integrantes visibles;
- reglas de valoración;
- evidencias;
- observaciones;
- historial reciente;
- matrices provisionales o finales.

Esto permite que la navegación entre las vistas principales sea rápida y no necesite recargar la página completa en cada clic.

### Concurrencia y consistencia

Las operaciones que modifican datos utilizan `LockService.getScriptLock()`. El bloqueo evita que dos usuarios escriban simultáneamente y generen identificadores repetidos o cambios incompatibles.

Si falla la escritura de una evidencia después de crear el archivo en Drive, el código envía ese archivo a la papelera para evitar archivos huérfanos.

Los textos se limpian y limitan en el servidor, las fechas se validan, los correos se normalizan a minúsculas y los enlaces se comprueban antes de guardarse.

### Alcance de la seguridad actual

Las validaciones de rol descritas en este documento protegen las operaciones realizadas a través de la aplicación. Sin embargo, debido a que la aplicación se ejecuta con la identidad del usuario, los integrantes activos reciben acceso de edición a la hoja de cálculo y a la carpeta de evidencias para que Apps Script pueda trabajar con esos recursos en su nombre.

Por ello, la versión actual es apropiada para un equipo académico de confianza, pero no constituye una base de datos resistente a manipulaciones directas: una persona con acceso podría abrir Google Sheets y modificar filas fuera de Aporta. Si en el futuro se requiere un entorno más estricto, habrá que separar el almacenamiento de los permisos directos de los integrantes o incorporar una capa de datos controlada exclusivamente por el propietario.

## 16. Configuración e instalación

El proyecto local se sincroniza con Google Apps Script mediante `clasp`. `.clasp.json` contiene la vinculación con el proyecto, mientras que las credenciales de autenticación quedan fuera de Git.

La instalación actual reutiliza:

- la hoja de cálculo existente;
- la carpeta de evidencias existente;
- la carpeta de reportes existente.

Antes de modificar una hoja existente, `SetupService.gs` compara sus encabezados con el esquema esperado. Las pestañas ajenas al sistema se conservan; una pestaña administrada con datos y estructura incompatible detiene la configuración para evitar sobrescrituras accidentales.

`setupAporta()` está reservado para una instalación nueva. Si encuentra recursos existentes de Aporta, se detiene y exige utilizar el flujo de inspección y reutilización.

## 17. Recorrido normal de uso

1. El administrador registra a los integrantes.
2. Crea una actividad y define su fecha límite.
3. Agrega los entregables esperados, si son necesarios.
4. Divide el trabajo en contribuciones concretas.
5. Selecciona responsable, tipo, alcance y complejidad para cada contribución.
6. El sistema calcula y explica el valor de cada responsabilidad.
7. Cada integrante consulta sus pendientes desde Inicio.
8. El responsable registra evidencia de su trabajo.
9. El equipo puede revisar las evidencias y reportar problemas verificables.
10. El administrador resuelve las observaciones y ajusta responsabilidades si corresponde.
11. Resultados muestra la matriz provisional durante el desarrollo.
12. Al vencer el plazo, Aporta guarda la matriz definitiva.

## 18. Estado visual actual

Las capturas iniciales muestran los estados vacíos porque todavía no existen actividades, entregables ni contribuciones. Es el comportamiento esperado de una instalación recién configurada.

Actualmente algunos encabezados se perciben duplicados porque existe un título general en la barra superior y otro título dentro de la propia vista. Es un detalle visual conocido y pendiente de simplificación; no afecta los permisos, los cálculos ni los datos.
