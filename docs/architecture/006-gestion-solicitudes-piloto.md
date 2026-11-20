# Gestión privada de solicitudes del piloto

Decisión del 19 de noviembre de 2026. Amplía la [recepción de interés](005-convocatoria-e-interes.md) con una pantalla privada de seguimiento para operadores designados. La implementación se prepara en development; la aceptación observada en AWS y navegador se registra por separado en [Verificación](../verificacion.md). Stripe continúa pendiente.

## Acceso específico de operador

Angular publica `/piloto/solicitudes`. El servicio ApplicationsFunction recibe las rutas privadas `/api/v1/pilot-applications` bajo el autorizador JWT de Cognito. Comparte InterestTable con InterestFunction porque ambas funciones pertenecen al mismo dominio de solicitudes; dispone de su propio rol de ejecución y no accede a las tablas de Catálogos, Cotizaciones o Equipo.

El permiso requiere una cuenta habilitada, CONFIRMED, con correo verificado y pertenencia vigente al grupo dedicado `cotitrama-pilot-reviewers` del pool propio. El servicio toma `sub` de un access token validado, consulta el usuario por IAM, confirma que el `sub` coincide y consulta sus grupos actuales, con un presupuesto de diez páginas. Un exceso devuelve error temporal; no concede acceso por una comprobación incompleta. No se usan los grupos de un JWT anterior para conceder este permiso.

Ser administrador de una organización no concede acceso al panel. `X-Organization-Id` no interviene en esta autorización. Los operadores autorizados revisan el conjunto de solicitudes del piloto de CotiTrama, independiente de los espacios comerciales a los que pertenezcan. El registro ordinario y su trigger no conceden el grupo. Tampoco existe una ruta pública para asignarlo.

SAM declara el grupo. `tools/pilot-reviewer-development.mjs` concede, comprueba o retira la pertenencia por IAM a una cuenta existente del pool de development. Antes de conceder exige coincidencia del correo actual y cuenta habilitada, confirmada y verificada; utiliza el username canónico devuelto por Cognito. Comprueba cuenta, región y stack de desarrollo mediante las guardas operativas compartidas. No crea usuarios ni confirma correos en nombre de otra persona. La retirada se consulta de nuevo al siguiente acceso al API, aunque el navegador conserve su token anterior.

## Lista, detalle y seguimiento manual

`GET /context` devuelve sólo `{allowed: true}` una vez comprobado el permiso. La lista devuelve referencia, organización, sector, fechas y metadatos de revisión; el correo y las notas sólo aparecen en la lectura de detalle correspondiente. El detalle conserva la solicitud original y presenta la revisión actual por separado. El historial contiene los cambios confirmados, su fecha y un identificador derivado del operador, sin copiar su correo ni su token.

El contrato compartido `services/applications/contract.json` define estos estados:

| Estado | Etiqueta | Uso manual |
| --- | --- | --- |
| `received` | Recibida | Pendiente de revisar. Es también el valor inicial de solicitudes anteriores. |
| `reviewing` | En revisión | Se está evaluando el encaje con el protocolo. |
| `needs_info` | Por aclarar | Falta confirmar información o disponibilidad. |
| `contacted` | Contactada | El operador registra que realizó el contacto por el canal acordado. |
| `selected` | Preseleccionada | Hay encaje preliminar; siguen pendientes el acuerdo y la preparación del piloto. |
| `not_selected` | No seleccionada | El operador registra su decisión para esta convocatoria. |
| `withdrawn` | Retirada | Se registra el retiro del proceso de selección. |

Cada cambio admite una fecha interna de próxima acción, opcional, y una nota de hasta 500 caracteres. La fecha usa `YYYY-MM-DD`, admite fechas pasadas y se borra con una cadena vacía. No programa correos, recordatorios o eventos de calendario. Las notas se normalizan y se muestran como texto; admiten saltos de línea y tabulación, sin controles de formato. Una nota puede documentar seguimiento sin cambiar el estado.

Todos los estados se gestionan manualmente. Preseleccionar no crea cuentas u organizaciones, no envía mensajes ni invitaciones y no asigna planes. Retirar una solicitud no altera su autorización original de contacto ni ejecuta un borrado o una baja comercial. Las opciones No y Por confirmar del formulario no provocan descartes automáticos. Antes de incorporar personas se mantiene el proceso del [protocolo](../piloto/protocolo.md).

