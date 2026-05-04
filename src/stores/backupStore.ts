import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const LS_KEY = 'menuPlanner.lastBackup';

/** Numero di giorni oltre i quali l'app mostra il reminder di backup. */
export const BACKUP_REMINDER_DAYS = 14;

export const useBackupStore = defineStore('backup', () => {
  // Timestamp (ms) dell'ultimo backup riuscito, o null se mai eseguito.
  // Persiste in localStorage (solo preferenza UI — ok per ARCHITECTURE.md).
  const lastBackupTimestamp = ref<number | null>(
    (() => {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? Number(stored) : null;
    })(),
  );

  /** Giorni interi trascorsi dall'ultimo backup, o null se mai eseguito. */
  const daysSinceLastBackup = computed<number | null>(() => {
    if (lastBackupTimestamp.value === null) return null;
    return Math.floor((Date.now() - lastBackupTimestamp.value) / (1000 * 60 * 60 * 24));
  });

  /**
   * true se non è mai stato fatto un backup o sono passati più di
   * BACKUP_REMINDER_DAYS giorni dall'ultimo.
   */
  const needsBackup = computed<boolean>(() => {
    if (lastBackupTimestamp.value === null) return true;
    return (daysSinceLastBackup.value ?? 0) > BACKUP_REMINDER_DAYS;
  });

  /** Registra il timestamp corrente come data dell'ultimo backup. */
  function recordBackup(): void {
    const now = Date.now();
    lastBackupTimestamp.value = now;
    localStorage.setItem(LS_KEY, String(now));
  }

  return { lastBackupTimestamp, daysSinceLastBackup, needsBackup, recordBackup };
});
