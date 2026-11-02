# ZaBa AI — diseño conceptual y especificación técnica

**Versión:** 0.1 · **Idioma:** español · **Estado:** propuesta para validación, no implementación ejecutable.

## 1. Visión y alcance

ZaBa AI es un espacio de trabajo de IA que reúne conversaciones, voz, agentes, generación de software y análisis de texto e imágenes/vídeos. Puede enrutar solicitudes a servicios en la nube compatibles o a modelos locales. La experiencia debe permitir elegir conscientemente entre calidad, latencia, privacidad, coste y capacidades disponibles, sin prometer que un modelo gratuito sea ilimitado o esté siempre disponible.

La plataforma no debe ejecutar acciones del sistema operativo de forma implícita. Las herramientas locales permanecen apagadas hasta que la persona las habilite, y las operaciones con impacto (escribir, borrar, ejecutar, subir o compartir) requieren confirmación contextual. ZaBa AI no debe presentarse como sustituto de asesoramiento profesional ni como fuente infalible.

### Objetivos

- Unificar acceso a modelos y proveedores mediante adaptadores intercambiables.
- Habilitar chat y voz con historial, archivos y contexto controlable.
- Crear agentes configurables con herramientas y límites explícitos.
- Asistir en programación dentro de proyectos y entornos aislados.
- Analizar contenido multimodal respetando límites técnicos y permisos.
- Dar controles comprensibles de privacidad, personalización, exportación y borrado.

### Fuera del alcance inicial

- Entrenar modelos fundacionales propios.
- Garantizar acceso gratuito permanente a terceros.
- Ejecutar código arbitrario con acceso directo al sistema anfitrión.
- Automatizar compras, publicaciones, comunicaciones externas u otras acciones sensibles sin aprobación.

## 2. Diseño de la interfaz

### Estructura principal

- **Barra lateral:** conversaciones recientes, espacios/proyectos, agentes guardados y configuración.
- **Cabecera de conversación:** título, selector de modelo/modo, estado de privacidad, agente activo y menú de contexto.
- **Área central:** mensajes, bloques de código, adjuntos, citas y resultados de herramientas claramente separados de la respuesta del modelo.
- **Compositor:** texto, adjuntar, micrófono, selector de herramientas y botón enviar/detener. Indicador de contexto y límites de archivo.
- **Panel contextual opcional:** archivos del proyecto, permisos concedidos, ejecución y actividad del agente.
- **Preferencias:** apariencia, idioma, accesibilidad, voz, proveedores, privacidad, datos y exportación.

El usuario puede trabajar en un chat normal, en un proyecto de programación o en una sesión de agente. El modo activo debe estar siempre visible; el sistema no debe cambiar silenciosamente de proveedor cuando una solicitud falla. Puede proponer una alternativa y pedir aceptación si supone cambiar el tratamiento de datos o las capacidades.

### Accesibilidad

Compatibilidad con navegación completa por teclado, foco visible, etiquetas accesibles, lectores de pantalla, contraste y ampliación. No comunicar estados únicamente por color. La voz debe tener transcripción visible y controles de pausa/cancelación; todas las respuestas de voz deben poder leerse como texto. Reducir movimiento y permitir personalizar tamaño de fuente.

## 3. Arquitectura lógica

```text
Cliente web/escritorio
  ├─ Chat, voz, archivos, proyectos y panel de permisos
  ├─ Almacenamiento local cifrado opcional / sincronización optativa
  └─ API de aplicación (HTTPS, sesión autenticada)
       ├─ Identidad, preferencias y autorización
       ├─ Conversaciones y gestión de contexto
       ├─ Orquestador de modelos (selección, políticas, streaming)
       │    └─ Adaptadores: API compatibles, APIs específicas, modelos locales
       ├─ Orquestador de agentes (plan limitado, aprobaciones, herramientas)
       ├─ Ingesta multimedia (validación, extracción, tareas asíncronas)
       ├─ Ejecución aislada de código (worker/sandbox efímero)
       └─ Auditoría, cuotas, observabilidad y eliminación de datos
```

