<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useSettimanaStore } from '../stores/settimanaStore';
import { weekIdToMonday } from '../domain/week';
import type { DayOfWeek, MealType } from '../domain/types';

const settimanaStore = useSettimanaStore();

// Tutti i pasti nel loro ordine cronologico naturale
const ALL_MEALS: { type: MealType; label: string }[] = [
  { type: 'colazione', label: 'Colazione' },
  { type: 'merenda_mattina', label: 'Merenda (mat.)' },
  { type: 'pranzo', label: 'Pranzo' },
  { type: 'merenda_pomeriggio', label: 'Merenda (pom.)' },
  { type: 'cena', label: 'Cena' },
];

const OPTIONAL_TYPES = new Set<MealType>(['colazione', 'merenda_mattina', 'merenda_pomeriggio']);

const visibleMeals = computed(() =>
  settimanaStore.showOptionalMeals
    ? ALL_MEALS
    : ALL_MEALS.filter((m) => !OPTIONAL_TYPES.has(m.type)),
);

const DAYS: { day: DayOfWeek; shortLabel: string }[] = [
  { day: 1, shortLabel: 'Lun' },
  { day: 2, shortLabel: 'Mar' },
  { day: 3, shortLabel: 'Mer' },
  { day: 4, shortLabel: 'Gio' },
  { day: 5, shortLabel: 'Ven' },
  { day: 6, shortLabel: 'Sab' },
  { day: 7, shortLabel: 'Dom' },
];

// Data (gg/mm) per ciascun giorno della settimana corrente
const dayHeaders = computed(() => {
  const monday = weekIdToMonday(settimanaStore.currentWeekId);
  return DAYS.map(({ day, shortLabel }) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + (day - 1));
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return { day, shortLabel, date: `${dd}/${mm}` };
  });
});

onMounted(() => settimanaStore.loadCurrentWeek());
</script>

<template>
  <div class="settimana-view">
    <!-- Navigazione settimane (label e pulsanti — label completa arriverà in T3.2) -->
    <div class="week-nav">
      <button
        class="nav-btn"
        aria-label="Settimana precedente"
        @click="settimanaStore.goToPrevWeek()"
      >
        &#8592;
      </button>
      <span class="week-label">{{ settimanaStore.currentWeekId }}</span>
      <button
        class="nav-btn"
        aria-label="Settimana successiva"
        @click="settimanaStore.goToNextWeek()"
      >
        &#8594;
      </button>
    </div>

    <!-- Toggle pasti opzionali -->
    <div class="toggle-bar">
      <label class="toggle-label">
        <input
          type="checkbox"
          :checked="settimanaStore.showOptionalMeals"
          @change="
            settimanaStore.setShowOptionalMeals(
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        Mostra colazione e merende
      </label>
    </div>

    <!-- Griglia settimanale -->
    <div class="grid-wrapper">
      <div
        class="week-grid"
        :style="{ gridTemplateColumns: `var(--meal-col-w) repeat(7, minmax(3.5rem, 1fr))` }"
      >
        <!-- Riga header: angolo vuoto + 7 intestazioni giorno -->
        <div class="cell cell--corner" aria-hidden="true"></div>
        <div
          v-for="dh in dayHeaders"
          :key="dh.day"
          class="cell cell--day-header"
        >
          <span class="day-name">{{ dh.shortLabel }}</span>
          <span class="day-date">{{ dh.date }}</span>
        </div>

        <!-- Righe pasti -->
        <template v-for="meal in visibleMeals" :key="meal.type">
          <div class="cell cell--meal-label">{{ meal.label }}</div>
          <div
            v-for="dh in dayHeaders"
            :key="dh.day"
            class="cell cell--slot"
            role="button"
            tabindex="0"
            :aria-label="`${meal.label} ${dh.shortLabel} ${dh.date}`"
          >
            <!-- Contenuto slot: verrà popolato in T3.3 / T3.4 -->
            <span class="empty-hint" aria-hidden="true">+</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Larghezza colonna etichetta pasto — modificabile facilmente */
.settimana-view {
  --meal-col-w: 6.5rem;
  padding: 0.5rem;
}

/* ── Navigazione ── */
.week-nav {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.nav-btn {
  min-width: 44px;
  min-height: 44px;
  font-size: 1.1rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.week-label {
  font-weight: 600;
  font-size: 0.95rem;
}

/* ── Toggle pasti opzionali ── */
.toggle-bar {
  margin-bottom: 0.75rem;
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
}

/* ── Griglia ── */
.grid-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.week-grid {
  display: grid;
  gap: 2px;
  /* min-width evita che la griglia collassi troppo su schermi stretti */
  min-width: 32rem;
}

/* Celle base */
.cell {
  padding: 5px 4px;
  font-size: 0.82rem;
}

/* Angolo top-left vuoto */
.cell--corner {
  /* intenzionalmente vuoto */
}

/* Intestazioni giorno */
.cell--day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-weight: 700;
  text-align: center;
  padding: 4px 2px;
}

.day-name {
  font-size: 0.82rem;
}

.day-date {
  font-size: 0.72rem;
  color: #666;
}

/* Etichetta pasto (colonna sinistra) */
.cell--meal-label {
  font-weight: 600;
  font-size: 0.8rem;
  color: #444;
  display: flex;
  align-items: center;
  padding-right: 0.25rem;
}

/* Celle slot pasto */
.cell--slot {
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 52px;
  cursor: pointer;
  background: #fafafa;
  word-break: break-word;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell--slot:hover,
.cell--slot:focus-visible {
  background: #eef2ff;
  border-color: #99aadd;
  outline: none;
}

.empty-hint {
  color: #bbb;
  font-size: 1.2rem;
  line-height: 1;
}
</style>
