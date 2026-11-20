# CotiTrama

Cotizaciones que conservan sus reglas.

Un equipo comercial configura productos y cantidades, verifica opciones compatibles y obtiene una propuesta reproducible con el desglose de precios. El administrador publica catálogos y reglas versionadas. El comprador recibe una propuesta con moneda, vigencia y condiciones originales.

## Primera versión

El piloto se centra en una familia de productos y una moneda por catálogo. Acepta cantidades enteras, opciones con recargos, combinaciones incompatibles y reglas porcentuales ordenadas por prioridad. Cada simulación explica las reglas aplicadas. El vendedor revisa el resultado antes de emitir.

Publicar catálogo v1 → configurar productos → revisar desglose → guardar propuesta → publicar v2 → reabrir la propuesta original sin alterar precios ni reglas.

Cada organización posee sus catálogos y propuestas. Un administrador publica; vendedores y administradores cotizan; lectores consultan. La emisión es idempotente: una repetición conserva el mismo identificador y un cambio de contenido con la misma clave devuelve conflicto.

## Identidad y dirección

CotiTrama sustituye al nombre descriptivo Cotizador de Catálogo. Producción: `cotitrama.lynxpardelle.com`. La elección y sus límites se registran en [la decisión de producto](architecture/002-cotitrama-producto.md).

## Piloto y modelo comercial

La propuesta es una suscripción mensual por organización y equipo comercial. **Esencial: $399 MXN**, con 2 miembros, 2 catálogos activos y 100 propuestas emitidas por mes; **Equipo: $1,199 MXN**, con 8 miembros, 10 catálogos y 1,000 propuestas; **Empresa: $3,499 MXN**, con 25 miembros, 50 catálogos y 5,000 propuestas. Los precios siguen propuestos antes de impuestos; las capacidades se aplican durante el piloto y se contrastarán con su uso real. La fuente compartida es [`services/shared/plans.json`](../services/shared/plans.json).

Los planes están en preparación. El piloto continúa sin cargos; crear una cuenta no activa una suscripción. La contratación automática y Stripe quedan pendientes. La [propuesta comercial detallada](planes-suscripcion.md) distingue capacidades actuales, ampliaciones y controles necesarios, además de referencias de mercado y escenarios de costo con supuestos explícitos.

Medir tiempos de cotización, correcciones y reutilización de reglas con personas y datos autorizados antes de afirmar ahorro o validar la propuesta comercial. Esas mediciones siguen pendientes; los datos de demostración son sintéticos. Las capacidades por plan se aplican en backend durante el piloto y `/consumo` avisa desde el 80% y al agotarse. Las propuestas emitidas conservan sus snapshots al publicar otra versión y no se borran por cambiar de plan. Los espacios nuevos usan Esencial; Equipo y Empresa se asignan por el operador sin activar cobros.

## Instrumentación del piloto

La instrumentación está **desplegada y verificada en development con AWS y navegador autenticado mediante JWT real**. La aceptación usa datos sintéticos y actividad automatizada, sin presentarlos como mediciones de personas. El administrador consulta `/piloto` para el espacio seleccionado, en períodos de 7, 30 o 90 días calendario UTC que incluyen hoy. El panel muestra emisiones por día y cuentas emisoras medidas sin revelar su identidad. El plan, los miembros actuales, los catálogos activos y el consumo mensual son una fotografía actual, distinta del historial elegido. La [evidencia técnica](verificacion.md) conserva los resultados y sus límites.

El tiempo es una estimación de actividad que comunica el navegador durante la configuración, no una medida completa de la jornada comercial ni una prueba de productividad humana. La media y la mediana usan sólo propuestas instrumentadas y se presentan junto al tamaño de muestra y las mediciones ausentes. Una duración reportada de cero es una muestra válida; las propuestas antiguas sin datos de tiempo se conservan en el total y no reciben una duración inventada.

Los ajustes reflejan nuevas previsualizaciones exitosas de una configuración distinta dentro del mismo flujo. No acreditan un error de precio. Después de emitir, un vendedor o administrador puede declarar una corrección por cantidad, opciones, catálogo, precio/reglas u otra categoría. No hay notas libres. La declaración conserva la propuesta original y no acredita que se haya resuelto el problema o emitido otra propuesta. Se cuentan eventos y propuestas afectadas por fecha de declaración, incluso cuando la emisión ocurrió antes del período; no se calcula una tasa con un denominador ambiguo.

