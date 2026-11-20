# CotiTrama: aceptación de development en AWS

Verificado el 19 de noviembre de 2026. URL pública: **https://cotitrama-dev.lynxpardelle.com**. Testing y producción no se promovieron; los demás proyectos no recibieron cambios.

## Última entrega de runtime: gestión privada de solicitudes

Panel privado: **https://cotitrama-dev.lynxpardelle.com/piloto/solicitudes**. Runtime **2bd574380a1f2523d5ed1835df82e67b98d4e63e**, con SourceCommit coincidente y stack UPDATE_COMPLETE. Su [CI](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44647502115) terminó correctamente. Los commits posteriores de evidencia no cambian el runtime.

ApplicationsFunction ofrece revisión manual e historial transaccional sobre InterestTable. La cuenta designada se registró por sí misma; se comprobó habilitada, CONFIRMED y con correo verificado antes de asignar el grupo específico de operador mediante la herramienta operativa. Tras la aceptación y limpieza se verificaron otra vez ese permiso, su perfil propio y su pertenencia de administrador a su organización. No se incorporan correos o identificadores personales al repositorio.

Validación local: **250 pruebas correctas** (158 servicios/herramientas, 90 Angular y dos de empaquetado), build SSR completo, invocación del paquete Lambda incluyendo `/piloto/solicitudes` y lint CloudFormation/SAM correctos. Una revisión independiente comprobó permisos, conservación del original/TTL, paginación y límites de limpieza sintética. Se reprodujeron y corrigieron cambios de filtro durante cargas, 404 definitivo, denegaciones tardías de lecturas paralelas y expiración de sesión; la interfaz conserva la edición en conflictos y congela el payload en reintentos ambiguos.

El build inicial mide 371.71 kB, con transferencia estimada de 100.28 kB. SAM compiló las ocho funciones. El changeset añadió diez recursos propios, sin eliminaciones ni reemplazos de tablas/pool. Los cambios de las cuatro tablas fueron únicamente etiquetas. La plantilla conserva cuatro tablas y ahora siete alarmas; todas terminaron en OK. El TTL de InterestTable continúa ENABLED sobre expiresAt.

### Aceptación AWS de solicitudes

`tools/applications-smoke.mjs --verify` completó cinco bloques con una solicitud ficticia y tres cuentas sintéticas creadas con correo suprimido:

1. Recepción por el endpoint público, journaling previo al envío y replay idéntico con un solo recibo. Persistencia del formulario original, autorización y deadline de noventa días comprobados por IAM.
2. Las cinco rutas privadas rechazan al anónimo con 401. Dos administradores de organizaciones propias reciben 403 en las cinco operaciones, aunque su envelope incluya grupos de operador y una organización falsificados.
3. Asignar y retirar el grupo dedicado modifica la autorización del siguiente acceso. La revocación se comprobó con el mismo envelope IAM conservando claims anteriores; esta prueba de negocio no se presenta como una revocación observada en navegador con JWT real.
4. La bandeja paginada alcanza el registro histórico sin review como Recibida/v0, con detalle original e historial vacío. El listado omite correo y notas y conserva su presupuesto de lectura y continuación explícita.
5. PATCH v0 → v1, replay idéntico sin otro evento, payload cambiado con el mismo identificador → 409 y dos revisiones concurrentes de v1 → un 200 y un 409 REVIEW_CONFLICT. Quedan exactamente v2/v1 en el historial. Otra edición obsoleta se rechaza. Formulario, consentimiento, hash, estado público, deadline y recibo siguen intactos.

Estos bloques invocan Lambdas desplegadas por IAM con envelopes HTTP API v2 sintéticos; las denegaciones anónimas y la recepción usan la URL pública. No son una prueba de carga, un agotamiento de las 200 recepciones diarias ni una observación del piloto humano.

### Navegador con JWT real y persistencia

La sesión existente de la cuenta real designada se renovó mediante el flujo PKCE y el SSO normal de Cognito, sin leer ni introducir su contraseña o código. El panel abrió con acceso de operador a través de CloudFront/HTTP API y JWT real. Todas las escrituras de aceptación se limitaron a la solicitud ficticia:

- Abrir detalle mostró el formulario original, el contacto ficticio, la autorización, el vencimiento y los eventos v2/v1.
- Con un borrador de estado Por aclarar, fecha 2026-11-25 y nota interna, el helper avanzó la revisión a v3. Guardar desde la pantalla produjo el conflicto esperado y conservó los tres campos. La recarga explícita mostró v3 antes de permitir una nueva edición.
- Guardar creó v4 con estado, fecha y nota. Tras recargar la página, la lista conservó la fecha y el detalle reabierto conservó v4 y su historial.
- Retirar la fecha produjo v5 y dejó el movimiento 2026-11-25 → Sin fecha en el historial. `--verify-browser` comprobó la persistencia, la nota y la conservación del original y de los deadlines en DynamoDB.
- El filtro Recibida excluyó la solicitud revisada; Por aclarar la incluyó. No se observaron errores en el registro de consola durante este recorrido.

