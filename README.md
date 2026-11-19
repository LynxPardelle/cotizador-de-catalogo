# CotiTrama

Cotizaciones que conservan sus reglas. Publica catálogos versionados, configura productos y emite propuestas con un desglose reproducible, incluso después de actualizar precios.

- [Producto](docs/PRODUCTO.md)
- [Arquitectura de microservicios](docs/architecture/ARCHITECTURE.md)
- [Decisión de producto y hosting](docs/architecture/002-cotitrama-producto.md)
- [Plan y pendientes](plan/feature-primera-version-1.md)
- [Planes propuestos y costos](docs/planes-suscripcion.md)
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

La recepción y confirmación del correo real de registro ya se comprobaron en development. La nueva gestión visual de miembros, invitaciones manuales de siete días y selector entre organizaciones están implementados en el incremento de Equipo; su despliegue y aceptación AWS siguen pendientes. Las invitaciones requieren el correo verificado destinatario, persisten sólo el hash del token y no envían correo automáticamente. Las transacciones protegen al último administrador y la migración inicial no restaura pertenencias retiradas.

## Planes en preparación

Esencial **$399 MXN/mes** propone 2 miembros, 2 catálogos activos y 100 propuestas mensuales; Equipo **$1,199** propone 8/10/1,000; Empresa **$3,499** propone 25/50/5,000. Son importes antes de impuestos y límites por validar, con fuente compartida en `config/plans.json`. El piloto continúa sin cargos: crear una cuenta no contrata una suscripción. No se activaron cuotas de pago y Stripe sigue pendiente.
