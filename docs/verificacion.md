# CotiTrama: aceptación de development en AWS

Verificado el 19 de noviembre de 2026. Desarrollo está desplegado en **https://cotitrama-dev.lynxpardelle.com**. Testing y producción no se promovieron.

## Entrega

- Rama `development`, trabajo previo conservado y publicado en origin.
- Aplicación desplegada: commit `8f4dcac107092f4543d58770d32a506966b94989` (landing, registro y flujo comercial).
- Herramienta de aceptación: commit `3fdc82ea2f1175f49aed7ff0998be70cc8dffa02`; los ajustes posteriores añaden evidencia y comandos de TLS locales, sin cambiar el runtime desplegado.
- Stacks exclusivos: `cotitrama-artifacts` y `cotitrama-development`, región us-east-1. Ambos CREATE_COMPLETE. El stack de aplicación lleva SourceCommit del código desplegado.
- CloudFront E3GSFWU10YQHF3, DNS A/AAAA y TLS válidos; certificado existente reutilizado sin modificarlo. No se cambiaron nameservers ni recursos de otros proyectos.
- Cinco Lambdas: Web SSR, Catálogos, Cotizaciones, Registro y Salud. Tablas DynamoDB separadas por dominio, Cognito propio y Function URL protegida con IAM/OAC.

## Comprobaciones locales y CI

| Comprobación | Resultado |
| --- | --- |
| Backend | 32 pruebas pasan, incluidas seis de onboarding. |
| Guardas del smoke AWS | 2 pruebas pasan; restringen stack, cuenta, región y limpieza QA. |
| Angular | 17 pruebas pasan. |
| Empaquetado | 2 pruebas pasan; sin assets residuales y paquete npm válido para SAM. |
| Build Angular SSR | Salida 0; bundle inicial 339.76kB, transferencia estimada 93.89kB. |
| SAM build | Salida 0, cinco funciones. |
| cfn-lint | Plantillas aplicación y artefactos sin errores. |
| CI aplicación | [Ejecución 44609859453](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44609859453), success. |
| CI guardas | [Ejecución 44610410180](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44610410180), success. |

## Servicios reales

`node --use-system-ca tools/aws-smoke.mjs --verify` completó ocho comprobaciones:

1. Dos cuentas QA sintéticas, sin envío de emails, con organizaciones distintas.
2. Onboarding idempotente mediante la Lambda desplegada: dos invocaciones conservan un único grupo.
3. Publicación de catálogo y cálculo exacto: subtotal 27,750.00 MXN, descuento 1,387.50 MXN, total 26,362.50 MXN.
4. Ocho emisiones concurrentes conservan un solo identificador; cambiar contenido con la misma clave devuelve 409.
5. Publicar v2 con otro precio y nombre de opción no cambia el snapshot emitido en v1.
6. Recursos de otra organización devuelven 404; reader no simula y seller no publica.
7. CloudFront entrega landing/config/health, y el API de negocio rechaza solicitudes sin token.
8. La Function URL directa rechaza invocaciones anónimas con 403.

Estos casos de negocio del script invocan Lambdas por IAM con el contrato HTTPv2 y comprueban DynamoDB real. Los casos de rol del script usan variantes explícitas de claims; su límite se declara en el reporte.

## Navegador, Cognito y JWT reales

La aceptación por navegador completó el tramo que no cubre la invocación IAM:

- La llamada Crear cuenta abrió el formulario público de Cognito con PKCE S256 y callback correcto.
- Login con usuario QA, intercambio Authorization Code/PKCE, sesión y logout reales.
- Listado y publicación desde Angular a través de CloudFront → API Gateway/JWT → Lambda → DynamoDB.
- Publicación de `oficina` v1, configuración de cinco escritorios con roble e instalación, cálculo y emisión por **26,362.50 MXN**.
- Propuesta `a158e508-c140-45d2-abf9-09f032679900` conservó v1, opciones e importes al recargar su URL después de publicarv2 con base 9,000.00 MXN y roble 1,200.00 MXN.
- Segunda cuenta autenticada: catálogo vacío y propuesta ajena rechazada con el mensaje de recurso inexistente en su organización. Esto prueba aislamiento con JWT real.
- Landing responsive, sin desbordamiento a 390 × 844; enlaces de planes y FAQ operativos. Sin errores de aplicación en el flujo positivo; el 404 de aislamiento es esperado.

Evidencia local ignorada por Git: `artifacts/aws-smoke-verified.json`, `artifacts/aws-browser.json`, `artifacts/cotitrama-aws-landing.jpg` y `artifacts/cotitrama-aws-propuesta.jpg`.

## Limpieza y operación

Después del navegador, `npm run cleanup:aws:development` eliminó las dos cuentas QA y sus grupos, verificando propiedad y ausencia de miembros ajenos. El archivo privado de contraseñas fue eliminado. Los datos sintéticos de DynamoDB se conservan como evidencia. Las cuatro alarmas del stack (API 5xx, Catálogos, Cotizaciones y Registro) estaban en OK al cerrar la aceptación.

En este Windows, Node necesitó `--use-system-ca` para usar la confianza TLS del sistema. No se desactivó verificación de certificados ni se cambió la configuración de Windows.

## Pendientes reales

- Confirmar recepción de correo en el primer registro de una persona: las cuentas QA se crearon con envío suprimido, sin simular un buzón humano.
- Piloto con usuarios/datos autorizados y medición de tiempo por cotización, correcciones y reglas reutilizadas. Las pruebas sintéticas no validan demanda ni ahorro comercial.
- Definir precios, cuotas aplicadas por plan, invitaciones y administración de miembros; condiciones comerciales y presupuesto operativo antes de producción.
- Stripe continúa pendiente por instrucción del usuario. No hay checkout ni cobros habilitados.
- Promover mediante PR development → testing → main cuando se autorice. El dominio de producción aún es una dirección prevista.