### Limpieza y estado final

`--cleanup` eliminó sólo RECORD/REVIEW#/REPLAY# de la referencia QA verificada, conservó el contador DAILY y retiró las tres cuentas sintéticas y sus grupos propios vacíos. La evidencia sintética previa de identidad en DynamoDB se conserva conforme al helper de cuotas; no se borraron perfiles comerciales o solicitudes ajenos. Los archivos privados de credenciales y manifiestos temporales se retiraron. La cuenta real conservó el grupo de operador, su perfil y su rol administrador propio.

El navegador quedó en la bandeja autorizada con Todos los estados y cero solicitudes, sin detalle de prueba seleccionado. La sesión real se conservó. Los estados no enviaron correos ni crearon participantes, accesos, suscripciones o cobros. Stripe permanece pendiente; reclutamiento y TASK-006 siguen pendientes.

Evidencia local ignorada: `artifacts/applications-preflight.json`, `artifacts/applications-changeset.json`, `artifacts/applications-smoke.json`, `artifacts/applications-browser.json`, `artifacts/applications-real-operator-check.json` y capturas `cotitrama-solicitudes-conflicto.jpg`, `cotitrama-solicitudes-seguimiento.jpg`, `cotitrama-solicitudes-historial.jpg` y `cotitrama-solicitudes-listo.jpg`. El informe anterior de cuotas se conservó como `artifacts/quota-smoke-before-applications-20261119.json`. La entrega anterior se mantiene abajo como histórico.

## Entrega anterior: convocatoria y formulario de interés

Formulario público: **https://cotitrama-dev.lynxpardelle.com/piloto/interes**. Runtime final **b8f1c96faf602e07c279849cdb5dc5361d0d318c**, con SourceCommit coincidente y stack UPDATE_COMPLETE. Su [CI](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44643192043) terminó correctamente. La recepción se aceptó inicialmente con `181626a3e88c04c74478ae79027028f654d6037b`, cuya [CI](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44642205007) también pasó; el runtime final añade únicamente el ajuste visual descrito abajo. Los commits de evidencia posteriores no cambian el runtime.

La [convocatoria redactada](piloto/convocatoria.md) contiene correo completo y mensaje breve para WhatsApp/LinkedIn. **No se enviaron invitaciones a personas ni se publicaron mensajes en canales externos.** La landing enlaza el formulario de interés sin exigir una cuenta. Las solicitudes se reciben en InterestFunction/InterestTable, separadas de las cuentas y del negocio; la selección del piloto y toda comunicación posterior son manuales. Stripe continúa pendiente.

### Validación local y CI de convocatoria

| Comprobación | Resultado |
| --- | --- |
| Servicios y herramientas | 127 pruebas correctas: incluye 16 del nuevo dominio, siete de consulta/exportación privada y dos guardas del smoke. |
| Angular | 73 pruebas correctas en 15 archivos, diez específicas del interés público. |
| Empaquetado | Dos pruebas correctas. |
| Total | **202 pruebas correctas**. |
| Build SSR | Compilación y empaquetado correctos; 365.59 kB iniciales, transferencia estimada 99.52 kB. |
| SSR | Ruta /piloto/interes incluida en el smoke; formulario inicial sin valores de solicitantes ni tokens. |
| SAM/CloudFormation | Siete funciones compiladas, lint correcto y changesets sin eliminaciones ni reemplazos de tablas/pool. Se añade la tabla de interés con TTL y seis recursos propios en la entrega inicial. |

Las pruebas locales verifican esquema exacto de diez propiedades, 8 KB, consentimiento versionado, normalización, respuesta sin datos personales, replay/concurrencia, conflicto por contenido, límite diario UTC de 200 y contención acotada. El cliente mantiene el envío para reintentos ambiguos, red, 5xx y 429. Un rechazo inicial definitivo 400/413 permite corregir campos. No se hace una prueba de carga ni se preparan contadores de producción; el límite diario y su reinicio se comprueban localmente.

### AWS y navegador

El helper `tools/interest-smoke.mjs` completó cuatro comprobaciones a través de la URL pública:

1. POST anónimo válido: recibo 202 con sólo referencia y estado received. Lectura IAM posterior confirma persistencia, autorización/fecha del servidor y expiresAt a 90 días.
2. Replay idéntico conserva el primer registro; otro contenido con la misma referencia produce 409 sin sustituirlo.
3. Consentimiento falso, versión de aviso anterior y propiedades desconocidas producen 400 sin escribir un registro.
4. GET del formulario API y de una referencia no permite leer solicitudes: 404. El API comercial de catálogos conserva 401 sin JWT.

