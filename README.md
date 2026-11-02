# ZaBa AI

**Tu espacio personal de inteligencia artificial.** Un prototipo web responsive y funcional para conversar, explorar agentes, personalizar preferencias, adjuntar medios y configurar un endpoint de IA compatible.

## Probar en local

No necesita instalación ni dependencias. Abre `index.html` en un navegador moderno o ejecuta:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Después visita `http://localhost:8000`.

## Qué puedes probar

- Chat interactivo, conversaciones recientes guardadas en el navegador y tarjetas para iniciar tareas.
- Proveedores preconfigurados: OpenRouter (incluye descubrimiento en vivo de modelos con precio cero), Google Gemini, Groq y endpoints OpenAI-compatible. Se autocompletan las URL y modelos iniciales; puedes descubrir modelos disponibles o escribir otro ID desde **Ajustes → Modelo**. Sin clave, el chat muestra respuestas demostrativas.
- Selector de modelo, adjuntos de imagen, vídeo y documentos (hasta 20 MB), voz mediante las APIs de voz disponibles en el navegador.
- Agentes predefinidos y creación de agentes personalizados, preferencias de respuesta y proyectos.
- Panel de permisos explícitos; selector de carpeta del navegador cuando está disponible. No hay lectura/escritura de archivos en segundo plano ni ejecución de código local.
- Descargar respuestas y controles para borrar historial.

## Importante antes de usar un proveedor real

ZaBa AI no incluye claves, modelos ni cuotas gratuitas. Añade una clave propia y confirma los términos del proveedor. En la demo, los adjuntos solo se envían al proveedor cuando pulsas **Enviar** y hay una clave configurada. El prototipo conecta endpoints compatibles con la API de chat de OpenAI; algunos proveedores requieren configuración CORS o un proxy backend. No publiques claves en una web compartida: el modo navegador no sustituye un gestor de secretos de servidor.

Las respuestas sin conexión a un proveedor son ejemplos de interfaz, no inferencias de IA. La voz depende del navegador y los permisos del dispositivo. El análisis de vídeo y la ejecución segura de programas necesitan servicios backend, que no forman parte de este prototipo estático.

## Publicación

## Publicado

[**Abrir ZaBa AI en GitHub Pages**](https://zabadevgit.github.io/ZaBa-AI/)

El workflow de `.github/workflows/pages.yml` publica los cambios al actualizar la rama de trabajo. Consulta también la [especificación técnica](docs/especificacion-tecnica.md).
