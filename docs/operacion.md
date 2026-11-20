# Operación de CotiTrama

## Desarrollo y pruebas

Desde la raíz, con Node.js 24 y npm:

```powershell
npm --prefix services ci
npm --prefix web ci
npm test
npm run test:web
npm run build
npm run smoke:ssr
npm run test:package
npm run demo
```

La demo se abre en http://127.0.0.1:4200, sólo en la máquina local, con datos sintéticos y repositorios en memoria. No usa JWT reales ni habilita una puerta de autenticación alternativa en las Lambdas desplegadas. Reiniciar borra sus datos. El catálogo de ejemplo cubre opciones, incompatibilidades y descuento por volumen.

`npm run pilot` produce un informe local reproducible en `artifacts/` con tiempos de simulaciones y la comprobación de conservación de un snapshot. Es una carga sintética local: no mide latencia de AWS ni productividad comercial.

## Preparar la nube

El stack `infra/template.yaml` declara ocho Lambdas (Web SSR, Catálogos, Cotizaciones, Equipo, Incorporación, Salud, Interés y Gestión de solicitudes), HTTP API, Cognito, cuatro tablas propias por dominio, CloudFront OAC y aliases A/AAAA. Equipo e Incorporación comparten la tabla de identidad; captura y revisión comparten la tabla de Interés. La aceptación incluye condiciones/transacciones reales y operaciones con JWT en navegador, con evidencia por entrega. No hay recursos de demo en el stack. Requiere una zona pública existente de lynxpardelle.com y un certificado ACM en us-east-1 que cubra el subdominio de cada ambiente. Un wildcard `*.lynxpardelle.com` cubre los tres nombres previstos.

Los identificadores de zona y certificado son parámetros del despliegue. `infra/environments.json` contiene los valores públicos comprobados mediante lecturas de AWS el 19 de noviembre de 2026: zona pública existente, certificado ISSUED para lynxpardelle.com y *.lynxpardelle.com, y nombres de stack/ambiente. Development ya publica su alias; no confundir la comprobación anterior a la creación del stack con el estado desplegado. Revalidar esos valores antes de ejecutar otro despliegue; no deben pegarse credenciales en archivos del repositorio. SAM CLI y cfn-lint son herramientas de operación, no dependencias del navegador.

```powershell
cfn-lint infra/template.yaml
sam build --template-file infra/template.yaml
```

En este checkout también se verificó con `.\.tools\sam\Scripts\python.exe -m samcli build --template-file infra/template.yaml`, usando SAM CLI 1.173.0 instalado localmente sin cambiar PATH. Las herramientas de `.tools/` están ignoradas y no forman parte del producto.

Desde la rama development, revisa el changeset para el stack de desarrollo antes de ejecutarlo. Usa Stage=development y los parámetros HostedZoneId/CertificateArn. Para testing y production, usa stacks y parámetros del ambiente correspondiente y sigue los PRs de [promoción](promocion.md). Nunca desplegar una revisión de main como corrección directa que eluda development → testing → main.

El frontend empaquetado requiere `npm run build` antes de SAM. Su handler es `index.handler`, en `web/dist/lambda`; los adaptadores de servicios tienen handlers `catalog/index.handler`, `quoting/index.handler`, `team/index.handler` y `onboarding/index.handler`. El paquete de Web incluye el adaptador serverless y no necesita dependencias instaladas en el runtime de Lambda.

## Recibir interés para el piloto

La [convocatoria](piloto/convocatoria.md) contiene textos de correo y mensaje breve preparados para revisión. No se han enviado a contactos ni publicado en canales externos. La landing de development enlaza `/piloto/interes`; enviar ese formulario sólo registra interés. No confirma plaza, verifica correo, crea una cuenta ni activa un plan o cobro.

