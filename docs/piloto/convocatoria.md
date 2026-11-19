# Convocatoria del piloto de CotiTrama

Versión 1.0, preparada el 19 de noviembre de 2026. **Textos listos para revisión; no enviados ni publicados en canales externos.** El formulario se incorpora en development en [Solicitar participar en el piloto](https://cotitrama-dev.lynxpardelle.com/piloto/interes). Antes de compartir la convocatoria, comprobar el despliegue y la recepción de una solicitud sintética conforme a la evidencia de esta entrega.

La convocatoria prepara la selección de dos organizaciones del mismo sector. Todavía no hay un sector, participantes o fecha de inicio confirmados. Expresar interés no equivale a inscribirse, obtener una plaza o empezar el piloto. La selección y la coordinación son manuales. El [protocolo](protocolo.md), los [casos](casos-de-prueba.md) y la [guía para primeros usuarios](guia-primeros-usuarios.md) siguen siendo la referencia del ejercicio.

## Invitación por correo

**Asunto:** Tu equipo y sus cotizaciones: participa en el piloto de CotiTrama

Hola:

Estamos preparando el primer piloto de CotiTrama y buscamos dos organizaciones que hagan cotizaciones a partir de un catálogo de productos, cantidades y opciones.

CotiTrama permite revisar el desglose, guardar una propuesta y conservar la versión de precios y reglas con la que se emitió. Queremos observar cómo funciona con personas que ya cotizan en su trabajo, compararlo con su proceso habitual y conocer qué necesita mejorar.

La propuesta es participar durante 14 días, a partir de que estén listos los accesos y el catálogo autorizado. Por organización participarían dos personas: una que revise y administre el catálogo y otra que prepare cotizaciones. Cada persona reservaría hasta 2 horas y 45 minutos, repartidos en una incorporación de hasta 30 minutos, dos sesiones de hasta una hora y un cierre de hasta 15 minutos.

El piloto será sin cargos, sin tarjeta y sin contratar una suscripción. Se realiza en el ambiente de desarrollo y la participación es voluntaria; puedes pausarla o terminarla. No necesitamos datos de compradores ni el catálogo en esta primera solicitud.

Si a tu organización le interesa, completa este formulario:

https://cotitrama-dev.lynxpardelle.com/piloto/interes

Pedimos un correo de contacto y una descripción breve de cómo cotizan hoy para revisar el encaje y la disponibilidad. Enviar el formulario no confirma una plaza ni crea una cuenta. Si hay encaje, coordinaremos los siguientes pasos por el correo indicado; las fechas se acordarán después.

CotiTrama / Lynx Pardelle

## Invitación breve para WhatsApp o LinkedIn

Estamos preparando el piloto de CotiTrama para equipos que cotizan con catálogos de productos. Buscamos dos organizaciones, con dos participantes cada una, para probar el flujo y compararlo con su proceso habitual.

Serían 14 días desde la preparación de accesos y catálogo, con hasta 2 h 45 min por persona repartidas en varias sesiones. Es voluntario y sin cargos, tarjeta ni suscripción. Expresar interés no confirma una plaza ni crea una cuenta.

¿Le interesa a tu organización? Registra su interés aquí, sin adjuntar catálogos ni datos de compradores:

https://cotitrama-dev.lynxpardelle.com/piloto/interes

CotiTrama / Lynx Pardelle

## Qué recoge el formulario

La solicitud es pública y no exige registrarse. Se limita a información para revisar el encaje del piloto y contactar a quien la presenta:

| Dato | Para qué se pide |
| --- | --- |
| Nombre de la organización | Distinguir la organización interesada; no se solicita una razón social fiscal o documento de identidad. |
| Correo de contacto | Coordinar exclusivamente esta solicitud del piloto. No se incorpora automáticamente a una lista comercial. |
| Sector o actividad | Buscar dos organizaciones con un contexto comparable. No debe incluir nombres de compradores, información confidencial o un catálogo. |
| Proceso actual de cotización | Entender si usan hojas de cálculo, documentos, otro software, un proceso manual u otro método. |
| Rango de cotizaciones mensuales | Dimensionar el ejercicio sin pedir ingresos, precios de venta ni una lista de operaciones. |
| Posibilidad de contar con dos participantes | Comprobar si puede cubrirse el rol de administración de catálogo y el de cotización. Sí, No y Por confirmar son respuestas para coordinar, sin rechazo automático. |
| Disponibilidad para el esquema de sesiones | Conocer si el esfuerzo propuesto puede encajar, sin pedir todavía agenda, calendario o fecha de inicio. |
| Autorización de contacto | Confirmación explícita, inicialmente desmarcada, para usar los datos con el propósito indicado. No es una aceptación de suscripción ni el acuerdo de participación en el estudio. |

No hay adjuntos, datos de pago, documentos de identidad, nombre de compradores, credenciales ni campos para copiar un catálogo. El formulario muestra una referencia de recepción y no envía una confirmación automática por correo. Una respuesta recibida no implica que el correo esté verificado, que la organización haya sido seleccionada o que se haya creado una cuenta o membresía.

La solicitud almacena la autorización con su versión y fecha de recepción. Su conservación técnica prevé una caducidad a los 90 días y eliminación posterior asíncrona mediante TTL de DynamoDB; no promete borrado inmediato en una fecha u hora exactas. Esta caducidad corresponde a las solicitudes de interés, no a las propuestas comerciales que se emitan en el producto. El operador debe definir el acceso y el tratamiento de cualquier copia privada antes de utilizarla.

## Revisión de interés y coordinación

El operador consulta las solicitudes únicamente por su acceso IAM a los recursos propios de CotiTrama. No se ofrece una lista pública, una búsqueda de correos ni un panel de solicitudes para los participantes. No copiar las respuestas completas a Git, a un issue público o a una captura compartida.

La herramienta de desarrollo permite listar referencias y fechas, sin nombre de organización, correo o sector:

```powershell
node --use-system-ca tools/pilot-interest-development.mjs --list
```

El listado está limitado a 500 filas examinadas y diez páginas; `partial: true` indica que no muestra todo el histórico. Excluye solicitudes caducadas. Para revisar una referencia concreta, el operador puede ejecutar `--export` seguido de su UUID. La herramienta guarda esa solicitud en `artifacts/pilot-interest-<UUID>-private.json`, no imprime sus datos y no reemplaza un archivo existente. El directorio está ignorado por Git y se rechazan rutas de exportación enlazadas. Los permisos locales de archivo son una precaución, no cifrado ni una garantía de privacidad del equipo; tratar la copia con el acceso y conservación acordados.

La revisión sigue estos pasos, sin decidir por orden de llegada ni aceptar automáticamente:

1. Comprobar que es una solicitud comprensible de una organización que prepara cotizaciones. Si el sector o proceso no está claro, dejarla por revisar.
2. Agrupar las solicitudes por sector y tipo de configuración. Buscar dos organizaciones cuyos catálogos puedan representar una familia de productos con una moneda y cantidades enteras, dentro del flujo actual.
3. Revisar si pueden participar dos personas y reservar las sesiones. Una respuesta No o Por confirmar inicia una aclaración; no implica descarte automático.
4. Confirmar que cada organización puede autorizar una copia mínima de catálogo y cinco solicitudes con resultados independientes. No pedir esa información por un campo libre del formulario.
5. Registrar en una copia privada la razón de encaje, aclaración o falta de encaje. El volumen declarado ayuda a dimensionar, pero no decide por sí solo. No prometer capacidades que no existen, adaptación incluida o un plan de pago.
6. Cuando corresponda, contactar de forma individual por el canal autorizado por el operador. La solicitud permite coordinar su propio piloto; no autoriza campañas ajenas. Esta preparación no envía mensajes.
7. Sólo después de aclarar el alcance, acordar participación, tratamiento de evidencias, facilitación y fecha. Entonces se aplica la incorporación del protocolo: cada persona crea y confirma su propia cuenta, y el administrador comparte la invitación al equipo.

Para llevar un seguimiento manual privado se pueden usar los campos `referencia`, `organizacion_codigo`, `sector_codigo`, `encaje`, `aclaracion_pendiente`, `estado_seguimiento`, `motivo`, `ultima_revision_utc` y `siguiente_paso`. Los estados sugeridos para ese registro son recibido, por revisar, por aclarar, contactado, seleccionado y no seleccionado. Son un seguimiento del operador, no estados que este formulario cambie ni una función de gestión ya disponible en la aplicación. Separar correos y nombres del resumen agregado y no registrar una acción como realizada antes de ejecutarla.

## Antes de compartir la convocatoria

- Comprobar el enlace público y que una solicitud sintética válida se recibe una sola vez al reintentar, sin exponer los datos en la respuesta, HTML, URL o registros.
- Verificar en la versión desplegada que siguen visibles duración, esfuerzo por persona, carácter voluntario, ausencia de cargos y diferencia entre interés y plaza confirmada.
- Acordar quién revisará las solicitudes y qué canal privado utilizará para coordinar. No anunciar una fecha, un plazo de respuesta o un contacto que todavía no estén acordados.
- Revisar el texto y elegir destinatarios o un canal concreto antes de enviarlo. No publicar este borrador automáticamente ni tratar la existencia del documento como un envío autorizado.
- Mantener el sector y las plazas como una selección pendiente. Si no hay dos organizaciones compatibles, documentar la situación y ajustar la convocatoria sin inventar participantes.
- Conservar Stripe, suscripciones y cobros pendientes. Los precios propuestos del producto no son una condición de participación ni una oferta contratada por este formulario.

El piloto humano de TASK-006 sigue pendiente hasta ejecutar el protocolo con participantes y datos autorizados. Esta convocatoria y su formulario preparan esa incorporación; no acreditan demanda, ahorro, correcciones resueltas ni intención de pagar.