### Componentes

1. **Cliente:** interfaz adaptable. El navegador no recibe claves de proveedor ni accede al host local sin mecanismo explícito del sistema operativo. Comunicación con API propia usando rutas relativas y TLS.
2. **API/BFF:** valida sesiones, limita peticiones, valida esquemas y aplica permisos. Mantiene claves de proveedores en un almacén de secretos del servidor cuando hay proxy, o en almacenamiento local seguro si se opta por modo BYOK (Bring Your Own Key). Nunca incluir claves en código cliente, telemetría o logs.
3. **Orquestador de modelos:** normaliza mensajes, herramientas, streaming y errores. Mantiene catálogo de capacidades, límites y políticas por proveedor/modelo. El router solo selecciona modelos habilitados por el usuario y explica cambios de ruta.
4. **Servicio de agentes:** máquina de estados con pasos, presupuesto, plazo máximo, lista permitida de herramientas y puntos de aprobación. No se permite ejecución recursiva ilimitada.
5. **Procesador de medios:** inspección, extracción de metadatos, OCR/transcripción cuando proceda y generación de referencias temporales; ficheros grandes procesados asíncronamente.
6. **Workers de código:** contenedores efímeros sin privilegios, red deshabilitada por defecto, límites de CPU/memoria/tiempo/tamaño, directorio de trabajo aislado y borrado al terminar.
7. **Persistencia:** base de datos relacional para usuarios, ajustes, conversaciones y metadatos; almacenamiento de objetos para ficheros cifrados; cola de trabajos para tareas multimedia. Separar datos por usuario/espacio y definir retención configurable.

### Despliegue de referencia

- Cliente: aplicación web TypeScript (por ejemplo, React) como primera fase; escritorio empaquetado como evolución si se requiere acceso local profundo.
- API: servicio modular (por ejemplo, Python/FastAPI o TypeScript/Node), con contratos OpenAPI.
- Persistencia: PostgreSQL y almacenamiento compatible con S3; Redis/cola solo si lo exige el volumen.
- Workers aislados: contenedores gestionados, sin montar el sistema anfitrión ni secretos del servidor.
- Observabilidad: métricas y trazas con contenido sensible redactado; nunca registrar prompts/archivos por defecto.

Estas tecnologías son una recomendación, no un requisito. Los límites de seguridad y los contratos de interfaz sí son requisitos.

## 4. Chat y conversación

### Ciclo de una petición

1. El cliente envía mensaje, referencias de adjuntos, identificadores de conversación y configuración elegida.
2. La API autentica, comprueba límites y permisos, valida el tamaño y calcula el contexto que se compartirá.
3. El usuario selecciona un proveedor/modelo o activa una política de selección. En modo automático se informa del criterio (capacidad, disponibilidad, latencia o preferencia), y se pide confirmación cuando la ruta implica transferencia de datos no prevista.
4. El orquestador transforma al formato del proveedor y transmite la respuesta en streaming. El sistema marca por separado texto del modelo, citas, llamadas a herramientas y resultados ejecutados.
5. Se guarda el turno conforme a las preferencias de retención. Se ofrece detener generación, regenerar, editar, copiar, valorar y exportar.

Las conversaciones deben admitir ramas o edición de mensajes sin sobrescribir silenciosamente el historial. El contexto enviado es inspeccionable: incluir conversación completa, selección de mensajes, resumen o solo el turno actual. Incluir instrucciones y archivos de un proyecto solo cuando se habiliten para ese chat.

### Selección de modelo

Mostrar nombre del proveedor/modelo, modalidad admitida (texto, visión, audio, herramientas), límite de contexto conocido, estado, latencia aproximada y condiciones de uso disponibles. Diferenciar “sin coste según el proveedor en este momento” de “sin límites”: puede haber cuotas, colas, límites de velocidad, uso aceptable, requisitos de cuenta o cambios de plan. El usuario aporta y gestiona sus propias credenciales si el modelo no se ofrece mediante una integración gestionada.

## 5. Voz

