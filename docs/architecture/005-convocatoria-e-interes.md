# Convocatoria y solicitudes de interés

Decisión del 19 de noviembre de 2026. Se prepara la convocatoria del piloto y una recepción pública de interés en development. Redactar una invitación no autoriza enviarla a contactos ni publicarla en redes. Una solicitud recibida no confirma una plaza, no crea una cuenta y no inicia el piloto. Stripe permanece pendiente.

## Experiencia y datos mínimos

La landing enlaza `/piloto/interes`, una ruta pública Angular SSR independiente del espacio autenticado. Explica dos organizaciones, dos personas por organización, catorce días desde la preparación de accesos/catálogos y hasta 2 h 45 min por persona repartidas en las actividades del protocolo. No promete ahorro, fechas de inicio, prestaciones futuras o una suscripción.

El formulario solicita nombre de organización, correo de contacto, sector/actividad, método actual, rango de propuestas mensuales, posibilidad de contar con dos personas y disponibilidad para el esquema de sesiones. Las opciones No y Por confirmar no provocan rechazo automático. No hay adjuntos, teléfono, nombre de compradores, catálogo, datos fiscales ni pago. La autorización de contacto empieza desmarcada; sólo permite usar los datos para revisar y coordinar el piloto.

`services/interest/contract.json` comparte versión del aviso, opciones y longitudes con Angular. El body admite exactamente diez propiedades, incluido requestId UUID, contactConsent true y privacyVersion vigente. Backend normaliza texto y correo, rechaza controles, campos desconocidos, valores inválidos y cuerpo mayor de 8 KB. No se interpreta contenido HTML ni se refleja el texto enviado en respuestas.

El frontend sólo mantiene el formulario en memoria. No incorpora sus valores a URLs, almacenamiento del navegador, HTML SSR o analíticas. Tras un error de respuesta conserva el identificador y payload para reintentar sin crear otra solicitud. El éxito muestra una referencia y el estado recibido, sin devolver el correo. Un cambio de pantalla o recarga puede descartar el borrador; conservar la referencia de una recepción confirmada.

## Servicio y aislamiento

Una séptima Lambda, InterestFunction, recibe únicamente POST `/api/v1/pilot-interest` con Auth NONE en esa ruta. El resto del API comercial conserva Cognito/JWT. No existe GET público para listas, referencias, correo o estado de selección.

InterestTable pertenece a este dominio, con SSE y TTL expiresAt. La Lambda sólo dispone de GetItem/PutItem/UpdateItem en esa tabla y escritura en su log propio; no lee ni escribe Catálogos, Cotizaciones, Equipo o Cognito. No envía correo. La infraestructura conserva el modelo de microservicios con tablas y roles propios.

La respuesta pública es siempre `202 {reference, status: 'received'}` para creación o replay idéntico. No indica que se haya verificado el correo ni vincula la solicitud a la sesión que tenga el navegador. Cambiar contenido con la misma referencia devuelve 409. El cliente público omite Authorization y X-Organization-Id incluso si existe una sesión comercial.

## Persistencia, capacidad y conservación

La transacción guarda `INTEREST#<uuid>/RECORD` y actualiza `DAILY#<fecha UTC>/COUNTER`. El primer registro conserva su payload normalizado, hash, estado received, fecha de recepción y autorización del servidor. La misma referencia y contenido no consumen otra plaza, incluso ante una carrera de escrituras. Una referencia usada con otro contenido no sustituye el registro.

La capacidad es global al formulario: 200 solicitudes nuevas por día UTC. Al agotarse se responde 429 INTEREST_LIMIT_REACHED con Retry-After hasta el próximo día. La ruta tiene throttling de 2 solicitudes/segundo y ráfaga 5; API Gateway puede devolver su propio 429 antes de llegar a Lambda. El throttling es un control operativo de mejor esfuerzo, no una garantía contra todo abuso. No se hacen pruebas de carga ni se agota la capacidad pública para verificar el formulario.

Las solicitudes reciben expiresAt a 90 días y los contadores dos días después del cierre de su día. El TTL elimina registros de forma asíncrona; no se promete borrado puntual al segundo ni se aplica esta política a snapshots comerciales. [TTL de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html). La tabla se retiene si se elimina el stack y no habilita PITR en esta entrega. Las copias privadas que genere el operador tienen tratamiento y eliminación propios; TTL no las borra.

Los logs de aplicación no contienen body, correo, organización ni IP/user-agent. El access log del API conserva requestId, ruta, status y tamaño. El indicador contactConsent registra lo recibido, sin acreditar por sí solo que el remitente controle el correo; antes de incorporar personas se confirma la coordinación por el proceso manual del piloto.

## Operación y verificación

`tools/pilot-interest-development.mjs` permite listar metadatos sin datos de contacto y exportar una referencia mediante IAM, restringido a cuenta/región/stack/tabla de CotiTrama development. La lista es acotada y avisa si hay más resultados; no debe interpretarse un subconjunto como todas las solicitudes. La exportación explícita guarda un JSON privado ignorado por Git, sin imprimir el contenido y sin sobrescribir otro archivo o seguir enlaces simbólicos. No hay un panel CRM ni cambios automáticos de estado de selección.

`tools/interest-smoke.mjs` verifica mediante el endpoint público una solicitud sintética, replay, conflicto, validación de consentimiento/campos y ausencia de lecturas públicas. Las lecturas IAM posteriores comprueban la persistencia y la caducidad. La comprobación del formulario en navegador usa otra solicitud ficticia; cleanup elimina sólo las referencias registradas con namespace example.invalid y hash coincidente. El contador diario conserva esas aceptaciones QA, sin decrementarlo ni afectar registros ajenos.

La [convocatoria redactada](../piloto/convocatoria.md) y el [protocolo](../piloto/protocolo.md) distinguen interés, selección, acuerdo de participación y comienzo. El envío a organizaciones reales y sus resultados continúan pendientes. La aceptación observada de la entrega se registra en [Verificación](../verificacion.md).
