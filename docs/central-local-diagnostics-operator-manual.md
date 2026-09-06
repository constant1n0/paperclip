# Informe y manual de operación — CENTRAL Local Diagnostics

Este documento entrega el estado y la operación segura de `paperclipai-local-diagnostics`. Es una herramienta manual y aislada de **provenance de compilación y compatibilidad del runtime del propio diagnóstico**; no administra ni observa CENTRAL.

## Camino rápido

1. Confirma que recibiste un artefacto ya instalado o una distribución autorizada que incluya el ejecutable.
2. Ejecuta solo uno de los comandos siguientes; no añadas argumentos posicionales ni otros flags.
3. Conserva stdout y el código de salida como evidencia. Un resultado nunca autoriza una acción sobre CENTRAL.

```bash
paperclipai-local-diagnostics
paperclipai-local-diagnostics --json
paperclipai-local-diagnostics --text
```

Captura segura para adjuntar a un caso:

```bash
paperclipai-local-diagnostics --json > central-local-diagnostics.json
code=$?
printf 'exit_code=%s\n' "$code"
```

`paperclipai-local-diagnostics` existe cuando el paquete `paperclipai` que contiene ese bin está instalado o cuando una distribución ya construida expone su bin. Este cambio **no publicó** un paquete npm ni creó una etiqueta de release; no supongas que el nombre está disponible mediante npm.

## Control documental

| Campo | Valor |
|---|---|
| Versión del manual | 1.0.0 |
| Fecha | 2026-09-06 |
| Fuente Git verificada | `fork/master` `f2c8a5aba3c0339888ede2525050e941980d1970` |
| Árbol Git verificado | `f8ec620c785db46bc2768a5d9aa4a3abd42e980c` |
| Estado del cambio | Integrado, verificado y archivado en Engram (`central-local-diagnostics`) |
| Estado de release | Preparado para distribución pública por configuración; **sin tag ni publicación npm realizada** |
| Audiencia | Operador humano autorizado, agente autorizado, mantenedor de Paperclip, propietario/autoridad de release |
| Propietario operativo actual | **UNASSIGNED / POR ASIGNAR** |

La fuente canónica de esta guía es este archivo del repositorio. La copia de Engram es índice y espejo de transferencia.

## Informe ejecutivo de situación

Se entregó un ejecutable independiente, `paperclipai-local-diagnostics`, con una salida canónica v1 que comunica:

- provenance embebido del paquete (`version` y `buildCommit`);
- compatibilidad del runtime Node del proceso de diagnóstico;
- checks, límites de alcance y garantías negativas declaradas.

El valor operativo es poder registrar esa evidencia sin iniciar la CLI normal ni el servidor, y sin consultar configuración, estado o salud de CENTRAL. El cambio está integrado y archivado; no hay daemon, planificador ni agente asignado. La ejecución es siempre manual y requiere autorización explícita para un agente futuro.

## Propósito y anti-propósito

| El ejecutable informa | El ejecutable no informa ni realiza |
|---|---|
| Versión y commit de compilación embebidos | Salud, liveness o readiness de CENTRAL |
| Compatibilidad del runtime Node del diagnóstico | Configuración, entorno, archivos, logs o estado de CENTRAL |
| Resultado v1 determinista del proceso aislado | Inicio, activación, reparación, recuperación o cambios |
| Checks y garantías negativas del proceso | Red, base de datos, almacenamiento, proveedor, plugin, worker, scheduler o servidor |

**Prohibición de interpretación:** un `ok` no demuestra que CENTRAL esté instalado, configurado, vivo, listo, accesible ni recuperable. Un resultado no autoriza acciones correctivas.

## Responsabilidad y modelo de asignación

| Actividad | Responsable | Aprobador | Consultado | Informado |
|---|---|---|---|---|
| Ejecutar y preservar evidencia | Operador humano o agente autorizado — **POR ASIGNAR** | Autoridad del sistema — **POR ASIGNAR** | Mantenedor Paperclip — **POR ASIGNAR** | Dueño de escalación — **POR ASIGNAR** |
| Interpretar el contrato técnico | Mantenedor Paperclip — **POR ASIGNAR** | Autoridad del sistema — **POR ASIGNAR** | Operador | Dueño de escalación |
| Aprobar distribución, publicación o release | Autoridad de release — **POR ASIGNAR** | Propietario del sistema — **POR ASIGNAR** | Mantenedor Paperclip | Operador |
| Resolver una anomalía o decidir acciones sobre CENTRAL | Dueño de escalación — **POR ASIGNAR** | Propietario del sistema — **POR ASIGNAR** | Mantenedor Paperclip | Operador |

