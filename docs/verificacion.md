# CotiTrama: aceptación de development en AWS

Verificado el 19 de noviembre de 2026. URL pública: **https://cotitrama-dev.lynxpardelle.com**. Testing y producción no se promovieron; los demás proyectos no recibieron cambios.

## Última entrega: límites y avisos de consumo

Runtime desplegado: **f6df9836c93d920177ec880ee2354135e3b8592d**, con SourceCommit coincidente en cotitrama-development y estado UPDATE_COMPLETE. La [CI del runtime](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44627215886) terminó correctamente. Los commits de evidencia posteriores no cambian el runtime.

La fuente canónica se trasladó a `services/shared/plans.json` para que Angular y las Lambdas compartan las mismas capacidades. Esencial aplica 2 miembros, 2 catálogos activos y 100 propuestas por mes UTC; Equipo 8/10/1,000 y Empresa 25/50/5,000. Los precios siguen propuestos. `limitsEnforced: true` declara las capacidades activas y `billingEnabled: false` conserva el piloto sin cargos. Stripe permanece pendiente.

### Comprobaciones locales de esta entrega

| Comprobación | Resultado |
| --- | --- |
| Backend y guardas de operación/QA | 79 pruebas correctas: 74 de servicios y cinco guardas de herramientas. |
| Angular | 44 pruebas correctas en diez archivos. |
| Empaquetado | Dos pruebas correctas. |
| Total | **125 pruebas correctas**. |
| Angular SSR | Build exitoso, 354.73 kB iniciales y 96.96 kB de transferencia estimada. |
| Artefacto SSR | Rutas profundas, incluida /consumo, configuración sin caché y token de invitación ausente del HTML. |
| SAM y CloudFormation | Build de seis funciones y lint de ambas plantillas sin errores. |

La revisión independiente encontró y corrigió dos casos antes del despliegue: un refresh de consumo absorbido por una consulta iniciada antes de la mutación, y una respuesta de propuesta que podía reinstalarse tras cerrar sesión. Las regresiones fallaron antes del arreglo y pasaron después. Las vistas privadas quedan ocultas al cerrar/expirar sesión y las respuestas se cercan por organización, sesión y generación.

### AWS real

`tools/quota-smoke.mjs` completó diez comprobaciones, además de preparar tres cuentas sintéticas aisladas con correo suprimido:

1. Catálogos Esencial: identificadores únicos frente a revisiones y replays, rechazo del tercer activo, archivo que libera capacidad y reactivación condicionada al cupo.
2. **100 emisiones reales de Esencial**, aviso al 80%, límite al 100%, rechazo de la siguiente y replay sin incremento. El contenido distinto conserva su conflicto; lectura y preview continúan disponibles.
3. Dos aceptaciones concurrentes disputan la última plaza de Esencial: sólo una entra. Reintentar no ocupa otra; retirar libera plaza y una invitación usada no restaura la membresía retirada.
4. Equipo: aviso de propuestas al 80% y disputa del último cupo de propuestas, catálogos y miembros.
5. Empresa: los mismos bordes y condiciones para sus capacidades 25/50/5,000.
6. Reducción a Esencial con exceso: conserva snapshots y lecturas, informa over y bloquea nuevas operaciones que consumen capacidad agotada.

Los bordes altos de Equipo y Empresa usan **preparaciones sintéticas de contadores exclusivamente en organizaciones QA registradas**, seguidas de transacciones reales. El informe lo declara; no demuestra que se hayan emitido 1,000/5,000 propuestas ni que exista una prueba de carga sostenida. El journal se restauró al recuento real de registros, incluso al salir de cada escenario. La prueba de cambio de mes y backfill paginado se cubre localmente; no se alteró el reloj de AWS.

Las invocaciones del script son IAM con el contrato HTTP API v2. La verificación de Cognito/PKCE/JWT del gateway se hizo por separado en navegador. No se enviaron correos QA nuevos en esta ampliación.

### Navegador y avisos