Modos: **pulsar para hablar** como opción predeterminada y **manos libres** opcional, claramente indicado. Flujo: captura con permiso del navegador/SO → transcripción en vivo o posterior → vista editable → envío solo tras acción del usuario (configurable) → respuesta textual → síntesis de voz opcional.

Requisitos:

- Pedir permiso de micrófono en el momento de uso, mostrar indicador activo y botón de parada inequívoco.
- No almacenar audio por defecto; transcripciones y grabaciones obedecen controles separados de retención.
- Permitir elegir motor local o proveedor remoto, idioma, voz, velocidad y reproducción automática.
- Mostrar errores, idioma detectado y opción de corregir antes de ejecutar acciones.
- Evitar que una transcripción que contenga una orden se trate como consentimiento para una acción local.
- Diseñar interrupción de voz (barge-in), cancelación y recuperación de red.

La disponibilidad de reconocimiento y síntesis puede depender del dispositivo, sistema operativo o proveedor. La interfaz debe indicar dónde se procesa el audio antes de enviarlo.

## 6. Acceso local y permisos

### Modelo de confianza

**Denegar por defecto.** El chat remoto no obtiene acceso al sistema de archivos, shell, cámara, micrófono, red local ni aplicaciones. Los permisos son granulares, por agente/proyecto y revocables; tienen propósito, alcance y caducidad. Presentar una solicitud comprensible justo antes de usar el recurso.

| Capacidad | Alcance inicial recomendado | Confirmación |
|---|---|---|
| Leer archivos | Archivos seleccionados por el usuario o carpeta elegida | Elegir/autorizar carpeta y mostrar rutas afectadas |
| Escribir/crear | Directorio de proyecto aislado | Vista previa del diff; confirmar escritura |
| Borrar/sobrescribir | Nunca implícito; papelera o copia recuperable | Confirmación explícita por operación |
| Ejecutar programa/código | Sandbox efímero | Mostrar comando, archivos y límites; ejecutar |
| Red/salida a Internet | Desactivada en sandbox | Aprobación por destino o política explícita |
| Micrófono/cámara | Solo durante uso visible | Permiso del navegador/SO y botón de parada |
| Portapapeles/notificaciones | Acceso puntual | Acción iniciada por usuario o ajuste específico |

Para navegador, emplear File System Access API cuando exista y disponer de carga/descarga manual como alternativa. No eludir permisos ni buscar archivos fuera del alcance elegido. Para escritorio, usar APIs seguras del framework, diálogo nativo de selección, lista de directorios autorizados y permisos del sistema operativo.

### Flujo de aprobación

1. El agente presenta **acción, motivo, recurso exacto, efecto esperado y si hay envío a nube**.
2. La persona acepta, rechaza o cambia el alcance. La aprobación no se reutiliza para acciones distintas.
3. El ejecutor aplica las comprobaciones en servidor/worker, no solo en la interfaz.
4. Se registra un evento de auditoría sin contenido sensible innecesario.
5. Se muestran resultado y opción de revertir cuando sea posible.

Permitir “recordar para este proyecto” únicamente para capacidades de bajo riesgo y con vencimiento; ejecución, borrado, publicación y transmisión externa requieren confirmación por acción. Botón global para revocar permisos y detener agentes.

## 7. Proveedores y modelos gratuitos

### Integración neutral

Definir una interfaz de adaptador común: `list_models`, `capabilities`, `send_message/stream`, `cancel`, `health` y normalización de errores. Los adaptadores traducen al protocolo propio, sin asumir que todos aceptan el mismo formato. Añadir pruebas de contrato por proveedor y detección de cambios de esquema.

El catálogo debe ser dinámico/versionado y mostrar fuente y fecha de verificación de capacidades/cuotas. No codificar en producto “gratis para siempre”. El término gratuito puede significar nivel gratuito limitado o endpoint comunitario con disponibilidad no garantizada. Revisar límites, territorios, licencia, uso comercial, retención, entrenamiento con datos, moderación y requerimientos de atribución.

### Estrategia de acceso

