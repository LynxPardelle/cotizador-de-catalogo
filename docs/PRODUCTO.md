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

Medir minutos por cotización, correcciones por error de precio y porcentaje de reglas reutilizadas entre catálogos antes de fijar precios o afirmar ahorro. Las mediciones con personas y datos autorizados siguen pendientes; los datos de demostración son sintéticos. Las capacidades por plan se aplican en backend durante el piloto y `/consumo` avisa desde el 80% y al agotarse. Las propuestas emitidas conservan sus snapshots al publicar otra versión y no se borran por cambiar de plan. Los espacios nuevos usan Esencial; Equipo y Empresa se asignan por el operador sin activar cobros.

## Origen

Proyecto de origen propio basado en el problema comercial identificado en novo-calculator. Los contratos, nombres, datos de ejemplo y código son nuevos. No se reutiliza información comercial ajena.