El operador designado puede revisar y dar seguimiento desde el panel privado descrito más abajo. La consulta operativa por IAM sigue disponible con `tools/pilot-interest-development.mjs`, exclusivamente en development y con el stack UPDATE_COMPLETE:

```powershell
node --use-system-ca tools/pilot-interest-development.mjs --list
node --use-system-ca tools/pilot-interest-development.mjs --export REFERENCIA_UUID
```

Sustituir REFERENCIA_UUID por una referencia recibida, no por un correo. La lista sólo muestra metadatos y avisa si quedó acotada; para volúmenes que la excedan, revisar el histórico en la consola IAM de la tabla propia antes de decidir. La exportación escribe `artifacts/pilot-interest-<uuid>-private.json`, ignorado por Git, sin volcar contactos al terminal. No sobrescribe un archivo existente ni sigue enlaces. Abrir la copia sólo en la ubicación y con las personas acordadas; no adjuntarla a issues ni al repositorio. El TTL del registro en AWS no elimina las exportaciones locales.

Las solicitudes expiran técnicamente a los 90 días, con eliminación TTL asíncrona; el cliente no promete un borrado inmediato. La revisión de encaje y la comunicación posterior son manuales. Confirmar las personas, autorización del catálogo y acuerdos del protocolo antes de iniciar; el interés recibido no reemplaza esos pasos. No usar la cuenta de una persona ni crearla en su nombre. Las opciones No y Por confirmar se revisan sin descarte automático.

Para verificar recepción exclusivamente con datos ficticios:

```powershell
npm run smoke:interest:development
# Enviar la segunda solicitud ficticia mediante el formulario y conservar su referencia.
node --use-system-ca tools/interest-smoke.mjs --verify-browser REFERENCIA_QA_UUID
npm run cleanup:interest:development
```

El reporte ignorado `artifacts/interest-smoke.json` contiene sólo el namespace QA y evidencia de estas comprobaciones. La limpieza verifica tabla, referencia, correo sintético y hash; no enumera ni elimina solicitudes de organizaciones. No se agotan las 200 plazas diarias ni se preparan contadores artificiales: sus bordes se verifican localmente. Los controles y la retención están descritos en el [diseño de convocatoria](architecture/005-convocatoria-e-interes.md). Stripe continúa pendiente.

## Gestionar las solicitudes del piloto

La pantalla privada `/piloto/solicitudes` requiere el permiso específico de operador `cotitrama-pilot-reviewers`. Ser administrador de una organización no lo concede. Cada acceso al API comprueba en el pool propio que la cuenta siga habilitada, CONFIRMED, con correo verificado y con esa pertenencia vigente. El permiso permite revisar las solicitudes del piloto de CotiTrama, sin depender de la organización comercial seleccionada. La aceptación desplegada de este incremento se registra en [Verificación](verificacion.md); el [ADR 006](architecture/006-gestion-solicitudes-piloto.md) describe sus contratos y condiciones.

La persona designada se registra y confirma su correo por el flujo normal. Con el stack de development desplegado y el grupo creado por SAM, un operador IAM asigna explícitamente el permiso a esa cuenta existente:

```powershell
node --use-system-ca tools/pilot-reviewer-development.mjs --show CORREO_VERIFICADO
node --use-system-ca tools/pilot-reviewer-development.mjs --grant CORREO_VERIFICADO
# Para retirar el permiso específico:
node --use-system-ca tools/pilot-reviewer-development.mjs --revoke CORREO_VERIFICADO
```

Sustituir CORREO_VERIFICADO por el correo exacto de la cuenta designada. El helper valida cuenta, región, stack y pool de development; verifica el usuario y utiliza su username canónico. No crea cuentas o grupos ni confirma un correo por IAM. No usar grupos `org:*` para conceder el permiso de revisión. La revocación se comprueba en la siguiente petición protegida, incluso si existe una sesión con un token emitido anteriormente. Si una comprobación de permisos falla o excede el presupuesto, el panel no concede acceso por defecto.

