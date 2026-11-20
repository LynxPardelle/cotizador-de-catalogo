# Tu primer piloto con CotiTrama

Esta guía te acompaña desde el registro hasta tu primera propuesta. Usaremos el ambiente de desarrollo para comprobar si el flujo ayuda a tu trabajo y dónde necesita mejorar. El piloto continúa sin cargos: crear una cuenta no contrata una suscripción. Stripe y los cobros siguen pendientes.

Abre [CotiTrama en desarrollo](https://cotitrama-dev.lynxpardelle.com/). La propuesta inicial es trabajar durante 14 días calendario con dos organizaciones, un administrador y un vendedor por organización. Es una evaluación pequeña de cuatro personas; las fechas comienzan cuando estén listos los accesos, el catálogo y los casos acordados. El [protocolo](protocolo.md) explica cómo se organizarán las sesiones y los [casos de prueba](casos-de-prueba.md) indican qué comprobar.

## Antes de empezar

La persona que coordina el piloto te entregará tu rol, el espacio que debes usar, los casos asignados y un canal privado para pedir ayuda. También acordará contigo los horarios de las dos sesiones, qué datos se recogerán y cómo dejar de participar. Si falta alguno de estos acuerdos, pide que se complete antes de la primera tarea medida.

- Usa tu propia cuenta y un correo que puedas confirmar.
- Trabaja con el catálogo revisado y autorizado para el piloto. No añadas datos personales de compradores ni información comercial que tu organización no haya autorizado.
- Reserva un equipo con navegador y conexión estable. No necesitas instalar herramientas ni compartir tu pantalla fuera de lo acordado.
- Puedes pausar o terminar tu participación. Explica a la persona facilitadora si fue una interrupción, un problema del producto u otro motivo; esa diferencia ayuda a interpretar los resultados.

## Si eres el contacto de una organización preseleccionada

La operación del piloto te compartirá manualmente un enlace de incorporación. Ábrelo con el mismo correo de contacto que usaste en la solicitud. Puedes iniciar sesión o crear y confirmar tu propia cuenta desde esa pantalla. El enlace por sí solo no concede acceso.

Selecciona expresamente el espacio de tu organización donde tengas administración y confirma participación y consulta de los metadatos necesarios para preparar el piloto. La pantalla te permitirá abrir Equipo y Catálogos en ese espacio. Invita al segundo participante con rol Vendedor mediante el flujo de Equipo y comparte su enlace de invitación, dirigido a su propio correo; el enlace de incorporación de contacto corresponde a tu cuenta.

Publica el catálogo revisado y autorizado con el flujo JSON actual. Vuelve a la incorporación, indica su identificador y revisión, y confirma la autorización para usarlo en el piloto. La preparación comprobará accesos vigentes y ese catálogo activo y vigente. La operación del piloto confirmará contigo referencias, sesiones, canal de ayuda, tratamiento de evidencias y fecha prevista. **Lista para coordinar el inicio** no inicia automáticamente los catorce días: acordaréis el comienzo cuando todo esté preparado.

## 1. Crea tu cuenta y confirma el correo

1. En la página de inicio, pulsa **Crear cuenta**.
2. Completa el registro en la pantalla de acceso de CotiTrama. Introduce tú mismo tu correo y contraseña y sigue los requisitos que indique la pantalla.
3. Revisa tu correo y escribe el código de confirmación en la pantalla correspondiente. Comprueba también correo no deseado si no aparece. No envíes tu contraseña ni el código a quien coordina el piloto.
4. Inicia sesión si se solicita. Una cuenta confirmada obtiene un espacio propio con rol de administrador.

Si el correo no llega o no puedes completar el acceso, comunica la hora aproximada y el mensaje que aparece. El facilitador revisará el alta antes de pedirte que crees otra cuenta. El registro y las invitaciones al equipo son pasos distintos.

## 2. Entra al espacio correcto

**Si vas a administrar el espacio:** confirma con el facilitador que tu espacio propio será el de tu organización para el piloto. En **Equipo**, dentro de **Crear una invitación**, escribe el correo de tu compañero y selecciona **Vendedor · Configura y emite propuestas**. Pulsa **Crear enlace de invitación**, usa **Copiar enlace** y compártelo directamente con esa persona por el canal acordado. La aplicación no envía un correo automático de invitación; el enlace caduca a los siete días. Compártelo sólo con su destinatario.

**Si recibiste una invitación:** abre el enlace, inicia sesión o usa **Crear una cuenta** y verifica exactamente el correo al que fue dirigida. Revisa el correo y rol que muestra la invitación y pulsa **Aceptar invitación**. Si está caducada o fue dirigida a otro correo, pide al administrador una nueva; no uses la cuenta de otra persona.

Tu espacio propio se conserva al aceptar. Las cuatro altas generan cuatro espacios propios, pero el piloto utiliza sólo los dos designados por el facilitador: **ORG-A** y **ORG-B**, correspondientes a los administradores. El vendedor usa el espacio al que fue invitado; su espacio personal queda fuera de las actividades de la cohorte. Si tienes más de uno, revisa el selector **Espacio activo** de la navegación antes de publicar o cotizar. La aceptación selecciona el espacio invitado; comprueba que coincide con el acordado. Cambiar de espacio abre una nueva cotización y limpia el borrador visible.

| Rol | Lo que puedes hacer en el piloto |
| --- | --- |
| Administrador | Publicar catálogos, cotizar, gestionar Equipo y consultar Piloto. |
| Vendedor | Consultar catálogos, revisar y guardar propuestas y registrar correcciones detectadas. |
| Lector | Consultar catálogos y propuestas. No puede emitir ni registrar correcciones. |

No cambies roles ni retires compañeros durante una tarea medida. Esas comprobaciones se realizan en el momento coordinado por el facilitador.

## 3. Prepara el catálogo con el administrador

Este paso corresponde al administrador, acompañado por el facilitador. La publicación actual usa un documento JSON; no hay un asistente para importar hojas de cálculo.

1. Abre **Catálogos**. El facilitador te entregará el documento revisado para tu organización y las condiciones autorizadas de las tareas. Durante los ejercicios medidos conserva en privado el resultado de referencia hasta terminar ambos métodos; los ejemplos resueltos se usan sólo en la práctica.
2. Pega ese documento en **Documento del catálogo (JSON)**. Revisa nombre, versión, moneda, vigencia y los productos previstos antes de pulsar **Publicar nueva versión**. El documento expresa los importes en unidades menores; pide ayuda al facilitador para modificarlo.
3. Comprueba que aparecen el catálogo, la versión y los precios acordados. Una versión publicada conserva su contenido; para cambiarla se publica otra versión.
4. Si se acordó practicar con datos de ejemplo, **Cargar ejemplo sintético** prepara un documento de ejemplo de la aplicación. Para los ejercicios del protocolo, el facilitador entrega el [catálogo de práctica](catalogo-practica.json), que se pega en el mismo campo JSON. Revisa qué documento, catálogo y versión se van a publicar antes de guardarlos: ambos ejemplos pueden tener diferencias y no deben mezclarse. La práctica no sustituye al catálogo autorizado de las tareas medidas.

Si ya existe el catálogo, usa **Preparar siguiente versión →** cuando el caso lo indique. Mantén el mismo identificador de catálogo y revisa con el facilitador la nueva versión antes de publicarla. No crees otro catálogo sólo para cambiar un precio.

## 4. Practica una cotización

La primera práctica sirve para aprender y se registra aparte de las tareas medidas.

1. Abre **Cotizar** y confirma el **Espacio activo**.
2. Elige **Catálogo publicado**, producto, cantidad entera y opciones del caso de práctica.
3. Pulsa **Revisar desglose**. Comprueba productos, cantidades, opciones, reglas, moneda y total frente al resultado esperado que te entregaron.
4. Si quieres ajustar la configuración, cambia la cantidad u opciones y vuelve a revisar. Un desglose todavía no es una propuesta guardada.
5. Cuando coincida con el caso, pulsa **Confirmar y guardar propuesta**.
6. Espera **Propuesta guardada** y pulsa **Abrir propuesta**. Guarda su referencia y enlace en la hoja privada del piloto; no hay que publicarlos en el repositorio.

Si aparece un error, conserva la pantalla y comunícalo antes de recargar. Cuando el contenido siga siendo el mismo, reintentar desde el mismo flujo conserva la referencia de la solicitud. Cambiar la configuración o iniciar otra cotización puede crear una propuesta nueva; no lo uses como sustituto de comprobar si la primera se guardó.

Si la sesión termina, vuelve a iniciar sesión. No des por guardado un borrador hasta ver la confirmación y poder abrir la propuesta.

## 5. Haz tus tareas medidas

Cada persona realizará cinco tareas comparables usando su proceso habitual y CotiTrama: veinte pares previstos entre las cuatro personas. El facilitador repartirá los casos entre dos sesiones y te indicará el orden de cada método. Sigue ese orden para reducir el efecto de hacer siempre primero la misma herramienta. No elijas una tarea más sencilla para un método.

En cada tarea usa exactamente los productos, cantidades, opciones, catálogo y versión acordados. El primer intento se realiza sin ayuda y dura hasta diez minutos por método. El facilitador registra el tiempo completo, las interrupciones y si el resultado coincide con el esperado. Si necesitas ayuda, pídela: se cierra el intento autónomo y la ayuda posterior se registra por separado, sin presentarla como una tarea completada sin acompañamiento. Al llegar a diez minutos o ante un fallo que impida continuar, detén el intento y registra el motivo; no inventes un resultado ni un tiempo cero.

La incorporación cubre acceso y práctica. Después hay dos sesiones de hasta una hora: en la primera haces las cinco solicitudes con el primer método asignado y en la segunda las repites con el otro. Los ejercicios de versión nueva, propuestas anteriores y configuraciones inválidas se realizan después de terminar los cronometrajes, para conservar las mismas condiciones de comparación. El detalle de cada actividad y su comprobación está en los [casos de prueba](casos-de-prueba.md).

## 6. Reabre una propuesta después de actualizar precios

El administrador publicará la siguiente versión del mismo catálogo cuando el caso lo indique. Abre el enlace de una propuesta guardada antes del cambio: debe conservar su versión, moneda, opciones, reglas e importes originales. Al iniciar una cotización nueva, el catálogo actualizado se usa para el nuevo cálculo.

Si ves que la propuesta anterior cambió, detén ese caso y avisa al facilitador. No intentes compensar el importe con otro cambio del catálogo.

## 7. Declara una corrección detectada

Desde una propuesta guardada, vendedores y administradores pueden usar **Registrar corrección detectada**:

1. Selecciona **Motivo de la corrección**: Cantidades, Opciones, Catálogo o versión, Reglas o importes u Otro motivo.
2. Pulsa **Registrar corrección** y espera la confirmación.
3. Si falla la respuesta, **Reintentar registro** conserva el motivo y la referencia. No uses **Registrar otra corrección** para repetir el mismo incidente ya confirmado; ese botón inicia un registro adicional.

Este registro no edita la propuesta, no cambia sus importes y no demuestra que el problema esté resuelto. Tampoco consume otra propuesta del plan. Si hace falta corregir el precio o la configuración comercial, coordina una nueva propuesta con el facilitador; la anterior se conserva y ambas referencias se relacionan en el registro privado del piloto. El formulario no admite notas libres; los detalles del caso se comunican por el canal acordado.

Las correcciones solicitadas como ejercicio se anotan como ejercicios. Si detectas un problema inesperado, indícalo al facilitador para distinguirlo de esas declaraciones preparadas.

## 8. Consulta Consumo y Piloto

En **Consumo** puedes comprobar el plan, los miembros, los catálogos activos y las propuestas emitidas del mes. Esencial permite dos miembros, dos catálogos activos y cien propuestas mensuales. Los límites operativos están activos aunque el piloto sea sin cargos. Revisar un desglose o reabrir una propuesta no consume otra emisión; guardar una propuesta nueva sí. Los avisos aparecen desde el 80% del cupo. Si se agota, consulta al administrador en lugar de crear otra cuenta para continuar la misma tarea.

Los administradores pueden abrir **Piloto** y elegir 7, 30 o 90 días. El tiempo que muestra es una estimación de actividad del navegador: sólo acumula tiempo con la página visible y con foco, hasta sesenta segundos desde la última interacción. Puede ser cero y no sustituye al tiempo completo que registra el facilitador. **Sin medición** significa que no hay muestra para esa propuesta; no equivale a cero minutos.

El panel distingue los cambios entre revisiones exitosas de las correcciones declaradas después de guardar. Las declaraciones se cuentan por la fecha del registro y pueden referirse a una propuesta anterior. La fotografía actual de miembros, catálogos y consumo mensual es el estado actual del espacio, no su promedio histórico.

El panel no separa automáticamente práctica, tareas comparables y ejercicios opcionales. El facilitador clasifica cada actividad y su referencia de propuesta en el registro privado. Por eso, para comparar tiempos humanos se usan las observaciones de los veinte pares previstos, no la media global del panel que también puede incluir práctica y ejercicios.

## Si algo no funciona

Envía al facilitador por el canal privado acordado: tu código de participante, caso, hora y zona horaria, pantalla, pasos, resultado esperado y mensaje observado. Añade la referencia de propuesta cuando sea necesaria. Si incluyes una captura, oculta correos, información comercial ajena al caso y enlaces de invitación. Nunca adjuntes contraseñas, códigos de confirmación, tokens de sesión ni la URL de retorno del inicio de sesión.

Si ves datos de otra organización, un cambio inesperado en una propuesta guardada o un importe distinto del esperado, detén esa actividad y comunica el caso. Si sólo necesitas ayuda con el JSON, el rol o el espacio, pide acompañamiento antes de modificar datos.

## Al terminar

- Confirma con el facilitador qué tareas completaste, cuáles necesitaron ayuda y cuáles quedaron sin terminar.
- Explica qué parte usarías de nuevo, cuál te hizo dudar y qué cambió respecto a tu proceso habitual. No hace falta dar una opinión favorable para terminar el piloto.
- Cierra sesión, especialmente en un equipo compartido. Si decides dejar el piloto, comunícalo al facilitador para coordinar el acceso y el tratamiento de tus datos; no se promete una eliminación automática desde la pantalla.

La evaluación no activa cobros ni una suscripción. PDF, CRM, SSO e integraciones no forman parte del flujo actual. Los precios comerciales siguen propuestos; el objetivo de estas sesiones es obtener evidencia para decidir qué mejorar antes de avanzar.
