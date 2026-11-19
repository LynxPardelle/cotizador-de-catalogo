# Verificación AWS de CotiTrama en development

## Límites y consumo por plan

El helper `tools/quota-smoke.mjs` usa únicamente development, exige UPDATE_COMPLETE y prepara tres cuentas `ct-quota-…@example.invalid`, con correos suprimidos y credenciales privadas ignoradas por Git. No reutiliza organizaciones de personas ni tablas de otros productos.

```powershell
node --use-system-ca tools/quota-smoke.mjs --prepare
npm run smoke:quotas:development
node --use-system-ca tools/quota-smoke.mjs --browser
node --use-system-ca tools/quota-smoke.mjs --browser-limit
npm run cleanup:quotas:development
```

`--verify` emite 100 propuestas reales de Esencial y comprueba avisos al 80%/100%, rechazo de la siguiente, replay sin otro consumo, conflicto de contenido, lectura y preview al límite. Verifica IDs de catálogo frente a revisiones, archivado/reactivación y la última plaza de miembros concurrente. Para Equipo y Empresa prepara contadores sintéticos justo antes de los bordes y ejecuta transacciones reales contra esos bordes: no acredita 1,000 o 5,000 emisiones ni una prueba de carga sostenida. Esas preparaciones sólo admiten campos de contador de las organizaciones QA registradas, se anotan antes en un journal privado y se restauran en finally al recuento real de datos. Una reducción vuelve a Esencial y conserva propuestas y lecturas mientras informa exceso y bloquea crecimiento.

`--browser` deja una cuenta QA con un catálogo, un miembro y 80 propuestas realmente emitidas, sin preparar contadores, para comprobar `/consumo` con Cognito/PKCE/JWT. `--browser-limit` completa la misma cuenta a 100 para probar el rechazo de una emisión nueva en la interfaz y conservar el aviso al recargar. Las invocaciones IAM del script se distinguen de esta aceptación por navegador.

El informe `artifacts/quota-smoke.json` conserva cada modo en runs y declara las preparaciones de borde. Las contraseñas y enlaces sólo se guardan en `artifacts/quota-qa-private.json`; no imprimir ni publicar ese archivo. Al cerrar la aceptación, cleanup verifica pool, sub, email y organización derivados, elimina las tres cuentas y sus grupos vacíos y borra el archivo privado. Conserva los registros sintéticos de DynamoDB. Si verify falla, recuperar cualquier journal pendiente, limpiar y preparar un run nuevo antes de repetir: el modo verify no finge reanudar una secuencia parcialmente completada.

## Flujo comercial y Equipo

`node --use-system-ca tools/aws-smoke.mjs --verify` prepara dos cuentas QA sintéticas y comprueba el flujo contra los recursos ya desplegados. Requiere AWS CLI, dependencias de `services/` y acceso IAM autorizado. El script acepta únicamente el stack `cotitrama-development`, región `us-east-1`, cuenta del certificado de `infra/environments.json` y origen `https://cotitrama-dev.lynxpardelle.com`.

Modos:

- `--prepare`: crea las dos cuentas sintéticas con `AdminCreateUser`, `MessageAction: SUPPRESS` y contraseña permanente aleatoria; invoca onboarding dos veces y verifica organizaciones distintas con un solo grupo por usuario.
- `--verify` o sin argumentos: prepara las cuentas y verifica publicación, cálculo exacto, ocho reintentos concurrentes, conflicto de idempotencia, snapshot después de v2, aislamiento, invitaciones ligadas al correo verificado, aceptación repetida, segundo espacio, cambios reales de rol, retirada inmediata y carrera por el último administrador. También verifica endpoints públicos y bloqueo de la Function URL anónima.
- `--cleanup`: elimina exclusivamente las dos cuentas registradas y sus grupos vacíos, después de cotejar pool, namespace de email, sub y grupo determinista. Borra el archivo privado al completar. Conserva los registros sintéticos de DynamoDB como evidencia.

Las credenciales se escriben únicamente en `artifacts/aws-qa-private.json`, dentro de una carpeta ignorada por Git. No se imprimen contraseñas ni tokens. El reporte `artifacts/aws-smoke.json` contiene sólo identificadores, resultados y las limitaciones de la comprobación. Las cuentas usan direcciones `@example.invalid`; no se envían emails.

La comprobación de negocio invoca las Lambdas por IAM usando eventos HTTP API v2. Los roles se cambian mediante la API de Equipo y se leen de su tabla autoritativa. Los casos de rechazo conservan deliberadamente claims obsoletos de administrador para comprobar que no sustituyen los permisos vigentes. **No prueba la verificación de un JWT en API Gateway.** Esa aceptación se completa por separado iniciando sesión en Hosted UI desde el navegador y usando los flujos publicados.

Los tokens de invitación se guardan únicamente en el archivo privado. Al terminar se deja una invitación pendiente para el segundo usuario QA en `browserInvitation.url`, de modo que la aceptación pueda comprobarse desde el navegador. Ese enlace no se incluye en el reporte público. La caducidad de siete días se cubre en las pruebas locales; el smoke no modifica el reloj ni los registros de expiración de AWS.

Las cuentas administrativas de QA ya tienen el email marcado como verificado; esto permite probar el trigger por invocación IAM sin enviar mensajes. No se cambia la verificación obligatoria de email del registro público. No se auto-confirma ningún alta real.

Si una comprobación falla, el archivo privado se conserva para continuar la prueba en navegador o ejecutar cleanup. No compartas ni agregues ese archivo al repositorio. Ejecuta cleanup al terminar la aceptación del navegador.

En Windows se usa `--use-system-ca` para validar TLS con las autoridades de confianza del sistema, también cuando hay inspección HTTPS local. No se desactiva la validación de certificados. Los scripts npm `smoke:aws:development` y `cleanup:aws:development` incluyen esa opción.

## Correo real de registro

`tools/registration-smoke.mjs` comprueba por separado el alta pública sin confirmación administrativa. Está restringido al stack, cuenta y origen de desarrollo, y a un alias QA de Gmail con la marca `+cotitrama-qa-`. Utilizar únicamente un buzón autorizado para esta prueba.

1. Ejecutar `node --use-system-ca tools/registration-smoke.mjs --start <alias-QA-autorizado>`. El helper genera una contraseña privada y exige el estado UNCONFIRMED.
2. Leer el correo recibido para ese alias y guardar temporalmente su código como objeto JSON con clave `code` en `artifacts/registration-code-private.json`, sin imprimirlo ni incorporarlo a Git.
3. Ejecutar `node --use-system-ca tools/registration-smoke.mjs --confirm`. Usa ConfirmSignUp real, elimina el código consumido y verifica CONFIRMED, email_verified, grupo propio y membresía administradora en DynamoDB con lectura consistente.
4. Completar la comprobación de navegador necesaria y ejecutar `node --use-system-ca tools/registration-smoke.mjs --cleanup`. Elimina únicamente la cuenta registrada, su grupo vacío y el archivo privado; conserva el reporte sin contraseñas ni códigos.

El resultado sin secretos se guarda en `artifacts/registration-verified.json`. No se sustituye la recepción del mensaje por AdminConfirmSignUp ni por marcar manualmente email_verified. La prueba requiere acceso actual al buzón y una entrega efectiva de Cognito; un resultado local de onboarding no acredita esa entrega.