En el panel se filtra por estado y se abre una referencia para consultar contacto, solicitud e historial. La lista omite correo y notas. Cada petición evalúa como máximo cien registros en cuatro páginas y devuelve hasta veinticinco coincidencias; continuar mientras exista **Cargar más**, incluso si la página actual no tiene coincidencias. No hay un total global ni un orden cronológico global. Cambiar de filtro reinicia la paginación. El historial se consulta de veinte en veinte, desde la revisión más reciente.

Los estados son Recibida, En revisión, Por aclarar, Contactada, Preseleccionada, No seleccionada y Retirada. El operador registra manualmente el seguimiento, una próxima fecha opcional y notas de hasta 500 caracteres. Una nota sola puede documentar una actuación sin cambiar el estado; incluir sólo información necesaria para coordinar el piloto. La fecha sirve para organización interna y no genera avisos automáticos. **Preseleccionada** no crea accesos, no envía mensajes y no activa un plan. Confirmar manualmente los acuerdos del protocolo antes de incorporar personas.

Si otro operador guarda primero, 409 REVIEW_CONFLICT conserva la edición en pantalla: consultar la versión actual antes de preparar un nuevo guardado. Ante una respuesta incierta, reintentar el mismo cambio conserva su referencia y devuelve la primera respuesta confirmada; no usar una referencia nueva hasta saber si el guardado anterior quedó registrado. Un cambio posterior debe expresar la versión actual. El historial conserva estado y fecha anteriores/nuevos, nota, momento e identificador derivado del operador.

El seguimiento mantiene inalterados la solicitud recibida, su autorización original de contacto, su hash y el recibo público. Las solicitudes anteriores aparecen como Recibidas con versión cero. Solicitud, historial y replays conservan el mismo plazo original de noventa días: revisar o añadir una nota no lo amplía. Al caducar no se muestran mediante el panel/API, aunque la eliminación física por TTL sea posterior. Retirada registra el estado del proceso y no ejecuta una baja o un borrado automático.

La aceptación sintética de este incremento utiliza exclusivamente cuentas y solicitudes QA en development:

```powershell
npm run smoke:applications:development
# Abrir la solicitud ficticia del reporte con una sesión de operador autorizada.
# Para inducir un conflicto después de cargar la versión en pantalla:
node --use-system-ca tools/applications-smoke.mjs --advance REFERENCIA_QA_UUID
# Guardar desde el navegador needs_info, fecha vacía y la nota literal:
# QA navegador CotiTrama: seguimiento manual.
node --use-system-ca tools/applications-smoke.mjs --verify-browser
npm run cleanup:applications:development
```

Los helpers y las pruebas de navegador deben acreditar acceso permitido, rechazo del administrador sin permiso, seguimiento e historial, replay, conflicto de versión y revocación con token previo. La aceptación técnica invoca funciones reales por IAM con envelopes sintéticos; la sesión de navegador verifica por separado JWT y HTTP API. El helper crea sólo tres actores QA con correo suprimido y una solicitud ficticia, y su limpieza conserva las solicitudes y cuentas ajenas a ese namespace, incluida la cuenta del operador real. No utilizar cuentas de participantes para preparar o limpiar fixtures. La revisión de organizaciones reales y la comunicación de decisiones siguen siendo manuales; Stripe permanece pendiente.

## Preparar el piloto con personas

### Incorporar una organización preseleccionada