La quinta comprobación se hizo desde el navegador sin sesión: la landing abre el formulario; vacío y sin autorización no se envía. Una organización ficticia con disponibilidad **Por confirmar** recibió la referencia `87fce639-9f9a-4fba-9944-b6a5521d36c7`. El recibo no mostró el correo, no afirmó admisión y explicó que no enviaría un correo automático. La lectura IAM confirmó esos datos y su caducidad. Recargar mostró nuevamente el formulario vacío, la autorización desmarcada y los controles habilitados.

`--list` mostró únicamente dos recibos sintéticos con metadatos, sin datos de contacto. `--export` generó el JSON privado sólo para la referencia pedida; se verificó el contenido ficticio y se retiró el archivo. El TTL de la tabla quedó ENABLED sobre expiresAt. La configuración desplegada limita esta ruta a 2 solicitudes/segundo y ráfaga 5; las demás conservan 15/30. No hay búsqueda pública de correos, creación de cuentas/membresías o envío de mensajes por la Lambda.

La prueba visual encontró que una regla global de desgloses monetarios heredaba white-space: nowrap en las descripciones del piloto. En el ancho observado, el texto más largo ocupaba 640 px dentro de una columna de 327 px e invadía el formulario. La corrección se limita a `.interest-expectations dd`: white-space normal. En el runtime final, las tres descripciones tienen ancho de contenido y columna de 327 px, sin desbordamiento; se guardó una captura nueva del formulario vacío.

### Limpieza y alcance

Cleanup eliminó sólo los dos registros ficticios registrados por referencia, namespace y hash. El listado posterior quedó vacío; se conservó el contador diario de aceptaciones, sin decrementarlo. No quedan exportaciones privadas de esta verificación. El pool de development permaneció en cero usuarios y las seis alarmas del stack cerraron en OK. No se modificaron testing, main, Stripe ni otros proyectos.

Evidencia local ignorada por Git: `artifacts/interest-tests.log`, `artifacts/interest-web-tests.log`, `artifacts/interest-build-final.log`, `artifacts/interest-sam-build-final.log`, `artifacts/interest-changeset.json`, `artifacts/interest-changeset-final.json`, `artifacts/interest-smoke.json`, `artifacts/interest-operator-qa.json`, `artifacts/interest-final-state.json`, `artifacts/cotitrama-convocatoria-recibo.jpg` y `artifacts/cotitrama-convocatoria-formulario-final.jpg`.

TASK-014 prepara la convocatoria y una recepción técnica verificada. Los datos son ficticios: sector, destinatarios/canal de difusión, organizaciones seleccionadas, personas, autorizaciones y fecha siguen pendientes. No completa el piloto humano de TASK-006 ni valida demanda o disposición a pagar.

## Preparación del piloto con usuarios

Preparada el 19/11/2026 en development, sin cambios de runtime. TASK-013 deja un [protocolo](piloto/protocolo.md), [catorce casos funcionales](piloto/casos-de-prueba.md), [guía para primeros usuarios](piloto/guia-primeros-usuarios.md), [catálogo ficticio de práctica](piloto/catalogo-practica.json) y [cuatro plantillas vacías](piloto/plantillas/README.md). TASK-006 sigue pendiente: no hay participantes convocados, inicio confirmado ni resultados humanos de esta cohorte.

La propuesta define dos organizaciones del mismo sector y cuatro personas, catorce días desde la preparación de accesos y catálogos, y veinte pares de tareas frente al proceso habitual. Cada intento tiene un máximo de diez minutos. Los siete criterios de salida tienen denominadores explícitos; la meta de mejora del 20% es exploratoria. El tiempo de pared comparable se separa del tiempo activo del navegador y de las emisiones de práctica incluidas en el panel.

Comprobaciones realizadas sobre esta entrega documental:

- Catálogo JSON idéntico al fixture sintético actual y válido para el motor.
- Cinco resultados de referencia, calculados de forma explícita en la matriz y contrastados con el motor: 4,500.00; 16,650.00; 21,375.00; 26,362.50 y 7,837.50 MXN. Esto valida el material ficticio, no resultados de participantes.
- Catorce identificadores de caso únicos, todos en estado No ejecutado; siete criterios y cuatro CSV con sólo encabezados, sin registros de personas.
- Enlaces locales y diferencias Git comprobados. No se instalaron dependencias ni se modificaron servicios, frontend, infraestructura o configuración.
- Revisión independiente del método: primeros intentos, ayuda y abandonos; sesgo de aprendizaje y conocimiento previo del administrador; cobertura frente a pares comparables; roles/cupos y reinicio mensual UTC; datos privados fuera de Git.

La revisión aclaró que los tiempos agotados o la ayuda no equivalen por sí solos a una pérdida de integridad, y que auditar un resultado no implica que coincida con la referencia. También separó la incorporación de las dos sesiones medidas. Los controles de precio, acceso y conservación siguen siendo críticos. Las fuentes metodológicas y los umbrales elegidos constan en el protocolo.

