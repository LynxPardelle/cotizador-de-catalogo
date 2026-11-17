# Cotizador de Catálogo

Un equipo comercial configura productos y cantidades, verifica opciones compatibles y obtiene una propuesta reproducible con el desglose de precios. El administrador del catálogo publica reglas versionadas. El comprador recibe una propuesta con la moneda, vigencia y condiciones que la generaron.

## Primera versión

El piloto se centra en una familia de productos y una moneda por catálogo. Usa reglas declarativas de compatibilidad, recargos y descuentos. Cada simulación explica las reglas aplicadas. El vendedor confirma el resultado antes de emitir la propuesta.

Publicar un catálogo de prueba → elegir una configuración válida → revisar el desglose → guardar la propuesta → verificar que una actualización posterior del catálogo conserva la propuesta anterior.

## Modelo comercial

Implementación inicial por catálogo y licencia por equipo comercial. Medir minutos por cotización, correcciones por error de precio y porcentaje de reglas que se reutilizan entre catálogos.

## Origen

Proyecto de origen propio basado en el problema comercial identificado en novo-calculator. Los contratos, nombres, datos de ejemplo y código de este repositorio son nuevos. Usa catálogos sintéticos como referencia de desarrollo.