No se asigna esta responsabilidad a Teseo, Atenea ni a una persona concreta sin una decisión de gobernanza.

## Arquitectura y flujo

```mermaid
flowchart LR
  O[Operador autorizado] --> E[Ejecutable independiente\npaperclipai-local-diagnostics]
  E --> R[Resultado canónico v1]
  R --> J[JSON por defecto o --json]
  R --> T[Texto solo si status=ok y --text]
```

**Alternativa textual:** un operador invoca un único ejecutable independiente. Este crea un resultado canónico v1 y lo renderiza como JSON por defecto o como texto únicamente en éxito con `--text`. El flujo no incluye servidor, base de datos, red, configuración, archivos de CENTRAL, procesos auxiliares ni activación.

## Disponibilidad e instalación: relevo al asignado

Que el código fuente esté integrado no significa que un binario distribuible esté disponible. `cli/package.json` declara el bin `paperclipai-local-diagnostics` y `publishConfig.access: public`, pero esta entrega no ejecutó publicación npm ni release.

### Requisitos comprobados

| Requisito | Hecho comprobado | Implicación |
|---|---|---|
| Política de paquete | `engines.node: >=20` | El ejecutable considera compatible un major Node `>=20`. |
| Metadatos embebidos | SemVer válido y SHA hexadecimal de 40 caracteres | Si faltan o son inválidos, termina con error 3. |
| Artefacto | Bin declarado hacia `dist/local-diagnostics.js` | El operador necesita un paquete instalado o un artefacto construido y autorizado. |
| Distribución | No publicada por este cambio | El asignado debe recibir prueba concreta de release/artefacto e instrucciones aprobadas de instalación. |

Antes de entregar la operación, la autoridad de release debe proporcionar: identificador y origen del artefacto, versión, commit de build de 40 caracteres, checksum del artefacto si existe, método autorizado de instalación y contacto de escalación. Si falta cualquiera, marca la disponibilidad como **[POR VERIFICAR]**; no intentes instalar, publicar ni construir por iniciativa propia.

### Ruta de build para mantenimiento (no es el camino del operador)

El único escritor de `cli/dist` es `cli/build.mjs`. El código permite al mantenedor autorizado construir desde el repositorio con provenance explícito:

```bash
PC_BUILD_COMMIT=SHA_GIT_DE_40_CARACTERES node cli/build.mjs
```

El valor debe ser hexadecimal minúsculo de 40 caracteres para la ruta de empaquetado validada. Esta orden no es una instrucción de publicación ni una garantía de que el entorno tenga sus dependencias preparadas. La publicación permanece en un flujo de release separado y autorizado.

## Contrato de invocación

| Forma | Aceptada | Salida esperada |
|---|---|---|
| Sin argumentos | Sí; equivale a JSON | Un resultado JSON |
| `--json` | Sí | Un resultado JSON |
| `--text` | Sí, solo para `ok` | Proyección textual del resultado |
| Argumento posicional | No | JSON de `invalid_arguments`, salida 2 |
| Flag desconocido, repetido o combinado | No | JSON de `invalid_arguments`, salida 2 |

No uses `--help`: no forma parte del contrato del ejecutable. No uses opciones de la CLI normal de Paperclip; son otro producto y pueden tener capacidades que este ejecutable no tiene.

## Contrato de salida

### Reglas de transporte

- stdout contiene exactamente un resultado completo y no incluye logs, progreso ni mezcla de formatos.
- JSON es la forma canónica y termina en salto de línea. El campo interno `exitCode` **no** se serializa.
- Para los mismos metadatos embebidos y hechos de runtime, los bytes JSON y las líneas de texto son deterministas.
- Incluso si se pide `--text`, cualquier resultado distinto de `ok` permanece como JSON parseable.
- El contrato no expone excepciones, stacks, credenciales, variables de entorno, host, rutas, directorio de trabajo, PID, puertos ni marcas temporales.

### Esquema v1 y vocabulario cerrado

El orden de claves del JSON es estable. Los campos son `schemaVersion`, `command`, `status`, `scope`, `paperclip`, `runtime`, `checks`, `guarantees` y, opcionalmente, `error`.