## Concurrencia, auditoría e identidad de la recepción

La solicitud conserva `record`, su hash original, el estado superior `received`, la fecha de recepción y `expiresAt`. Sólo se añade o sustituye `review`, con estado de seguimiento, versión, última fecha y próxima acción. Las solicitudes históricas sin ese objeto se leen como Recibida con versión cero; no se necesita reescribirlas antes de consultarlas.

Un PATCH admite exactamente `mutationId` UUID, `expectedVersion` entero, `status`, `nextActionDate` y `note`. Una transacción actualiza condicionalmente la revisión y añade un evento `REVIEW#<versión>` y una respuesta `REPLAY#<mutationId>` en la misma partición. El evento incluye estados y fechas anterior/nueva, nota y actor derivado del `sub` verificado. No se duplican los datos de contacto en los eventos.

La repetición del mismo identificador y contenido devuelve la primera respuesta confirmada sin crear otro evento. Cambiar el contenido con ese identificador devuelve 409 CONFLICT. Si otro operador cambió la versión, 409 REVIEW_CONFLICT exige consultar el estado actual antes de enviar una nueva revisión. Las carreras de transacción tienen reintentos acotados y devuelven 503 REVIEW_BUSY si no se puede confirmar el cambio. El cliente conserva el identificador para reintentar una respuesta incierta.

La recepción pública continúa devolviendo `202 {reference, status: 'received'}` ante una creación o replay idéntico, incluso después de una revisión privada. No permite consultar el seguimiento interno ni cambiar la solicitud original o su consentimiento. Un seguimiento no consume otra plaza del formulario.

## Paginación acotada y retención

La tabla no tiene un índice global de seguimiento. Cada petición de lista hace lecturas fuertes con un máximo de cuatro páginas, cien registros evaluados y veinticinco solicitudes coincidentes no caducadas. El filtro por estado incluye las solicitudes históricas como Recibidas. Se devuelve un cursor explícito mientras quedan registros por explorar, incluso cuando una página no contiene coincidencias; una página vacía con cursor no significa que no existan más solicitudes. `scannedCount` es el trabajo evaluado de esa petición, no el número total de organizaciones.

La lista no promete orden global ni una instantánea de toda la tabla. El operador debe continuar las páginas antes de interpretar un filtro como completo. El cursor tiene versión y queda vinculado a su clase de consulta y filtro; el de historial también se vincula a la referencia. Sólo admite claves del dominio, sin permitir elegir una tabla, cuenta o ARN. Cambiar de filtro requiere iniciar la paginación desde el principio. Una mayor escala requerirá evaluar un índice y su estrategia de migración.

El historial usa una consulta fuerte a una sola partición, veinte eventos por página y versiones descendentes. Antes del detalle, historial o PATCH —también antes de devolver un replay— se comprueba que la solicitud no haya caducado. Los eventos y replays comparten el deadline original de noventa días de la solicitud; cada nota o cambio conserva ese mismo `expiresAt`. Las rutas dejan de mostrar un registro al llegar a su deadline, aunque la eliminación TTL de DynamoDB siga pendiente. Las copias privadas obtenidas por IAM mantienen su propio tratamiento; TTL no elimina esas copias.

## Verificación y límites

Las pruebas locales cubren autorización vigente y revocación, cuenta confirmada, exclusión de administradores sin permiso, esquemas estrictos, metadatos históricos, concurrencia, idempotencia, paginación, privacidad de la lista y caducidad. La regresión de memoria compartida comprueba que el seguimiento privado conserva recibo, consentimiento, hash y capacidad de la recepción pública. Estas pruebas no sustituyen la aceptación con JWT y DynamoDB reales.

El procedimiento de [operación](../operacion.md) incluye la asignación explícita del permiso y la aceptación sintética en development. El panel no automatiza selección, admisión, comunicaciones, borrado de solicitudes ni gestión de suscripciones. El envío de la convocatoria y la incorporación de participantes siguen siendo tareas humanas.
