# Interfaz Angular de Cotizador de Catálogo

Desde esta carpeta usa npm ci para instalar, npm start para arrancar el servidor local, npm run build para compilar y npm test -- --watch=false para verificar la ruta inicial.

La ruta inicial carga un workspace standalone de forma diferida. Su estado vive en un NgRx SignalStore con alcance de ruta. El [diseño de producto](../docs/PRODUCTO.md) describe los siguientes flujos.

## Dependencias de desarrollo

La auditoría del 17 de noviembre de 2026 encontró avisos transitivos del toolchain de compilación y pruebas por picomatch 4.0.7. La auditoría de dependencias de producción no reportó avisos. Actualizar el lock cuando se publique una versión compatible corregida y repetir build, pruebas y ambas auditorías. [Aviso publicado](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)
