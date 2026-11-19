# Planes de suscripción de CotiTrama

Propuesta comercial de trabajo, revisada el 19 de noviembre de 2026. Los planes están en preparación: **precio por definir**, sin contratación ni cobro automático. Crear una cuenta o participar en el piloto no activa una suscripción. Stripe y la gestión del ciclo de suscripción quedan pendientes.

## Valor y unidad de contratación

CotiTrama propone una suscripción por organización y equipo comercial. El valor es convertir catálogos y reglas en propuestas cuyo desglose se puede volver a consultar después de publicar precios nuevos. El piloto debe medir minutos por cotización, correcciones por errores de precio y reutilización de reglas antes de fijar precios o afirmar ahorro.

La base de cada plan combina miembros del equipo y catálogos activos; el volumen de propuestas emitidas por mes permite dimensionar uso. Las simulaciones se miden para operar el servicio, sin convertir cada ajuste de una cotización en un cargo. Números incluidos, excedentes, periodicidad y precios se decidirán con datos del piloto. Hoy no existen cuotas comerciales ni diferenciación de acceso por plan en el backend.

## Propuesta de planes

| Plan en preparación | Para quién | Núcleo disponible en el código | Diferenciación por validar o construir | Precio y llamada a la acción |
| --- | --- | --- | --- | --- |
| **Esencial** | Un negocio que empieza a ordenar su catálogo y sus propuestas. | Publicación de catálogos versionados, opciones y reglas compatibles, simulación con desglose, emisión y consulta de la propuesta original. | Paquete de miembros, catálogos y volumen mensual; incorporación guiada del primer catálogo. | **Precio por definir.** Crear cuenta para el piloto. |
| **Equipo** | Un equipo comercial que comparte precios y responsabilidades. | El mismo núcleo; separación por organización y autorización para administrador, vendedor y lector. El modelo admite varios catálogos. | Paquete ampliado; invitaciones y administración de miembros desde la aplicación; métricas de actividad del equipo. | **Precio por definir.** Explorar el piloto en equipo. |
| **Empresa** | Una operación que necesita adaptar catálogos y evaluar integraciones. | El mismo núcleo de catálogos, reglas y propuestas reproducibles. | Acompañamiento de incorporación y evaluación de integraciones, necesidades de identidad y soporte. Cada ampliación requiere alcance y verificación propios. | **Precio por definir.** Evaluar el piloto. |

La matriz expresa posicionamiento, no tres productos habilitados ni prestaciones exclusivas ya impuestas por el sistema. Las capacidades descritas como disponibles corresponden al código del proyecto; su publicación en la nube y aceptación con personas se comprueban por separado. El registro autónomo y el alta de organización se verifican como parte del flujo de incorporación, sin conceder por ello un plan de pago.

No se anuncian exportación PDF, integración CRM, SSO empresarial, automatizaciones externas, invitaciones autogestionadas, disponibilidad garantizada, soporte permanente ni uso ilimitado como capacidades actuales. Los roles del backend no equivalen a una pantalla de gestión del equipo.

## Estado técnico que sustenta la oferta

- `services/catalog/`: lectura por organización y publicación de una revisión inmutable mediante escritura condicional.
- `services/quoting/`: simulación y emisión con versión exacta, importes enteros y explicación de reglas; una emisión repetida conserva su identificador.
- `services/shared/auth.mjs`: autorización por identidad, organización y rol; separación entre organizaciones en los repositorios.
- `web/src/app/features/`: consulta y publicación JSON de catálogos, configuración de productos, desglose y consulta de propuestas guardadas.
- `infra/template.yaml`: recursos previstos para Angular en Lambda, API, Cognito, tablas DynamoDB bajo demanda y CloudFront. Infraestructura declarada no acredita despliegue ni entrega transaccional.

## Uso razonable, límites y conservación

El piloto es para uso comercial interactivo autorizado de la organización. Importaciones masivas, pruebas de carga, robots y procesamiento por lotes requieren evaluación previa de capacidad. El throttling de API es un control operativo compartido y no representa una cuota contractual de suscripción.