1. El operador marca la solicitud como Preseleccionada y abre **Preparar incorporación**. La pantalla `/piloto/preparacion/<referencia>` muestra pendientes e historial y permite copiar el enlace de incorporación para compartirlo manualmente con el contacto. No envía correo.
2. El contacto abre `/piloto/incorporacion/<referencia>`, inicia sesión o registra y confirma su propia cuenta con el mismo correo de la solicitud. Selecciona un espacio que actualmente administre y acepta participación y consulta de metadatos para preparar el piloto. Esa vinculación queda fija para la solicitud; no se usa un cambio de correo para transferirla.
3. Desde **Gestionar equipo**, el administrador crea la invitación al vendedor y la comparte manualmente. El vendedor registra/confirma su propia cuenta y acepta el enlace con el correo destinatario. Un enlace creado o dos administradores no acreditan el vendedor requerido por el protocolo.
4. Desde **Preparar catálogo**, el administrador publica el JSON autorizado y vigente. Vuelve a la incorporación, indica identificador y revisión publicada y confirma la autorización de uso. Se mantiene esa revisión aunque haya una publicación posterior; archivar el catálogo o caducar lo deja pendiente en la siguiente comprobación.
5. El operador confirma los acuerdos con las personas: roles, referencias independientes, sesiones, canal privado de ayuda y tratamiento de evidencias. Registra una fecha prevista actual o futura en calendario UTC y guarda. **Actualizar comprobaciones** vuelve a consultar accesos y catálogo; el sello de última comprobación indica la vigencia de la pantalla.
6. **Lista para coordinar el inicio** exige administrador y vendedor distintos con cuentas vigentes, catálogo autorizado activo/vigente, los cinco acuerdos y fecha. Confirmar el comienzo con las personas conforme al protocolo: el estado no inicia el período, inscribe automáticamente participantes ni activa cobros.

Los cambios se guardan con versión e identificador idempotente. Un conflicto exige recarga explícita y conserva la edición; una respuesta incierta conserva exactamente la misma intención para reintentar. Retirar o cambiar la preselección pausa las rutas de preparación sin borrar datos comerciales. Caducar la solicitud la oculta; el seguimiento mantiene el deadline original de noventa días. Los consentimientos se conservan por versión, fecha e identidad interna, fuera de los DTO públicos.

Para aceptación ficticia de desarrollo:

```powershell
npm run smoke:preparation:development
# Revisar operatorUrl/contactUrl y la fecha esperada en artifacts/preparation-smoke.json.
# Comprobar las pantallas con sesiones autorizadas y datos QA exclusivamente.
node --use-system-ca tools/preparation-smoke.mjs --verify-browser
npm run cleanup:preparation:development
```

El helper exige un run de cuotas nuevo preparado sólo con --prepare, conserva las credenciales únicamente en el artefacto privado ignorado y limita escrituras a tres actores, una solicitud y su espacio/catálogo sintéticos. No sustituye la recepción y confirmación real de correo ni mide productividad humana. Las pruebas de negocio por IAM y JWT de navegador se documentan por separado. No cambiar configuraciones de Cognito para simplificar QA. La limpieza conserva DAILY y la evidencia comercial sintética; no se usa con participantes. [Contrato y límites](architecture/007-incorporacion-del-piloto.md).

El [protocolo de primeros usuarios](piloto/protocolo.md) define convocatoria, datos autorizados, calendario, casos y criterios de éxito. Usar su [guía de incorporación](piloto/guia-primeros-usuarios.md) y copiar las [plantillas vacías](piloto/plantillas/README.md) a la ubicación privada acordada fuera de Git. TASK-013 deja preparada esa documentación; TASK-006 sigue pendiente hasta observar personas y registrar resultados reales.

El facilitador confirma dos espacios designados, dos miembros por espacio y una copia mínima de catálogo autorizada. No ejecutar scripts de preparación/cleanup sintético con cuentas de participantes: cada persona se registra y confirma su propio correo, y las invitaciones se comparten manualmente. Los resultados de la cohorte se separan de la práctica mediante el registro privado; el panel no ofrece filtro por cohorte ni una exportación de esos datos. Mantener las tareas medidas en v1 y pasar a los controles de v2 después. No se activa Stripe ni un cobro.

## Dar acceso al piloto

