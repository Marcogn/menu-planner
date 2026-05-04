/**
 * Test src/storage/backup.ts
 *
 * Usa fake-indexeddb per simulare IndexedDB senza browser reale.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportAll,
  importAll,
  BackupImportError,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
} from '../backup';
import { appDb } from '../db';
import { createElement, getAllElements } from '../elements';
import { addDishToSlot, getWeek } from '../weeks';
import { v4 as uuidv4 } from 'uuid';

beforeEach(async () => {
  await appDb.elements.clear();
  await appDb.weeks.clear();
});

// ---- Helpers ----

async function parseBlob(blob: Blob): Promise<BackupData> {
  const text = await blob.text();
  return JSON.parse(text) as BackupData;
}

function makeValidBackup(overrides: Partial<BackupData> = {}): BackupData {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    elements: [],
    weeks: [],
    ...overrides,
  };
}

function makeFile(content: string, name = 'backup.json'): File {
  return new File([content], name, { type: 'application/json' });
}

// ---- Test exportAll ----

describe('exportAll', () => {
  it('ritorna un Blob di tipo application/json', async () => {
    const blob = await exportAll();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
  });

  it('il JSON contiene i campi obbligatori del formato backup', async () => {
    const data = await parseBlob(await exportAll());
    expect(data.format).toBe(BACKUP_FORMAT);
    expect(data.version).toBe(BACKUP_VERSION);
    expect(typeof data.exportedAt).toBe('string');
    expect(Array.isArray(data.elements)).toBe(true);
    expect(Array.isArray(data.weeks)).toBe(true);
  });

  it('exportedAt è una data ISO 8601 valida', async () => {
    const data = await parseBlob(await exportAll());
    const d = new Date(data.exportedAt);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('DB vuoto → elements e weeks sono array vuoti', async () => {
    const data = await parseBlob(await exportAll());
    expect(data.elements).toEqual([]);
    expect(data.weeks).toEqual([]);
  });

  it('esporta gli Elementi presenti nel DB', async () => {
    const el1 = await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const el2 = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const data = await parseBlob(await exportAll());
    expect(data.elements).toHaveLength(2);
    const ids = data.elements.map((e) => e.id);
    expect(ids).toContain(el1.id);
    expect(ids).toContain(el2.id);
  });

  it('esporta le Settimane presenti nel DB', async () => {
    const dish = { id: uuidv4(), name: 'pasta al pomodoro', elementIds: [] };
    await addDishToSlot('2026-W19', 1, 'pranzo', dish);
    const data = await parseBlob(await exportAll());
    expect(data.weeks).toHaveLength(1);
    expect(data.weeks[0].id).toBe('2026-W19');
  });

  it('esporta elementi e settimane insieme con integrità', async () => {
    const el = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const dish = { id: uuidv4(), name: 'bistecca', elementIds: [el.id] };
    await addDishToSlot('2026-W19', 2, 'cena', dish);

    const data = await parseBlob(await exportAll());
    expect(data.elements).toHaveLength(1);
    expect(data.weeks).toHaveLength(1);

    const exportedEl = data.elements[0];
    expect(exportedEl.name).toBe('carne rossa');
    expect(exportedEl.maxFrequencyPerWeek).toBe(2);

    const exportedWeek = data.weeks[0];
    const slot = exportedWeek.slots.find((s) => s.day === 2 && s.meal === 'cena');
    expect(slot).toBeDefined();
    expect(slot?.dishes[0].elementIds).toContain(el.id);
  });
});

// ---- Test importAll ----

describe('importAll', () => {
  it('importa un backup valido e popola il DB', async () => {
    const backup = makeValidBackup({
      elements: [
        { id: 'el-1', name: 'formaggio', maxFrequencyPerWeek: 2, createdAt: 1000, updatedAt: 1000 },
      ],
      weeks: [
        {
          id: '2026-W19',
          isoWeekStart: '2026-05-04',
          slots: [{ day: 1, meal: 'pranzo', dishes: [{ id: 'd-1', name: 'pasta', elementIds: ['el-1'] }] }],
          updatedAt: 2000,
        },
      ],
    });
    await importAll(makeFile(JSON.stringify(backup)));
    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('formaggio');
    const week = await getWeek('2026-W19');
    expect(week).toBeDefined();
    expect(week?.slots[0].dishes[0].name).toBe('pasta');
  });

  it('sovrascrive i dati esistenti nel DB', async () => {
    await createElement({ name: 'vecchio', maxFrequencyPerWeek: 1 });
    const backup = makeValidBackup({
      elements: [
        { id: 'el-new', name: 'nuovo', maxFrequencyPerWeek: 3, createdAt: 1000, updatedAt: 1000 },
      ],
    });
    await importAll(makeFile(JSON.stringify(backup)));
    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('nuovo');
  });

  it('DB vuoto dopo import di backup senza dati', async () => {
    await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const backup = makeValidBackup({ elements: [], weeks: [] });
    await importAll(makeFile(JSON.stringify(backup)));
    const elements = await getAllElements();
    expect(elements).toHaveLength(0);
  });

  it('lancia BackupImportError per JSON malformato', async () => {
    await expect(importAll(makeFile('{ non è json }'))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile('{ non è json }'))).rejects.toThrow(/JSON valido/);
  });

  it('lancia BackupImportError per formato sconosciuto', async () => {
    const bad = makeValidBackup({ format: 'altro-app' as typeof BACKUP_FORMAT });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(/Formato/i);
  });

  it('lancia BackupImportError per versione non supportata', async () => {
    const bad = { ...makeValidBackup(), version: 99 };
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(/versione/i);
  });

  it('lancia BackupImportError per schema non valido (elemento senza nome)', async () => {
    const bad = makeValidBackup({
      elements: [{ id: 'x', name: '', maxFrequencyPerWeek: 1, createdAt: 0, updatedAt: 0 }],
    });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(/Schema/i);
  });

  it('lancia BackupImportError per schema non valido (campo mancante)', async () => {
    // settimana senza isoWeekStart
    const bad = makeValidBackup({
      weeks: [{ id: '2026-W19', slots: [], updatedAt: 0 } as unknown as BackupData['weeks'][0]],
    });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
  });

  it('non modifica il DB in caso di errore di validazione', async () => {
    await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const bad = makeValidBackup({
      elements: [{ id: 'x', name: '', maxFrequencyPerWeek: 1, createdAt: 0, updatedAt: 0 }],
    });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    // Il record originale deve ancora esserci (errore prima della transazione)
    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('formaggio');
  });

  it('round-trip: export poi import ripristina i dati', async () => {
    const el = await createElement({ name: 'pesce', maxFrequencyPerWeek: 3 });
    const dish = { id: uuidv4(), name: 'salmone', elementIds: [el.id] };
    await addDishToSlot('2026-W20', 3, 'cena', dish);

    const blob = await exportAll();
    const text = await blob.text();
    const file = makeFile(text, 'backup.json');

    // Svuota e reimporta
    await appDb.elements.clear();
    await appDb.weeks.clear();
    await importAll(file);

    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('pesce');
    const week = await getWeek('2026-W20');
    expect(week?.slots[0].dishes[0].name).toBe('salmone');
  });
});
