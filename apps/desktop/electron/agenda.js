// ═══════════════════════════════════════════════════════════════════════════
// agenda.js — Module Agenda (Session 12)
//
// Gère :
//   - CRUD des événements (vault_events)
//   - Sync Microsoft Outlook (push + pull) via Graph API
//   - Hooks auto-création depuis chantiers et devis envoyés
//   - 14 handlers IPC
// ═══════════════════════════════════════════════════════════════════════════

const { ipcMain } = require("electron");
const axios = require("axios");

// ─── Utilitaires ─────────────────────────────────────────────────────────
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso() { return new Date().toISOString(); }

function rowToEvent(row) {
  if (!row) return null;
  return {
    ...row,
    allDay: !!row.allDay,
    syncToOutlook: !!row.syncToOutlook,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Initialisation du module
// ═══════════════════════════════════════════════════════════════════════════
function init({ db, msAuth }) {

  // ─── Helper : Push événement vers Outlook ───────────────────────────
  async function pushToOutlook(event) {
    try {
      const account = await msAuth.getAccount();
      if (!account) {
        return { success: false, error: "Non connecté à Microsoft" };
      }
      const token = await msAuth.getAccessToken();
      if (!token) return { success: false, error: "Token Microsoft indisponible" };

      const eventBody = {
        subject: event.title || "Sans titre",
        body: {
          contentType: "Text",
          content: event.description || "",
        },
        start: event.allDay
          ? { dateTime: event.startAt.slice(0, 10) + "T00:00:00", timeZone: "Europe/Paris" }
          : { dateTime: event.startAt.replace("Z", ""), timeZone: "Europe/Paris" },
        end: event.allDay
          ? { dateTime: event.endAt.slice(0, 10) + "T00:00:00", timeZone: "Europe/Paris" }
          : { dateTime: event.endAt.replace("Z", ""), timeZone: "Europe/Paris" },
        isAllDay: !!event.allDay,
        location: event.location ? { displayName: event.location } : undefined,
        categories: ["BatiDesk"],
      };

      let response;
      if (event.outlookEventId) {
        // Update
        response = await axios.patch(
          `https://graph.microsoft.com/v1.0/me/events/${event.outlookEventId}`,
          eventBody,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
      } else {
        // Create
        response = await axios.post(
          "https://graph.microsoft.com/v1.0/me/events",
          eventBody,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
      }
      const outlookId = response.data?.id || event.outlookEventId;
      return { success: true, outlookEventId: outlookId };
    } catch (e) {
      console.error("[agenda:pushToOutlook]", e.response?.data?.error?.message || e.message);
      return { success: false, error: e.response?.data?.error?.message || e.message };
    }
  }

  async function deleteFromOutlook(outlookEventId) {
    try {
      const token = await msAuth.getAccessToken();
      if (!token) return { success: false };
      await axios.delete(
        `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { success: true };
    } catch (e) {
      // 404 = déjà supprimé, on considère que c'est ok
      if (e.response?.status === 404) return { success: true };
      console.warn("[agenda:deleteFromOutlook]", e.message);
      return { success: false, error: e.message };
    }
  }

  // ─── Helper : Sync auto si activé ──────────────────────────────────
  async function syncEventIfNeeded(eventId) {
    const event = db.prepare("SELECT * FROM agenda_events WHERE id = ?").get(eventId);
    if (!event || !event.syncToOutlook) return;
    const r = await pushToOutlook(event);
    if (r.success && r.outlookEventId) {
      db.prepare(`
        UPDATE agenda_events
        SET outlookEventId = ?, outlookLastSyncAt = ?
        WHERE id = ?
      `).run(r.outlookEventId, nowIso(), eventId);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // HANDLERS IPC
  // ═════════════════════════════════════════════════════════════════════════

  ipcMain.handle("agenda:list", (_e, { rangeStart, rangeEnd } = {}) => {
    try {
      let sql = "SELECT * FROM agenda_events WHERE 1=1";
      const params = [];
      if (rangeStart) {
        sql += " AND endAt >= ?";
        params.push(rangeStart);
      }
      if (rangeEnd) {
        sql += " AND startAt <= ?";
        params.push(rangeEnd);
      }
      sql += " ORDER BY startAt ASC";
      const rows = db.prepare(sql).all(...params);
      return rows.map(rowToEvent);
    } catch (e) {
      console.error("[agenda:list]", e);
      return [];
    }
  });

  ipcMain.handle("agenda:getById", (_e, id) => {
    try {
      const row = db.prepare("SELECT * FROM agenda_events WHERE id = ?").get(id);
      return rowToEvent(row);
    } catch {
      return null;
    }
  });

  ipcMain.handle("agenda:create", async (_e, data) => {
    try {
      const id = generateId("evt");
      const now = nowIso();
      db.prepare(`
        INSERT INTO agenda_events (
          id, title, description, type, startAt, endAt, allDay,
          clientId, chantierId, quoteId, invoiceId,
          location, colorOverride,
          syncToOutlook, outlookEventId, outlookLastSyncAt,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)
      `).run(
        id,
        data.title || "",
        data.description || "",
        data.type || "rdv",
        data.startAt,
        data.endAt,
        data.allDay ? 1 : 0,
        data.clientId || "",
        data.chantierId || "",
        data.quoteId || "",
        data.invoiceId || "",
        data.location || "",
        data.colorOverride || "",
        data.syncToOutlook ? 1 : 0,
        now,
        now
      );

      // Sync Outlook si demandé (non-bloquant, ne fait pas planter la création)
      if (data.syncToOutlook) {
        syncEventIfNeeded(id).catch((e) => console.warn("[agenda] sync push échoué:", e.message));
      }

      return { success: true, id };
    } catch (e) {
      console.error("[agenda:create]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agenda:update", async (_e, { id, data }) => {
    try {
      const existing = db.prepare("SELECT * FROM agenda_events WHERE id = ?").get(id);
      if (!existing) return { success: false, error: "Événement introuvable" };

      const allowedKeys = [
        "title", "description", "type", "startAt", "endAt", "allDay",
        "clientId", "chantierId", "quoteId", "invoiceId",
        "location", "colorOverride", "syncToOutlook",
      ];
      const keys = Object.keys(data).filter(k => allowedKeys.includes(k));
      const sets = keys.map(k => `${k} = @${k}`).join(", ");
      const payload = { id, updatedAt: nowIso() };
      for (const k of keys) {
        payload[k] = (k === "allDay" || k === "syncToOutlook")
          ? (data[k] ? 1 : 0)
          : (data[k] !== undefined ? data[k] : "");
      }
      db.prepare(`UPDATE agenda_events SET ${sets}, updatedAt = @updatedAt WHERE id = @id`).run(payload);

      // Sync Outlook si activé
      const updated = db.prepare("SELECT * FROM agenda_events WHERE id = ?").get(id);
      if (updated.syncToOutlook) {
        syncEventIfNeeded(id).catch((e) => console.warn("[agenda] sync push échoué:", e.message));
      } else if (existing.outlookEventId) {
        // Si on a désactivé la sync ET qu'il y avait un event sur Outlook, on le supprime
        deleteFromOutlook(existing.outlookEventId).catch(() => {});
        db.prepare("UPDATE agenda_events SET outlookEventId = '', outlookLastSyncAt = '' WHERE id = ?").run(id);
      }

      return { success: true };
    } catch (e) {
      console.error("[agenda:update]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agenda:delete", async (_e, id) => {
    try {
      const existing = db.prepare("SELECT * FROM agenda_events WHERE id = ?").get(id);
      if (existing?.outlookEventId) {
        deleteFromOutlook(existing.outlookEventId).catch(() => {});
      }
      db.prepare("DELETE FROM agenda_events WHERE id = ?").run(id);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Sync Outlook ──────────────────────────────────────────────────────
  ipcMain.handle("agenda:syncAllToOutlook", async () => {
    try {
      const account = await msAuth.getAccount();
      if (!account) {
        return { success: false, needsLogin: true, error: "Connectez-vous à Microsoft d'abord" };
      }
      const events = db.prepare("SELECT * FROM agenda_events WHERE syncToOutlook = 1").all();
      let pushed = 0, failed = 0;
      for (const event of events) {
        const r = await pushToOutlook(event);
        if (r.success && r.outlookEventId) {
          db.prepare(`
            UPDATE agenda_events
            SET outlookEventId = ?, outlookLastSyncAt = ?
            WHERE id = ?
          `).run(r.outlookEventId, nowIso(), event.id);
          pushed++;
        } else {
          failed++;
        }
      }
      return { success: true, pushed, failed, total: events.length };
    } catch (e) {
      console.error("[agenda:syncAllToOutlook]", e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agenda:syncOne", async (_e, eventId) => {
    try {
      const event = db.prepare("SELECT * FROM agenda_events WHERE id = ?").get(eventId);
      if (!event) return { success: false, error: "Événement introuvable" };
      const r = await pushToOutlook(event);
      if (r.success && r.outlookEventId) {
        db.prepare(`
          UPDATE agenda_events
          SET outlookEventId = ?, outlookLastSyncAt = ?, syncToOutlook = 1
          WHERE id = ?
        `).run(r.outlookEventId, nowIso(), eventId);
        return { success: true };
      }
      return { success: false, error: r.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ─── Stats ─────────────────────────────────────────────────────────────
  ipcMain.handle("agenda:getStats", () => {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Début de la semaine (lundi)
      const dayOfWeek = now.getDay() || 7; // dim = 7
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek - 1));
      const mondayStr = monday.toISOString().slice(0, 10);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const sundayStr = sunday.toISOString().slice(0, 10);

      const totalEvents = db.prepare("SELECT COUNT(*) as n FROM agenda_events").get().n;
      const todayCount = db.prepare(`
        SELECT COUNT(*) as n FROM agenda_events
        WHERE substr(startAt, 1, 10) <= ? AND substr(endAt, 1, 10) >= ?
      `).get(today, today).n;
      const thisWeekCount = db.prepare(`
        SELECT COUNT(*) as n FROM agenda_events
        WHERE substr(startAt, 1, 10) <= ? AND substr(endAt, 1, 10) >= ?
      `).get(sundayStr, mondayStr).n;
      const upcomingNext7Days = db.prepare(`
        SELECT COUNT(*) as n FROM agenda_events
        WHERE substr(startAt, 1, 10) >= ? AND substr(startAt, 1, 10) <= ?
      `).get(tomorrow, in7days).n;

      return { totalEvents, todayCount, thisWeekCount, upcomingNext7Days };
    } catch {
      return { totalEvents: 0, todayCount: 0, thisWeekCount: 0, upcomingNext7Days: 0 };
    }
  });

  ipcMain.handle("agenda:listToday", () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const rows = db.prepare(`
        SELECT * FROM agenda_events
        WHERE substr(startAt, 1, 10) <= ? AND substr(endAt, 1, 10) >= ?
        ORDER BY startAt ASC
      `).all(today, today);
      return rows.map(rowToEvent);
    } catch {
      return [];
    }
  });

  ipcMain.handle("agenda:listUpcoming", (_e, days = 7) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const limit = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const rows = db.prepare(`
        SELECT * FROM agenda_events
        WHERE substr(startAt, 1, 10) >= ? AND substr(startAt, 1, 10) <= ?
        ORDER BY startAt ASC
        LIMIT 20
      `).all(today, limit);
      return rows.map(rowToEvent);
    } catch {
      return [];
    }
  });

  ipcMain.handle("agenda:listByClient", (_e, clientId) => {
    try {
      const rows = db.prepare(`
        SELECT * FROM agenda_events WHERE clientId = ? ORDER BY startAt DESC
      `).all(clientId);
      return rows.map(rowToEvent);
    } catch {
      return [];
    }
  });

  ipcMain.handle("agenda:listByChantier", (_e, chantierId) => {
    try {
      const rows = db.prepare(`
        SELECT * FROM agenda_events WHERE chantierId = ? ORDER BY startAt DESC
      `).all(chantierId);
      return rows.map(rowToEvent);
    } catch {
      return [];
    }
  });

  // ─── Hook : auto-création événement chantier ─────────────────────────
  ipcMain.handle("agenda:ensureChantierEvent", async (_e, { chantierId, title, dateStart, dateEnd, clientId, syncToOutlook }) => {
    try {
      // Existe déjà ?
      const existing = db.prepare(`
        SELECT id FROM agenda_events
        WHERE chantierId = ? AND type = 'chantier' AND quoteId = '' AND invoiceId = ''
      `).get(chantierId);
      if (existing) return { success: true, id: existing.id, alreadyExists: true };

      // Sinon, créer
      const id = generateId("evt");
      const now = nowIso();
      const startISO = dateStart ? new Date(dateStart).toISOString() : now;
      const endISO = dateEnd ? new Date(dateEnd).toISOString() : startISO;
      db.prepare(`
        INSERT INTO agenda_events (
          id, title, description, type, startAt, endAt, allDay,
          clientId, chantierId, quoteId, invoiceId,
          location, colorOverride,
          syncToOutlook, outlookEventId, outlookLastSyncAt,
          createdAt, updatedAt
        ) VALUES (?, ?, '', 'chantier', ?, ?, 1, ?, ?, '', '', '', '', ?, '', '', ?, ?)
      `).run(
        id, title || "Chantier", startISO, endISO, clientId || "", chantierId,
        syncToOutlook ? 1 : 0, now, now
      );

      if (syncToOutlook) {
        syncEventIfNeeded(id).catch(() => {});
      }
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle("agenda:ensureSignatureEvent", async (_e, { quoteId, title, dateStart, clientId, chantierId, syncToOutlook }) => {
    try {
      const existing = db.prepare(`
        SELECT id FROM agenda_events WHERE quoteId = ? AND type = 'signature'
      `).get(quoteId);
      if (existing) return { success: true, id: existing.id, alreadyExists: true };

      const id = generateId("evt");
      const now = nowIso();
      const startISO = dateStart ? new Date(dateStart).toISOString() : now;
      const endISO = new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
      db.prepare(`
        INSERT INTO agenda_events (
          id, title, description, type, startAt, endAt, allDay,
          clientId, chantierId, quoteId, invoiceId,
          location, colorOverride,
          syncToOutlook, outlookEventId, outlookLastSyncAt,
          createdAt, updatedAt
        ) VALUES (?, ?, '', 'signature', ?, ?, 0, ?, ?, ?, '', '', '', ?, '', '', ?, ?)
      `).run(
        id, title || "Signature devis", startISO, endISO,
        clientId || "", chantierId || "", quoteId,
        syncToOutlook ? 1 : 0, now, now
      );

      if (syncToOutlook) {
        syncEventIfNeeded(id).catch(() => {});
      }
      return { success: true, id };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log("[agenda] Module initialisé");
}

module.exports = { init };