La landing permite registrarse mediante Cognito con verificación de correo. La recepción del código y confirmación se comprobaron con dos correos reales en development. Al confirmar, el trigger asigna una organización propia y rol admin; no acepta organización ni rol del cliente. También inicializa el perfil y la pertenencia en `MembersTable`: se comprobó su persistencia antes de la primera consulta de contexto a Equipo. No reutilizar pools del portafolio. Las pruebas automatizadas pueden usar cuentas sintéticas con MessageAction=SUPPRESS, sin enviar correos; esa vía de pruebas se distingue de la comprobación de entrega real.

El cliente usa Authorization Code + PKCE S256, state aleatorio y tokens con vencimiento. API Gateway valida issuer, audience y scope openid; las Lambdas exigen token_use de acceso. Catálogos y Cotizaciones consultan al servicio Equipo por IAM para comprobar pertenencia y rol actuales en DynamoDB. No se admite un token de identidad para operaciones comerciales. `X-Organization-Id` sólo solicita un espacio; el servidor comprueba acceso vigente y construye con él las claves comerciales. No autoriza el rol por los grupos de un JWT antiguo.

### Incorporar a un equipo

El núcleo de Equipo ya está aceptado en development. Para incorporar a una persona:

1. El administrador abre `/equipo`, revisa miembros y crea una invitación con correo y rol admin, seller o reader.
2. Comparte manualmente el enlace `/invitacion/<token>` con la persona destinataria. La aplicación no envía correos de invitación automáticamente. El enlace caduca a los siete días; no se guarda en notas públicas ni en Git.
3. La persona inicia sesión o se registra con ese mismo correo y lo verifica. La API consulta el correo verificado directamente al pool propio antes de mostrar o aceptar la invitación. Un enlace recibido con otro correo no concede acceso.
4. Al aceptar se conserva el espacio propio y se incorpora el nuevo. El selector de organización usa las pertenencias devueltas por servidor; cambiar espacio limpia el estado comercial de pantalla.
5. El administrador puede cambiar roles o retirar pertenencias desde la aplicación. La condición transaccional impide dejar el espacio sin administrador, incluso si dos cambios compiten. Una pertenencia retirada no revive al volver a abrir un enlace ya aceptado.

El retiro de un rol se consulta en cada operación protegida: conservar un access token con grupos antiguos no debe conservar el permiso. No se elimina una cuenta Cognito por retirar su pertenencia a un espacio.

### Migrar las cuentas anteriores

No editar grupos Cognito para administrar los permisos cotidianos del nuevo modelo. Si falta el registro `USER#<sub>/PROFILE`, Equipo obtiene usuario y grupos directamente de su pool mediante IAM e inicializa las pertenencias heredadas y contadores en transacción. El token del navegador no aporta la lista autorizada. Una vez creado `PROFILE`, ese marcador permanece aunque se retire la última pertenencia de una cuenta; borrar el perfil permitiría intentar otra inicialización y no forma parte de una retirada ordinaria.

La migración automática inicial contempla hasta 32 organizaciones heredadas por persona. Un caso superior requiere revisar su estado y diseñar una migración explícita sin borrar perfiles, tablas o usuarios. No reejecutar el alta como forma de restaurar una pertenencia que se retiró deliberadamente. Verificar los conteos de administradores y las dos claves de cada pertenencia antes de corregir datos por una vía operativa extraordinaria.

## Aceptación en development