- **BYOK:** la persona registra su propia clave, cifrada en almacén del sistema; no enviarla a servicios de analítica ni exponerla al modelo.
- **Proxy gestionado:** si se ofrece, se configura una política de cuotas, límites por usuario y financiación; se identifica claramente qué servidor recibe los prompts.
- **Local:** conectar un runtime local mediante API autenticada y configurable; no asumir disponibilidad de GPU.

No hacer scraping de interfaces web ni redistribuir credenciales. Un proveedor sin cuota disponible debe devolver estado claro y permitir reintento o selección manual; no cambiar automáticamente a otro si eso altera privacidad, coste o calidad.

### Router opcional

El usuario elige perfil: **privacidad primero**, **más rápido**, **visión**, **programación**, **modelo local** o **manual**. El router evalúa solo modelos permitidos, compatibilidad de modalidad, región y cuota; no usa contenido de conversación para telemetría. Mostrar explicación y permitir fijar modelo. Fallback sujeto a consentimiento según el nivel de privacidad configurado.

## 8. Agentes personalizables

Un agente es una configuración versionada, no un proceso autónomo ilimitado. Campos sugeridos:

```json
{
  "name": "Asistente de proyecto",
  "description": "Ayuda a comprender y modificar el proyecto",
  "system_instructions": "...",
  "model_policy": {"mode": "user_selected", "allowed_models": []},
  "tools": ["search_project", "read_selected_files"],
  "permissions": {"filesystem": "selected_project", "network": "denied"},
  "approval_policy": "confirm_each_write_or_run",
  "limits": {"max_steps": 8, "timeout_seconds": 120, "max_tokens": 12000},
  "memory": {"enabled": false, "scope": "conversation", "retention_days": 0}
}
```

Editor de agentes: nombre, instrucciones, modelo o política, herramientas permitidas, permisos, memoria, límites y pruebas de ejemplo. Vista previa de cambios y opción de duplicar/restaurar versiones. Compartir/exportar en formato declarativo, sin secretos. Los agentes compartidos deben ser revisados y no heredar permisos del creador.

### Ejecución segura

Estado explícito: `borrador → esperando aprobación → ejecutando → requiere intervención → completado/fallido/cancelado`. Cada herramienta tiene esquema tipado, validación de argumentos, timeout y política de errores. Requerir confirmación antes de mutaciones, acciones externas o enviar datos. Limitar pasos, tokens, duración y llamadas; detectar ciclos; botón detener cancela la cola y los procesos disponibles. El resultado de una herramienta se considera dato no confiable: no puede cambiar política ni conceder permisos.

## 9. Creación de programas

Flujo orientado a proyectos: describir objetivo → generar plan → crear/modificar archivos en un espacio de trabajo → revisar diff → ejecutar pruebas en sandbox → corregir → exportar o aplicar cambios con aprobación.

Funciones propuestas:

- Generación de código, explicación, depuración, refactorización y documentación.
- Contexto de proyecto selectivo, árbol de archivos y exclusiones configurables (por ejemplo, `.env`, claves, dependencias y artefactos grandes).
- Diff antes de aplicar; cambios reversibles; no sobrescribir archivos sin aviso.
- Terminal aislada con comandos visibles, salida acotada y cancelación.
- Plantillas para aplicaciones, scripts, pruebas, consultas SQL y documentación.
- Escaneo opcional de dependencias/licencias y detección de secretos local antes de exportar.
- Descarga de proyecto como archivo y exportación de conversación/plan.

El código generado no se ejecuta automáticamente. El sandbox no comparte credenciales ni sockets del host, se destruye al completar, y bloquea red salvo excepción aprobada. Advertir que las pruebas no equivalen a una auditoría de seguridad.

## 10. Contenido multimodal

### Imágenes

Admitir formatos comunes con lista permitida, límite de tamaño y cantidad configurable. Validar extensión, MIME real y dimensiones; eliminar metadatos EXIF salvo que se soliciten; escanear archivos y generar miniaturas seguras. Opciones: describir, OCR, extracción de elementos, comparar imágenes o usarlas como contexto de una petición. Mostrar al usuario qué archivo y representación se enviará; comprobar que el modelo elegido admite visión. No ejecutar instrucciones incrustadas en imágenes: tratarlas como contenido no confiable.

