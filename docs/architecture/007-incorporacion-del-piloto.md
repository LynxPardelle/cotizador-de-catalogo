# Incorporación y preparación de organizaciones del piloto

Decisión del 19 de noviembre de 2026. Amplía la revisión de solicitudes preseleccionadas con vinculación consentida de un espacio, comprobación de accesos y catálogo, y seguimiento de los acuerdos del protocolo. Se conserva el dominio de Solicitudes, ApplicationsFunction e InterestTable: ocho Lambdas y cuatro tablas. La aceptación observada por entrega se registra en [Verificación](../verificacion.md). Stripe sigue pendiente.

## Responsables y recorrido

El operador abre `/piloto/preparacion/<referencia>` desde una solicitud Preseleccionada y comparte manualmente el enlace `/piloto/incorporacion/<referencia>` con su contacto. La referencia es la del recibo público; no concede permiso por posesión ni funciona como credencial. No se envía correo desde este flujo.

El contacto inicia sesión o registra y confirma su propia cuenta. El servicio comprueba directamente en el pool propio que esté habilitada, CONFIRMED y con correo verificado igual al de la solicitud original. La persona elige expresamente un espacio donde Equipo confirme administración vigente y acepta participación y consulta de los metadatos necesarios para preparar el piloto. Después de vincular se conserva el mismo espacio y la identidad que lo autorizó; este formulario no permite reemplazarlos silenciosamente ni transferir el acceso si se recicla un correo.

El administrador usa las pantallas existentes de Equipo y Catálogos en el espacio elegido: crea la invitación manual al segundo participante, quien confirma su propia cuenta y la acepta, y publica un catálogo autorizado. La incorporación solicita identificador y revisión del catálogo publicado, con autorización expresa para el piloto. No importa archivos Excel/CSV, copia otro catálogo, crea membresías por cuenta del operador ni publica precios en su nombre.

La pantalla de operación distingue comprobaciones técnicas actuales y acuerdos humanos. No fija el comienzo del período de catorce días, crea participantes automáticamente ni activa una suscripción. La aceptación técnica con datos ficticios no completa TASK-006.

## Contratos y autorización

Todas las rutas HTTP siguientes heredan JWT de Cognito:

| Ruta | Actor y operación |
| --- | --- |
| `GET/PATCH /api/v1/pilot-applications/<referencia>/preparation` | Operador vigente: consulta de preparación o actualización de acuerdos y fecha. |
| `GET /api/v1/pilot-applications/<referencia>/preparation/history` | Operador vigente: historial paginado. |
| `GET /api/v1/pilot-onboarding/<referencia>` | Contacto verificado coincidente: preparación y espacios propios administrados. |
| `POST /api/v1/pilot-onboarding/<referencia>/link` | Contacto: vinculación y consentimiento versionado. |
| `POST /api/v1/pilot-onboarding/<referencia>/catalog` | Contacto vinculado que conserva administración: catálogo específico autorizado. |

El permiso de operador sigue siendo el grupo Cognito actual `cotitrama-pilot-reviewers`; no concede administración comercial sobre el espacio vinculado. La ruta de contacto ignora X-Organization-Id, rechaza otras cuentas sin mostrar la solicitud y utiliza `workspaceId` del body sólo después de comprobar su pertenencia admin actual. JWT identifica; los grupos históricos del token no conceden roles.

ApplicationsFunction invoca por IAM únicamente TeamFunction y CatalogFunction del mismo stack. No lee sus tablas directamente. Los nuevos contratos de Equipo `pilotAdminWorkspaces` y `pilotReadiness` son exclusivamente internos, no ejecutan inicializaciones ni migraciones y devuelven IDs/etiquetas propios o indicadores mínimos. Las consultas fuertes tienen un máximo de 32 pertenencias, 25 miembros y cuatro páginas; excederlos produce un 503 explícito.

Para comprobar accesos se consulta la cuenta actual de cada miembro, habilitada, confirmada y con correo verificado. Se requiere el administrador que vinculó el espacio y un segundo sujeto distinto con rol seller. Dos miembros, un lector o dos administradores no sustituyen este requisito del protocolo. No se entrega al operador un roster, correos ni identidades de otros miembros.