| Campo | Significado y valores |
|---|---|
| `schemaVersion` | `v1` |
| `command` | `paperclipai-local-diagnostics` |
| `status` | `ok`, `incompatible` o `error` |
| `scope.assessed` | `diagnostic-runtime/build-compatibility` |
| `scope.centralHealth`, `centralLiveness`, `centralReadiness` | Siempre `not_assessed` |
| `paperclip` | `{version, buildCommit}` si el metadata es válido; de lo contrario `null` |
| `runtime` | `nodeVersion`, `platform`, `architecture` del proceso de diagnóstico |
| `checks` | Orden fijo: `build.metadata`, `runtime.node`; estado `pass`, `fail` o `error` |
| `guarantees` | 22 booleanos, en orden fijo; describe capacidades negativas del proceso, no el estado de CENTRAL |
| `error.code` | Solo `invalid_arguments`, `unsupported_runtime`, `invalid_build_metadata` o `internal_error` |

La lista de garantías contiene: `localOnly`, los cinco `central*`, `filesystemAccessed`, `environmentMutated`, `subprocessSpawned`, `networkAccessed`, `databaseOpened`, `storageOpened`, `telemetryInitialized`, `providersInitialized`, `pluginsLoaded`, `workersLoaded`, `schedulersLoaded`, `recoveryLoaded`, `serverStarted`, `persistentTimersInstalled`, `signalHandlersInstalled` y `repairsPerformed`. Salvo `localOnly=true`, la matriz actual las emite `false`.

### Códigos de salida

| Código | Resultado | Significado operativo |
|---:|---|---|
| 0 | `ok` | Metadata válido y major Node compatible; no concluye nada sobre CENTRAL. |
| 2 | `incompatible` o error de uso | Runtime no soportado o argumentos inválidos; no reparar automáticamente. |
| 3 | `error` | Metadata inválido o error interno; escalar con evidencia. |

### Ejemplos de fixture verificados

El siguiente JSON corresponde al fixture de pruebas: versión `7.8.9`, commit de ejemplo de 40 caracteres y runtime representado por el proceso de prueba. En una ejecución real cambian los metadatos y los tres hechos de runtime; la estructura y el orden no cambian.

```json
{"schemaVersion":"v1","command":"paperclipai-local-diagnostics","status":"ok","scope":{"assessed":"diagnostic-runtime/build-compatibility","centralHealth":"not_assessed","centralLiveness":"not_assessed","centralReadiness":"not_assessed"},"paperclip":{"version":"7.8.9","buildCommit":"0123456789abcdef0123456789abcdef01234567"},"runtime":{"nodeVersion":"v22.0.0","platform":"linux","architecture":"x64"},"checks":[{"id":"build.metadata","status":"pass","code":"valid"},{"id":"runtime.node","status":"pass","code":"supported"}],"guarantees":{"localOnly":true,"centralInspected":false,"centralContacted":false,"centralStarted":false,"centralRecovered":false,"centralValidated":false,"filesystemAccessed":false,"environmentMutated":false,"subprocessSpawned":false,"networkAccessed":false,"databaseOpened":false,"storageOpened":false,"telemetryInitialized":false,"providersInitialized":false,"pluginsLoaded":false,"workersLoaded":false,"schedulersLoaded":false,"recoveryLoaded":false,"serverStarted":false,"persistentTimersInstalled":false,"signalHandlersInstalled":false,"repairsPerformed":false}}
```

La proyección de texto del mismo fixture es:

```text
paperclipai-local-diagnostics
status: ok
scope: diagnostic-runtime/build-compatibility; CENTRAL health/liveness/readiness not assessed
paperclip: 7.8.9 0123456789abcdef0123456789abcdef01234567
runtime: v22.0.0 linux x64
checks: build.metadata=pass/valid, runtime.node=pass/supported
guarantees: localOnly=true, centralInspected=false, centralContacted=false, centralStarted=false, centralRecovered=false, centralValidated=false, filesystemAccessed=false, environmentMutated=false, subprocessSpawned=false, networkAccessed=false, databaseOpened=false, storageOpened=false, telemetryInitialized=false, providersInitialized=false, pluginsLoaded=false, workersLoaded=false, schedulersLoaded=false, recoveryLoaded=false, serverStarted=false, persistentTimersInstalled=false, signalHandlersInstalled=false, repairsPerformed=false
```