### Vídeo

El vídeo se procesa como tarea asíncrona: validar contenedor/códec y duración → extraer metadatos → muestrear fotogramas según política configurable → opcionalmente extraer/transcribir audio con permiso → resumir/consultar y citar marcas de tiempo. No enviar el vídeo completo si basta con fotogramas y fragmentos pertinentes. Proporcionar progreso, límites de duración/tamaño y posibilidad de cancelar. Borrar temporales tras el plazo de retención. Indicar claramente si el análisis pierde detalles entre fotogramas.

### Seguridad y límites

Protección frente a archivos malformados, bombas de descompresión, contenido activo, prompt injection en documentos y URLs maliciosas. Nunca abrir automáticamente enlaces ni ejecutar macros. Separar la extracción de datos de instrucciones del agente. El pipeline informa formatos, calidad y límites; el usuario puede eliminar adjuntos y derivados. Aplicar cuotas para almacenamiento y trabajos multimedia.

## 11. Modelo de datos y API orientativa

Entidades mínimas:

- `User`, `Workspace`, `Preference`, `ProviderCredential` (referencia a secreto, nunca texto plano).
- `Conversation`, `Message`, `Attachment`, `MessageRevision`, `Citation`.
- `Agent`, `AgentVersion`, `AgentRun`, `ToolCall`, `Approval`, `PermissionGrant`, `AuditEvent`.
- `Project`, `ProjectFileReference`, `Job`, `UsageRecord`, `RetentionPolicy`.

IDs no predecibles; fechas UTC; separación estricta por propietario/espacio; soft delete solo si se documenta y se facilita borrado definitivo. Cifrado en tránsito y en reposo.

Endpoints orientativos (REST; streaming por SSE o WebSocket autenticado):

```text
GET    /api/v1/models
POST   /api/v1/conversations
GET    /api/v1/conversations/{id}
POST   /api/v1/conversations/{id}/messages   # streaming
POST   /api/v1/files                         # carga validada
POST   /api/v1/agents
POST   /api/v1/agents/{id}/runs
POST   /api/v1/runs/{id}/approvals
POST   /api/v1/runs/{id}/cancel
GET    /api/v1/permissions
DELETE /api/v1/permissions/{id}
GET    /api/v1/export
DELETE /api/v1/account/data
```

Autorización en cada endpoint y operación; límites de carga y frecuencia; protección CSRF si se usan cookies; CORS restrictivo; validación estricta de tipos; idempotencia para acciones repetibles. Los eventos de streaming usan tipos explícitos (`token`, `tool_proposed`, `approval_required`, `tool_result`, `error`, `done`) y nunca mezclan salida de herramienta con texto del asistente.

## 12. Privacidad, seguridad y gobernanza

- Minimizar datos y hacer opt-in para historial, memoria, analítica y sincronización.
- Cifrado en tránsito y reposo, gestión y rotación de secretos, aislamiento por tenant.
- No registrar contenido de prompts, tokens, nombres de archivo o audio por defecto. Métricas agregadas y redactadas.
- Indicar qué datos salen del dispositivo, con qué proveedor y para qué; permitir elegir modo local o no enviar adjuntos.
- Exportación legible y eliminación de cuenta/datos verificable, incluyendo temporales y copias sujetas a plazos documentados.
- Protección contra inyección de instrucciones, abuso de herramientas, CSRF, XSS, SSRF, traversal, malware y denegación de servicio.
- Revisar dependencias, permisos del runtime, límites de recursos, políticas de retención y respuesta a incidentes.
- Mantener inventario de proveedores, subencargados, región de procesamiento y términos; validar obligaciones normativas aplicables antes de producción (incluidos RGPD y normativa europea pertinente).

## 13. Personalización

