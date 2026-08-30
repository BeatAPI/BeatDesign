#!/usr/bin/env node
export {};

const { startBeatDesignMcpServer } = await import('../src/mcp/server');
startBeatDesignMcpServer();
console.error('BeatDesign MCP server is running on stdio.');