1. Confirmar DNS/TLS y HTML inicial SSR; abrir y recargar rutas profundas.
2. Iniciar sesión por Cognito y comprobar el intercambio PKCE, expiración y salida.
3. Como admin, publicar un catálogo sintético v1. Como seller, simular y emitir; volver a enviar la misma clave y confirmar un solo id. Cambiar el contenido con esa clave y confirmar 409.
4. Publicar v2 y consultar la propuesta emitida: conserva moneda, desglose, reglas, versión y total.
5. Con otra organización, consultar ids anteriores devuelve 404. Reader no simula ni emite; seller no publica. Sin token se rechazan las rutas protegidas.
6. Confirmar que el origen Function URL no acepta invocación pública; CloudFront sí. HTML, config y respuestas comerciales sin caché compartida. Authorization llega al origen API.
7. Verificar transacciones/condiciones DynamoDB reales, permisos mínimos, métricas de errores/latencia y logs sin datos comerciales ni tokens.
8. Registrar mediciones del piloto y verificar alarmas/presupuesto antes de promover. Un benchmark local no completa este punto.
9. Para el incremento de Equipo, crear y aceptar una invitación manual con el correo verificado correcto; rechazar otro correo, token desconocido o invitación caducada. Repetir aceptación no duplica acceso ni restaura un rol retirado.
10. Comprobar selector entre dos organizaciones, rechazo de `X-Organization-Id` ajeno, cambio de rol y retirada con un token obtenido antes del cambio. Ejecutar cambios concurrentes que intenten retirar a los últimos administradores y verificar que permanece uno.
11. Migrar una cuenta previa desde grupos consultados por IAM, comprobar `PROFILE`, retirar una pertenencia y confirmar que el grupo heredado no la recrea. Acreditar condiciones/transacciones con DynamoDB real; las pruebas locales no completan esta aceptación.

## Recuperación

Conservar artifacts y revisión validada de cada ambiente. Volver a desplegar una revisión conocida siguiendo el procedimiento autorizado, sin borrar tablas ni el pool. Las tablas/pool se retienen al eliminar el stack; confirmar copias y estado de datos antes de cualquier operación destructiva. La creación de una nueva versión de catálogo corrige precios sin modificar propuestas existentes.

## Límites actuales

No se incluye facturación, exportación PDF, envío automático de invitaciones ni importación de catálogos grandes. Equipo, invitaciones manuales, selección entre organizaciones y migración inicial están implementados y su núcleo se comprobó en AWS y navegador. Esa aceptación técnica no completa el piloto comercial ni valida precios o demanda; las revisiones y sus comprobaciones se mantienen en [Verificación](verificacion.md).

Esencial $399, Equipo $1,199 y Empresa $3,499 MXN/mes son precios propuestos antes de impuestos. Sus límites operativos 2/2/100, 8/10/1,000 y 25/50/5,000 expresan miembros/catálogos activos/propuestas mensuales y se aplican en backend. `services/shared/plans.json` mantiene `proposal`, `limitsEnforced: true` y `billingEnabled: false`. `/consumo` muestra uso, capacidades, avisos desde el 80% y reinicio mensual UTC. Crear una cuenta no contrata un plan y el piloto continúa sin cargos. Stripe queda pendiente.

## Asignar un plan del piloto en desarrollo

Los espacios nuevos usan Esencial. No existe una ruta pública ni una operación RPC para concederse Equipo o Empresa. El operador autorizado utiliza IAM y las guardas de `tools/plan-development.mjs`:

```powershell
node --use-system-ca tools/plan-development.mjs --show <organizationId>
node --use-system-ca tools/plan-development.mjs --set <organizationId> equipo
```

Los únicos planes admitidos son esencial, equipo y empresa. El script comprueba cuenta 765932874577, región us-east-1, stack cotitrama-development completamente desplegado, tabla propia y organización existente con administrador. El cambio no crea una suscripción ni realiza cobros. Coordinar una ventana sin escrituras del equipo y esperar que terminen las solicitudes antes de cambiar el plan: Catálogos/Cotizaciones usan el plan que leyeron al autorizar cada petición. Una reducción conserva los datos y puede mostrar exceso; impide nuevo crecimiento en la dimensión agotada.

