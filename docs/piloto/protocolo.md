# Piloto con primeros usuarios de CotiTrama

Versión 1.0, preparada el 19 de noviembre de 2026. **Preparación documental completa; convocatoria y ejecución pendientes.** No hay participantes, autorizaciones, resultados humanos ni fecha de inicio confirmados en este repositorio. Los tamaños y umbrales siguientes son decisiones propuestas para este primer piloto exploratorio, no resultados observados ni estándares del mercado.

Ambiente: [CotiTrama development](https://cotitrama-dev.lynxpardelle.com/). El piloto continúa sin cargos; Stripe y la contratación siguen pendientes. Esta preparación no cambia el runtime ni promueve testing/main. El flujo de promoción permanece development → testing → main.

## Objetivo y entregables

Comprobar si personas de dos organizaciones pueden producir propuestas correctas, conservar su versión y entender las correcciones sin asistencia continua. Comparar el tiempo del flujo con su método habitual, observar uso por organización y obtener motivos concretos para repetir o abandonar el producto.

El paquete contiene la [guía para participantes](guia-primeros-usuarios.md), [casos funcionales y cinco tareas de referencia](casos-de-prueba.md), un [catálogo ficticio de práctica](catalogo-practica.json) y [plantillas de registro](plantillas/README.md). La aceptación técnica anterior se conserva en [Verificación](../verificacion.md); no reemplaza estas observaciones con personas.

## Cohorte, alcance y responsables

| Elemento | Diseño propuesto |
| --- | --- |
| Organizaciones | Dos espacios de trabajo designados ORG-A y ORG-B, cada uno perteneciente a una organización participante distinta. |
| Personas | Cuatro adultas voluntarias que ya preparen o revisen cotizaciones: un administrador y un vendedor por organización. A1/B1 son administradores y A2/B2 vendedores. Códigos A1/A2 y B1/B2, sin nombres en los informes compartidos. |
| Espacios incidentales | Las cuatro altas crean espacios personales. Sólo los dos espacios designados cuentan como organizaciones del piloto; los vendedores deben seleccionar el espacio al que fueron invitados. |
| Plan | Esencial: dos miembros, dos catálogos activos y cien emisiones por mes UTC por espacio. Un catálogo de práctica y uno comercial autorizado caben en el cupo; versiones nuevas del mismo catálogo no ocupan otro. No se requiere un cambio de plan. |
| Datos | Una familia de productos del mismo sector en ambas organizaciones, con copia mínima autorizada por cada una, una moneda por catálogo y cantidades enteras. Sin nombres de compradores, datos personales de clientes ni información comercial de terceros sin autorización. |
| Actividad medida | Cinco pares de tareas por persona: veinte pares previstos, diez por organización. Cada par incluye un intento con el proceso habitual y otro con CotiTrama. |
| Tiempo | Catorce días calendario desde el cierre de la lista de preparación. Reservar una incorporación de hasta 30 minutos, dos sesiones de hasta 60 minutos y un cierre de hasta 15 minutos por persona. Cada intento tiene un corte de 10 minutos. |
| Volumen | Presupuesto de hasta 25 emisiones nuevas por espacio durante todo el piloto, incluidas práctica, controles y uso opcional. Llevar cuenta en el registro; no llenar la cuota ni ejecutar pruebas de carga con participantes. |

El **facilitador** convoca, explica el ejercicio, cronometra, registra ayuda y custodia las evidencias privadas. El **administrador participante** autoriza el catálogo de su organización y las cinco solicitudes y resultados de referencia. El **operador de CotiTrama** atiende fallos técnicos, comprueba el ambiente y decide una eventual corrección por el flujo habitual. Una persona puede cubrir facilitación y operación; el resultado de referencia debe revisarse con el administrador de cada organización. Los nombres y el canal de ayuda se acuerdan antes de convocar; no se inventa aquí un contacto.

No se envían invitaciones ni se crean cuentas en nombre de personas como parte de esta preparación. Cada participante registra y confirma su propia cuenta. El retiro de una membresía o el cierre de una cuenta real se coordina con la persona; no se usa el cleanup de QA sintética.

## Lista de preparación y comienzo

El facilitador marca cada punto en una copia privada antes de fijar el día 1:

- Cuatro personas y dos organizaciones aceptan participar, conocen la duración, la naturaleza de development, el uso de sus observaciones y la posibilidad de detenerse. Se acuerda un canal privado de ayuda, sin grabación de pantalla por defecto.
- Cada organización autoriza una copia mínima de su catálogo y designa los dos miembros del espacio. Las cuentas personales y correos no se incluyen en Git ni en un informe público.
- El operador confirma acceso a landing, registro, confirmación de correo y rutas de trabajo con una sesión normal. Revisa el estado del stack y alarmas propios y registra fecha/revisión. La verificación del 19/11/2026 es antecedente, no una comprobación automática del día de arranque.
- El administrador prepara los JSON válidos, vigentes y con identificadores distintos para práctica y catálogo comercial. La UI publica JSON; no hay importador Excel/CSV ni editor visual de reglas. El facilitador puede preparar el archivo, pero no cambiar precios sin revisión del administrador.
- Se congelan catálogo comercial v1, moneda, vigencia, redondeo y cinco solicitudes válidas por persona. Cada solicitud tiene un resultado de referencia independiente y revisado: producto, opciones, cantidad, subtotal, reglas/descuento, total y versión. No se obtiene ese resultado copiando una respuesta de CotiTrama.
- Se fija el método habitual: herramienta que la persona usa hoy para guardar y volver a abrir una propuesta equivalente. No se exige que sea la misma herramienta en ambas organizaciones; se documenta por participante.
- Se registran inicio UTC, contador mensual y catálogos/miembros actuales, las cinco tareas y el orden de los métodos. Se preparan las copias privadas de las plantillas y se comprueba que el cupo permite el ejercicio.
- Se acuerda quién puede consultar las evidencias, una fecha de revisión/cierre y su tratamiento posterior. No se promete borrado automático: las propuestas emitidas no tienen una función de borrado para participantes.

Si falta una persona, autorización, acceso o referencia de cálculo, el estado sigue **preparado, sin iniciar**. La fecha de este documento no inicia los catorce días.

## Secuencia de los catorce días

| Momento relativo | Actividad y salida |
| --- | --- |
| Día 1 | Registro propio, correo confirmado, invitación manual, selección del espacio y práctica con datos ficticios. Un par de calentamiento por persona, marcado práctica y excluido de las veinte tareas. Se permite ayuda durante el aprendizaje. |
| Días 2–5 | Primera sesión: cinco tareas con el primer método asignado. Se conserva el catálogo v1 y se guardan resultados y referencias privadas. |
| Días 6–8 | Segunda sesión: las mismas cinco solicitudes con el otro método. Sin mostrar el resultado de referencia hasta que ambos intentos de cada par estén cerrados. |
| Días 9–11 | Casos funcionales pendientes: publicar v2, reabrir v1, declarar correcciones, controles de roles y cierre de sesión. Uso opcional autorizado, clasificado aparte. |
| Días 12–14 | Conciliar las emisiones, auditar importes, revisar incidencias, entrevista breve y decisión por organización. Preparar informe agregado, con limitaciones y tareas siguientes. |

Orden fijado antes de comenzar: A1 y B2 usan habitual → CotiTrama; A2 y B1 usan CotiTrama → habitual. No se cambia ese orden al ver resultados. Contrabalancear reduce el sesgo de aprendizaje, pero no lo elimina; repetir solicitudes permite recordar resultados. El administrador que aprobó el catálogo puede conocer ya las respuestas: registrar esa familiaridad y no presentar el ejercicio como ciego. No se vuelve a mostrar el resultado de referencia durante el cronometraje. El piloto sólo produce evidencia descriptiva.

Los veinte pares se hacen con el catálogo v1 congelado. Publicar v2, probar incompatibilidades y cambiar temporalmente roles se deja para después de los intentos medidos. Si se debe cambiar v1 por un error de referencia, se cierra esa cohorte como afectada y se define otra revisión del ejercicio antes de medir de nuevo; no se mezclan silenciosamente configuraciones distintas.

## Medición comparable

**Tiempo de pared, en ambos métodos.** La herramienta está abierta y lista. Se inicia el cronómetro cuando el facilitador entrega la solicitud y dice iniciar; termina cuando la persona ha guardado una propuesta recuperable, la ha vuelto a abrir y declara la tarea terminada. El facilitador verifica el resultado contra la referencia después de cerrar ambos métodos del par. Para el método habitual, el archivo o registro debe ofrecer el mismo entregable mínimo: configuración, desglose, moneda, total y referencia recuperable.

Registrar inicio/fin UTC y segundos transcurridos con el mismo cronómetro. Incluye lectura de la solicitud, configuración, revisión, esperas del sistema, guardado y reapertura. Las pausas ajenas a la tarea se anotan; no se descuentan a conveniencia. Una interrupción externa que invalide la comparación se marca con motivo y se excluye del estimador de mejora en ambos métodos del par, conservando el registro.

Cada primer intento termina como **éxito**, **fallo**, **abandono** o **no ejecutado**. Al llegar a 10 minutos se detiene como fallo por tiempo. Si se necesita ayuda antes de terminar, se marca asistido y se conserva el primer intento. Una demostración o recuperación posterior lleva otra fila de clase control y no sustituye el fallo original ni rellena la muestra medida. Retirarse no se registra como éxito.

Un **par comparable** requiere ambos métodos terminados correctamente, tiempos de pared mayores que cero, misma solicitud/revisión, sin ayuda y sin interrupción invalidante. Para cada par: `mejora_pct = 100 × (segundos_habitual − segundos_CotiTrama) / segundos_habitual`. Cero o negativo en el método habitual invalida ese tiempo; una mejora negativa significa que CotiTrama tardó más. No se divide la media de un método por la de otro ni se incluyen fallos como si hubieran sido rápidos.

Reportar mediana de las mejoras de los pares comparables, conteo y causas de exclusión, y medianas por persona y organización. Mostrar también exactitud y fallos del método habitual, y primeros intentos asistidos, fallidos o abandonados en ambos métodos; el tiempo comparado está condicionado a tareas completadas correctamente. Veinte pares de cuatro personas no son veinte personas independientes. No se calcula una conclusión estadística de población ni un porcentaje público de ahorro a partir de esta muestra pequeña.

**Tiempo activo del navegador.** `/piloto` muestra otra medida: comienza con la primera interacción manual y se congela al primer intento de emitir, con foco/visibilidad e inactividad limitada. Excluye pasos que sí entran en el tiempo de pared. Se registra como dato auxiliar; nunca se compara directamente contra el tiempo habitual. Un cero reportado por el navegador es válido y se distingue de una muestra ausente.

## Uso y correcciones por organización

El panel permite filtrar organización y 7/30/90 días UTC, pero no cohorte, catálogo, participante o clase de tarea. Su media puede incluir práctica, controles y actividad opcional; no equivale a la media de los veinte pares. El registro privado enlaza cada emisión con su tarea y clase para reconstruir la cohorte sin inferir abandonos desde el número de propuestas emitidas. No existe una exportación CSV del panel: los registros del piloto se completan manualmente.

Por ORG-A/ORG-B, informar tareas asignadas/cerradas/autónomas, sesiones y días con uso observado, emisiones únicas por clase, correcciones declaradas y propuestas auditadas. Las cuentas emisoras agregadas del panel no identifican personas; la asistencia y participación se obtienen del registro, no de ese agregado.

Una corrección declarada no acredita un error de precio ni su resolución. Registrar aparte incidencia observada, categoría, propuesta afectada, resultado de auditoría y eventual referencia a una nueva propuesta. Varios registros pueden referirse a una misma propuesta; no multiplicar el número de errores confirmados. No se provocan declaraciones ficticias en tareas medidas para mejorar una estadística. Los ejercicios de declaración llevan clase control.

Fotografiar al inicio y cierre plan/consumo del espacio con datos mínimos y sin credenciales. Si los catorce días cruzan un cambio de mes UTC, conciliar emisiones de cada mes por separado: la cuota se reinicia el día 1 a 00:00 UTC. `consumo_final − consumo_inicial` no representa todo el piloto cuando cambia el mes. Los replays no son emisiones nuevas; publicar v2 no es otro catálogo activo y declarar correcciones no añade cuota de propuestas.

## Criterios de éxito propuestos

Los umbrales se fijan antes de medir. No pueden relajarse al ver un resultado desfavorable. Registrar por criterio **cumple**, **no cumple**, **sin datos** o **no evaluable**, con su denominador; el estado inicial de todos es **sin datos**.

| ID | Criterio y denominador | Umbral para avanzar a otra cohorte controlada |
| --- | --- | --- |
| EX-01 | Integridad y acceso: casos críticos de la matriz, snapshots y aislamiento de las dos organizaciones. | Todos los controles críticos de integridad y acceso pasan; cero accesos ajenos, pérdidas o cambios de snapshots emitidos. Los tiempos agotados, la ayuda y los abandonos de PIL-04 se evalúan en EX-03/04/05 y no constituyen por sí solos un fallo de integridad. Una discrepancia de precio o acceso confirmado sí impide avanzar. |
| EX-02 | Exactitud: todas las propuestas CotiTrama emitidas en las tareas comerciales medidas, incluidas las asistidas si se emiten. | 100% auditadas y coincidentes en configuración, moneda, revisión, reglas, redondeo e importes con la referencia independiente; informar cantidad auditada/emitida. Una discrepancia pendiente impide avanzar. |
| EX-03 | Autonomía: veinte tareas CotiTrama preasignadas, no sólo las emitidas. Éxito correcto, guardado y reapertura en el primer intento, sin ayuda y en hasta 10 minutos. | Al menos 16/20 y al menos 8/10 por organización. Fallos, abandonos y no ejecutados permanecen en el denominador. |
| EX-04 | Cobertura de observación de pared: los veinte pares previstos. Ambos intentos tienen inicio/fin/estado válidos, aunque acaben en fallo o abandono. | Al menos 18/20 y al menos 4/5 por persona; los veinte pares deben tener un estado de cierre. No ejecutado no es un intervalo observado. |
| EX-05 | Comparabilidad y tiempo: pares correctos y sin ayuda en ambos métodos. | Al menos 16/20 pares comparables y al menos tres por persona antes de evaluar la meta. Mediana de mejora de al menos 20%, con medianas por organización no negativas. Meta exploratoria, sin promesa comercial de ahorro. |
| EX-06 | Utilidad declarada: respuesta privada de las cuatro personas, tras completar el ejercicio. | Al menos 3/4 desean usarlo para otra tarea y explican una razón concreta; al menos una por organización. Ausencia de respuesta no cuenta a favor. No valida intención de pagar. |
| EX-07 | Trazabilidad de uso: emisiones de los dos espacios designados durante el intervalo observado. | Todas las emisiones identificadas en el registro tienen clase y referencia; conciliación por organización y mes sin diferencias pendientes. Las prácticas y espacios personales incidentales no se presentan como adopción comercial. |

La cobertura de `pilot` del panel se informa como `muestras/emitidas` y las ausentes como su propio conteo. Para la cohorte comercial, el facilitador consigna presencia/ausencia de la medición al observar la propuesta, si puede verificarla con las herramientas de operación autorizadas. Si sólo dispone del panel mezclado, la cobertura de la cohorte se declara **no disponible**; no se inventa una cifra de 20. Es un diagnóstico auxiliar, no sustituye EX-04/EX-05.

## Decisión y tratamiento de incidentes

- **Avanzar a otra cohorte controlada:** EX-01..EX-07 cumplen, las cuatro personas y dos organizaciones participaron y los veinte pares están cerrados. Se documentan limitaciones, incidencias y mejoras. Esto no publica producción, no valida los precios y no activa Stripe.
- **Iterar o ampliar observación:** integridad y acceso no presentan fallos, pero algún criterio de uso, tiempo, utilidad o cobertura no cumple o no es evaluable. Conservar los datos completos, explicar exclusiones y proponer un nuevo ejercicio versionado. No declarar éxito seleccionando sólo los pares favorables.
- **Detener para corregir:** acceso entre organizaciones, pérdida/alteración de snapshots, resultado comercial incorrecto o exposición de credenciales/datos no previstos. Detener nuevas tareas afectadas y avisar al operador por el canal acordado; preservar evidencia mínima privada. No borrar registros ni compartir enlaces/token para reproducirlo. Si el alcance afecta aislamiento, pausar el piloto completo.

Una retirada o interrupción deja pendientes como no ejecutados y evita una decisión de avance si no se cumplen muestra y participación; no se sustituye una persona o una tarea silenciosamente. El uso de la palabra éxito en este protocolo se refiere a este ejercicio exploratorio.

## Evidencia y cierre

Copiar las [plantillas vacías](plantillas/README.md) a una ubicación privada acordada fuera de Git. Conservar la correspondencia personas/códigos separada del registro de sesiones. No subir registros completos, correos, invitaciones, URLs con tokens, credenciales o catálogos reales al repositorio. El repositorio conserva sólo plantillas vacías y resultados agregados revisados para compartir.

En el cierre, presentar por organización: participantes previstos/observados, tareas y estados, muestra comparable/exclusiones, tiempos de pared, referencia a la cobertura del panel con su alcance, discrepancias auditadas, correcciones declaradas, emisiones por mes y comentarios de utilidad. Preguntar qué costó más, qué repetirían, qué les impide adoptarlo y qué capacidad les haría falta. Las preguntas de precios, si se hacen después, se etiquetan como hipótesis sin pedir tarjeta ni activar un cobro.

Se acuerda la revisión de accesos con cada organización. Retirar membresías no borra las cuentas ni snapshots; cualquier solicitud sobre cuentas o datos se trata por el procedimiento específico que defina el operador. No prometer exportación, eliminación o retención automática que el producto no ofrece.

TASK-006 continúa pendiente hasta ejecutar y registrar este piloto con personas y datos autorizados. La preparación de este paquete completa TASK-013. Las [definiciones técnicas de métricas](../architecture/004-metricas-del-piloto.md) y los [límites operativos](../architecture/003-limites-y-consumo.md) siguen vigentes.

## Referencias metodológicas

Se consultaron el 19 de noviembre de 2026. Las pautas informan el diseño; los objetivos de 20%, 80%, cobertura y utilidad son hipótesis propias de este piloto, no umbrales prescritos por estas fuentes.

- [GOV.UK: observación moderada de tareas](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing): tareas relevantes para las personas, con un objetivo claro y sin adelantar la respuesta. Se usa para separar el aprendizaje guiado de los intentos observados.
- [GOV.UK: planificación de investigación](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service): distingue rondas pequeñas de investigación de métodos que requieren muchas más personas. Se propone una cohorte de cuatro como exploración, sin extrapolar sus porcentajes a toda la población.
- [GOV.UK: medición de usabilidad](https://www.gov.uk/service-manual/measuring-success/usability-benchmarking-a-website-or-whole-service): recoge terminación, tiempo y abandono, y orienta a limitar la cantidad y duración de tareas. De ahí se adopta el tope de cinco tareas y diez minutos por intento; este piloto pequeño no se presenta como un benchmark poblacional.