La comprobación de catálogo reutiliza `getPublishedCatalog` por IAM, respetando archivado y revisión exacta. El DTO sólo incluye identificador, revisión, nombre, vigencia y cantidad de productos. No contiene productos, precios ni reglas. Si el administrador vinculado pierde el permiso actual, se bloquea la preparación y deja de leerse o mostrarse esa metadata de catálogo.

## Preparación lista y pendientes

El estado se calcula al consultar; no se guarda como una aprobación permanente. Se muestra la fecha de comprobación y el operador puede actualizarla. Se requiere:

- Espacio vinculado con los consentimientos de la versión vigente.
- Administrador y vendedor distintos, con acceso y cuentas vigentes.
- Catálogo específico autorizado, publicado, activo, vigente y con productos.
- Participantes/roles acordados, referencias revisadas, sesiones previstas, canal privado y tratamiento de evidencias confirmados manualmente.
- Fecha prevista de calendario UTC igual o posterior a hoy.

Los estados son Pendiente de vincular, Preparación en curso, Preparación bloqueada y Lista para coordinar el inicio. La falta de un requisito se devuelve como pendiente concreto; una fecha vencida requiere revisar la coordinación. El protocolo sigue exigiendo confirmar participantes, autorizaciones y arranque fuera de estas comprobaciones técnicas.

Cada lectura y escritura requiere que la solicitud no haya expirado y siga Preseleccionada. No seleccionada o Retirada pausa la preparación sin retirar membresías ni borrar cuentas o catálogos. Una dependencia indisponible produce un error explícito, sin inventar un estado listo.

## Persistencia, reintentos y privacidad

Se añade `preparation` al registro de la solicitud. El formulario recibido, su consentimiento de contacto, hash, estado público received, fechas y TTL originales permanecen intactos. Los consentimientos de vinculación y catálogo se guardan por separado con versión y fecha; no sustituyen la autorización original.

Las tres mutaciones admiten `mutationId` UUID y `expectedVersion`. La transacción comprueba versión, vencimiento y estado selected, actualiza la preparación y crea `PREP_HISTORY#<versión>` y `PREP_REPLAY#<mutationId>`. Todos conservan el mismo expiresAt original de noventa días; preparar o añadir acuerdos no amplía la retención. La eliminación TTL física es asíncrona.

El hash idempotente incluye operación, contenido e identidad. Una repetición idéntica conserva la preparación original sin otro evento; cambiar su contenido devuelve conflicto. Las comprobaciones de disponibilidad se recalculan al responder, por lo que checkedAt puede cambiar en un replay. Una edición concurrente devuelve 409 y exige recarga explícita; el cliente conserva el borrador. Un resultado de red ambiguo conserva identificador y payload completos. Después de confirmar el guardado, el cliente consulta la versión vigente.

El historial se consulta por partición propia en páginas de veinte eventos, versiones descendentes y cursores vinculados al tipo y referencia. Los DTO excluyen sujetos internos y campos ajenos al contrato. Angular no consulta ni serializa información privada en SSR, desactiva transferCache y elimina datos ante expiración de sesión, 401/403, referencia no disponible o preparación pausada. Las respuestas HTTP usan no-store.

## Verificación

Las pruebas locales cubren cuentas y roles vigentes, consentimiento exacto, espacios ajenos, vinculación fija, revisión/archivado/vigencia del catálogo, requisitos y fechas, preservación del original/TTL, replays, carreras, paginación y privacidad. La demo loopback comparte el almacenamiento de solicitud/revisión/preparación y conserva explícitamente pendiente al vendedor cuando sólo existe el administrador sintético.

El helper `tools/preparation-smoke.mjs` usa únicamente tres cuentas QA con correo suprimido, una solicitud ficticia cuyo contacto es una de ellas y su espacio/catálogo propios. Verifica las funciones reales por IAM y distingue ese resultado del JWT observado en navegador. La limpieza valida namespace, referencia, formulario, hash y deadline antes de eliminar sólo esa partición y esas cuentas; conserva DAILY y la evidencia comercial sintética. No debe ejecutarse con participantes reales. [Procedimiento operativo](../operacion.md).
