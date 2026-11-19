# Planes de suscripción de CotiTrama

Propuesta comercial de trabajo, revisada el 19 de noviembre de 2026. Los planes están en preparación: **precios y límites propuestos**, antes de impuestos, sin contratación ni cobro automático. El piloto continúa sin cargos. Crear una cuenta o participar en el piloto no activa una suscripción. Stripe y la gestión del ciclo de suscripción quedan pendientes.

## Valor y unidad de contratación

CotiTrama propone una suscripción por organización y equipo comercial. El valor es convertir catálogos y reglas en propuestas cuyo desglose se puede volver a consultar después de publicar precios nuevos. El piloto debe medir minutos por cotización, correcciones por errores de precio y reutilización de reglas antes de fijar precios o afirmar ahorro.

La base de cada plan combina miembros del equipo y catálogos activos; el volumen de propuestas emitidas por mes permite dimensionar uso. Las simulaciones se miden para operar el servicio, sin convertir cada ajuste de una cotización en un cargo. Los números siguientes son una hipótesis para contrastar con el piloto, no demanda ni disposición a pagar validadas. Hoy no existen cuotas de pago ni diferenciación de acceso por suscripción en el backend.

La fuente compartida de importes y límites es [`config/plans.json`](../config/plans.json). Su estado `proposal`, `billingEnabled: false` y `limitsEnforced: false` expresa que no activa pagos ni cuotas comerciales. `priceMinor` contiene centavos como cadena; la periodicidad propuesta es mensual. Los controles operativos del piloto son independientes de estos planes.

## Propuesta de planes

| Plan en preparación | Precio propuesto MXN/mes antes de impuestos | Miembros | Catálogos activos | Propuestas emitidas/mes | Para quién |
| --- | ---: | ---: | ---: | ---: | --- |
| **Esencial** | **$399** | 2 | 2 | 100 | Un negocio que empieza a ordenar sus catálogos y propuestas. |
| **Equipo** | **$1,199** | 8 | 10 | 1,000 | Un equipo comercial que comparte precios y responsabilidades. |
| **Empresa** | **$3,499** | 25 | 50 | 5,000 | Un escenario base para una operación con más catálogos y volumen de propuestas. |

El núcleo propuesto es común: publicación de revisiones, configuración y reglas, desglose, emisión idempotente y reapertura con importes originales. Los roles administrador, vendedor y lector son reglas de autorización del producto. La diferenciación inicial de planes se plantea por escala, sin reservar la conservación del desglose para un plan superior. Empresa no incluye por ese precio integraciones a medida, SSO, migraciones, SLA ni soporte permanente; un trabajo adicional requiere alcance y precio propios.

Las llamadas a la acción son «Crear cuenta para el piloto», «Explorar el piloto en equipo» y «Evaluar el piloto». La presentación pública debe conservar «precio propuesto» y «el piloto continúa sin cargos» junto a los importes; no debe parecer un checkout activo.

Definiciones para implementar las cuotas más adelante: un miembro es una pertenencia activa a la organización, incluido su administrador; un catálogo activo es un identificador habilitado para nuevas propuestas, sin contar cada revisión como otro catálogo; una propuesta es una emisión nueva confirmada por el servidor. Consultas, simulaciones y reintentos con la misma clave idempotente no cuentan otra vez. El período propuesto es el mes calendario UTC hasta que el ciclo de facturación requiera otra decisión explícita. La pantalla no constituye la autoridad de consumo.

La matriz expresa posicionamiento, no tres productos habilitados ni prestaciones exclusivas ya impuestas por el sistema. Las capacidades descritas como disponibles corresponden al código del proyecto; su publicación en la nube y aceptación con personas se comprueban por separado. El registro autónomo y el alta de organización se verifican como parte del flujo de incorporación, sin conceder por ello un plan de pago.

No se incluyen por estos importes exportación PDF, integración CRM, SSO empresarial, automatizaciones externas, disponibilidad garantizada, soporte permanente ni uso ilimitado. El estado funcional de la gestión de miembros y sus límites operativos se verifica aparte; su existencia no activa la contratación de Equipo o Empresa.

## Referencias comerciales y justificación de la hipótesis

La comparación sirve para evaluar la estructura de la oferta; no demuestra que CotiTrama sea equivalente ni que haya clientes dispuestos a pagar. Precios oficiales consultados el 19 de noviembre de 2026, expresados en la moneda publicada, sin conversión de divisas:

