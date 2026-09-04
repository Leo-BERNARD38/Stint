import { fmtDateInput } from "../utils/datetime.js";

/**
 * Import / export (§6.9). JSON = format maître (sans perte) ; CSV = 1 ligne
 * par segment pour analyse tableur (export seulement).
 */
export class DataTransfer {
  /** Télécharge l'état complet au format JSON. */
  static exportJSON(store) {
    const content = JSON.stringify(store.toJSON(), null, 2);
    DataTransfer.download(content, "stint-" + fmtDateInput(new Date()) + ".json", "application/json");
  }

  /** Lit un fichier JSON et renvoie l'objet brut (rejette si invalide). */
  static readJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || typeof parsed !== "object") throw new Error("format");
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /** Exporte un CSV des segments (durées calculées via `calc`/`formatter`). */
  static exportCSV(store, calc, formatter) {
    // `kind` = task | off : un vide justifié (hors tâche) a le motif pour nom,
    // « hors » pour type, ni tâche ni Jira — la colonne permet un filtre tableur
    // sans ambiguïté.
    const header = [
      "segment_id", "task_id", "task_name", "type",
      "start", "end", "raw", "worked_minutes", "decimal_hours", "jira", "kind",
    ];
    const rows = [header];
    const sorted = [...store.segments].sort((a, b) => a.startMs() - b.startMs());
    for (const seg of sorted) {
      const t = seg.isOff ? null : store.taskById(seg.taskId);
      const minutes = calc.segmentMs(seg) / 60000;
      rows.push([
        seg.id, seg.taskId ?? "", seg.isOff ? seg.reason : (t?.name ?? ""), seg.isOff ? "hors" : (t?.type ?? ""),
        seg.start, seg.end ?? "", seg.raw ? "true" : "false",
        Math.round(minutes), formatter.decimal(minutes), seg.isOff ? "" : formatter.jira(minutes),
        seg.isOff ? "off" : "task",
      ]);
    }
    const csv = rows.map((r) => r.map(DataTransfer.#cell).join(",")).join("\n");
    DataTransfer.download(csv, "stint-segments-" + fmtDateInput(new Date()) + ".csv", "text/csv");
  }

  static #cell(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  static download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