Este paquete prepara la ejecución y una decisión de avanzar a otra cohorte controlada, iterar o detener para corregir; no constituye una publicación en producción ni validación de demanda o precio. Stripe permanece pendiente. El runtime de referencia y su aceptación AWS anterior se conservan a continuación; esta entrega no ejecuta un nuevo despliegue ni modifica otros proyectos.

## Evidencia previa: métricas del piloto

Runtime desplegado: **7dbffa9b9fdda31212be56a8e658e3d6f956dcda**, con SourceCommit coincidente y estado UPDATE_COMPLETE en cotitrama-development. La [CI del runtime](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44634469521) terminó correctamente. Los commits posteriores de evidencia no cambian el runtime.

El panel `/piloto` permite a administradores consultar 7, 30 y 90 días calendario UTC de la organización autorizada. Distingue emisiones, emisores con cobertura, media/mediana del tiempo activo estimado por el navegador, muestras y ausentes, ajustes entre revisiones exitosas y correcciones declaradas. Plan, miembros, catálogos y cuota mensual se presentan como fotografía actual. Las [definiciones](architecture/004-metricas-del-piloto.md) explican el alcance y los límites de interpretación.

La emisión conserva `pilot` opcional junto al snapshot y la cuota en la transacción existente. El hash comercial excluye esa medición y los reintentos conservan la primera confirmada. Volver a revisar el mismo contenido tras una respuesta fallida mantiene clave y payload; una edición comercial posterior inicia otra medición. Las correcciones por categoría son declaraciones idempotentes: no cambian importes ni consumen otra propuesta.

### Comprobaciones locales de métricas

| Comprobación | Resultado |
| --- | --- |
| Servicios y guardas de QA | **101 pruebas correctas**. Incluyen parser, idempotencia, permisos, fechas UTC, históricos sin datos de tiempo, privacidad y paginación/presupuesto DynamoDB. |
| Angular | **63 pruebas correctas en 14 archivos**: tracker monotónico, foco/inactividad, reintentos, edición posterior, cobertura, roles y respuestas cruzadas. |
| Empaquetado | **Dos pruebas correctas**. |
| Total | **166 pruebas correctas**. |
| Angular SSR | Build exitoso: 360.98 kB iniciales, 98.31 kB de transferencia estimada. |
| Artefacto final | Rutas profundas, incluida /piloto, SSR sin tokens y configuración sin caché; paquete con assets finales styles-ENQJB5QH.css y main-OCHHRZZD.js. |
| SAM y CloudFormation | Build de seis funciones y lint de ambas plantillas correctos. Changeset sin eliminaciones ni reemplazos de tablas/pool; dos permisos nuevos para rutas del API. |

La revisión independiente detectó y resolvió el arrastre de una medición congelada a una configuración distinta y el cambio de clave al volver a revisar un contenido idéntico tras un fallo. También se añadió un presupuesto compartido de 100 páginas, 30,000 registros y comprobaciones de seis segundos entre lecturas. Superarlo devuelve 503 METRICS_LIMIT sin agregados parciales; no interrumpe una solicitud SDK ya en curso. La consulta histórica acotada es una solución de piloto y no acredita rendimiento sostenido de Empresa.

### Aceptación de métricas en AWS

`tools/pilot-metrics-smoke.mjs` completó **seis comprobaciones** en recursos exclusivos de development:

1. Verificación del namespace, identidad real y organización propia de tres cuentas QA sintéticas, creadas con el envío de correo suprimido. Pool, cuenta, región, stack y tablas están restringidos por guardas.
2. Tres emisiones del propietario: mediciones controladas de 60 y 120 segundos, más una propuesta sin tiempo. Replays paralelos con otros metadatos válidos conservaron la primera propuesta y su medición; otro contenido con la misma clave devolvió 409 y campos desconocidos de pilot devolvieron 400. Cuota final: tres.
3. Una emisión de otra organización quedó fuera del panel del propietario; declarar correcciones sobre propuestas ajenas devolvió 404 en ambas direcciones.
4. Dos registros de corrección sobre una propuesta: dos solicitudes simultáneas de la misma declaración devolvieron 201/200 y un único evento. Replay conservó fecha/categoría, cambiar la categoría para el mismo identificador devolvió 409 y notas libres fueron rechazadas. Snapshot completo y cuota de tres emisiones permanecieron intactos.
5. Las ventanas 7/30/90 devolvieron tres emisiones, un emisor, dos muestras y una medición ausente; media y mediana de 90 segundos y dos correcciones sobre una propuesta. La serie diaria y la ausencia de sujetos, correos y claves privadas se comprobaron en las respuestas. Un período inválido fue rechazado.
6. Un vendedor no pudo consultar el panel y sí repetir una declaración autorizada; al degradarlo a lector, métricas y registros nuevos o repetidos devolvieron 403. La membresía QA temporal fue retirada al cerrar el escenario.

