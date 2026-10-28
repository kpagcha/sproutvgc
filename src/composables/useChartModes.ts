import { shallowRef, watch, type ShallowRef } from 'vue'
import { offenseModeOf, type OffenseMode } from '@/lib/teamBalance'
import type { SpeedMode } from '@/lib/teamSpeed'

// The team builder's charts' choices, one for each wherever it's drawn (its panel, and the pinned slot's dock on
// phones): how the Offense chart measures attackers, and the side the Speed chart shows the team on. Remembered.
function stored<T extends string>(key: string, read: (saved: string | null) => T): ShallowRef<T> {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(key)
  } catch {
    // Storage unavailable: the default.
  }
  const choice = shallowRef<T>(read(saved)) as ShallowRef<T>
  watch(choice, (v) => {
    try {
      localStorage.setItem(key, v)
    } catch {
      // Storage unavailable: the choice lasts for this page load.
    }
  })
  return choice
}

const SPEED_MODES: readonly SpeedMode[] = ['none', 'tailwind', 'trickroom']
const offenseMode = stored<OffenseMode>('sproutvgc.builder.offenseMode', (s) => offenseModeOf(s) ?? 'stats')
const speedMode = stored<SpeedMode>('sproutvgc.builder.speedMode', (s) => SPEED_MODES.find((m) => m === s) ?? 'none')

export const useChartModes = () => ({ offenseMode, speedMode })