Preferencias por usuario y por proyecto, con herencia visible y opción de restablecer: idioma, tema, densidad, atajos, voz, estilo de respuesta, longitud por defecto, modelo favorito, reglas del router, contexto, memoria, retención y configuración de privacidad. Separar instrucciones de estilo de permisos: una instrucción personalizada nunca puede habilitar una herramienta ni aumentar privilegios.

Los perfiles de respuesta (conciso, explicativo, técnico) y las instrucciones personalizadas son editables, exportables y desactivables por conversación. No inferir atributos sensibles ni usar contenido privado para entrenar sin consentimiento específico.

## 14. Fallos, límites y experiencia de recuperación

- Errores tipados: sin cuota, límite de velocidad, timeout, proveedor caído, modalidad no soportada, rechazo, credencial inválida y desconexión.
- Mostrar causa accionable, si el mensaje pudo enviarse, opción de reintento y estado de cobro/cuota cuando esté disponible.
- Reanudar stream cuando sea seguro; evitar duplicar llamadas o escrituras mediante idempotencia.
- No perder borradores por cambio de proveedor o red. Recuperar estado de agente y permitir cancelación.
- Explicar incertidumbre del modelo y marcar contenido generado, citas y resultados externos.

## 15. Plan de implementación

### Fase 0 — base segura

Diseño visual, contratos API, modelo de amenazas, autenticación, almacenamiento cifrado, conversaciones de texto y proveedor de prueba. Definir política de privacidad y retención.

### Fase 1 — MVP

Chat streaming, selector manual de modelos, BYOK, historial/exportación/borrado, preferencias básicas, adjuntos de imagen, límites/errores claros. Sin herramientas locales ni ejecución de código inicialmente.

### Fase 2 — programación controlada

Proyectos, selección de archivos, diff y sandbox sin red; aprobación por acción, pruebas automatizadas y auditoría de permisos.

### Fase 3 — voz, agentes y vídeo

Voz con consentimiento visible, agentes acotados con editor y máquina de estados; pipeline de vídeo asíncrono con límites y cancelación.

### Fase 4 — capacidades locales y endurecimiento

Integración de escritorio si se justifica, runtime de modelos locales, permisos del sistema operativo, pruebas de seguridad externas, escalado y localización adicional.

No avanzar de fase por mera disponibilidad técnica: cada etapa requiere pruebas de seguridad, accesibilidad y borrado de datos.

## 16. Criterios de aceptación iniciales

1. Ningún proveedor recibe solicitudes hasta que la persona seleccione/configure ese proveedor y confirme las condiciones de transferencia aplicables.
2. La aplicación no lee archivos, micrófono ni cámara sin permiso del sistema y una acción visible del usuario.
3. Un agente no puede ejecutar una escritura, borrado, comando o envío externo sin la aprobación requerida; cancelar detiene el trabajo pendiente.
4. Antes de cambiar un archivo se muestra un diff; se puede descartar o recuperar el estado previo cuando sea posible.
5. La pantalla identifica modelo/proveedor, modalidad, estado de cuota conocido y errores; no se presenta una cuota gratuita como ilimitada.
6. Imágenes y vídeos se validan, procesan dentro de límites y pueden borrarse; los temporales expiran según política documentada.
7. El usuario puede inspeccionar el contexto enviado, exportar datos y solicitar su eliminación.
8. Los controles principales funcionan con teclado y lector de pantalla; voz dispone de transcripción y opción de solo texto.
9. Las pruebas incluyen aislamiento entre usuarios, permisos revocados, prompt injection en medios, carga maliciosa, fallos del proveedor y límites del sandbox.

## 17. Decisiones pendientes para producto

Antes de implementar: ¿web, escritorio o ambos como objetivo inicial? ¿BYOK únicamente o proxy gestionado? ¿Historial solo local o sincronización opcional? ¿Qué proveedores y regiones se priorizan? ¿Qué límites de tamaño/duración se fijan para medios? ¿Qué nivel de memoria persistente desea el usuario? Resolver estas decisiones con pruebas de privacidad, coste, accesibilidad y viabilidad, no con supuestos de gratuidad permanente.
