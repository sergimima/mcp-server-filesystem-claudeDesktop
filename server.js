#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('VW Projects MCP server running on stdio');
    console.error(`Base directory: ${this.baseDir}`);
  }
}

const server = new FileServer();
server.run().catch(console.error);
