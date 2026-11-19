# CotiTrama: aceptación de development en AWS

Verificado el 19 de noviembre de 2026. Desarrollo está desplegado en **https://cotitrama-dev.lynxpardelle.com**. Testing y producción no se promovieron.

## Entrega

- Rama `development`, trabajo previo conservado y publicado en origin.
- Equipo, invitaciones y propuesta de precios desplegados: commit `26d6a99766614afc8c08bffb4485e4f3efbbb6ae`.
- Runtime final desplegado y verificado: `0f32a5d6a882d7180650b967929a7dbcf89d83a1`, incluido el ajuste visual del selector, con CI verde y SourceCommit coincidente en el stack.
- Stacks exclusivos: `cotitrama-artifacts` y `cotitrama-development`, región us-east-1. La actualización de Equipo terminó UPDATE_COMPLETE. El stack de aplicación lleva SourceCommit del código desplegado.
- CloudFront E3GSFWU10YQHF3, DNS A/AAAA y TLS válidos; certificado existente reutilizado sin modificarlo. No se cambiaron nameservers ni recursos de otros proyectos.
- Seis Lambdas: Web SSR, Catálogos, Cotizaciones, Equipo, Registro y Salud. Tablas DynamoDB separadas por dominio, Cognito propio y Function URL protegida con IAM/OAC. Equipo y Registro pertenecen al mismo dominio de identidad y comparten su tabla MembersTable.

## Comprobaciones locales y CI

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

## Servicios reales

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

## Registro y correo de confirmación reales

Se realizaron dos altas públicas con aliases QA del buzón autorizado: una antes y otra después de desplegar Equipo. Ambas usaron SignUp real, exigieron confirmación y permanecieron UNCONFIRMED hasta recibir el correo. Se leyó únicamente el mensaje dirigido al alias QA, se utilizó el código recibido con ConfirmSignUp y Cognito terminó en CONFIRMED con email_verified=true y organización propia.

En la segunda alta, una lectura fuertemente consistente de MembersTable confirmó que PostConfirmation ya había persistido al propietario como administrador antes de llamar al contexto de Equipo. No se utilizó AdminConfirmSignUp ni se marcó manualmente como verificado el correo de estas dos altas.

Se mantiene el correo administrado de Cognito. Personalizar asunto y contenido requiere una configuración SES DEVELOPER, fuera de esta entrega, según el [contrato de plantillas de Cognito](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_VerificationMessageTemplateType.html). El correo automático de invitación no está habilitado: los administradores comparten un enlace de siete días, dirigido al correo verificado del destinatario.

Evidencia sin contraseñas ni códigos: `artifacts/registration-legacy-verified.json` y `artifacts/registration-verified.json`. Las dos cuentas de registro QA se eliminaron después de comprobar el resultado.

## Navegador, Cognito y JWT reales

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

## Limpieza y operación

Se cerraron las sesiones de navegador y se eliminaron las dos cuentas sintéticas registradas y sus grupos vacíos mediante el helper con guardas de propiedad. Las dos cuentas de registro con correo real también se eliminaron. Los archivos privados de credenciales y códigos ya no existen. Los datos sintéticos de DynamoDB se conservan como evidencia; no se borraron datos de otras organizaciones. El stack terminó UPDATE_COMPLETE y sus cinco alarmas (API 5xx, Catálogos, Cotizaciones, Registro y Equipo) estaban en OK al cerrar.

En este Windows, Node necesitó `--use-system-ca` para usar la confianza TLS del sistema. No se desactivó verificación de certificados ni se cambió la configuración de Windows.

## Pendientes reales

- Piloto con usuarios/datos autorizados y medición de tiempo por cotización, correcciones y reglas reutilizadas. Las pruebas sintéticas no validan demanda ni ahorro comercial.
- Contrastar los precios y límites propuestos de Esencial ($399, 2 miembros, 2 catálogos, 100 propuestas/mes), Equipo ($1,199, 8/10/1,000) y Empresa ($3,499, 25/50/5,000), en MXN mensuales antes de impuestos. La landing y config/plans.json comparten esta propuesta; no hay cuotas de suscripción aplicadas, contrato ni cargos.
- Implementar contadores y avisos de consumo, ciclo de suscripción, condiciones comerciales y presupuesto operativo antes de habilitar contratación. Las propuestas y revisiones emitidas conservan su integridad al diseñar límites futuros.
- Stripe continúa pendiente por instrucción del usuario. No hay checkout ni cobros habilitados.
- Promover mediante PR development → testing → main cuando se autorice. El dominio de producción aún es una dirección prevista.