- Sin sesión, /consumo muestra el acceso y no serializa métricas privadas. Las tres rutas de consumo sin JWT devuelven 401.
- Una cuenta propia de Esencial mostró el estado inicial normal, luego **80 de 100 propuestas realmente emitidas**, 20 disponibles y aviso Cerca del límite en pantalla y navegación.
- Tras completar esa cuenta a **100 propuestas reales**, mostró Límite alcanzado, cero disponibles y reinicio 01/12/2026 00:00 UTC. El estado persistió al recargar.
- El preview siguió disponible al agotar el cupo. Una emisión nueva devolvió PLAN_LIMIT_REACHED con enlace a Consumo, conservando el borrador y su clave para reintentar.
- El operador asignó Equipo por IAM sin cobro. Con la misma sesión y borrador, el reintento se guardó: el consumo pasó a **101 de 1,000** y reflejó el nuevo plan sin cambiar el token.
- Archivar desde la pantalla, con confirmación, redujo los catálogos activos de uno a cero. La propuesta `4f2211f8-3945-48be-aaa1-a62e6ee7d432`, v1 por **4,500.00 MXN**, siguió consultándose con el catálogo archivado. Reactivar devolvió el contador a uno.

### Activación, evidencia y limpieza

Antes de desplegar se comprobó dos veces que el pool propio de development tenía cero usuarios. Se esperó UPDATE_COMPLETE y se drenó el timeout antes de crear QA; no había escritores autenticados anteriores durante el backfill. Para activar otro ambiente con usuarios, importar pertenencias Cognito pendientes y pausar/drenar escritores antiguos conforme al [diseño de límites](architecture/003-limites-y-consumo.md). Una operación ya autorizada puede terminar con el plan que leyó al comenzar; coordinar los cambios del operador sin escrituras en curso.

Evidencia local ignorada por Git: `artifacts/quotas-preflight.json`, `artifacts/quota-smoke.json`, `artifacts/quotas-browser.json`, `artifacts/cotitrama-consumo-80.jpg`, `artifacts/cotitrama-consumo-100.jpg`, `artifacts/cotitrama-cuota-rechazo.jpg`, `artifacts/cotitrama-consumo-archivo.jpg` y `artifacts/cotitrama-cuota-propuesta-conservada.jpg`.

Se cerró la sesión del navegador y cleanup eliminó únicamente las tres cuentas QA y sus grupos vacíos, verificando namespace, pool, email, sub y organización. El archivo privado de credenciales ya no existe. Los registros sintéticos DynamoDB se conservan como evidencia. Las cinco alarmas del stack estaban en OK al cerrar. No hubo cambios en Stripe, testing, main ni recursos de otros productos.

## Evidencia previa de registro y Equipo

Los apartados siguientes conservan la aceptación anterior del registro, correo real y gestión de miembros. Sus commits, conteos de pruebas e informes corresponden a esa entrega; el runtime y las comprobaciones actuales están arriba.

### Entrega

- Rama `development`, trabajo previo conservado y publicado en origin.
- Equipo, invitaciones y propuesta de precios desplegados: commit `26d6a99766614afc8c08bffb4485e4f3efbbb6ae`.
- Runtime final desplegado y verificado: `0f32a5d6a882d7180650b967929a7dbcf89d83a1`, incluido el ajuste visual del selector, con CI verde y SourceCommit coincidente en el stack.
- Stacks exclusivos: `cotitrama-artifacts` y `cotitrama-development`, región us-east-1. La actualización de Equipo terminó UPDATE_COMPLETE. El stack de aplicación lleva SourceCommit del código desplegado.
- CloudFront E3GSFWU10YQHF3, DNS A/AAAA y TLS válidos; certificado existente reutilizado sin modificarlo. No se cambiaron nameservers ni recursos de otros proyectos.
- Seis Lambdas: Web SSR, Catálogos, Cotizaciones, Equipo, Registro y Salud. Tablas DynamoDB separadas por dominio, Cognito propio y Function URL protegida con IAM/OAC. Equipo y Registro pertenecen al mismo dominio de identidad y comparten su tabla MembersTable.

### Comprobaciones locales y CI

