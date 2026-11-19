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

El stack `infra/template.yaml` declara Web SSR, Catálogos, Cotizaciones, Equipo, Incorporación, Salud, HTTP API, Cognito, tres tablas propias por dominio, CloudFront OAC y aliases A/AAAA. Equipo y su tabla de pertenencias ya se desplegaron y verificaron en development, junto con la base comercial. La aceptación incluye condiciones/transacciones reales y operaciones con JWT en navegador. No hay recursos de demo en el stack. Requiere una zona pública existente de lynxpardelle.com y un certificado ACM en us-east-1 que cubra el subdominio de cada ambiente. Un wildcard `*.lynxpardelle.com` cubre los tres nombres previstos.

Los identificadores de zona y certificado son parámetros del despliegue. `infra/environments.json` contiene los valores públicos comprobados mediante lecturas de AWS el 19 de noviembre de 2026: zona pública existente, certificado ISSUED para lynxpardelle.com y *.lynxpardelle.com, y nombres de stack/ambiente. Development ya publica su alias; no confundir la comprobación anterior a la creación del stack con el estado desplegado. Revalidar esos valores antes de ejecutar otro despliegue; no deben pegarse credenciales en archivos del repositorio. SAM CLI y cfn-lint son herramientas de operación, no dependencias del navegador.

```powershell
cfn-lint infra/template.yaml
sam build --template-file infra/template.yaml
```

En este checkout también se verificó con `.\.tools\sam\Scripts\python.exe -m samcli build --template-file infra/template.yaml`, usando SAM CLI 1.173.0 instalado localmente sin cambiar PATH. Las herramientas de `.tools/` están ignoradas y no forman parte del producto.

Desde la rama development, revisa el changeset para el stack de desarrollo antes de ejecutarlo. Usa Stage=development y los parámetros HostedZoneId/CertificateArn. Para testing y production, usa stacks y parámetros del ambiente correspondiente y sigue los PRs de [promoción](promocion.md). Nunca desplegar una revisión de main como corrección directa que eluda development → testing → main.

El frontend empaquetado requiere `npm run build` antes de SAM. Su handler es `index.handler`, en `web/dist/lambda`; los adaptadores de servicios tienen handlers `catalog/index.handler`, `quoting/index.handler`, `team/index.handler` y `onboarding/index.handler`. El paquete de Web incluye el adaptador serverless y no necesita dependencias instaladas en el runtime de Lambda.

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

## Registro y recuperación

PostConfirmation requiere email_verified y la confirmación de alta; un cambio de contraseña no crea otra organización. Si un fallo de AWS deja una cuenta recién confirmada sin perfil inicial, revisar el evento y su estado antes de reejecutar el evento original con la función de incorporación por IAM. Verificar perfil, pertenencia y contador de administradores antes de pedir otro inicio de sesión. Una pertenencia deliberadamente retirada no es un fallo de incorporación y no se restaura por esta vía. La aceptación de invitaciones requiere identidad, correo verificado y token destinatario; no hay un endpoint que permita escoger libremente organización o rol.

Las alarmas del stack se consultan en CloudWatch. No se configuran destinatarios de correo ni acciones automáticas de facturación. Las reservas de costo y los precios son hipótesis documentadas en [Planes de suscripción](planes-suscripcion.md), pendientes de contrastar con uso, costos y personas del piloto.
