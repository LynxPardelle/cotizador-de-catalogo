# Verificación de CotiTrama

Fecha: 19 de noviembre de 2026. Resultado: flujo local implementado y comprobado; aceptación de nube y piloto comercial pendientes.

## Resultados ejecutados

| Comprobación | Resultado observado |
| --- | --- |
| `npm test` | 26 pruebas de backend pasan. Motor, roles/organización, publicación, snapshot, idempotencia concurrente, fechas y contratos SDK. |
| `npm run test:web` | 13 pruebas en cinco archivos pasan: navegación, publicación, presentación monetaria, sesión, preview obsoleta, reintentos y caducidad reactiva. |
| `npm run build` | Angular browser/server y paquete Lambda completos. Bundle inicial 323.03 kB; transferencia estimada 89.98 kB. |
| `npm run smoke:ssr` | Invocación del handler Lambda real sin AWS: redirección raíz, HTML inicial, rutas profundas, ausencia de tokens, config sin caché y negocio separado. |
| `npm run test:package` | Dos pruebas pasan: el nuevo paquete excluye assets residuales y es un paquete npm válido con handler/browser/server. |
| `cfn-lint infra/template.yaml` | cfn-lint 1.60.1: salida 0 sin avisos. |
| `npm run pilot` | 250 simulaciones sintéticas en memoria y comprobaciones de snapshot/replay/aislamiento. Informe en `artifacts/pilot-local.json`. |
| SAM build | SAM CLI 1.173.0: salida 0, cuatro funciones y `.aws-sam/build/template.yaml`. El paquete Web de SAM devuelve 200 en `/config.json` (demo:false, no-store) y `/cotizar` (HTML CotiTrama). |

SAM se instaló en un entorno virtual local ignorado por Git. Se resolvió el límite Windows de 260 caracteres con un prefijo de ruta extendida, sin cambios al registro ni configuración del sistema. Los paquetes SAM de negocio incluyen handlers/SDK y excluyen el servidor demo, fixtures y pruebas gracias a una lista explícita de módulos runtime.

Los adaptadores AWS se verifican con comandos SDK v3 inyectados: condiciones de publicación, paginación por organización, transacción de propuesta/idempotencia, carreras y contrato de invocación de Catálogos. No se presentan como pruebas ejecutadas contra DynamoDB o Cognito reales.

## Navegador real y build final

En la demo loopback con Angular SSR y el mismo adaptador de Lambda:

1. Una combinación Roble + Blanco fue rechazada con el mensaje de incompatibilidad.
2. Cinco escritorios con Roble e Instalación dieron subtotal 27,750.00 MXN, descuento 1,387.50 MXN y total **26,362.50 MXN**.
3. Se emitió la propuesta `ce71129f-5021-4a12-8473-d94a78403c08` con catálogo v1.
4. Se publicó v2 cambiando precio base a 9,000.00 MXN y Roble a Roble premium por 1,200.00 MXN.
5. Una carga nueva de la URL de la propuesta original mantuvo v1, Roble, el precio original y el total **26,362.50 MXN**.
6. En viewport móvil solicitado por la prueba (390 × 844), el ancho de contenido coincidió con el ancho disponible, sin desbordamiento horizontal.
7. Consola del build final sin errores ni warnings capturados. Se restauró el viewport normal.

Evidencia local: `artifacts/cotitrama-demo.jpg` y `artifacts/cotitrama-propuesta.jpg`. Esos artifacts están ignorados por Git. La demo es temporal: sus propuestas sólo existen mientras siga vivo el servidor.

## Revisión y correcciones comprobadas

Se corrigieron con regresiones reproducidas las fechas ISO normalizadas silenciosamente, el 503 de servicio no disponible, la publicación del ejemplo sin incompatibilidades explícitas, la respuesta de preview obsoleta tras editar, la caducidad no reactiva y los assets residuales en paquetes sucesivos. El snapshot conserva nombres e importes de opciones, además de sus identificadores.

## Lecturas actuales de AWS

Se comprobó acceso por STS, la zona pública existente lynxpardelle.com, un certificado ACM ISSUED en us-east-1 con SAN *.lynxpardelle.com y la ausencia de registros CotiTrama en esa zona. Los parámetros públicos se guardan en `infra/environments.json`. Estas lecturas no crearon recursos, usuarios, DNS, certificados ni despliegues.

## Estado para continuar desde remoto

La rama de trabajo sigue en **main** y HEAD conserva `f75c0d3ee1f8299943fbefc04d8b032357c1e262`; los cambios de implementación están **locales, sin commit ni push**. La carpeta y origin históricos se conservan. Logs of Change y Notion no se modificaron y conservaron architecture/serverless-product-foundation.

El siguiente paso de entrega es incorporar el trabajo en development sin perder estos cambios, revisar el despliegue development con los parámetros verificados y ejecutar la aceptación AWS de `docs/operacion.md`. Luego usar los PR de development → testing → main. No desplegar cambios locales directamente como producción.

Quedan pendientes la sesión real Cognito/PKCE, las transacciones/condiciones y permisos en DynamoDB real, OAC/DNS/TLS desplegados, mediciones de latencia AWS, presupuesto/alarmas y el piloto con usuarios/datos autorizados. La demanda comercial y las métricas de ahorro no están validadas por la demo.

## Ampliación y preparación de development

Por instrucción del usuario se incorporaron los cambios a development, conservando íntegro el trabajo previo. Se añadió landing SSR pública, planes en preparación sin cobro y registro Cognito con organización propia después de confirmar el correo. Las suites actuales pasan32backend+17frontend+2empaquetado, buildSSR, smoke y cfn-lint de ambas plantillas. El siguiente registro de esta sección documentará commit, despliegue y aceptación AWS observada.