| Referencia | Precio publicado y unidad | Qué informa para esta propuesta |
| --- | --- | --- |
| [Quotient](https://www.quotientapp.com/pricing) | Solo: USD $28/mes, un miembro y 100 cotizaciones/mes. | Un paquete sencillo puede dimensionarse por miembros y cotizaciones. |
| [PandaDoc](https://support.pandadoc.com/en/articles/9715033-compare-subscription-plan-features) | Starter: USD $35 por usuario/mes con facturación mensual; USD $19 por usuario/mes con facturación anual. | Hay productos que cobran por asiento; sus funciones documentales y firma no están presentes en CotiTrama. |
| [ScalePad Quoter](https://www.scalepad.com/quoter/pricing) | Standard: USD $299/mes, 75 cotizaciones mensuales y usuarios ilimitados; facturación mensual sobre un plazo de 12 meses. La [página general de precios](https://www.scalepad.com/pricing) confirma USD y una activación única de $495 para Quoter. | El volumen emitido también es una métrica comercial usada por herramientas con integraciones y funciones más amplias. |

Los $399 permiten ensayar una entrada por organización con dos personas, sin empezar por una licencia individual. Los $1,199 multiplican miembros y catálogos y permiten un ritmo comercial mayor. Los $3,499 son una base de volumen para un equipo de hasta 25 personas, sin prometer personalización incluida. Es una escala de precios elegida para probar valor y cobertura de operación, no un costo AWS trasladado con un margen supuesto ni una afirmación de ser la opción más barata.

Antes de convertir la hipótesis en oferta, entrevistar organizaciones del sector elegido, observar cotizaciones reales autorizadas y preguntar por la compra del paquete concreto. Comparar minutos ahorrados y correcciones con el precio propuesto. No publicar porcentajes de ahorro, clientes, conversión o retorno sin evidencia.

## Estado técnico que sustenta la oferta

- `services/catalog/`: lectura por organización y publicación de una revisión inmutable mediante escritura condicional.
- `services/quoting/`: simulación y emisión con versión exacta, importes enteros y explicación de reglas; una emisión repetida conserva su identificador.
- `services/shared/auth.mjs`: autorización por identidad, organización y rol; separación entre organizaciones en los repositorios.
- `web/src/app/features/`: consulta y publicación JSON de catálogos, configuración de productos, desglose y consulta de propuestas guardadas.
- `infra/template.yaml`: recursos previstos para Angular en Lambda, API, Cognito, tablas DynamoDB bajo demanda y CloudFront. Infraestructura declarada no acredita despliegue ni entrega transaccional.

## Uso razonable, límites y conservación

El piloto es para uso comercial interactivo autorizado de la organización. Importaciones masivas, pruebas de carga, robots y procesamiento por lotes requieren evaluación previa de capacidad. El throttling de API es un control operativo compartido y no representa una cuota contractual de suscripción.

Antes de vender paquetes con límites se necesitan contadores por organización y período, autorizaciones de plan verificadas en servidor, avisos de consumo y una política explícita de excedentes. Los reintentos idempotentes no deben consumir dos propuestas de la cuota. Una reducción de plan debe controlar nuevas operaciones, conservando el acceso a las propuestas ya emitidas según las condiciones acordadas.

Política propuesta de excedentes: avisar antes de llegar al límite y, al alcanzarlo, impedir nuevas emisiones hasta reinicio de período o ampliación expresamente elegida; no cobrar excedentes de manera automática. Una reducción se aplicaría al siguiente período acordado. Si hay más miembros o catálogos que el nuevo paquete, el administrador debe poder resolver la capacidad antes del cambio sin perder su cuenta ni sus datos. Suspender nuevas invitaciones, publicaciones o emisiones según corresponda no autoriza borrar propuestas o revisiones. Estos comportamientos necesitan implementación y aceptación antes de ofrecer contratación.

Las propuestas emitidas son snapshots comerciales inmutables. No se borran ni recalculan por publicar otra versión, agotar una cuota o cambiar de plan. Las tablas actuales no aplican una expiración automática a esos snapshots. La caducidad comercial de una propuesta limita su vigencia, no determina su borrado. La retención y eliminación de información al cerrar una cuenta requieren condiciones explícitas y un procedimiento específico; no se promete conservación indefinida.

Los borradores actuales viven en el estado de pantalla y no ofrecen recuperación persistente entre sesiones. Una futura política de limpieza de borradores debe afectar únicamente borradores, sin reutilizarla para snapshots emitidos. La retención de logs de infraestructura es independiente de la retención de datos comerciales.

## Economía unitaria: tasas y supuestos de estimación

La estimación debe usar la región y configuración reales y distinguir costo variable por organización de costos compartidos. Las siguientes relaciones se basan en precios oficiales consultados el 19 de noviembre de 2026; no son una cotización de infraestructura ni acreditan gasto observado.

| Componente | Factor de costo | Implicación para el piloto |
| --- | --- | --- |
| Cognito | Usuarios activos mensuales y nivel de funciones; correo y SMS pueden generar cargos separados. | Medir miembros activos por organización y verificar entrega de registro/recuperación. No fundamentar el margen en un nivel gratuito compartido con otros proyectos. [Precios de Cognito](https://aws.amazon.com/cognito/pricing/). |
| Lambda | Para las funciones declaradas, solicitudes y duración ponderada por memoria. | Medir por separado renderizado Angular, simulación, emisión y llamadas entre servicios; los reintentos también consumen cómputo. [Precios de Lambda](https://aws.amazon.com/lambda/pricing/). |
| DynamoDB | Lecturas, escrituras, tamaño retenido y recuperación continua. Las escrituras transaccionales consumen más unidades que una escritura estándar. | Una emisión guarda propuesta y registro idempotente en transacción; conservar versiones y snapshots incrementa almacenamiento. Medir bytes y unidades por operación. [Precios de DynamoDB](https://aws.amazon.com/dynamodb/pricing/). |
| CloudFront | Modelo contratado y tráfico; en pago por uso los servicios se facturan según consumo. | Medir solicitudes, transferencia y caché. La plantilla no contrata por sí sola un plan comercial de tarifa plana; no atribuirle protecciones o servicios incluidos sin comprobarlos. [Precios de CloudFront](https://aws.amazon.com/cloudfront/pricing/). |

También deben entrar en el cálculo API Gateway, logs, DNS, correo de autenticación, recuperación de datos, soporte e incorporación de catálogos. El margen por organización se evalúa con ingreso previsto menos su costo atribuible y una parte razonable de los costos compartidos. Los niveles gratuitos y créditos reducen una factura elegible, pero no sustituyen una estimación sostenible.

Registrar al menos: miembros activos, catálogos y revisiones retenidas, simulaciones, propuestas nuevas, reintentos, bytes almacenados, duración por función, transferencia, fallos y tiempo de soporte. Las estimaciones siguientes son escenarios calculados; todavía no son métricas observadas del piloto.

### Escenario mensual reproducible

Usar `us-east-1`, funciones Arm sin concurrencia aprovisionada, DynamoDB Standard bajo demanda y tráfico CloudFront en Estados Unidos/México. No descontar niveles gratuitos ni créditos, que pueden compartirse con otros proyectos. Tasas de referencia en USD: Lambda $0.0000133334/GB-segundo y $0.20/millón de invocaciones; DynamoDB $0.625/millón de unidades de escritura y $0.125/millón de lectura, almacenamiento $0.25/GB-mes y PITR $0.20/GB-mes. Fuentes: [Lambda](https://aws.amazon.com/lambda/pricing/) y [DynamoDB](https://aws.amazon.com/dynamodb/pricing/).

Para HTTP API se usa $1/millón de solicitudes; para CloudFront $0.085/GB entregado y $0.01/10,000 solicitudes HTTPS; para Cognito Essentials $0.015 por miembro activo/mes sin restar nivel gratuito. Los logs se modelan con $0.50/GB de ingreso y $0.03/GB-mes de almacenamiento, con una aproximación conservadora de un mes retenido. Son tarifas de referencia para estos supuestos, no un costo global válido para todas las regiones. Fuentes: [API Gateway](https://aws.amazon.com/api-gateway/pricing/), [CloudFront pago por uso](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/), [Cognito](https://aws.amazon.com/cognito/pricing/) y [CloudWatch](https://aws.amazon.com/cloudwatch/pricing/).

Supuestos medibles por propuesta emitida:

- Cinco simulaciones, una emisión y una reapertura: siete solicitudes de negocio a la API. Las seis operaciones de cálculo consultan el microservicio de Catálogos.
- Dos renderizados Angular de 250 ms con 512 MB; trece invocaciones de negocio/catálogo de 150 ms con 256 MB; siete verificaciones adicionales de pertenencia en Team de 50 ms con 256 MB. Este último costo anticipa el flujo de equipo del incremento, sin tratarlo como gratis. Total: 22 invocaciones y 0.825 GB-segundos por propuesta. Reemplazar tiempos por los observados después del despliegue.
- Sesenta unidades de lectura por propuesta, incluidas las consultas adicionales de pertenencia, un catálogo de 32 KiB y la reapertura; 34 unidades de escritura transaccional para snapshot de 16 KiB y registro idempotente de 1 KiB. Agregar seis revisiones mensuales de 32 KiB por catálogo activo. Las unidades exactas se deben contrastar con `ConsumedCapacity` y tamaño real; el contador de cuota de pago todavía no está activado.
- Cuarenta solicitudes CloudFront y 2 MB entregados por propuesta; 2 KiB de logs por invocación. No incluye campañas de visitas públicas ajenas al ritmo de cotización.
- Para valorar retención, calcular el almacenamiento acumulado después de 36 meses al volumen completo de cada plan: 17 KiB por propuesta y seis revisiones de 32 KiB por catálogo al mes. Es una ventana de evaluación de costo, **no una regla de borrado a los 36 meses**.

Fórmula de cómputo por mes: `propuestas × (0.825 × tarifa_GB_segundo + 22 × tarifa_solicitud)`. Para almacenamiento al final de la ventana: `(propuestas × 36 × 17 KiB + catálogos × 6 × 36 × 32 KiB) × (tarifa_almacenamiento + tarifa_PITR)`. Sumar lecturas, escrituras, API, Cognito, CDN y logs. Los resultados redondean hacia arriba y no descuentan gratuidades.

| Escenario al volumen completo propuesto | Esencial | Equipo | Empresa |
| --- | ---: | ---: | ---: |
| Miembros / catálogos / propuestas-mes | 2 / 2 / 100 | 8 / 10 / 1,000 | 25 / 50 / 5,000 |
| Lambda, HTTP API y operaciones DynamoDB (USD/mes) | 0.01 | 0.06 | 0.27 |
| Almacenamiento y PITR al final de 36 meses (USD/mes) | 0.04 | 0.30 | 1.47 |
| Cognito, CloudFront y logs (USD/mes) | 0.06 | 0.36 | 1.54 |
| Variable calculado con estos supuestos (USD/mes, suma antes de redondear) | **0.10** | **0.70** | **3.30** |
| Reserva de planeación para infraestructura por organización (USD/mes) | **3** | **8** | **20** |
| Misma reserva con supuesto interno de 20 MXN/USD | **60 MXN** | **160 MXN** | **400 MXN** |

La reserva es un presupuesto interno con holgura para errores, reintentos, operación del equipo y participación en recursos compartidos; no es una factura observada, un límite de gasto ni una garantía. El supuesto de 20 MXN/USD se utiliza sólo para explorar la propuesta y no representa una cotización cambiaria actual. El gasto y el tipo de cambio efectivos se deben actualizar antes de contratar recursos o fijar margen.

Fuera del variable calculado quedan DNS y artefactos compartidos, alarmas, copias o restauraciones extraordinarias, correo/SMS, tráfico público independiente de las propuestas, errores, migraciones, soporte humano, adquisición de clientes, impuestos y comisiones de pago aún desconocidas. Por tanto, la diferencia entre precio y reserva **no es margen validado**. Un piloto con pocas organizaciones distribuye costos compartidos entre menos clientes; una organización con catálogos mucho mayores o tráfico automático puede exceder el escenario. No prometer que la reserva cubre cualquier uso.

## Antes de activar suscripciones

1. Validar el flujo de registro, pertenencia, catálogo, emisión y reapertura en el ambiente de pruebas, siguiendo `development → testing → main`.
2. Medir costos y uso del piloto, contrastar disposición a pagar por estos paquetes y confirmar o corregir límites, precios e impuestos.
3. Implementar derechos de acceso y contadores en backend, con reglas de excedentes, cancelación y conservación verificables.
4. Integrar y verificar suscripciones, webhooks idempotentes y estados de pago cuando se retome el trabajo pendiente de Stripe. El navegador no decide el plan efectivo.
5. Revisar condiciones comerciales, privacidad, correo, soporte y texto público antes de ofrecer contratación.
