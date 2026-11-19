# Verificación AWS de CotiTrama en development

`node --use-system-ca tools/aws-smoke.mjs --verify` prepara dos cuentas QA sintéticas y comprueba el flujo contra los recursos ya desplegados. Requiere AWS CLI, dependencias de `services/` y acceso IAM autorizado. El script acepta únicamente el stack `cotitrama-development`, región `us-east-1`, cuenta del certificado de `infra/environments.json` y origen `https://cotitrama-dev.lynxpardelle.com`.

Modos:

- `--prepare`: crea las dos cuentas sintéticas con `AdminCreateUser`, `MessageAction: SUPPRESS` y contraseña permanente aleatoria; invoca onboarding dos veces y verifica organizaciones distintas con un solo grupo por usuario.
- `--verify` o sin argumentos: prepara las cuentas y verifica publicación, cálculo exacto, ocho reintentos concurrentes, conflicto de idempotencia, snapshot después de v2, aislamiento por organización, permisos por rol, endpoints públicos y bloqueo de la Function URL anónima.
- `--cleanup`: elimina exclusivamente las dos cuentas registradas y sus grupos vacíos, después de cotejar pool, namespace de email, sub y grupo determinista. Borra el archivo privado al completar. Conserva los registros sintéticos de DynamoDB como evidencia.

Las credenciales se escriben únicamente en `artifacts/aws-qa-private.json`, dentro de una carpeta ignorada por Git. No se imprimen contraseñas ni tokens. El reporte `artifacts/aws-smoke.json` contiene sólo identificadores, resultados y las limitaciones de la comprobación. Las cuentas usan direcciones `@example.invalid`; no se envían emails.

La comprobación de negocio invoca las Lambdas por IAM usando eventos HTTP API v2 y grupos obtenidos de Cognito. Los casos reader y seller usan variantes explícitas del contexto de claims para verificar el contrato de autorización. **No prueba la verificación de un JWT en API Gateway.** Esa aceptación se completa por separado iniciando sesión en Hosted UI desde el navegador y usando los flujos publicados.

Las cuentas administrativas de QA ya tienen el email marcado como verificado; esto permite probar el trigger por invocación IAM sin enviar mensajes. No se cambia la verificación obligatoria de email del registro público. No se auto-confirma ningún alta real.

Si una comprobación falla, el archivo privado se conserva para continuar la prueba en navegador o ejecutar cleanup. No compartas ni agregues ese archivo al repositorio. Ejecuta cleanup al terminar la aceptación del navegador.

En Windows se usa `--use-system-ca` para validar TLS con las autoridades de confianza del sistema, también cuando hay inspección HTTPS local. No se desactiva la validación de certificados. Los scripts npm `smoke:aws:development` y `cleanup:aws:development` incluyen esa opción.
