# MCP Server para VW Projects

Este es un servidor MCP (Model Context Protocol) que permite a Claude AI acceder a todos los proyectos en tu workspace de desarrollo.

## 🚀 Instalación y Configuración

### 1. Instalar dependencias

```bash
cd mcp-server
npm install
```

### 2. Configurar la ruta de tu workspace

El servidor usa la variable de entorno `VW_PROJECTS_PATH` para saber dónde están tus proyectos.

**⚠️ CRÍTICO:** La variable de entorno es **obligatoria**. Sin ella, el servidor usará un fallback que puede apuntar a una ubicación incorrecta.

### 3. Configurar Claude Desktop

Edita el archivo de configuración de Claude Desktop:

**Ubicación:** `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
**Ubicación:** `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)

**Contenido:**
```json
{
  "mcpServers": {
    "vw-projects": {
      "command": "node",
      "args": [
        "C:\\Users\\TU_USUARIO\\Documents\\DEVELOPEMENT\\VW\\mcp-server\\server.js"
      ],
      "env": {
        "VW_PROJECTS_PATH": "C:\\Users\\TU_USUARIO\\Documents\\DEVELOPEMENT\\VW"
      }
    }
  }
}
```

**Ejemplo funcional:**
```json
{
  "mcpServers": {
    "evm": {
      "command": "node",
      "args": [
        "C:OTRO/index.js"
      ],
      "env": {
        "QN_ENDPOINT_NAME": "LATE-WISER-CRATER",
        "QN_TOKEN_ID": "6cfbef37c8b0226f20c9e420086c7c885243cabd"
      }
    },
    "vw-projects": {
      "command": "node",
      "args": [
        "C:\\RUTA\\mcp-server\\server.js"
      ],
      "env": {
        "VW_PROJECTS_PATH": "C:\\ruta directorio proyectos"
      }
    }
  }
}
```

### 4. Reiniciar Claude Desktop

**Importante:** Cierra Claude Desktop **completamente** (incluyendo la bandeja del sistema) y vuelve a abrirlo.

## 🛠️ Funcionalidades

El servidor MCP proporciona las siguientes herramientas a Claude:

### `explore_projects`
Explora la estructura completa de proyectos en tu workspace.

**Parámetros:**
- `depth` (opcional): Profundidad máxima de exploración (default: 2)

**Ejemplo de uso:** "Explora mis proyectos" o "Muéstrame la estructura del workspace"

### `find_files`
Busca archivos por nombre o extensión en todos los proyectos.

**Parámetros:**
- `pattern` (requerido): Patrón de búsqueda (ej: "*.js", "package.json", "README*")

**Ejemplo de uso:** "Busca todos los package.json" o "Encuentra archivos .env"

### `read_file`
Lee el contenido de un archivo específico.

**Parámetros:**
- `path` (requerido): Ruta relativa al directorio del workspace

**Ejemplo de uso:** "Lee el archivo token-react/package.json"

### `list_directory`
Lista el contenido de un directorio específico.

**Parámetros:**
- `path` (requerido): Ruta del directorio a listar

**Ejemplo de uso:** "Lista los archivos en token-react" o "Qué hay en la carpeta src"

### `write_file`
Escribe contenido a un archivo.

**Parámetros:**
- `path` (requerido): Ruta del archivo
- `content` (requerido): Contenido a escribir

**Ejemplo de uso:** "Crea un archivo README.md en token-react"

## 🔧 Funcionamiento Interno

### Variable de entorno crítica

```javascript
this.baseDir = process.env.VW_PROJECTS_PATH || path.resolve(process.cwd(), '..');
```

**Con `VW_PROJECTS_PATH`:** ✅ Usa la ruta específica que configures
**Sin `VW_PROJECTS_PATH`:** ❌ Usa la carpeta padre de donde se ejecuta (puede ser incorrecta)

### Fallback automático

Si no se especifica `VW_PROJECTS_PATH`, el servidor intentará usar la carpeta padre del directorio `mcp-server`. Esto puede fallar si Claude Desktop ejecuta el script desde una ubicación inesperada.

## 📋 Requisitos

- **Node.js** 16+
- **Claude Desktop** (no funciona con la versión web)
- **@modelcontextprotocol/sdk** v1.12.3+

## 🐛 Troubleshooting

### ❌ Error: "Cannot use import statement outside a module"

**Causa:** El `package.json` no está configurado para ES modules.

**Solución:** Asegúrate de que tu `package.json` tenga:
```json
{
  "type": "module"
}
```