Las invocaciones del helper usan IAM con eventos HTTP API v2. Las duraciones de 60/120 segundos son **fixtures declarados**, no tiempo observado de personas. No se prepararon contadores de cuotas ni se alteró el reloj de AWS en esta entrega.

### Flujo autenticado de navegador

- Sin sesión, /piloto mostró únicamente el acceso. Las rutas públicas de métricas y registro de corrección devolvieron 401 sin JWT.
- La cuenta QA entró mediante Cognito, Authorization Code y PKCE. El panel mostró tres emisiones, muestra 2 de 3, una ausente y media/mediana de 1 min 30 s. Los filtros de 7, 90 y 30 días cambiaron las fechas UTC correctamente.
- Desde /cotizar, cantidad dos produjo un preview de 9,000 MXN. Cambiar a tres y revisar produjo 13,500 MXN. La emisión creó la propuesta `8c918e47-ba3a-4c3a-8c2b-54d30bcf769b`, con un ajuste y una estimación del navegador de **15,580 ms**. Es una interacción automatizada de QA; no valida productividad ni ahorro humano.
- Al reabrirla se registró la categoría Reglas o importes y se mostró la confirmación. El precio conservó 13,500 MXN. El panel pasó a **cuatro emisiones, tres muestras, una ausente, tres ajustes en dos configuraciones y tres correcciones sobre dos propuestas**. Media 65,193.33 ms y mediana 60,000 ms; la interfaz redondea a 1 min 5 s y 1 min 0 s. El consumo actual mostró un miembro, un catálogo y cuatro propuestas del mes.
- Las lecturas de comprobación posteriores verificaron que la muestra del navegador estaba persistida, las fórmulas coincidían y las correcciones no añadieron cuota. La sesión se cerró y la landing volvió a mostrar Iniciar sesión.

### Evidencia y limpieza de métricas

Evidencia local ignorada por Git: `artifacts/pilot-tests.log`, `artifacts/pilot-sam-build.log`, `artifacts/pilot-changeset.json`, `artifacts/pilot-metrics-aws.json`, `artifacts/pilot-metrics-browser.json`, `artifacts/cotitrama-piloto-inicial.jpg`, `artifacts/cotitrama-piloto.jpg` y `artifacts/cotitrama-piloto-correccion.jpg`.

Cleanup eliminó únicamente las tres cuentas QA registradas y sus grupos vacíos; el pool propio quedó con cero usuarios y el archivo privado de credenciales dejó de existir. Los registros sintéticos DynamoDB se conservaron como evidencia. El stack cerró UPDATE_COMPLETE con SourceCommit coincidente y sus cinco alarmas en OK. No se cambiaron otros proyectos, testing, main ni Stripe.

El primer piloto con clientes, personas y catálogos autorizados continúa pendiente en TASK-006. Esta instrumentación completa TASK-012 técnicamente en development; los datos sintéticos no validan demanda, precios, ahorro o errores resueltos. Stripe continúa pendiente, sin contratación ni cobros. Testing y main mantienen el flujo de promoción existente.

## Evidencia previa: límites y avisos de consumo

Runtime desplegado: **f6df9836c93d920177ec880ee2354135e3b8592d**, con SourceCommit coincidente en cotitrama-development y estado UPDATE_COMPLETE. La [CI del runtime](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44627215886) terminó correctamente. Los commits de evidencia posteriores no cambian el runtime.

La fuente canónica se trasladó a `services/shared/plans.json` para que Angular y las Lambdas compartan las mismas capacidades. Esencial aplica 2 miembros, 2 catálogos activos y 100 propuestas por mes UTC; Equipo 8/10/1,000 y Empresa 25/50/5,000. Los precios siguen propuestos. `limitsEnforced: true` declara las capacidades activas y `billingEnabled: false` conserva el piloto sin cargos. Stripe permanece pendiente.

### Comprobaciones locales de esta entrega

| Comprobación | Resultado |
| --- | --- |
| Backend y guardas de operación/QA | 79 pruebas correctas: 74 de servicios y cinco guardas de herramientas. |
| Angular | 44 pruebas correctas en diez archivos. |
| Empaquetado | Dos pruebas correctas. |
| Total | **125 pruebas correctas**. |
| Angular SSR | Build exitoso, 354.73 kB iniciales y 96.96 kB de transferencia estimada. |
| Artefacto SSR | Rutas profundas, incluida /consumo, configuración sin caché y token de invitación ausente del HTML. |
| SAM y CloudFormation | Build de seis funciones y lint de ambas plantillas sin errores. |

La revisión independiente encontró y corrigió dos casos antes del despliegue: un refresh de consumo absorbido por una consulta iniciada antes de la mutación, y una respuesta de propuesta que podía reinstalarse tras cerrar sesión. Las regresiones fallaron antes del arreglo y pasaron después. Las vistas privadas quedan ocultas al cerrar/expirar sesión y las respuestas se cercan por organización, sesión y generación.

### AWS real