Ejemplo de incompatibilidad: `status` es `incompatible`, `runtime.node` es `fail/unsupported`, `error.code` es `unsupported_runtime`, stdout sigue siendo JSON y el proceso sale con 2.

## Interpretación y decisión

| Evidencia | Significa | Acción requerida | Conclusión prohibida |
|---|---|---|---|
| `ok`, salida 0 | El metadata embebido es válido y el major Node es `>=20` | Registrar evidencia y cerrar solo el chequeo de compatibilidad | «CENTRAL está sano/listo/ejecutándose» |
| `incompatible`, `unsupported_runtime`, salida 2 | El runtime del diagnóstico no cumple la política | Preservar evidencia y escalar para un runtime/artefacto autorizado | «CENTRAL falló» o «actualiza Node automáticamente» |
| `error`, `invalid_arguments`, salida 2 | La invocación no cumple el contrato | Corregir únicamente la línea de invocación permitida y repetir | «El binario está roto» |
| `error`, `invalid_build_metadata`, salida 3 | El artefacto carece de provenance válido | Bloquear su uso operativo y escalar a mantenimiento/release | «Recompilar o publicar ahora» |
| `error`, `internal_error`, salida 3 | Fallo inesperado, sin detalle sensible | Preservar stdout y código; escalar | «Inspeccionar entorno, archivos o CENTRAL» |

## Procedimiento operativo estándar

### Antes de ejecutar

- Confirma autorización, responsable de escalación y origen del artefacto.
- Verifica que la petición es solo de provenance/compatibilidad y no una solicitud de diagnóstico de CENTRAL.
- Prepara un identificador de caso no sensible y un lugar de almacenamiento aprobado.
- No prepares secretos, variables de entorno, rutas de datos ni flags de la CLI normal: no son entradas autorizadas.

### Ejecutar y validar

1. Ejecuta `paperclipai-local-diagnostics --json`.
2. Conserva stdout sin editar y el código de salida.
3. Comprueba que hay un único documento JSON y que `schemaVersion` es `v1`.
4. Comprueba que `scope.centralHealth`, `scope.centralLiveness` y `scope.centralReadiness` son `not_assessed`.
5. Aplica la tabla de interpretación. No hagas remediation autónoma.

### Preservar, informar y cerrar

Conserva solo la salida del ejecutable, el código de salida, fecha/hora de registro del caso y el identificador de artefacto autorizado. Si la salida no es un único JSON en una ejecución no `ok`, o si hay efectos inesperados, detente y escala.

Plantilla mínima de evidencia:

```text
case_id: ID_DE_CASO
authorized_by: POR_ASIGNAR
operator: POR_ASIGNAR
artifact_id: POR_VERIFICAR
invocation: paperclipai-local-diagnostics --json
exit_code: 0|2|3
stdout_sha256: SHA256_DE_LA_SALIDA
status: ok|incompatible|error
error_code: AUSENTE|CODIGO_CERRADO
scope_confirmed_not_assessed: yes|no
escalated_to: POR_ASIGNAR|no_aplica
```

## Runbook humano y contrato para agentes

### Acciones autorizadas

Un operador humano autorizado o un agente explícitamente autorizado puede: ejecutar una de las tres invocaciones permitidas, leer stdout, registrar el código de salida, validar JSON y elevar evidencia. Un agente no debe actuar por defecto: la autorización debe identificar caso, artefacto, destinatario y límite de acción.

### Acciones prohibidas

- No reparar, activar, arrancar, detener ni reconfigurar CENTRAL.
- No afirmar salud, liveness, readiness, disponibilidad o estado de CENTRAL.
- No sondear entorno, archivos, procesos, red, base de datos, puertos ni configuración.
- No añadir flags, argumentos, `--help`, redirecciones a destinos no aprobados ni comandos auxiliares de investigación.
- No instalar, compilar, publicar, etiquetar o cambiar paquetes sin autorización de release independiente.

### Condiciones de parada y escalación

Detente y escala si falta autorización o evidencia de artefacto; el bin no existe; el resultado es 2 o 3; la salida está malformada o mezclada; hay stderr/logs/efectos inesperados; o la solicitud intenta convertir el resultado en una afirmación sobre CENTRAL.

Respuesta mínima de un agente:

