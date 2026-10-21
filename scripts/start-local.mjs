// The core workspace has no multi-user authentication; always listen on loopback.
// Set both Nitro and generic variables so ambient hosting defaults cannot widen it.
process.env.HOST = '127.0.0.1';
process.env.NITRO_HOST = '127.0.0.1';
process.env.NITRO_PORT = process.env.NITRO_PORT || process.env.PORT || '3020';
await import('../.output/server/index.mjs');