`tools/quota-smoke.mjs` completó diez comprobaciones, además de preparar tres cuentas sintéticas aisladas con correo suprimido:

1. Catálogos Esencial: identificadores únicos frente a revisiones y replays, rechazo del tercer activo, archivo que libera capacidad y reactivación condicionada al cupo.
2. **100 emisiones reales de Esencial**, aviso al 80%, límite al 100%, rechazo de la siguiente y replay sin incremento. El contenido distinto conserva su conflicto; lectura y preview continúan disponibles.
3. Dos aceptaciones concurrentes disputan la última plaza de Esencial: sólo una entra. Reintentar no ocupa otra; retirar libera plaza y una invitación usada no restaura la membresía retirada.
4. Equipo: aviso de propuestas al 80% y disputa del último cupo de propuestas, catálogos y miembros.
5. Empresa: los mismos bordes y condiciones para sus capacidades 25/50/5,000.
6. Reducción a Esencial con exceso: conserva snapshots y lecturas, informa over y bloquea nuevas operaciones que consumen capacidad agotada.

Los bordes altos de Equipo y Empresa usan **preparaciones sintéticas de contadores exclusivamente en organizaciones QA registradas**, seguidas de transacciones reales. El informe lo declara; no demuestra que se hayan emitido 1,000/5,000 propuestas ni que exista una prueba de carga sostenida. El journal se restauró al recuento real de registros, incluso al salir de cada escenario. La prueba de cambio de mes y backfill paginado se cubre localmente; no se alteró el reloj de AWS.

Las invocaciones del script son IAM con el contrato HTTP API v2. La verificación de Cognito/PKCE/JWT del gateway se hizo por separado en navegador. No se enviaron correos QA nuevos en esta ampliación.

### Navegador y avisos

- Sin sesión, /consumo muestra el acceso y no serializa métricas privadas. Las tres rutas de consumo sin JWT devuelven 401.
- Una cuenta propia de Esencial mostró el estado inicial normal, luego **80 de 100 propuestas realmente emitidas**, 20 disponibles y aviso Cerca del límite en pantalla y navegación.
- Tras completar esa cuenta a **100 propuestas reales**, mostró Límite alcanzado, cero disponibles y reinicio 01/12/2026 00:00 UTC. El estado persistió al recargar.
- El preview siguió disponible al agotar el cupo. Una emisión nueva devolvió PLAN_LIMIT_REACHED con enlace a Consumo, conservando el borrador y su clave para reintentar.
- El operador asignó Equipo por IAM sin cobro. Con la misma sesión y borrador, el reintento se guardó: el consumo pasó a **101 de 1,000** y reflejó el nuevo plan sin cambiar el token.
- Archivar desde la pantalla, con confirmación, redujo los catálogos activos de uno a cero. La propuesta `4f2211f8-3945-48be-aaa1-a62e6ee7d432`, v1 por **4,500.00 MXN**, siguió consultándose con el catálogo archivado. Reactivar devolvió el contador a uno.

### Activación, evidencia y limpieza

Antes de desplegar se comprobó dos veces que el pool propio de development tenía cero usuarios. Se esperó UPDATE_COMPLETE y se drenó el timeout antes de crear QA; no había escritores autenticados anteriores durante el backfill. Para activar otro ambiente con usuarios, importar pertenencias Cognito pendientes y pausar/drenar escritores antiguos conforme al [diseño de límites](architecture/003-limites-y-consumo.md). Una operación ya autorizada puede terminar con el plan que leyó al comenzar; coordinar los cambios del operador sin escrituras en curso.

Evidencia local ignorada por Git: `artifacts/quotas-preflight.json`, `artifacts/quota-smoke.json`, `artifacts/quotas-browser.json`, `artifacts/cotitrama-consumo-80.jpg`, `artifacts/cotitrama-consumo-100.jpg`, `artifacts/cotitrama-cuota-rechazo.jpg`, `artifacts/cotitrama-consumo-archivo.jpg` y `artifacts/cotitrama-cuota-propuesta-conservada.jpg`.

Se cerró la sesión del navegador y cleanup eliminó únicamente las tres cuentas QA y sus grupos vacíos, verificando namespace, pool, email, sub y organización. El archivo privado de credenciales ya no existe. Los registros sintéticos DynamoDB se conservan como evidencia. Las cinco alarmas del stack estaban en OK al cerrar. No hubo cambios en Stripe, testing, main ni recursos de otros productos.

## Evidencia previa de registro y Equipo

Los apartados siguientes conservan la aceptación anterior del registro, correo real y gestión de miembros. Sus commits, conteos de pruebas e informes corresponden a esa entrega; el runtime y las comprobaciones actuales están arriba.

### Entrega

