#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { defaultDeps } from "./deps.js";
import { createNameCheckServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

/**
 * Stdio entry point — for Claude Desktop, Cursor, and other local MCP
 * clients that spawn the server as a subprocess. All diagnostics go to
 * stderr; stdout is reserved for the protocol.
 */
const server = createNameCheckServer(defaultDeps());
await server.connect(new StdioServerTransport());
console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on stdio`);
