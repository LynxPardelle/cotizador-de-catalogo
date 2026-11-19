# CotiTrama

Cotizaciones que conservan sus reglas. Publica catálogos versionados, configura productos y emite propuestas con un desglose reproducible, incluso después de actualizar precios.

- [Producto](docs/PRODUCTO.md)
- [Arquitectura de microservicios](docs/architecture/ARCHITECTURE.md)
- [Decisión de producto y hosting](docs/architecture/002-cotitrama-producto.md)
- [Plan y pendientes](plan/feature-primera-version-1.md)
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

Angular SSR se sirve desde una Lambda detrás de CloudFront/OAC. Catálogos y Cotizaciones son servicios Lambda separados, con contratos y tablas DynamoDB propias; Cognito y API Gateway protegen las operaciones por organización y rol.

| Ambiente | Rama de promoción | Dirección prevista |
| --- | --- | --- |
| development | development | https://cotitrama-dev.lynxpardelle.com |
| testing | testing | https://cotitrama-test.lynxpardelle.com |
| production | main | https://cotitrama.lynxpardelle.com |

Estas direcciones se describen en infraestructura; su configuración no significa que el producto ya esté desplegado. La carpeta y el remoto histórico `cotizador-de-catalogo` se conservan para mantener los accesos remotos.