- Rama `development`, trabajo previo conservado y publicado en origin.
- Equipo, invitaciones y propuesta de precios desplegados: commit `26d6a99766614afc8c08bffb4485e4f3efbbb6ae`.
- Runtime final desplegado y verificado: `0f32a5d6a882d7180650b967929a7dbcf89d83a1`, incluido el ajuste visual del selector, con CI verde y SourceCommit coincidente en el stack.
- Stacks exclusivos: `cotitrama-artifacts` y `cotitrama-development`, región us-east-1. La actualización de Equipo terminó UPDATE_COMPLETE. El stack de aplicación lleva SourceCommit del código desplegado.
- CloudFront E3GSFWU10YQHF3, DNS A/AAAA y TLS válidos; certificado existente reutilizado sin modificarlo. No se cambiaron nameservers ni recursos de otros proyectos.
- Seis Lambdas: Web SSR, Catálogos, Cotizaciones, Equipo, Registro y Salud. Tablas DynamoDB separadas por dominio, Cognito propio y Function URL protegida con IAM/OAC. Equipo y Registro pertenecen al mismo dominio de identidad y comparten su tabla MembersTable.

### Comprobaciones locales y CI

| Comprobación | Resultado |
| --- | --- |
| Backend | 50 pruebas pasan: reglas, negocio, onboarding, Equipo, permisos y adaptadores transaccionales. |
| Guardas del smoke AWS | 2 pruebas pasan; restringen stack, cuenta, región y limpieza QA. |
| Angular | 27 pruebas pasan, incluida regresión de selección de espacio tras aceptar una invitación. |
| Empaquetado | 2 pruebas pasan; sin assets residuales y paquete npm válido para SAM. |
| Build Angular SSR | Salida 0; bundle inicial 349.62kB, transferencia estimada 97.01kB. |
| SAM build | Salida 0, seis funciones. |
| cfn-lint | Plantillas aplicación y artefactos sin errores. |
| CI Equipo | [Ejecución 44618456771](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44618456771), success. |
| CI selector | [Ejecución 44620159729](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44620159729), success. |

### Servicios reales

`node --use-system-ca tools/aws-smoke.mjs --verify` completó 14 comprobaciones, agrupadas aquí por comportamiento:

1. Dos cuentas QA sintéticas, sin envío de emails, con organizaciones distintas.
2. Onboarding idempotente mediante la Lambda desplegada: dos invocaciones conservan un único grupo.
3. Publicación de catálogo y cálculo exacto: subtotal 27,750.00 MXN, descuento 1,387.50 MXN, total 26,362.50 MXN.
4. Ocho emisiones concurrentes conservan un solo identificador; cambiar contenido con la misma clave devuelve 409.
5. Publicar v2 con otro precio y nombre de opción no cambia el snapshot emitido en v1.
6. Recursos de otra organización devuelven 404 antes de aceptar invitaciones; reader no simula y seller no publica. Los roles se modifican realmente en la tabla de Equipo.
7. CloudFront entrega landing/config/health, y el API de negocio rechaza solicitudes sin token.
8. La Function URL directa rechaza invocaciones anónimas con 403.

9. Invitación ligada al destinatario: otra cuenta recibe 404; aceptación y repetición conservan una sola membresía y permiten acceder a dos espacios.
10. Degradar a lector impide simular aunque la solicitud conserve claims antiguos de administrador. Retirar la membresía impide acceder al negocio; repetir una invitación usada no restaura el acceso.
11. Dos administradores intentan degradarse simultáneamente contra DynamoDB real: una transacción termina correctamente, otra devuelve 409 y queda exactamente un administrador. Se restaura al propietario mediante quien conserva el permiso.
12. Un espacio persistido que fue retirado se recupera hacia el espacio propio; una solicitud comercial que insiste en el espacio retirado se rechaza. La baja o degradación del último administrador devuelve 409.

Los casos de negocio del script invocan Lambdas por IAM con el contrato HTTPv2 y comprueban DynamoDB real. Los cambios de rol y pertenencia usan el servicio de Equipo desplegado; no se simulan cambiando grupos del token. El script no acredita por sí solo la verificación de JWT del gateway; esa etapa se comprueba en navegador.

### Registro y correo de confirmación reales

Se realizaron dos altas públicas con aliases QA del buzón autorizado: una antes y otra después de desplegar Equipo. Ambas usaron SignUp real, exigieron confirmación y permanecieron UNCONFIRMED hasta recibir el correo. Se leyó únicamente el mensaje dirigido al alias QA, se utilizó el código recibido con ConfirmSignUp y Cognito terminó en CONFIRMED con email_verified=true y organización propia.

En la segunda alta, una lectura fuertemente consistente de MembersTable confirmó que PostConfirmation ya había persistido al propietario como administrador antes de llamar al contexto de Equipo. No se utilizó AdminConfirmSignUp ni se marcó manualmente como verificado el correo de estas dos altas.

Se mantiene el correo administrado de Cognito. Personalizar asunto y contenido requiere una configuración SES DEVELOPER, fuera de esta entrega, según el [contrato de plantillas de Cognito](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_VerificationMessageTemplateType.html). El correo automático de invitación no está habilitado: los administradores comparten un enlace de siete días, dirigido al correo verificado del destinatario.

