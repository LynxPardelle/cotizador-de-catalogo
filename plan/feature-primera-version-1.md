---
goal: Primera versión de Cotizador de Catálogo
version: '1.0'
date_created: 2026-11-17
status: 'Planned'
tags: [feature, architecture]
---

# Introduction

Estado **Planned**. Este plan convierte el esqueleto en el flujo de generación de propuestas a partir de catálogos y reglas comerciales versionadas. Las fases se ejecutan en orden.

## 1. Requirements & Constraints

- **REQ-001** El piloto completa el flujo descrito en [Producto](../docs/PRODUCTO.md).
- **SEC-001** Cada operación de negocio valida identidad, organización y acceso al recurso. Los ejemplos del repositorio usan datos sintéticos.
- **CON-001** Las escrituras repetidas conservan el resultado original o devuelven conflicto cuando cambia la solicitud.
- **PAT-001** El frontend usa componentes standalone, rutas lazy y SignalStore por flujo. El cómputo del backend se cobra por uso.

## 2. Implementation Steps

### Implementation Phase 1

**GOAL-001** Reglas del producto

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Crear un motor puro bajo services/quoting/domain/price.mjs. Recibe catálogo versionado, moneda, cantidades y opciones validadas. Devuelve importes menores serializados como cadenas, versión exacta y explicación ordenada de reglas. Verificación. Casos sintéticos verifican importes, prioridad, redondeo, monedas y rechazo de opciones y revisiones inválidas. | Pendiente | |

### Implementation Phase 2

**GOAL-002** Catálogo y publicación

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-002 | Agregar servicios services/catalog y services/quoting al template con HTTP API v2 y autorizador JWT. Crear tablas bajo demanda, publicador condicional e idempotencia de emisión por organización. Verificación. Una revisión publicada es inmutable. Repetir la misma emisión conserva un solo id. Accesos cruzados devuelven 404. | Pendiente | |

### Implementation Phase 3

**GOAL-003** Flujo comercial Angular

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-003 | Agregar rutas de catálogo y cotización bajo web/src/app/features, usar un SignalStore por flujo y HttpClient tipado. Renderizar desglose y versión de catálogo con estados de carga, error y expiración. Verificación. El usuario emite una cotización de prueba y puede abrirla después de publicar otra versión. El total original coincide. | Pendiente | |

### Implementation Phase 4

**GOAL-004** Piloto de catálogo

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-004 | Definir un catálogo sintético que cubra las reglas del primer sector. Correr pruebas de carga pequeñas y medir tiempo de cotización con datos autorizados del piloto. Verificación. Hay un conjunto reproducible de propuestas y se registran latencia, correcciones y reglas reutilizables. | Pendiente | |

## 3. Alternatives

- **ALT-001** Contenedor siempre activo. Reservarlo para procesamiento que requiera recursos sostenidos durante la jornada.
- **ALT-002** Orquestación de cada operación con Step Functions. Usarla cuando el historial de etapas y la recuperación independiente aporten valor a un proceso largo.

## 4. Dependencies

- **DEP-001** Angular y NgRx Signals según el lock de `web/`.
- **DEP-002** Node.js 24, AWS SAM, API Gateway y DynamoDB bajo demanda para los servicios del piloto.

## 5. Files

- **FILE-001** `infra/template.yaml` incorpora rutas autorizadas y tablas por servicio.
- **FILE-002** `services/` contiene dominios y adaptadores Lambda, con pruebas de operaciones e idempotencia.
- **FILE-003** `web/src/app/features/` contiene rutas, estado y pantallas de cada flujo.

## 6. Testing

- **TEST-001** Pruebas unitarias de reglas, invariantes monetarias e idempotencia con fixtures sintéticos.
- **TEST-002** Pruebas de integración de segregación por organización, datos y operación de extremo a extremo en entorno de pruebas.
- **TEST-003** Verificación de compilación y pruebas Angular, `node --test` de handlers y lint de SAM.

## 7. Risks & Assumptions

- **RISK-001** Errores de importe o repetición. Verificar operaciones con aritmética entera, validación de moneda y escrituras condicionales.
- **ASSUMPTION-001** Cada organización piloto aporta un escenario y datos de prueba autorizados. El despliegue y la operación se revisan después de comprobar el flujo local.

## 8. Related Specifications / Further Reading

- [Producto](../docs/PRODUCTO.md)
- [Arquitectura](../docs/architecture/ARCHITECTURE.md)
- [Runtime Node.js en Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [DynamoDB bajo demanda](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html)
- [Flujos de AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html)
