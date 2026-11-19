# CotiTrama

Cotizaciones que conservan sus reglas. Publica catálogos versionados, configura productos y emite propuestas con un desglose reproducible, incluso después de actualizar precios.

- [Producto](docs/PRODUCTO.md)
- [Arquitectura de microservicios](docs/architecture/ARCHITECTURE.md)
- [Decisión de producto y hosting](docs/architecture/002-cotitrama-producto.md)
- [Plan y pendientes](plan/feature-primera-version-1.md)
- [Planes propuestos y costos](docs/planes-suscripcion.md)
- [Métricas del piloto y sus definiciones](docs/architecture/004-metricas-del-piloto.md)
- [Protocolo del piloto con usuarios](docs/piloto/protocolo.md)
- [Guía para primeros usuarios](docs/piloto/guia-primeros-usuarios.md)
- [Operación y despliegue](docs/operacion.md)
- [Promoción development → testing → main](docs/promocion.md)

## Ejecutar en local

Node.js 24 (desde 24.15) y npm. Instala las dependencias en sus dos paquetes:

```powershell
npm --prefix services ci
npm --prefix web ci
npm run build
npm run demo
```

Abre http://127.0.0.1:4200. La demostración usa únicamente un catálogo sintético y almacenamiento en memoria. Se reinicia al cerrar el proceso; no es persistencia de producción. Permite publicar revisiones, previsualizar, emitir y reabrir propuestas. El servidor queda ligado a loopback.

El panel `/piloto` permite revisar las emisiones y las mediciones de esa sesión local. Sus filtros de 7, 30 y 90 días usan días calendario UTC; el servidor de demostración conserva esos parámetros y rechaza períodos duplicados.

Para trabajar sólo el frontend, `npm --prefix web start`; para probar el flujo completo usa la demostración anterior.

## Verificar

```powershell
npm test
npm run test:web
npm run build
npm run smoke:ssr
npm run test:package
npm run pilot
cfn-lint infra/template.yaml
```

`build` compila Angular SSR y empaqueta la función en `web/dist/lambda`. SAM requiere ese resultado y los paquetes de `services/`. El smoke invoca el adaptador Lambda real con eventos HTTP v2; no accede a AWS. El piloto sintético mide el motor local y verifica conservación de propuestas; no acredita tiempos de usuarios reales.

## Nube

Angular SSR se sirve desde una Lambda detrás de CloudFront/OAC. Catálogos y Cotizaciones son servicios Lambda separados, con contratos y tablas DynamoDB propias. El incremento de Equipo añade una tercera tabla del dominio de identidad: los servicios consultan por IAM las pertenencias y roles actuales. Cognito y API Gateway verifican la identidad; los grupos antiguos del token no conceden permisos. El cliente puede seleccionar un espacio con `X-Organization-Id` únicamente si el servidor valida acceso.

| Ambiente | Rama de promoción | Dirección prevista |
| --- | --- | --- |
| development | development | https://cotitrama-dev.lynxpardelle.com |
| testing | testing | https://cotitrama-test.lynxpardelle.com |
| production | main | https://cotitrama.lynxpardelle.com |

Development está desplegado y verificado en https://cotitrama-dev.lynxpardelle.com. Testing y producción siguen como destinos previstos, sin promoción. La raíz pública presenta el producto y abre el registro verificado de Cognito. [Evidencia AWS](docs/verificacion.md). La carpeta y el remoto histórico `cotizador-de-catalogo` se conservan para mantener los accesos remotos.

La recepción y confirmación del registro se comprobaron con dos correos reales en development. El núcleo de Equipo está desplegado y verificado con servicios AWS y navegador autenticado: gestión de miembros, invitaciones manuales, aceptación al correo correcto, cambio entre espacios, aislamiento y retirada de permisos. Las invitaciones caducan a los siete días, persisten sólo el hash del token y no envían correo automáticamente. Las transacciones protegen al último administrador incluso con cambios concurrentes; la migración inicial no restaura pertenencias retiradas. Las revisiones y comprobaciones de cada entrega se registran en [Verificación](docs/verificacion.md).

## Planes en preparación

Esencial **$399 MXN/mes** propone 2 miembros, 2 catálogos activos y 100 propuestas mensuales; Equipo **$1,199** propone 8/10/1,000; Empresa **$3,499** propone 25/50/5,000. Los precios siguen en validación antes de impuestos y las capacidades operativas se aplican en backend, con fuente compartida en `services/shared/plans.json`. `/consumo` y la navegación avisan desde el 80% y al agotarse. Archivar catálogos o retirar miembros libera cupo sin borrar propuestas ni cuentas. Los espacios nuevos usan Esencial; el operador asigna Equipo/Empresa en el piloto sin cobros ni contratación. Stripe sigue pendiente. [Diseño de límites](docs/architecture/003-limites-y-consumo.md).

## Medición del piloto

La instrumentación está desplegada y **verificada en development con AWS y navegador autenticado mediante JWT real**. La aceptación usa fixtures sintéticos y actividad automatizada; no constituye una medición con personas. [Evidencia de la entrega](docs/verificacion.md). `/piloto` está reservado a administradores y muestra únicamente el espacio autorizado. Incluye emisiones por día, cobertura de cuentas emisoras, media/mediana de tiempo activo estimado por el navegador, tamaño de muestra, mediciones ausentes, ajustes de configuración y correcciones declaradas. El uso actual de miembros, catálogos y cuota mensual se consulta por separado; no es un promedio del período.

Las propuestas históricas sin medición siguen contando en las emisiones. Una muestra ausente no se convierte en cero minutos ni en un emisor identificado. Las correcciones se declaran por categoría, no modifican la propuesta ni acreditan que se haya resuelto un error de precio; tampoco consumen otra propuesta del plan. Los reintentos conservan el primer snapshot y su medición, sin añadir muestras o cuota.

La consulta usa un presupuesto compartido de 100 páginas, 30,000 registros y seis segundos entre lecturas. Si se supera, devuelve `503 METRICS_LIMIT` sin un resultado parcial; este diseño no garantiza consultar 90 días de cualquier historial de Empresa. Las [definiciones y límites](docs/architecture/004-metricas-del-piloto.md) distinguen fixtures sintéticos, instrumentación y resultados con personas. El piloto humano autorizado de TASK-006 y Stripe siguen pendientes.

## Preparar el piloto con personas

El [paquete del piloto](docs/piloto/protocolo.md) propone dos organizaciones y cuatro personas, catorce días desde que accesos y catálogos estén listos, y veinte pares de tareas frente al proceso habitual. Incluye [catorce casos funcionales](docs/piloto/casos-de-prueba.md), una [guía de incorporación](docs/piloto/guia-primeros-usuarios.md), un catálogo ficticio completo y [plantillas vacías de sesiones, incidencias, cierre y retroalimentación](docs/piloto/plantillas/README.md). La preparación está completa; no se han convocado ni medido participantes de esta cohorte.

Los criterios distinguen integridad/aislamiento, coincidencia con referencias independientes, autonomía, cobertura, tiempos comparables y utilidad. La meta del 20% de mejora es exploratoria. La comparación usa tiempo de pared observado con el mismo inicio/final en ambos métodos; la media de actividad del panel mezcla práctica y otras emisiones, y no representa los veinte pares. Los registros completados se conservan fuera de Git. Stripe sigue pendiente, sin contratación ni cobros.