Antes de activar contadores en un ambiente con usuarios anteriores, importar sus pertenencias Cognito pendientes, pausar escritores antiguos y drenar el timeout de Lambda antes del primer backfill. No inicializar consumo como cero si ya hay datos. En esta entrega se comprobó que development no tenía usuarios Cognito antes del despliegue. La inicialización de contadores usa lecturas fuertes paginadas y escritura condicional; no borrar ni reiniciar contadores para resolver un límite comercial. [Diseño y condiciones de activación](architecture/003-limites-y-consumo.md).

## Consultar las métricas del piloto

Un administrador abre `/piloto` y elige 7, 30 o 90 días calendario UTC para la organización activa. El panel distingue emisiones, muestra de tiempo activo estimado, mediciones ausentes, ajustes entre revisiones exitosas y correcciones declaradas. Miembros, catálogos y cuota del mes son el estado actual del espacio. Cambiar de ventana no reconstruye esos valores históricos.

La configuración captura la medición al primer intento de emitir; los reintentos idénticos conservan su clave y medición. Una edición comercial posterior abre otro flujo. El tiempo puede ser cero cuando el navegador no tuvo foco, y los históricos sin instrumentación aparecen sin medición. No usar estos datos técnicos para afirmar ahorro sin contrastarlos con personas y procesos reales.

Un vendedor o administrador abre una propuesta guardada y usa **Registrar corrección detectada** para declarar una categoría. La declaración no cambia sus importes ni consume otra propuesta. Si falla la respuesta, **Reintentar registro** conserva la referencia y el motivo; sólo **Registrar otra corrección** inicia un registro adicional. El administrador actualiza el panel para consultar el nuevo evento.

La consulta aplica un presupuesto compartido de 100 páginas, 30,000 registros y comprobaciones de plazo de seis segundos entre lecturas. `503 METRICS_LIMIT` significa que hace falta revisar el volumen y el acceso temporal del histórico; no es un agregado parcial ni se resuelve necesariamente eligiendo menos días, porque se incluyen propuestas anteriores sin metadatos temporales. La llamada SDK que ya esté en curso conserva su propio timeout. Ver [definiciones y límites](architecture/004-metricas-del-piloto.md).

Para repetir la aceptación sintética de este incremento, usar exclusivamente development y un stack en `UPDATE_COMPLETE`:

```powershell
node --use-system-ca tools/pilot-metrics-smoke.mjs --prepare
npm run smoke:metrics:development
node --use-system-ca tools/pilot-metrics-smoke.mjs --browser
# Completar el flujo autenticado del panel y la propuesta en el navegador.
npm run cleanup:metrics:development
```

Los helpers restringen cuenta, región, stack y tablas propias; preparan tres cuentas QA con envío de correo suprimido y organizaciones independientes. Las credenciales QA son temporales e ignoradas por Git. La limpieza elimina sólo esas cuentas y sus grupos registrados; conserva los registros sintéticos DynamoDB como evidencia. Las duraciones de 60/120 segundos de la prueba son fixtures declarados para verificar media y mediana, sin modificar el reloj de AWS ni demostrar tiempos humanos. El piloto sigue sin cobros y Stripe continúa pendiente.

## Registro y recuperación

PostConfirmation requiere email_verified y la confirmación de alta; un cambio de contraseña no crea otra organización. Si un fallo de AWS deja una cuenta recién confirmada sin perfil inicial, revisar el evento y su estado antes de reejecutar el evento original con la función de incorporación por IAM. Verificar perfil, pertenencia y contador de administradores antes de pedir otro inicio de sesión. Una pertenencia deliberadamente retirada no es un fallo de incorporación y no se restaura por esta vía. La aceptación de invitaciones requiere identidad, correo verificado y token destinatario; no hay un endpoint que permita escoger libremente organización o rol.

Las alarmas del stack se consultan en CloudWatch. No se configuran destinatarios de correo ni acciones automáticas de facturación. Las reservas de costo y los precios son hipótesis documentadas en [Planes de suscripción](planes-suscripcion.md), pendientes de contrastar con uso, costos y personas del piloto.
