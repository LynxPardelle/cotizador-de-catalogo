# Verificación AWS de CotiTrama en development

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
