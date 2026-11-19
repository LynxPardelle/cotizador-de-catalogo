# Límites por plan y avisos de consumo

Decisión del 19 de noviembre de 2026 para el piloto de CotiTrama en development. Stripe, contratación y cobros permanecen pendientes.

## Plan y autoridad

La fuente canónica es `services/shared/plans.json`, empaquetada junto a las Lambdas e importada por Angular. Los precios siguen siendo una propuesta comercial; `limitsEnforced: true` aplica las capacidades operativas durante el piloto y `billingEnabled: false` impide presentar el piloto como una suscripción contratada.

Esencial permite 2 miembros, 2 catálogos activos y 100 propuestas mensuales; Equipo, 8/10/1,000; Empresa, 25/50/5,000. Una organización sin asignación explícita usa Esencial. El identificador de plan está en la metadata de organización del dominio de identidad. Equipo devuelve el plan autoritativo junto a la autorización vigente de cada petición. El navegador y los documentos comerciales no pueden conceder otro plan.

El operador asigna planes del piloto por IAM mediante `tools/plan-development.mjs`, restringido a la cuenta, stack, región y tablas de CotiTrama en desarrollo. No se crea una ruta HTTP ni una operación privada setPlan en Equipo: Catálogos y Cotizaciones ya pueden invocar esa función y Lambda IAM no distingue el campo operation del payload.

## Contadores y conservación

Cada dominio conserva su contador en su propia tabla. El incremento y la operación que lo consume comparten la misma transacción DynamoDB con condición de capacidad; no se reservan cupos en un servicio central ni se cuenta después de confirmar la operación. [Contrato de transacciones DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).

- Miembros: pertenencias activas, incluido el administrador. Una invitación pendiente no reserva cupo. La aceptación de una persona nueva comprueba el límite y escribe token utilizado, ambas pertenencias y contador en una transacción. Reintentar o cambiar el rol no consume otra plaza; retirar libera una plaza y conserva la cuenta. El contador de miembros y el de administradores comparten una sola actualización META.
- Catálogos: identificadores activos, sin multiplicar por revisión. Publicar otra revisión o repetir la misma publicación no consume otro catálogo. Archivar libera capacidad, conserva todas las versiones y evita nuevas simulaciones/emisiones de ese catálogo. Reactivar comprueba cupo. Las propuestas emitidas y su consulta permanecen disponibles.
- Propuestas: emisiones nuevas confirmadas en el mes calendario UTC de issuedAt. Snapshot, idempotencia e incremento son atómicos. La consulta de replay ocurre antes de validar capacidad o volver a leer el catálogo, y conserva el resultado incluso al cambiar de mes o archivar. Un contenido distinto con la misma clave conserva su conflicto. Lecturas y simulaciones no consumen propuestas; alcanzar el cupo no las bloquea.

El contador mensual usa una clave nueva al cambiar de mes, sin borrar snapshots, revisiones o idempotencias anteriores. Una reducción de plan puede dejar el consumo por encima del nuevo límite: se muestra exceso y se impide crecer en la dimensión agotada, conservando el acceso a los datos existentes. Las revisiones de un catálogo ya activo siguen permitidas.

## Lectura y avisos

Las rutas autenticadas GET `/api/v1/team/usage`, `/api/v1/catalogs/usage` y `/api/v1/quotes/usage` exponen únicamente el consumo de la organización autorizada. La pantalla `/consumo` y los avisos de navegación reúnen los tres resultados y descartan respuestas de otra sesión/organización o de planes que cambiaron durante la lectura.

Cada métrica devuelve used, limit, remaining y state: normal, warning desde el 80%, limit al 100% y over cuando hay exceso previo. La métrica mensual incluye inicio y reinicio en UTC. Las operaciones que superan capacidad devuelven 409 PLAN_LIMIT_REACHED y permiten consultar consumo. Los avisos son dentro de la aplicación; no envían correo, cobran excedentes ni amplían el plan automáticamente.

## Datos anteriores y activación

Los contadores ausentes se inicializan mediante lecturas fuertes paginadas y escritura condicional. Todos los escritores nuevos deben esperar ese contador; otro inicializador conserva el valor que haya ganado la condición. No se considera cero un dominio con datos existentes. Las migraciones de pertenencias históricas conservan acceso y pueden dejar exceso, que se informa sin borrar miembros.

La inicialización requiere una ventana sin escritores de la versión anterior. Antes de activar en otro ambiente, importar las pertenencias Cognito aún no migradas, detener nuevas escrituras y drenar las solicitudes antiguas durante al menos el timeout máximo antes del primer contador. Esta entrega verificó inicialmente cero usuarios en el pool propio de development; las pruebas QA se crearán después de UPDATE_COMPLETE y del drenaje. Los registros de pruebas anteriores de DynamoDB se conservan.

Los planes de Catálogos y Cotizaciones se obtienen al autorizar cada petición; una operación ya autorizada puede terminar con el plan que leyó al empezar. Para un cambio de plan ordenado, pausar las escrituras del equipo y esperar que terminen las solicitudes antes de ejecutar el script del operador. Equipo, que posee plan y contador en la misma tabla, condiciona además el identificador de plan en la aceptación transaccional.

## Aceptación

La verificación incluye idempotencia al agotar el cupo, revisiones sin consumo adicional, archivado/reactivación, liberación de miembros, contención por la última plaza, cambio de mes y conservación tras una reducción. En AWS se separan emisiones reales de cualquier preparación sintética de contadores usada para probar los bordes de Equipo/Empresa; esas preparaciones sólo pueden afectar organizaciones QA identificadas y no acreditan una prueba de carga de miles de propuestas. El estado observado queda en `docs/verificacion.md`.
