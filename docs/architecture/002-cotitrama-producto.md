# CotiTrama: identidad y diseño de la primera versión

Decisión del 19 de noviembre de 2026, dentro de la autorización para actualizar el plan e implementar sin intervención adicional.

CotiTrama conecta catálogos publicados, reglas de precio y propuestas reproducibles. El nombre descriptivo anterior, Cotizador de Catálogo, pasa a ser la categoría del producto. La búsqueda pública inicial descartó NexoCotiza por una colisión directa en software de cotizaciones; no encontró coincidencias exactas para CotiTrama. Esto no constituye validación marcaria. La carpeta y el remoto Git existentes se conservan como identificadores históricos para no interrumpir los accesos remotos.

Producción usa `cotitrama.lynxpardelle.com`; desarrollo `cotitrama-dev.lynxpardelle.com`; pruebas `cotitrama-test.lynxpardelle.com`. No se reutilizan los aliases del portafolio ni se modifican nameservers.

Se adopta el patrón existente del portafolio: Angular standalone con SSR, Express y serverless-http dentro de una Lambda Node.js 24 arm64. Una Function URL con IAM recibe tráfico de CloudFront mediante OAC. HTML/configuración y API no se cachean. Los archivos con hash llevan caché inmutable. La sesión comercial se inicia en el navegador; SSR sólo entrega la estructura pública y nunca datos protegidos ni tokens.

Se consideró conservar el frontend como SPA estática en S3 (menos ejecución, pero no cumple el alojamiento Angular en Lambda solicitado) o reunir toda la aplicación en una Lambda (menos recursos iniciales, pero mezcla permisos y responsabilidades). Se eligen funciones separadas de Web, Catálogos, Cotizaciones y Salud. Cada dominio es dueño de su tabla y contrato. Cotizaciones invoca la lectura de Catálogos por IAM; no consulta su tabla. Una base de código compartida no comparte permisos ni propiedad de datos.

El flujo verificable es publicar v1, elegir opciones/cantidades, obtener desglose calculado en backend, emitir con idempotencia, publicar v2 y reabrir la propuesta anterior con su snapshot intacto. BigInt conserva la aritmética monetaria; JSON transporta cadenas en unidades menores. Versiones y propuestas son inmutables. Se rechazan precios negativos, incompatibilidades, cantidades inválidas y revisiones vencidas.

Cognito con Authorization Code + PKCE autentica a los usuarios. API Gateway valida JWT y scopes; cada servicio obtiene organización/rol de grupos firmados `org:<id>:<admin|seller|reader>`. Los usuarios no eligen organización por un campo del formulario o cabecera. Sólo administradores publican; vendedores y administradores cotizan. La ampliación autorizada habilita registro público con verificación de correo y trigger PostConfirmation que asigna una organización propia de forma idempotente. Las búsquedas en otra organización responden 404.

El modo de demostración es un servidor en loopback con repositorios en memoria y datos sintéticos. Nunca se activa por parámetros del stack ni por el frontend publicado. Las pruebas cubren el cálculo, autorizaciones, idempotencia concurrente, conservación de snapshots, UI y el adaptador SSR empaquetado. DynamoDB, Cognito y DNS requieren comprobación posterior en development antes de promover a testing y main.

Referencias: [Angular SSR](https://angular.dev/guide/ssr), [CloudFront OAC para Lambda](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html), [producto NexoCotiza](https://cotiza.nexosoftware.cl/).
