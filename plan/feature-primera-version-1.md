---
goal: Primera versión de CotiTrama
version: '1.3'
date_created: 2026-11-17
date_updated: 2026-11-19
status: 'In Progress'
tags: [feature, microservices, aws, angular, ssr]
---

# Primera versión de CotiTrama

El producto pasa de una base de salud a un flujo comercial reproducible. Se mantiene el identificador histórico del repositorio para continuidad remota. [Diseño y nombre](../docs/architecture/002-cotitrama-producto.md).

## Requisitos y límites

- **REQ-001** Publicar catálogo v1 → configurar → revisar desglose → emitir → publicar v2 → reabrir propuesta original sin cambios.
- **REQ-002** Arquitectura de microservicios en AWS: Web SSR, Catálogos, Cotizaciones, Equipo e identidad y Salud en Lambdas separadas. Tablas y roles por dominio; comunicación mediante contratos. El trigger de Incorporación inicializa la tabla propia del dominio de identidad.
- **REQ-003** Frontend Angular standalone, rutas lazy, SignalStore por flujo y HttpClient tipado, servido por Lambda mediante Angular SSR/Express/serverless-http. CloudFront OAC/IAM protege el origen Web.
- **REQ-004** Subdominios de lynxpardelle.com: cotitrama-dev, cotitrama-test y cotitrama para development, testing y production. DNS/TLS por infraestructura; no modificar nameservers ni aliases del portafolio.
- **SEC-001** Cognito Authorization Code + PKCE; JWT verificado por API Gateway para identificar el `sub`. Equipo resuelve organización y rol actuales en su tabla propia mediante invocación IAM. `X-Organization-Id` selecciona un espacio únicamente si el servidor confirma pertenencia; los grupos del JWT no son autoridad de rol. Accesos a recursos comerciales ajenos devuelven 404. Demo sólo local y sintética.
- **CON-001** Revisiones y snapshots inmutables, emisión idempotente y conflicto al cambiar el contenido de una clave ya usada.
- **CON-002** Importes BigInt serializados como cadenas de unidades menores, cantidades enteras, reglas/moneda/redondeo explícitos. Backend decide los importes.
- **OPS-001** Toda elevación sigue development → testing → main. Cambios locales no son promoción ni despliegue.

## Implementación

| Tarea | Alcance | Estado |
| --- | --- | --- |
| **TASK-001** Motor de reglas | `services/quoting/domain/price.mjs`: validación de revisiones, opciones/cantidades, prioridad, descuentos/recargos y redondeo. Casos sintéticos, límites e invariantes monetarias. | Verificada localmente (19/11/2026) |
| **TASK-002** Catálogos y Cotizaciones | Handlers HTTP, repositorios de memoria/AWS, tablas independientes, contrato de lectura IAM, publicación condicional, snapshots e idempotencia transaccional. Pruebas de roles, aislamiento y reintentos. | Verificada en AWS y navegador con JWT real (19/11/2026) |
| **TASK-003** Flujo Angular y sesión | Catálogos, configuración, preview, emisión y reapertura; estados de carga/error/vigencia. PKCE, sesión expirable y roles UI. SSR y paquete Lambda con invocación local. | Verificada localmente (19/11/2026) |
| **TASK-004** Piloto sintético | Catálogo de oficina con opciones, incompatibilidades y volumen; servidor demo loopback y carga pequeña reproducible con informe. | Piloto sintético verificado; piloto comercial pendiente |
| **TASK-005** Microservicios y dominio en nube | SAM completo, Cognito, IAM mínimo, logs/retención, DynamoDB, CloudFront OAC y Route 53. Lint y CI. Despliegue development, smoke JWT/DDB/DNS y luego promociones. | Development desplegado y verificado; testing/main pendientes |
| **TASK-006** Piloto autorizado | Usuarios de prueba y catálogo del primer sector autorizados. Medir minutos/cotización, correcciones, reutilización de reglas y latencia AWS. Alarmas y presupuesto del ambiente. | Pendiente |

TASK-002 y TASK-005 quedaron aceptadas en development con servicios administrados y navegador autenticado. Testing y main conservan su puerta de promoción. TASK-006 requiere evidencia real; un catálogo sintético no valida demanda ni ahorro comercial.

## Ampliación autorizada: sitio, registro y suscripciones

