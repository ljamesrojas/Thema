#!/usr/bin/env node
// thema-mcp: the MCP server over stdio, as Claude Code, Cursor and other agents launch it.
// Logs go to stderr: stdout carries the protocol.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createThemaServer } from "./server.js";

const server = createThemaServer({ cwd: process.env.INIT_CWD ?? process.cwd() });
await server.connect(new StdioServerTransport());
process.stderr.write("Thema MCP server ready (extract, blend, get_design_md).\n");