Repetir una emisión o declaración con su referencia original no agrega muestras, eventos ni consumo. Las consultas tienen un presupuesto acotado y fallan explícitamente si el histórico lo supera, sin mostrar un total truncado. La [decisión de métricas](architecture/004-metricas-del-piloto.md) precisa captura, cobertura y límites. La instrumentación no completa el piloto humano de TASK-006, la validación de demanda ni la disposición a pagar. Stripe y la contratación automática continúan pendientes.

## Piloto con primeros usuarios

La preparación de TASK-013 está completa en el [protocolo del piloto](piloto/protocolo.md), con [casos funcionales](piloto/casos-de-prueba.md), [guía de incorporación](piloto/guia-primeros-usuarios.md) y [plantillas de registro privado](piloto/plantillas/README.md). La cohorte propuesta es de dos organizaciones, con administrador y vendedor por espacio, durante catorce días a partir de la preparación de accesos y datos. Todavía no se ha convocado ni ejecutado; TASK-006 continúa pendiente.

La evaluación prevé veinte pares de tareas y criterios fijados antes de observar: exactitud comercial completa, integridad y aislamiento, autonomía, cobertura de observación, mejora exploratoria de tiempo y utilidad declarada. Contrasta el proceso habitual con el flujo completo de CotiTrama usando tiempo de pared, separado de la estimación de actividad del navegador. Los resultados de cuatro personas son exploratorios; no validan demanda de mercado, ahorro poblacional ni disposición a pagar. Stripe continúa pendiente.

## Convocatoria de organizaciones interesadas

La [invitación del piloto](piloto/convocatoria.md) está redactada y no se ha enviado a terceros. El formulario público `/piloto/interes` está **desplegado y verificado en development con AWS y navegador**. La aceptación utiliza solicitudes ficticias; no acredita inscripción de organizaciones reales. Permite expresar interés sin crear cuenta, proporcionar un catálogo ni contratar una suscripción. La selección de las dos organizaciones del mismo sector se realiza después de revisar las solicitudes y coordinar con sus responsables; un recibo no confirma una plaza ni la fecha de inicio.

La solicitud recoge nombre de organización, correo de contacto, sector, proceso actual, volumen aproximado y disponibilidad para dos participantes y las sesiones. Requiere autorización expresa para usar esos datos en la coordinación del piloto, con versión del aviso y fecha de aceptación guardadas por servidor. Los datos se mantienen en la tabla propia de Interés, con expiración TTL a 90 días y eliminación asíncrona; no se exponen en una consulta pública. El operador accede mediante IAM y exportación privada por referencia. No hay CRM, correo de respuesta, aceptación de participantes, alta de cuenta ni cobro automáticos. Los reintentos de la misma solicitud no duplican su registro.

La preparación de la invitación y el formulario está completa. La difusión con destinatarios y canal autorizados, las solicitudes de organizaciones reales, las personas, el sector definitivo y las fechas continúan pendientes. Esta captura no completa TASK-006 ni valida demanda o disposición a pagar. Stripe permanece pendiente. El [diseño de convocatoria](architecture/005-convocatoria-e-interes.md) documenta el contrato, los límites y el tratamiento de la información.

## Gestión privada de las solicitudes

El operador autorizado revisa `/piloto/solicitudes` con una cuenta confirmada y correo verificado. Este permiso es independiente del administrador de cada organización. La bandeja permite filtrar Recibida, En revisión, Por aclarar, Contactada, Preseleccionada, No seleccionada y Retirada, consultar los datos de contacto, fijar la próxima acción y conservar notas de seguimiento en un historial.

Los estados reflejan decisiones registradas manualmente: Contactada no envía un mensaje, Preseleccionada no confirma una plaza ni crea una cuenta y Retirada no elimina el consentimiento original ni una cuenta. Antes de admitir participantes se aplican los acuerdos del protocolo. Las notas no deben contener contraseñas, datos de pago, catálogos de clientes ni información personal ajena al seguimiento autorizado.

Cada actualización comprueba la versión observada; un conflicto requiere consultar la revisión actual antes de volver a guardar. Los reintentos idénticos conservan un solo evento. El registro recibido, la autorización de contacto y el plazo original de 90 días se mantienen, con eliminación TTL asíncrona. La [decisión de gestión privada](architecture/006-gestion-solicitudes-piloto.md) documenta los límites de acceso, paginación y retención. Esta herramienta no sustituye reclutar y observar usuarios reales; Stripe sigue pendiente.

## Origen

Proyecto de origen propio basado en el problema comercial identificado en novo-calculator. Los contratos, nombres, datos de ejemplo y código son nuevos. No se reutiliza información comercial ajena.
