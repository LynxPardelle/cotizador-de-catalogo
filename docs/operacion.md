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

El stack `infra/template.yaml` contiene Web SSR, Catálogos, Cotizaciones, Salud, HTTP API, Cognito, dos tablas, CloudFront OAC y aliases A/AAAA. No hay recursos de demo en el stack. Requiere una zona pública existente de lynxpardelle.com y un certificado ACM en us-east-1 que cubra el subdominio de cada ambiente. Un wildcard `*.lynxpardelle.com` cubre los tres nombres previstos.

Los identificadores de zona y certificado son parámetros del despliegue. `infra/environments.json` contiene los valores públicos comprobados mediante lecturas de AWS el 19 de noviembre de 2026: zona pública existente, certificado ISSUED para lynxpardelle.com y *.lynxpardelle.com, y nombres de stack/ambiente. No había registros CotiTrama en esa zona al comprobarlos. Revalidar esos valores antes de ejecutar un despliegue; no deben pegarse credenciales en archivos del repositorio. SAM CLI y cfn-lint son herramientas de operación, no dependencias del navegador.

```powershell
cfn-lint infra/template.yaml
sam build --template-file infra/template.yaml
```

En este checkout también se verificó con `.\.tools\sam\Scripts\python.exe -m samcli build --template-file infra/template.yaml`, usando SAM CLI 1.173.0 instalado localmente sin cambiar PATH. Las herramientas de `.tools/` están ignoradas y no forman parte del producto.

Desde la rama development, revisa el changeset para el stack de desarrollo antes de ejecutarlo. Usa Stage=development y los parámetros HostedZoneId/CertificateArn. Para testing y production, usa stacks y parámetros del ambiente correspondiente y sigue los PRs de [promoción](promocion.md). Nunca desplegar una revisión de main como corrección directa que eluda development → testing → main.

El frontend empaquetado requiere `npm run build` antes de SAM. Su handler es `index.handler`, en `web/dist/lambda`; los adaptadores de servicios tienen handlers `catalog/index.handler` y `quoting/index.handler`. El paquete de Web incluye el adaptador serverless y no necesita dependencias instaladas en el runtime de Lambda.

## Dar acceso al piloto

La landing permite registrarse mediante Cognito con verificación de correo. Al confirmar, el trigger asigna una organización propia y rol admin; no acepta organización ni rol del cliente. Para las pruebas automatizadas se crean cuentas sintéticas con MessageAction=SUPPRESS, sin enviar correos, y se eliminan al cerrar la verificación. Un operador de Cognito puede asignar roles de equipo con formato `org:demo:admin`, `org:demo:seller` u `org:demo:reader`, y asigna a cada persona un único grupo de organización. No reutilizar pools del portafolio. Usar invitaciones/credenciales temporales de Cognito y los canales habituales, sin almacenarlas en Git.

El cliente usa Authorization Code + PKCE S256, state aleatorio y tokens con vencimiento. API Gateway valida issuer, audience y scope openid; las Lambdas validan token_use, pertenencia y permisos. No se admite un token de identidad para operaciones comerciales ni se selecciona organización mediante headers del cliente.

## Aceptación en development

1. Confirmar DNS/TLS y HTML inicial SSR; abrir y recargar rutas profundas.
2. Iniciar sesión por Cognito y comprobar el intercambio PKCE, expiración y salida.
3. Como admin, publicar un catálogo sintético v1. Como seller, simular y emitir; volver a enviar la misma clave y confirmar un solo id. Cambiar el contenido con esa clave y confirmar 409.
4. Publicar v2 y consultar la propuesta emitida: conserva moneda, desglose, reglas, versión y total.
5. Con otra organización, consultar ids anteriores devuelve 404. Reader no simula ni emite; seller no publica. Sin token se rechazan las rutas protegidas.
6. Confirmar que el origen Function URL no acepta invocación pública; CloudFront sí. HTML, config y respuestas comerciales sin caché compartida. Authorization llega al origen API.
7. Verificar transacciones/condiciones DynamoDB reales, permisos mínimos, métricas de errores/latencia y logs sin datos comerciales ni tokens.
8. Registrar mediciones del piloto y verificar alarmas/presupuesto antes de promover. Un benchmark local no completa este punto.

## Recuperación

Conservar artifacts y revisión validada de cada ambiente. Volver a desplegar una revisión conocida siguiendo el procedimiento autorizado, sin borrar tablas ni el pool. Las tablas/pool se retienen al eliminar el stack; confirmar copias y estado de datos antes de cualquier operación destructiva. La creación de una nueva versión de catálogo corrige precios sin modificar propuestas existentes.

## Límites actuales

No se incluye facturación, exportación PDF, invitaciones de equipo, importación de catálogos grandes ni migración automática de organizaciones. La validación local no acredita un despliegue o piloto comercial concluido.

## Registro y recuperación

PostConfirmation requiere email_verified y la confirmación de alta; un cambio de contraseña no crea otra organización. Si un fallo de AWS deja una cuenta confirmada sin grupo, el operador reejecuta el evento original con la función de onboarding por IAM y verifica la pertenencia antes de pedir al usuario que vuelva a iniciar sesión. No hay endpoint público que otorgue membresías.

Las alarmas del stack se consultan en CloudWatch. No se configuran destinatarios de correo ni acciones automáticas de facturación; el presupuesto comercial y los precios por plan se definirán con el piloto.