### ❌ Error: "Server disconnected"

**Causas posibles:**
1. La ruta en `claude_desktop_config.json` es incorrecta
2. El archivo `server.js` no existe o no es ejecutable
3. La variable `VW_PROJECTS_PATH` no está configurada
4. Claude Desktop no encuentra el archivo de configuración

**Soluciones:**
1. Verifica todas las rutas en la configuración
2. Ejecuta el servidor manualmente para testear: `node server.js`
3. Busca todos los archivos de configuración: `Get-ChildItem -Path C:\ -Name "*claude*config*" -Recurse`
4. Revisa los logs de Claude Desktop

### ❌ Error: "Failed to read file" / "ENOENT: no such file or directory"

**Causa:** El servidor está ejecutándose desde la ubicación incorrecta.

**Diagnóstico:** Si ves rutas como `C:\Users\usuario\AppData\Local\AnthropicClaude\` en los errores, significa que la variable `VW_PROJECTS_PATH` no se está aplicando.

**Solución:**
1. **Verifica que la variable de entorno esté en la configuración:**
   ```json
   "env": {
     "VW_PROJECTS_PATH": "C:\\Users\\TU_USUARIO\\ruta\\a\\tu\\workspace"
   }
   ```
2. **Reinicia Claude Desktop completamente**
3. **Testa manualmente el servidor:** `node server.js` debería mostrar la ruta correcta

### ❌ El servidor funciona manualmente pero no en Claude Desktop

**Causa:** Claude Desktop está usando una configuración antigua o desde otra ubicación.

**Solución:**
1. **Mata todos los procesos de Claude** en Task Manager
2. **Busca archivos de configuración duplicados:**
   ```bash
   Get-ChildItem -Path C:\ -Name "*claude*config*" -Recurse -ErrorAction SilentlyContinue
   ```
3. **Elimina configuraciones antiguas** y crea una nueva desde cero
4. **Cambia el nombre del servidor** en la configuración (ej: `"vw-workspace"` en lugar de `"vw-projects"`)

## 🧪 Testing

### Probar el servidor manualmente
```bash
cd mcp-server
node server.js
```

**Salida esperada:**
```
VW Projects MCP server running on stdio
Base directory: C:\Users\TU_USUARIO\Documents\DEVELOPEMENT\VW
```

### Probar en Claude Desktop

Después de configurar, pregunta a Claude:
- "¿Puedes explorar mis proyectos?"
- "Lista los archivos en token-react"
- "Busca todos los package.json"

## 📁 Estructura del Proyecto

```
mcp-server/
├── package.json          # Configuración del proyecto
├── server.js             # Servidor MCP principal
├── .env.example          # Plantilla de configuración (opcional)
├── .gitignore           # Archivos ignorados por Git
├── package-lock.json     # Lock de dependencias
└── README.md            # Esta documentación
```

## 🚀 Para GitHub

Este proyecto está preparado para ser subido a GitHub de forma segura:

- ✅ Las rutas personales no están hardcodeadas
- ✅ Los archivos de configuración local están en `.gitignore`
- ✅ Incluye plantillas y documentación para otros usuarios
- ✅ Funciona en Windows, Mac y Linux
- ✅ Documentación completa de troubleshooting basada en experiencia real

## 🎯 Casos de uso

Una vez configurado, puedes pedir a Claude:

### Exploración
- "Explora mis proyectos y dime qué tecnologías usan"
- "¿Cuántos proyectos React vs Go tengo?"
- "Muéstrame la estructura de token-react"

### Búsqueda
- "Busca todos los archivos package.json y compara las dependencias"
- "Encuentra archivos .env en todos los proyectos"
- "Busca archivos de configuración de pipelines"

### Análisis de código
- "Lee el package.json de token-react y explícamelo"
- "Analiza la configuración de Vite en gila-react"
- "Compara las configuraciones de TypeScript entre proyectos"

### Desarrollo
- "Ayúdame a crear un nuevo componente en token-react"
- "Genera documentación para el proyecto core-go"
- "Revisa el código de auth-react y sugiere mejoras"

## 📚 Referencias

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Claude Desktop MCP Guide](https://docs.anthropic.com/claude/docs/mcp)

## 🔄 Historial de cambios

### v1.0.0
- ✅ Servidor MCP funcional con acceso a workspace completo
- ✅ Soporte para variables de entorno
- ✅ Documentación completa de troubleshooting
- ✅ Configuración lista para GitHub
- ✅ Casos de uso y ejemplos prácticos