| Comprobación | Resultado |
| --- | --- |
| Backend | 50 pruebas pasan: reglas, negocio, onboarding, Equipo, permisos y adaptadores transaccionales. |
| Guardas del smoke AWS | 2 pruebas pasan; restringen stack, cuenta, región y limpieza QA. |
| Angular | 27 pruebas pasan, incluida regresión de selección de espacio tras aceptar una invitación. |
| Empaquetado | 2 pruebas pasan; sin assets residuales y paquete npm válido para SAM. |
| Build Angular SSR | Salida 0; bundle inicial 349.62kB, transferencia estimada 97.01kB. |
| SAM build | Salida 0, seis funciones. |
| cfn-lint | Plantillas aplicación y artefactos sin errores. |
| CI Equipo | [Ejecución 44618456771](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44618456771), success. |
| CI selector | [Ejecución 44620159729](https://github.com/LynxPardelle/cotizador-de-catalogo/actions/runs/44620159729), success. |

### Servicios reales

`node --use-system-ca tools/aws-smoke.mjs --verify` completó 14 comprobaciones, agrupadas aquí por comportamiento:

1. Dos cuentas QA sintéticas, sin envío de emails, con organizaciones distintas.
2. Onboarding idempotente mediante la Lambda desplegada: dos invocaciones conservan un único grupo.
3. Publicación de catálogo y cálculo exacto: subtotal 27,750.00 MXN, descuento 1,387.50 MXN, total 26,362.50 MXN.
4. Ocho emisiones concurrentes conservan un solo identificador; cambiar contenido con la misma clave devuelve 409.
5. Publicar v2 con otro precio y nombre de opción no cambia el snapshot emitido en v1.
6. Recursos de otra organización devuelven 404 antes de aceptar invitaciones; reader no simula y seller no publica. Los roles se modifican realmente en la tabla de Equipo.
7. CloudFront entrega landing/config/health, y el API de negocio rechaza solicitudes sin token.
8. La Function URL directa rechaza invocaciones anónimas con 403.

9. Invitación ligada al destinatario: otra cuenta recibe 404; aceptación y repetición conservan una sola membresía y permiten acceder a dos espacios.
10. Degradar a lector impide simular aunque la solicitud conserve claims antiguos de administrador. Retirar la membresía impide acceder al negocio; repetir una invitación usada no restaura el acceso.
11. Dos administradores intentan degradarse simultáneamente contra DynamoDB real: una transacción termina correctamente, otra devuelve 409 y queda exactamente un administrador. Se restaura al propietario mediante quien conserva el permiso.
12. Un espacio persistido que fue retirado se recupera hacia el espacio propio; una solicitud comercial que insiste en el espacio retirado se rechaza. La baja o degradación del último administrador devuelve 409.

Los casos de negocio del script invocan Lambdas por IAM con el contrato HTTPv2 y comprueban DynamoDB real. Los cambios de rol y pertenencia usan el servicio de Equipo desplegado; no se simulan cambiando grupos del token. El script no acredita por sí solo la verificación de JWT del gateway; esa etapa se comprueba en navegador.

### Registro y correo de confirmación reales

Se realizaron dos altas públicas con aliases QA del buzón autorizado: una antes y otra después de desplegar Equipo. Ambas usaron SignUp real, exigieron confirmación y permanecieron UNCONFIRMED hasta recibir el correo. Se leyó únicamente el mensaje dirigido al alias QA, se utilizó el código recibido con ConfirmSignUp y Cognito terminó en CONFIRMED con email_verified=true y organización propia.

En la segunda alta, una lectura fuertemente consistente de MembersTable confirmó que PostConfirmation ya había persistido al propietario como administrador antes de llamar al contexto de Equipo. No se utilizó AdminConfirmSignUp ni se marcó manualmente como verificado el correo de estas dos altas.

Se mantiene el correo administrado de Cognito. Personalizar asunto y contenido requiere una configuración SES DEVELOPER, fuera de esta entrega, según el [contrato de plantillas de Cognito](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_VerificationMessageTemplateType.html). El correo automático de invitación no está habilitado: los administradores comparten un enlace de siete días, dirigido al correo verificado del destinatario.

Evidencia sin contraseñas ni códigos: `artifacts/registration-legacy-verified.json` y `artifacts/registration-verified.json`. Las dos cuentas de registro QA se eliminaron después de comprobar el resultado.

### Navegador, Cognito y JWT reales

La aceptación por navegador completó el tramo que no cubre la invocación IAM:

- La llamada Crear cuenta abrió el formulario público de Cognito con PKCE S256 y callback correcto.
- Login con usuario QA, intercambio Authorization Code/PKCE, sesión y logout reales.
- Listado y publicación desde Angular a través de CloudFront → API Gateway/JWT → Lambda → DynamoDB.
- Publicación de `oficina` v1, configuración de cinco escritorios con roble e instalación, cálculo y emisión por **26,362.50 MXN**.
- Propuesta `a158e508-c140-45d2-abf9-09f032679900` conservó v1, opciones e importes al recargar su URL después de publicarv2 con base 9,000.00 MXN y roble 1,200.00 MXN.
- Segunda cuenta autenticada: catálogo vacío y propuesta ajena rechazada con el mensaje de recurso inexistente en su organización. Esto prueba aislamiento con JWT real.
- Landing responsive, sin desbordamiento a 390 × 844; enlaces de planes y FAQ operativos. Sin errores de aplicación en el flujo positivo; el 404 de aislamiento es esperado.

La ampliación de Equipo también se verificó con Cognito y JWT reales:

- Una cuenta confirmada antes de la ampliación migró desde sus grupos existentes y abrió Equipo como administrador.
- El administrador creó un enlace desde la pantalla; la sesión de otra cuenta recibió el rechazo previsto. El login conservó la ruta de regreso a la invitación.
- El destinatario aceptó y conservó su espacio propio, además del nuevo espacio comercial. Cambiar de espacio mostró únicamente los catálogos correspondientes.
- El administrador cambió el rol a lector; otra sesión, con el mismo token anterior, recibió el rol actual y deshabilitó la simulación. La pantalla protegió al último administrador con el mensaje previsto.
- La retirada de acceso desde la pantalla conservó la cuenta de la persona; al recargar recuperó su espacio propio sin acceder al catálogo del espacio retirado.
- Se encontró una discrepancia visual entre el selector y el espacio activo tras aceptar. La prueba de regresión reprodujo el fallo y pasó al vincular cada opción con la selección actual. El ajuste desplegado se verificó al aceptar otra invitación: el selector mostró el espacio invitado con rol Vendedor y conservó la selección al recargar.
- En esa sesión de vendedor, se simularon y emitieron cinco escritorios con opciones de la revisión v2: subtotal 52,250.00 MXN, descuento 2,612.50 MXN y total **49,637.50 MXN**. La propuesta `4edb44b2-70ac-4f61-9572-6eb9fdef83e8` se reabrió por URL y conservó su desglose al recargar.

Evidencia local ignorada por Git: aceptación original en `artifacts/aws-smoke-verified.json` y `artifacts/aws-browser.json`; ampliación en `artifacts/aws-team-verified.json`, `artifacts/aws-team-browser.json`, `artifacts/cotitrama-equipo.jpg` y `artifacts/cotitrama-equipo-propuesta.jpg`. Los archivos privados de pruebas nunca se incorporan al repositorio.

### Limpieza y operación

Se cerraron las sesiones de navegador y se eliminaron las dos cuentas sintéticas registradas y sus grupos vacíos mediante el helper con guardas de propiedad. Las dos cuentas de registro con correo real también se eliminaron. Los archivos privados de credenciales y códigos ya no existen. Los datos sintéticos de DynamoDB se conservan como evidencia; no se borraron datos de otras organizaciones. El stack terminó UPDATE_COMPLETE y sus cinco alarmas (API 5xx, Catálogos, Cotizaciones, Registro y Equipo) estaban en OK al cerrar.

En este Windows, Node necesitó `--use-system-ca` para usar la confianza TLS del sistema. No se desactivó verificación de certificados ni se cambió la configuración de Windows.


## Pendientes actuales

- Piloto con clientes y datos autorizados: medir tiempo por cotización, correcciones, uso y costos, y contrastar precios/capacidades con disposición a pagar. La aceptación sintética no valida demanda.
- Medir volumen y latencia reales antes de ofrecer Empresa a escala. El primer contador de cada mes consulta el historial de propuestas de la organización; evaluar una migración o índice que evite que el arranque crezca con años de snapshots.
- Definir ciclo contractual, cancelación, condiciones comerciales y soporte antes de contratar. Los contadores y avisos operativos ya están implementados; Stripe y los cobros continúan pendientes.
- Promover únicamente mediante el flujo autorizado development → testing → main. El dominio de producción sigue siendo una dirección prevista.
