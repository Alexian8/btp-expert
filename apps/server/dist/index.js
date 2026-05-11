"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// Entry point — lit la config, ouvre le pool MySQL, démarre Express.
// Utilisé en local (`npm run dev`). Sur cPanel/Passenger, c'est `app.js`
// qui est chargé (cf racine du dossier apps/server/).
// ═══════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
// Must run before any other import that loads Express/HTTP modules.
require("./instrument");
const config_1 = require("./config");
const app_1 = require("./app");
const db_1 = require("./db");
async function main() {
    const cfg = (0, config_1.loadConfig)();
    const { app, ctx } = await (0, app_1.createApp)(cfg);
    try {
        await (0, db_1.pingPool)(ctx.db);
        console.log(`✅ MySQL connection OK (${cfg.MYSQL_HOST}:${cfg.MYSQL_PORT}/${cfg.MYSQL_DATABASE})`);
    }
    catch (e) {
        console.error("❌ MySQL ping failed:", e instanceof Error ? e.message : e);
        process.exit(1);
    }
    const server = app.listen(cfg.PORT, () => {
        console.log(`✅ BatiDesk server listening on http://localhost:${cfg.PORT}`);
        console.log(`   env: ${cfg.NODE_ENV}`);
    });
    const shutdown = async (signal) => {
        console.log(`\n${signal} reçu, arrêt en cours…`);
        server.close(() => {
            ctx.db.end().finally(() => process.exit(0));
        });
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map