#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createUnzip } from 'zlib';
import { stat } from 'fs/promises';

class FileServer {
  constructor() {
    // Usar variable de entorno o ruta relativa por defecto
    this.baseDir = process.env.VW_PROJECTS_PATH || path.resolve(process.cwd(), '..');
    
    this.server = new Server(
      {
        name: 'vw-projects-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'explore_projects',
          description: 'Explore all projects in the VW directory with their structure',
          inputSchema: {
            type: 'object',
            properties: {
              depth: {
                type: 'number',
                description: 'Maximum depth to explore (default: 2)',
                default: 2,
              },
            },
          },
        },
        {
          name: 'find_files',
          description: 'Find files by name or extension across all projects',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'File name pattern or extension (e.g., "*.js", "package.json")',
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'read_file',
          description: 'Read the contents of a file (path relative to VW folder)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file relative to VW directory',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'list_directory',
          description: 'List the contents of a directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the directory to list',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'write_file',
          description: 'Write content to a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to write',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
            },
            required: ['path', 'content'],
          },
        },
        {
          name: 'create_directory',
          description: 'Create a new directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the directory to create',
              },
              recursive: {
                type: 'boolean',
                description: 'Create parent directories if they do not exist',
                default: true,
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'copy_file',
          description: 'Copy a file from source to destination',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source file path',
              },
              destination: {
                type: 'string',
                description: 'Destination file path',
              },
              overwrite: {
                type: 'boolean',
                description: 'Overwrite destination if it exists',
                default: false,
              },
            },
            required: ['source', 'destination'],
          },
        },
        {
          name: 'move_file',
          description: 'Move a file from source to destination',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source file path',
              },
              destination: {
                type: 'string',
                description: 'Destination file path',
              },
              overwrite: {
                type: 'boolean',
                description: 'Overwrite destination if it exists',
                default: false,
              },
            },
            required: ['source', 'destination'],
          },
        },
        {
          name: 'delete_file',
          description: 'Delete a file',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file to delete',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'delete_directory',
          description: 'Delete a directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the directory to delete',
              },
              recursive: {
                type: 'boolean',
                description: 'Delete directory contents recursively',
                default: false,
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'file_exists',
          description: 'Check if a file or directory exists',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to check',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'get_file_info',
          description: 'Get information about a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file or directory',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'rename_file',
          description: 'Rename a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source path',
              },
              newName: {
                type: 'string',
                description: 'New name (not full path, just the name)',
              },
            },
            required: ['source', 'newName'],
          },
        },
        {
          name: 'zip_directory',
          description: 'Compress a directory into a zip file',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source directory path',
              },
              destination: {
                type: 'string',
                description: 'Destination zip file path',
              },
            },
            required: ['source', 'destination'],
          },
        },
        {
          name: 'unzip_file',
          description: 'Extract a zip file',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: 'Source zip file path',
              },
              destination: {
                type: 'string',
                description: 'Destination directory path',
              },
            },
            required: ['source', 'destination'],
          },
        },
        {
          name: 'change_permissions',
          description: 'Change file permissions (Unix-like systems only)',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the file or directory',
              },
              mode: {
                type: 'string',
                description: 'Permission mode in octal format (e.g., "0755")',
              },
            },
            required: ['path', 'mode'],
          },
        },
        
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'explore_projects':
          return await this.exploreProjects(request.params.arguments?.depth || 2);
        case 'find_files':
          return await this.findFiles(request.params.arguments?.pattern);
        case 'read_file':
          return await this.readFile(request.params.arguments?.path);
        case 'list_directory':
          return await this.listDirectory(request.params.arguments?.path);
        case 'write_file':
          return await this.writeFile(request.params.arguments?.path, request.params.arguments?.content);
        case 'create_directory':
          return await this.createDirectory(request.params.arguments?.path, request.params.arguments?.recursive);
        case 'copy_file':
          return await this.copyFile(request.params.arguments?.source, request.params.arguments?.destination, request.params.arguments?.overwrite);
        case 'move_file':
          return await this.moveFile(request.params.arguments?.source, request.params.arguments?.destination, request.params.arguments?.overwrite);
        case 'delete_file':
          return await this.deleteFile(request.params.arguments?.path);
        case 'delete_directory':
          return await this.deleteDirectory(request.params.arguments?.path, request.params.arguments?.recursive);
        case 'file_exists':
          return await this.fileExists(request.params.arguments?.path);
        case 'get_file_info':
          return await this.getFileInfo(request.params.arguments?.path);
        case 'rename_file':
          return await this.renameFile(request.params.arguments?.source, request.params.arguments?.newName);
        case 'zip_directory':
          return await this.zipDirectory(request.params.arguments?.source, request.params.arguments?.destination);
        case 'unzip_file':
          return await this.unzipFile(request.params.arguments?.source, request.params.arguments?.destination);
        case 'change_permissions':
          return await this.changePermissions(request.params.arguments?.path, request.params.arguments?.mode);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  // Resolver ruta relativa al directorio base
  resolvePath(relativePath) {
    return path.resolve(this.baseDir, relativePath);
  }

  async exploreProjects(maxDepth = 2) {
    try {
      const structure = await this.getDirectoryStructure(this.baseDir, maxDepth);
      return {
        content: [
          {
            type: 'text',
            text: `Estructura de proyectos en VW:\n${JSON.stringify(structure, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to explore projects: ${error.message}`);
    }
  }

  async getDirectoryStructure(dirPath, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return "...";
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      const structure = {};
      
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        
        const itemPath = path.join(dirPath, item.name);
        if (item.isDirectory()) {
          structure[item.name + '/'] = await this.getDirectoryStructure(itemPath, maxDepth, currentDepth + 1);
        } else {
          structure[item.name] = 'file';
        }
      }
      
      return structure;
    } catch (error) {
      return `Error: ${error.message}`;
    }
  }

  async findFiles(pattern) {
    try {
      const files = await this.searchFiles(this.baseDir, pattern);
      return {
        content: [
          {
            type: 'text',
            text: `Archivos encontrados para "${pattern}":\n${JSON.stringify(files, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to find files: ${error.message}`);
    }
  }

  async searchFiles(dir, pattern, results = []) {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(this.baseDir, fullPath);
        
        if (item.isDirectory()) {
          await this.searchFiles(fullPath, pattern, results);
        } else {
          if (this.matchesPattern(item.name, pattern)) {
            results.push(relativePath);
          }
        }
      }
      
      return results;
    } catch (error) {
      return results;
    }
  }

  matchesPattern(filename, pattern) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
    return regex.test(filename);
  }

  async readFile(relativePath) {
    try {
      const fullPath = this.resolvePath(relativePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async listDirectory(relativePath) {
    try {
      const fullPath = relativePath ? this.resolvePath(relativePath) : this.baseDir;
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      const fileList = files.map(file => ({
        name: file.name,
        type: file.isDirectory() ? 'directory' : 'file',
        path: relativePath ? path.join(relativePath, file.name) : file.name
      }));
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(fileList, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  async writeFile(relativePath, content) {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.writeFile(fullPath, content, 'utf-8');
      return {
        content: [
          {
            type: 'text',
            text: `File written successfully to ${relativePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  async createDirectory(relativePath, recursive = true) {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.mkdir(fullPath, { recursive });
      return {
        content: [
          {
            type: 'text',
            text: `Directory created successfully at ${relativePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  async copyFile(sourcePath, destinationPath, overwrite = false) {
    try {
      const sourceFullPath = this.resolvePath(sourcePath);
      const destFullPath = this.resolvePath(destinationPath);
      
      // Verificar si el archivo de destino ya existe
      if (!overwrite) {
        try {
          await fs.access(destFullPath);
          throw new Error(`Destination file already exists. Use overwrite=true to force copy.`);
        } catch (err) {
          // Si hay error al acceder, significa que no existe, lo cual es lo que queremos
          if (err.code !== 'ENOENT') throw err;
        }
      }
      
      await fs.copyFile(sourceFullPath, destFullPath);
      return {
        content: [
          {
            type: 'text',
            text: `File copied successfully from ${sourcePath} to ${destinationPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }

  async moveFile(sourcePath, destinationPath, overwrite = false) {
    try {
      const sourceFullPath = this.resolvePath(sourcePath);
      const destFullPath = this.resolvePath(destinationPath);
      
      // Verificar si el archivo de destino ya existe
      if (!overwrite) {
        try {
          await fs.access(destFullPath);
          throw new Error(`Destination file already exists. Use overwrite=true to force move.`);
        } catch (err) {
          // Si hay error al acceder, significa que no existe, lo cual es lo que queremos
          if (err.code !== 'ENOENT') throw err;
        }
      }
      
      await fs.rename(sourceFullPath, destFullPath);
      return {
        content: [
          {
            type: 'text',
            text: `File moved successfully from ${sourcePath} to ${destinationPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to move file: ${error.message}`);
    }
  }

  async deleteFile(relativePath) {
    try {
      const fullPath = this.resolvePath(relativePath);
      await fs.unlink(fullPath);
      return {
        content: [
          {
            type: 'text',
            text: `File deleted successfully: ${relativePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async deleteDirectory(relativePath, recursive = false) {
    try {
      const fullPath = this.resolvePath(relativePath);
      
      if (recursive) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.rmdir(fullPath);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Directory deleted successfully: ${relativePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to delete directory: ${error.message}`);
    }
  }

  async fileExists(relativePath) {
    try {
      const fullPath = this.resolvePath(relativePath);
      try {
        await fs.access(fullPath);
        const stats = await fs.stat(fullPath);
        const type = stats.isDirectory() ? 'directory' : 'file';
        
        return {
          content: [
            {
              type: 'text',
              text: `The ${type} exists: ${relativePath}`,
            },
          ],
        };
      } catch (err) {
        if (err.code === 'ENOENT') {
          return {
            content: [
              {
                type: 'text',
                text: `Path does not exist: ${relativePath}`,
              },
            ],
          };
        }
        throw err;
      }
    } catch (error) {
      throw new Error(`Failed to check if file exists: ${error.message}`);
    }
  }

  async getFileInfo(relativePath) {
    try {
      const fullPath = this.resolvePath(relativePath);
      const stats = await fs.stat(fullPath);
      
      const info = {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8).slice(-3),
      };
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  async renameFile(sourcePath, newName) {
    try {
      const sourceFullPath = this.resolvePath(sourcePath);
      const sourceDir = path.dirname(sourceFullPath);
      const destFullPath = path.join(sourceDir, newName);
      
      // Verificar si el archivo de destino ya existe
      try {
        await fs.access(destFullPath);
        throw new Error(`A file with the name ${newName} already exists in the directory.`);
      } catch (err) {
        // Si hay error al acceder, significa que no existe, lo cual es lo que queremos
        if (err.code !== 'ENOENT') throw err;
      }
      
      await fs.rename(sourceFullPath, destFullPath);
      return {
        content: [
          {
            type: 'text',
            text: `File renamed successfully from ${path.basename(sourcePath)} to ${newName}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  async zipDirectory(sourcePath, destinationPath) {
    try {
      const sourceFullPath = this.resolvePath(sourcePath);
      const destFullPath = this.resolvePath(destinationPath);
      
      // Verificar que la fuente es un directorio
      const stats = await fs.stat(sourceFullPath);
      if (!stats.isDirectory()) {
        throw new Error('Source must be a directory');
      }
      
      // Nota: Esta es una implementación simplificada que comprime el primer archivo
      // que encuentra en el directorio. Para una implementación completa se necesitaría
      // una biblioteca como archiver o una implementación recursiva personalizada.
      
      // Obtener la lista de archivos en el directorio
      const files = await fs.readdir(sourceFullPath);
      
      if (files.length === 0) {
        throw new Error('Directory is empty');
      }
      
      // Usar el primer archivo encontrado para la compresión simplificada
      const firstFile = files.find(file => !file.startsWith('.'));
      if (!firstFile) {
        throw new Error('No valid files found in directory');
      }
      
      // Crear un stream de escritura para el archivo de destino
      const output = createWriteStream(destFullPath);
      const gzip = createGzip();
      
      const input = createReadStream(path.join(sourceFullPath, firstFile));
      
      await pipeline(input, gzip, output);
      
      return {
        content: [
          {
            type: 'text',
            text: `File ${firstFile} from directory ${sourcePath} compressed successfully to ${destinationPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to zip directory: ${error.message} (Note: This is a simplified implementation and may not work with all directories)`);
    }
  }

  async unzipFile(sourcePath, destinationPath) {
    try {
      const sourceFullPath = this.resolvePath(sourcePath);
      const destFullPath = this.resolvePath(destinationPath);
      
      // Crear el directorio de destino si no existe
      await fs.mkdir(destFullPath, { recursive: true });
      
      // Obtener el nombre base del archivo fuente sin extensión
      const sourceBaseName = path.basename(sourcePath, path.extname(sourcePath));
      const outputFileName = `${sourceBaseName}_extracted${path.extname(sourcePath) === '.gz' ? '.txt' : path.extname(sourcePath)}`;
      
      // Crear streams para descompresión
      const input = createReadStream(sourceFullPath);
      const unzip = createUnzip();
      const output = createWriteStream(path.join(destFullPath, outputFileName));
      
      await pipeline(input, unzip, output);
      
      return {
        content: [
          {
            type: 'text',
            text: `File extracted successfully from ${sourcePath} to ${path.join(destinationPath, outputFileName)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to unzip file: ${error.message} (Note: This is a simplified implementation and may not work with all zip files)`);
    }
  }

  async changePermissions(relativePath, mode) {
    try {
      const fullPath = this.resolvePath(relativePath);
      
      // Convertir el modo de string a número
      const modeNum = parseInt(mode, 8);
      if (isNaN(modeNum)) {
        throw new Error('Invalid mode format. Use octal format (e.g., "0755")');
      }
      
      await fs.chmod(fullPath, modeNum);
      
      return {
        content: [
          {
            type: 'text',
            text: `Permissions changed successfully for ${relativePath} to ${mode}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to change permissions: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('VW Projects MCP server running on stdio');
    console.error(`Base directory: ${this.baseDir}`);
  }
}

const server = new FileServer();
server.run().catch(console.error);