Evidencia sin contraseñas ni códigos: `artifacts/registration-legacy-verified.json` y `artifacts/registration-verified.json`. Las dos cuentas de registro QA se eliminaron después de comprobar el resultado.

### Navegador, Cognito y JWT reales

La aceptación por navegador completó el tramo que no cubre la invocación IAM:

- La llamada Crear cuenta abrió el formulario público de Cognito con PKCE S256 y callback correcto.
- Login con usuario QA, intercambio Authorization Code/PKCE, sesión y logout reales.
- Listado y publicación desde Angular a través de CloudFront → API Gateway/JWT → Lambda → DynamoDB.
- Publicación de `oficina` v1, configuración de cinco escritorios con roble e instalación, cálculo y emisión por **26,362.50 MXN**.
- Propuesta `a158e508-c140-45d2-abf9-09f032679900` conservó v1, opciones e importes al recargar su URL después de publicarv2 con base 9,000.00 MXN y roble 1,200.00 MXN.
- Segunda cuenta autenticada: catálogo vacío y propuesta ajena rechazada con el mensaje de recurso inexistente en su organización. Esto prueba aislamiento con JWT real.
- Landing responsive, sin desbordamiento a 390 × 844; enlaces de planes y FAQ operativos. Sin errores de aplicación en el flujo positivo; el 404 de aislamiento es esperado.

La ampliación de Equipo también se verificó con Cognito y JWT reales:

- Una cuenta confirmada antes de la ampliación migró desde sus grupos existentes y abrió Equipo como administrador.
- El administrador creó un enlace desde la pantalla; la sesión de otra cuenta recibió el rechazo previsto. El login conservó la ruta de regreso a la invitación.
- El destinatario aceptó y conservó su espacio propio, además del nuevo espacio comercial. Cambiar de espacio mostró únicamente los catálogos correspondientes.
- El administrador cambió el rol a lector; otra sesión, con el mismo token anterior, recibió el rol actual y deshabilitó la simulación. La pantalla protegió al último administrador con el mensaje previsto.
- La retirada de acceso desde la pantalla conservó la cuenta de la persona; al recargar recuperó su espacio propio sin acceder al catálogo del espacio retirado.
- Se encontró una discrepancia visual entre el selector y el espacio activo tras aceptar. La prueba de regresión reprodujo el fallo y pasó al vincular cada opción con la selección actual. El ajuste desplegado se verificó al aceptar otra invitación: el selector mostró el espacio invitado con rol Vendedor y conservó la selección al recargar.
- En esa sesión de vendedor, se simularon y emitieron cinco escritorios con opciones de la revisión v2: subtotal 52,250.00 MXN, descuento 2,612.50 MXN y total **49,637.50 MXN**. La propuesta `4edb44b2-70ac-4f61-9572-6eb9fdef83e8` se reabrió por URL y conservó su desglose al recargar.

Evidencia local ignorada por Git: aceptación original en `artifacts/aws-smoke-verified.json` y `artifacts/aws-browser.json`; ampliación en `artifacts/aws-team-verified.json`, `artifacts/aws-team-browser.json`, `artifacts/cotitrama-equipo.jpg` y `artifacts/cotitrama-equipo-propuesta.jpg`. Los archivos privados de pruebas nunca se incorporan al repositorio.

### Limpieza y operación

Se cerraron las sesiones de navegador y se eliminaron las dos cuentas sintéticas registradas y sus grupos vacíos mediante el helper con guardas de propiedad. Las dos cuentas de registro con correo real también se eliminaron. Los archivos privados de credenciales y códigos ya no existen. Los datos sintéticos de DynamoDB se conservan como evidencia; no se borraron datos de otras organizaciones. El stack terminó UPDATE_COMPLETE y sus cinco alarmas (API 5xx, Catálogos, Cotizaciones, Registro y Equipo) estaban en OK al cerrar.

En este Windows, Node necesitó `--use-system-ca` para usar la confianza TLS del sistema. No se desactivó verificación de certificados ni se cambió la configuración de Windows.


## Pendientes actuales

- Piloto con clientes y datos autorizados: medir tiempo por cotización, correcciones, uso y costos, y contrastar precios/capacidades con disposición a pagar. La aceptación sintética no valida demanda.
- Medir volumen y latencia reales antes de ofrecer Empresa a escala. El primer contador de cada mes consulta el historial de propuestas de la organización; evaluar una migración o índice que evite que el arranque crezca con años de snapshots.
- Definir ciclo contractual, cancelación, condiciones comerciales y soporte antes de contratar. Los contadores y avisos operativos ya están implementados; Stripe y los cobros continúan pendientes.
- Promover únicamente mediante el flujo autorizado development → testing → main. El dominio de producción sigue siendo una dirección prevista.
