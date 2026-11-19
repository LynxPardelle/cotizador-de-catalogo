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

La propuesta es una suscripción por organización y equipo comercial, dimensionada por miembros, catálogos y volumen de propuestas emitidas. Los planes **Esencial**, **Equipo** y **Empresa** están en preparación, con **precio por definir**. El registro y el piloto no activan una suscripción; la contratación automática y Stripe quedan pendientes. La matriz de capacidades actuales, ampliaciones y controles necesarios está en [Planes de suscripción](planes-suscripcion.md).

Medir minutos por cotización, correcciones por error de precio y porcentaje de reglas reutilizadas entre catálogos antes de fijar precios o afirmar ahorro. Las mediciones con personas y datos autorizados siguen pendientes; los datos de demostración son sintéticos. No existen todavía cuotas comerciales aplicadas por plan. Las propuestas emitidas conservan sus snapshots al publicar otra versión y no se deben borrar por cambiar de plan.

## Origen

Proyecto de origen propio basado en el problema comercial identificado en novo-calculator. Los contratos, nombres, datos de ejemplo y código son nuevos. No se reutiliza información comercial ajena.
