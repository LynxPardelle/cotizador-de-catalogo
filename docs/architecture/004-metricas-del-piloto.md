# Métricas del piloto por organización

Decisión del 19 de noviembre de 2026. Se instrumenta el flujo autorizado de CotiTrama en development, sin Stripe ni cambios en otros proyectos. La instrumentación permite observar un piloto; no demuestra por sí sola ahorro, demanda o corrección de errores comerciales.

## Definiciones y alcance

El panel `/piloto` exige administrador y muestra únicamente la organización seleccionada y autorizada por Equipo. El período de 7, 30 o 90 días usa días calendario UTC e incluye el día actual. Las emisiones nuevas confirmadas por el servidor se agrupan por fecha de issuedAt. Consultas, simulaciones y reintentos de la misma emisión no crean otra propuesta ni otra muestra.

El tiempo activo es una **estimación reportada por el navegador**, desde la primera interacción manual con la configuración —o Revisar desglose si no hubo una anterior— hasta el primer intento de emitir. Sólo acumula intervalos con página visible y foco, limitados a 60 segundos desde la última actividad. El reloj es monotónico; no se calcula restando fechas del equipo. [Performance.now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) y [visibilidad de página](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

Los ajustes de configuración cuentan nuevas previsualizaciones exitosas de una configuración comercial distinta después de otra previsualización exitosa dentro del mismo flujo. No se cuentan pulsaciones, inicialización del formulario, llamadas fallidas o repetir la misma configuración. Un ajuste no acredita un error de precio.

Las correcciones declaradas son registros explícitos sobre propuestas emitidas, con categoría cantidad, opciones, catálogo, precio/reglas u otra. No se admiten notas libres. El registro conserva el snapshot y no acredita que se haya emitido una propuesta corregida ni que el problema se haya resuelto. El panel distingue esos registros de los ajustes de configuración, cuenta eventos y propuestas afectadas y evita publicar una tasa con un denominador ambiguo.

El uso histórico incluye emisiones por día y cuentas emisoras identificadas, sin mostrar su identidad. Miembros, catálogos activos, plan y consumo mensual proceden de las APIs de consumo existentes y se etiquetan como una fotografía actual, no como un promedio del período elegido.

## Captura, integridad y conservación

`pilot` es opcional al emitir: flowId UUID efímero del flujo, activeDurationMs entero entre cero y ocho horas, y adjustments entero entre cero y mil. No hay identificador persistente del dispositivo, correo, notas ni un evento por cada interacción. El tracker vive en memoria y se descarta al terminar el flujo, destruir la pantalla o cambiar sesión/organización. No se ejecuta durante SSR.

La primera tentativa congela la medición del cliente para sus reintentos con el mismo contenido y clave. Si después de un intento fallido se edita el contenido comercial, la nueva propuesta abre otro flujo desde esa edición, sin arrastrar el tiempo ni los ajustes congelados del anterior. El hash idempotente comercial excluye pilot: la primera emisión confirmada conserva su medición y una repetición válida no la sustituye. Cambiar productos, cantidades, catálogo, revisión o moneda con la misma clave sigue produciendo conflicto. Snapshot, medición opcional e incremento de cuota se guardan juntos; un fallo no deja una muestra sin propuesta.

La cuenta emisora se deriva en servidor y se guarda como clave seudónima privada del registro, fuera del snapshot que devuelve la API de propuesta. El panel devuelve únicamente su recuento y cobertura; una cuenta con múltiples emisiones cuenta una vez. Los registros anteriores sin ese dato no se convierten en emisores identificados ficticios.

El registro de corrección recibe correctionId UUID y reason de una lista fija. La transacción comprueba la existencia de la propuesta en la organización y guarda evento más idempotencia. Repetir la misma solicitud devuelve el registro original; reutilizar el identificador con otra categoría produce conflicto. El registro no consume cuota de propuestas ni modifica sus importes.

## API y permisos

- GET `/api/v1/quotes/metrics?days=7|30|90`: administrador; devuelve ventana UTC, emisiones, serie diaria, cobertura de emisores, media/p50 de tiempo, muestra/ausentes, ajustes y correcciones declaradas por categoría.
- POST `/api/v1/quotes/{quoteId}/corrections`: administrador o vendedor; lector recibe rechazo. Una propuesta ajena a la organización devuelve recurso inexistente.

La organización y el rol proceden de Equipo con la pertenencia vigente; no se toman del body ni del filtro. Todas las respuestas comerciales llevan no-store. El frontend descarta respuestas de otra organización, sesión, rango o generación. Una sesión expirada no conserva visibles los datos privados del panel o de la propuesta.

## Cobertura y límites de interpretación

La media y la mediana usan sólo propuestas con pilot válido. Se muestran simultáneamente emisiones totales, muestra instrumentada y mediciones ausentes. Una duración reportada de cero es válida y se distingue de no haber medición. Las propuestas anteriores siguen contando en el uso sin recibir tiempos o ajustes inventados. Las correcciones declaradas se filtran por su fecha de registro; pueden referirse a una propuesta emitida antes del período.

Las consultas son fuertes y paginadas dentro de la partición de Cotizaciones de la organización, sin Scan global, tabla compartida entre dominios ni servicio de telemetría por clic. El piloto actual consulta los registros históricos para incluir los anteriores sin metadatos. Se comparte un presupuesto de 100 páginas, 30,000 registros y seis segundos entre las dos consultas, comprobado entre lecturas. Superarlo devuelve 503 METRICS_LIMIT sin resultados parciales; el plazo no interrumpe una petición SDK en curso. Medir latencia y volumen antes de ofrecer historial grande; una proyección o fila temporal compacta con migración explícita puede optimizarlo sin omitir las propuestas anteriores.

La verificación separa metadatos controlados de QA —por ejemplo, 60 y 120 segundos para comprobar una media de 90— de mediciones observadas por el navegador. Una cuenta sintética no es un cliente ni una medición de productividad humana. El piloto comercial con personas y datos autorizados continúa pendiente; el resultado técnico se registra en `docs/verificacion.md`.
