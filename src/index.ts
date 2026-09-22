#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createNameCheckServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

/**
 * Stdio entry point — for Claude Desktop, Cursor, and other local MCP
 * clients that spawn the server as a subprocess. All diagnostics go to
 * stderr; stdout is reserved for the protocol.
 */
const server = createNameCheckServer();
await server.connect(new StdioServerTransport());
console.error(`${SERVER_NAME} ${SERVER_VERSION} listening on stdio`);