```json
{
  "operation": "central-local-diagnostics",
  "authorized": true,
  "invocation": "paperclipai-local-diagnostics --json",
  "exitCode": 0,
  "resultStatus": "ok",
  "scope": "diagnostic-runtime/build-compatibility",
  "centralAssessment": "not_assessed",
  "evidenceStored": "CASE_REFERENCE",
  "nextAction": "close_compatibility_check_or_escalate"
}
```

Prompt de asignación copiable para un agente futuro:

```text
Estás autorizado únicamente para ejecutar CENTRAL Local Diagnostics para el caso CASE_ID.
Artefacto autorizado: ARTIFACT_ID. Ejecuta exactamente:
paperclipai-local-diagnostics --json
Guarda stdout y el código de salida en EVIDENCE_LOCATION aprobada. Valida un único JSON v1.
No uses otros argumentos ni comandos; no inspecciones archivos, entorno, red, procesos, configuración o CENTRAL;
no realices remediation; no afirmes salud/liveness/readiness de CENTRAL. Si exitCode no es 0, stdout no es JSON
único o observas cualquier efecto inesperado, detente y escala a ESCALATION_OWNER. Devuelve el sobre JSON acordado.
```

## Seguridad y privacidad

El producto está diseñado para no cargar la CLI normal, servidor, doctor, configuración, telemetría ni entradas operativas. Las pruebas de frontera verifican un bundle de siete archivos, sin imports externos en el bundle final, y un escáner que rechaza rutas/capacidades prohibidas. Las pruebas contractuales comprueban una única escritura a stdout, redacción de datos de metadata inválidos y ausencia de salida de error en las rutas empaquetadas probadas.

Estas garantías se refieren al código de aplicación y a su bundle; no hacen afirmaciones sobre la carga normal del ejecutable por el sistema operativo. No introduzcas secretos en argumentos ni en el registro del caso. Aunque la salida está diseñada para evitar datos sensibles, comparte y conserva evidencia solo en almacenamiento aprobado y con la mínima audiencia necesaria.

## Matriz de troubleshooting

| Síntoma | Lectura segura | Acción | No hacer |
|---|---|---|---|
| Comando no encontrado | No hay bin accesible en el entorno | Escalar para recibir artefacto/método de instalación autorizado | Buscar o instalar paquetes por cuenta propia |
| Argumentos inválidos | Contrato de argv incumplido | Repetir solo con ninguna opción, `--json` o `--text` | Probar flags de ayuda o CLI normal |
| Runtime incompatible | Major Node del diagnóstico no soportado | Escalar al mantenedor/release | Cambiar runtime automáticamente |
| Metadata inválido | Artefacto sin provenance válido | Bloquear uso y escalar | Editar metadata, recompilar o publicar |
| Error interno | Fallo inesperado sin detalle expuesto | Conservar evidencia y escalar | Inspeccionar host/archivos/CENTRAL |
| Salida malformada o mezclada | Incumple garantía de contrato | Detener, preservar bytes y escalar | Filtrar, normalizar o ignorar contenido |
| Efecto secundario inesperado | Contradice la frontera esperada | Detener y abrir incidente de mantenimiento | Continuar la investigación operativa |
| Evidencia contradictoria | No hay base para decisión | Escalar al dueño de escalación | Elegir el resultado más favorable |

## Mantenimiento y control de cambios

El contrato v1 solo admite adiciones opcionales compatibles; cambiar significado, eliminar un campo requerido, alterar vocabulario cerrado o romper orden/semántica exige una nueva versión de esquema. Cualquier cambio de runtime soportado, bin, salida, scanner/corpus, provenance o empaquetado requiere revisión de mantenimiento y evidencia de pruebas/CI.

La evidencia histórica registra una construcción serial de `cli/dist`, allowlist de paquete (`README.md`, `package.json`, `dist/index.js`, `dist/index.js.map`, `dist/local-diagnostics.js`), metadata de build de 40 hex y pruebas de cierre del bundle. El flujo de release/publicación es independiente de esta guía operativa. El rollback histórico, si una autoridad lo aprueba, revierte el trabajo de recuperación en orden D → C → B2 → B1 → A; esta guía no autoriza ni ejecuta ese rollback. Las ramas retenidas son límites de auditoría/rollback, no dependencias operativas.

## Evidencia de verificación histórica

