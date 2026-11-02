# ZaBa AI

**Tu espacio personal de inteligencia artificial.** Un prototipo web responsive y funcional para conversar, explorar agentes, personalizar preferencias, adjuntar medios y configurar un endpoint de IA compatible.

## Probar en local

No necesita instalación ni dependencias. Abre `index.html` en un navegador moderno o ejecuta:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Después visita `http://localhost:8000`.

## Qué puedes probar

- Chat interactivo; conversaciones recientes persistentes, recuperables al volver a abrir ZaBa y eliminables individualmente. Los títulos se resumen localmente a partir del tema del primer mensaje.
- Cada respuesta se puede copiar, escuchar, guardar como texto o descargar directamente en PDF.
- Proveedores preconfigurados: OpenRouter (incluye descubrimiento en vivo de modelos con precio cero), Google Gemini, Groq y endpoints OpenAI-compatible. Se autocompletan las URL y modelos iniciales; puedes descubrir modelos disponibles o escribir otro ID desde **Ajustes → Modelo**. Sin clave, el chat muestra respuestas demostrativas.
- Selector de modelo, adjuntos de imagen, vídeo y documentos (hasta 20 MB), voz mediante las APIs de voz disponibles en el navegador.
- Proyectos: selecciona archivos de una carpeta local autorizada o de un repositorio GitHub como contexto para el agente. Las respuestas con código se pueden guardar en la carpeta seleccionada o subir a una rama nueva de GitHub tras confirmación.
- Agentes predefinidos y creación de agentes personalizados, preferencias de respuesta y proyectos.
- TeraBox ofrece un enlace para intercambio manual; no se solicita la contraseña ni se simula una API que requiere credenciales oficiales de desarrollador.

## Importante antes de usar un proveedor real

ZaBa AI no incluye claves ni garantiza cuotas gratuitas. Añade tu clave de proveedor y revisa sus términos. Los archivos de carpeta/GitHub solo se leen cuando los seleccionas; si luego envías un mensaje con un modelo conectado, ese contexto se transmite al proveedor elegido. El token GitHub se mantiene solo en memoria y se envía directamente a `api.github.com`; usa un token granular limitado a un único repositorio y no lo introduzcas en equipos compartidos. La escritura a GitHub crea una rama nueva tras confirmación. Algunos endpoints requieren CORS o un proxy backend; la app estática no sustituye a un gestor de secretos de servidor.

Las respuestas sin conexión a un proveedor son ejemplos de interfaz, no inferencias de IA. La voz depende del navegador y los permisos del dispositivo. El análisis de vídeo y la ejecución segura de programas necesitan servicios backend, que no forman parte de este prototipo estático.

## Sitio publicado

[**Abrir ZaBa AI en GitHub Pages**](https://zabadevgit.github.io/ZaBa-AI/)

El workflow de `.github/workflows/pages.yml` publica los cambios al actualizar la rama de trabajo. Consulta también la [especificación técnica](docs/especificacion-tecnica.md).
