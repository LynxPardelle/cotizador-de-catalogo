# AWS Lambda para frontend y microservicios de CotiTrama

Estado: aceptada; ampliada el 19 de noviembre de 2026 para incluir el frontend Angular SSR solicitado.

Web, Catálogos, Cotizaciones y Salud son funciones Lambda Node.js 24 arm64. Angular SSR usa Express y serverless-http; CloudFront accede a su Function URL con IAM y OAC. Las rutas de negocio usan otro origen HTTP API con JWT de Cognito. Cada dominio tiene tabla y rol separados. Cotizaciones lee catálogos mediante un contrato de invocación; no accede a su tabla.

SAM describe infraestructura reproducible por ambiente. DynamoDB bajo demanda se ajusta a solicitudes variables; las propuestas conservan snapshots y las emisiones usan transacciones condicionales. El cálculo interactivo es síncrono y usa aritmética entera.

Se descarta una SPA exclusivamente en S3 para cumplir el hosting en Lambda solicitado. Un servicio siempre activo queda reservado para cargas sostenidas. SQS se podrá añadir para documentos asíncronos y Step Functions para importaciones largas cuando existan esos requisitos.

[Arquitectura](../ARCHITECTURE.md) · [Diseño de producto](../002-cotitrama-producto.md)
