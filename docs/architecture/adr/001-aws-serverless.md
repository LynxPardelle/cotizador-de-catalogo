# AWS Lambda para los servicios de dominio

**Estado** Aceptada para la base.

El servicio de Catálogos es dueño de publicación y revisiones. Cotizaciones lee una revisión publicada por un contrato de lectura. Puede iniciar con ambos Lambdas en un stack y tablas separadas. La cotización se calcula de forma síncrona en una Lambda con operaciones acotadas. El cálculo usa enteros en unidades monetarias menores y decisiones explícitas de redondeo. El piloto acepta cantidades enteras. Cada revisión se valida antes de publicar. Un fallo al emitir permite reintentar con la misma clave de idempotencia. Si la clave llega con otro contenido, el API devuelve conflicto.

Las funciones escalan por invocación y permiten publicar contratos separados a medida que se desarrollan los dominios. DynamoDB bajo demanda se ajusta a solicitudes variables. Los recursos se describen con SAM para reproducir la configuración y revisar permisos. Se consideró un servicio en contenedor cuando hay trabajo sostenido o bibliotecas con dependencias pesadas. La carga prevista del piloto es intermitente y se ajusta a Lambdas breves.

Añadir una Lambda con SQS para exportación de documentos cuando se necesite entrega asíncrona y reintentos. Step Functions Standard queda reservado para importaciones largas con validación, publicación por etapas y seguimiento de ejecución. El cálculo interactivo permanece síncrono.

- [Runtime Node.js en Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [DynamoDB bajo demanda](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html)
- [Flujos de AWS Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html)
