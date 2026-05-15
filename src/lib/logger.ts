/**
 * Logger structuré (façade JSON minimale, compatible Vercel Logs).
 *
 * En dev : console pretty-print
 * En prod : JSON serialisé (lisible par Datadog / Logtail / Vercel Drains)
 *
 * Niveaux : debug | info | warn | error
 *
 * Usage :
 *   logger.info("ticket.assigned", { ticketId, assignedTo });
 *   logger.error("push.send_failed", { code: 410, endpoint });
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) ?? "info";
const IS_PROD = process.env.NODE_ENV === "production";

function emit(level: Level, msg: string, context?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[MIN_LEVEL]) return;

  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(context ?? {}),
  };

  // Vercel runtime : JSON sur stdout. Pretty en dev.
  if (IS_PROD) {
    // Évite les références circulaires
    try {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(record));
    } catch {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ts: record.ts, level, msg: msg, ctx_error: "serialize_failed" }));
    }
  } else {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${level.toUpperCase()}] ${msg}`, context ?? "");
  }
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info:  (msg: string, ctx?: Record<string, unknown>) => emit("info",  msg, ctx),
  warn:  (msg: string, ctx?: Record<string, unknown>) => emit("warn",  msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => emit("error", msg, ctx),
  /** Wrap une fonction async pour logger automatiquement durée et erreurs */
  async timed<T>(name: string, fn: () => Promise<T>, ctx?: Record<string, unknown>): Promise<T> {
    const start = Date.now();
    try {
      const r = await fn();
      emit("info", name, { ...ctx, duration_ms: Date.now() - start });
      return r;
    } catch (e) {
      emit("error", name, {
        ...ctx,
        duration_ms: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  },
};