| Hecho | Evidencia |
|---|---|
| Suite final focalizada | 132/132 pruebas aprobadas, 7 archivos, Vitest 4.1.10 |
| Cadena de PR | [#8](https://github.com/constant1n0/paperclip/pull/8), [#9](https://github.com/constant1n0/paperclip/pull/9), [#10](https://github.com/constant1n0/paperclip/pull/10), [#11](https://github.com/constant1n0/paperclip/pull/11), [#12](https://github.com/constant1n0/paperclip/pull/12) |
| Integración final | SHA `f2c8a5aba3c0339888ede2525050e941980d1970`; árbol `f8ec620c785db46bc2768a5d9aa4a3abd42e980c` |
| Cierre | Cero findings abiertos BLOCKER/CRITICAL; cambio archivado |
| Runtime de pruebas | Política de producto `>=20`; el bundle objetivo es Node 20; la evidencia histórica de aislamiento tenía condiciones de entorno propias y no añade deberes al operador |
| Tipo local | Existe un TS2353 ajeno en `packages/adapter-utils/src/acpx-engine/execute.ts:3290`; era baseline no relacionado. La lane CI verde, de alcance menor, ejecuta `typecheck:build-gaps`, no el typecheck local completo de `cli`. |

Esta sección es evidencia de implementación, no un procedimiento que el operador deba ejecutar. No se ejecutaron build, package, install ni pruebas raíz para esta entrega documental.

## Checklist de asignación y uso periódico

### Antes de asignar

- [ ] Se nombró operador, autoridad y dueño de escalación (sin asumir identidades).
- [ ] Se aprobó explícitamente el uso manual o por agente.
- [ ] Se entregó evidencia del artefacto/distribución; la ausencia de publicación npm está entendida.
- [ ] Se confirmó que el objetivo es compatibility/provenance, no CENTRAL.
- [ ] Se aprobó almacenamiento de evidencia.

### En cada uso

- [ ] Se usó exactamente una invocación permitida.
- [ ] Se registró stdout completo y código 0, 2 o 3.
- [ ] Se confirmó alcance `not_assessed` para CENTRAL.
- [ ] No hubo remediation ni investigación de entorno.
- [ ] Se cerró el chequeo de compatibilidad o se escaló según la tabla.

## Ítems abiertos

1. **POR ASIGNAR:** operador, mantenedor, autoridad de sistema/release y dueño de escalación.
2. **Sin release:** decidir distribución, tag o publicación requiere flujo separado y autorización del propietario.
3. **TS2353 baseline:** deuda no relacionada; tratarla en un cambio separado si se prioriza.
4. **Notion opcional:** no existe sincronización requerida para esta entrega; decidirla por separado si se desea seguimiento humano.

## Glosario

| Término | Definición |
|---|---|
| CENTRAL | Sistema que este ejecutable deliberadamente no inspecciona ni opera. |
| Provenance de build | Versión SemVer y commit de 40 hex embebidos durante la compilación. |
| Runtime compatible | Proceso Node cuyo major es 20 o superior según el código actual. |
| Resultado canónico | Objeto v1 desde el que se deriva JSON y, solo en éxito, texto. |
| Operador autorizado | Humano o agente con autorización explícita, alcance y escalación definidos. |

## Referencias verificadas

- Código de contrato: `cli/src/local-diagnostics/{schema,core,matrix,renderers,local-diagnostics,index,build-metadata}.ts`.
- Build y paquete: `cli/package.json`, `cli/esbuild.config.mjs`, `cli/build.mjs`, `scripts/build-npm.sh`, `cli/build.test.mjs`.
- Pruebas de contrato y frontera: `cli/src/__tests__/local-diagnostics/{core,renderers,local-diagnostics,bundle-closure,build-options,dependency-boundary}.test.ts`.
- Convenciones de CLI: `docs/cli/overview.md`, `docs/cli/setup-commands.md`.
- Engram: `sdd/central-local-diagnostics/proposal` (#5162), `spec` (#5163), `design` (#5172), `design-master-integration-recovery` (#5956), `verify-report` (#7754), `archive-report` (#7756), `situation-report` (#7759).

## Límites y elementos por verificar

- **[POR VERIFICAR]** Identificador, ubicación y checksum del artefacto que recibirá cada operador: no existe publicación realizada por este cambio.
- **[POR VERIFICAR]** Identidades de todas las funciones RACI: permanecen sin asignar.
- No se declara disponibilidad de npm, una instalación concreta ni salud de CENTRAL porque no están probadas por esta guía.