- **TASK-007** Landing pública SSR, registro Cognito con PKCE y verificación de correo, organización propia por cuenta confirmada e idempotencia del alta. Implementada y verificada en development, incluida recepción y confirmación con correo real antes del incremento de Equipo.
- **TASK-008** Propuesta de planes mensuales antes de impuestos: Esencial $399 MXN (2 miembros, 2 catálogos, 100 propuestas/mes), Equipo $1,199 (8/10/1,000), Empresa $3,499 (25/50/5,000). Fuente compartida `config/plans.json`, estado `proposal`; precios/límites por validar con el piloto, sin cobros ni cuotas de pago activas. [Matriz y escenario de costos](../docs/planes-suscripcion.md). Stripe permanece pendiente por instrucción del usuario.
- **TASK-009** Incorporar el trabajo en development, commit/push, validar CI y desplegar exclusivamente development. Ejecutar el flujo comercial con Cognito/HTTP API/DynamoDB y la URL pública, comprobar aislamiento y preservar los otros proyectos. Completada: commits/push, CI verde y development desplegado con aceptación AWS y navegador.
- **TASK-010** Servicio Equipo y tabla propia `MembersTable`, contexto de organización, selector Angular y gestión de miembros. Autoridad de pertenencias en DynamoDB consultada por IAM; cambios/retiradas con protección transaccional del último administrador. Invitaciones manuales de siete días con hash persistido y aceptación ligada al correo verificado. Migración de grupos consultados directamente a Cognito una sola vez mediante `PROFILE`, sin restaurar accesos retirados. Implementación y comprobaciones locales del incremento realizadas; despliegue y aceptación con servicios AWS pendientes. La aceptación anterior de TASK-009 no acredita este incremento.

## Verificación y evidencia

- **TEST-001** Motor puro: importes, moneda/exponente, revisión exacta, redondeo, incompatibilidad, caducidad, límites y prioridad estable.
- **TEST-002** Flujo de handlers: publicación v1, preview, emisión, actualización v2 y snapshot intacto; reintentos concurrentes, conflictos, roles y organizaciones.
- **TEST-003** Pruebas de UI/servicios Angular, compilación browser/server e invocación del adaptador Lambda empaquetado para rutas profundas y configuración sin caché.
- **TEST-004** Lint CloudFormation/SAM, contrato IAM por servicio y CI sin despliegues. Validación de controles de promoción existentes.
- **TEST-005** Informe `artifacts/pilot-local.json`: carga sintética reproducible, con límites y métricas comerciales explícitamente pendientes.
- **TEST-006** Aceptación AWS descrita en [Operación](../docs/operacion.md): Cognito/PKCE, JWT, transacciones DynamoDB reales, OAC, DNS/TLS, logs, latencia, aislamiento y permisos.
- **TEST-007** Equipo: autorización con pertenencias vigentes, rechazo de selección ajena y de claims históricos; invitación al correo correcto, caducidad, idempotencia y no restauración tras retirada. Cambios concurrentes preservan un administrador. Migración inicial conserva `PROFILE` y no repuebla una pertenencia eliminada. Repetir con DynamoDB/Cognito reales después del despliegue del incremento.

Comandos desde la raíz: `npm test`, `npm run test:web`, `npm run build`, `npm run smoke:ssr`, `npm run pilot`, `cfn-lint infra/template.yaml`. Los resultados observados y las limitaciones se registran en [Verificación](../docs/verificacion.md).

## Recursos y entrega

| Recurso | Ubicación |
| --- | --- |
| Infraestructura serverless | `infra/template.yaml` |
| Catálogos y propuestas | `services/catalog/`, `services/quoting/` |
| Equipo, pertenencias e incorporación | `services/team/`, `services/onboarding/` |
| Contratos, auth y adaptadores | `services/shared/` |
| Datos sintéticos | `services/fixtures/catalog.mjs` |
| Angular por flujo | `web/src/app/features/` |
| Sesión y contratos frontend | `web/src/app/core/`, `web/src/app/data/` |
| Propuesta compartida de planes | `config/plans.json`, `docs/planes-suscripcion.md` |
| Angular SSR | `web/src/server.ts`, `tools/package-web.mjs` |
| Demo y piloto | `tools/demo.mjs`, `tools/pilot.mjs` |
| CI | `.github/workflows/ci.yml` |

Se conserva Node.js 24, Angular 22 y NgRx Signals 22; los lockfiles fijan las dependencias. El hosting replica el patrón SSR del portafolio sin reutilizar sus stacks, pool de identidad ni dominios principales.

## Fuera del primer flujo

No se incluyen cobros/licencias automáticas, cuotas de suscripción activas, exportación PDF, importaciones largas, envío automático del correo de invitación, CRM, SSO empresarial ni SLA. Las invitaciones manuales y la selección de espacios sí forman parte del incremento de Equipo, pendiente de aceptar en AWS. SQS para documentos y Step Functions para importaciones se incorporarán al existir esos requisitos. El primer piloto opera una moneda por catálogo y cantidades enteras.

## Primer pendiente para continuar desde remoto

Desplegar y aceptar el incremento de Equipo en development con la tabla de pertenencias, migración e invitaciones reales, sin confundir las comprobaciones anteriores del flujo comercial y del correo de registro con esa aceptación. Después ejecutar el piloto con personas y datos autorizados para contrastar los precios, límites y costos propuestos. Promover únicamente mediante PR development → testing → main. Stripe sigue pendiente. Consultar [Verificación](../docs/verificacion.md) para distinguir lo comprobado localmente de lo aceptado en nube.