Antes de vender paquetes con límites se necesitan contadores por organización y período, autorizaciones de plan verificadas en servidor, avisos de consumo y una política explícita de excedentes. Los reintentos idempotentes no deben consumir dos propuestas de la cuota. Una reducción de plan debe controlar nuevas operaciones, conservando el acceso a las propuestas ya emitidas según las condiciones acordadas.

Las propuestas emitidas son snapshots comerciales inmutables. No se borran ni recalculan por publicar otra versión, agotar una cuota o cambiar de plan. Las tablas actuales no aplican una expiración automática a esos snapshots. La caducidad comercial de una propuesta limita su vigencia, no determina su borrado. La retención y eliminación de información al cerrar una cuenta requieren condiciones explícitas y un procedimiento específico; no se promete conservación indefinida.

Los borradores actuales viven en el estado de pantalla y no ofrecen recuperación persistente entre sesiones. Una futura política de limpieza de borradores debe afectar únicamente borradores, sin reutilizarla para snapshots emitidos. La retención de logs de infraestructura es independiente de la retención de datos comerciales.

## Economía unitaria: qué medir antes de fijar precios

La estimación debe usar la región y configuración reales y distinguir costo variable por organización de costos compartidos. Las siguientes relaciones se basan en precios oficiales consultados el 19 de noviembre de 2026; no son una cotización de infraestructura ni acreditan gasto observado.

| Componente | Factor de costo | Implicación para el piloto |
| --- | --- | --- |
| Cognito | Usuarios activos mensuales y nivel de funciones; correo y SMS pueden generar cargos separados. | Medir miembros activos por organización y verificar entrega de registro/recuperación. No fundamentar el margen en un nivel gratuito compartido con otros proyectos. [Precios de Cognito](https://aws.amazon.com/cognito/pricing/). |
| Lambda | Para las funciones declaradas, solicitudes y duración ponderada por memoria. | Medir por separado renderizado Angular, simulación, emisión y llamadas entre servicios; los reintentos también consumen cómputo. [Precios de Lambda](https://aws.amazon.com/lambda/pricing/). |
| DynamoDB | Lecturas, escrituras, tamaño retenido y recuperación continua. Las escrituras transaccionales consumen más unidades que una escritura estándar. | Una emisión guarda propuesta y registro idempotente en transacción; conservar versiones y snapshots incrementa almacenamiento. Medir bytes y unidades por operación. [Precios de DynamoDB](https://aws.amazon.com/dynamodb/pricing/). |
| CloudFront | Modelo contratado y tráfico; en pago por uso los servicios se facturan según consumo. | Medir solicitudes, transferencia y caché. La plantilla no contrata por sí sola un plan comercial de tarifa plana; no atribuirle protecciones o servicios incluidos sin comprobarlos. [Precios de CloudFront](https://aws.amazon.com/cloudfront/pricing/). |

También deben entrar en el cálculo API Gateway, logs, DNS, correo de autenticación, recuperación de datos, soporte e incorporación de catálogos. El margen por organización se evalúa con ingreso previsto menos su costo atribuible y una parte razonable de los costos compartidos. Los niveles gratuitos y créditos reducen una factura elegible, pero no sustituyen una estimación sostenible.

Registrar al menos: miembros activos, catálogos y revisiones retenidas, simulaciones, propuestas nuevas, reintentos, bytes almacenados, duración por función, transferencia, fallos y tiempo de soporte. Con esos datos se pueden comparar escenarios de uso pequeño, mediano y alto sin inventar demanda o conversión.

## Antes de activar suscripciones

1. Validar el flujo de registro, pertenencia, catálogo, emisión y reapertura en el ambiente de pruebas, siguiendo `development → testing → main`.
2. Medir costos y uso del piloto, contrastar disposición a pagar y fijar alcance, límites, precios e impuestos.
3. Implementar derechos de acceso y contadores en backend, con reglas de excedentes, cancelación y conservación verificables.
4. Integrar y verificar suscripciones, webhooks idempotentes y estados de pago cuando se retome el trabajo pendiente de Stripe. El navegador no decide el plan efectivo.
5. Revisar condiciones comerciales, privacidad, correo, soporte y texto público antes de ofrecer contratación.
