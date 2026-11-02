import type { Component } from 'vue'
import {
  BookOpen,
  Calculator,
  ChartColumn,
  ChartColumnBig,
  GraduationCap,
  Grid3x3,
  Scale,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Wrench,
} from '@lucide/vue'
import type { AreaId } from '@/lib/areas'

// Each area's icon, and each of its sections', by its key: the home page's cards and the phones' drawer share them.

export const AREA_ICONS: Record<AreaId, Component> = {
  meta: TrendingUp,
  tools: Wrench,
  quizzes: GraduationCap,
  dex: BookOpen,
}

export const SECTION_ICONS: Record<string, Component> = {
  rankings: ChartColumn,
  tournaments: Trophy,
  speedTiers: ChartColumnBig,
  // For now the speed tiers' own, until picked.
  bulkTiers: ChartColumnBig,
  powerTiers: ChartColumnBig,
  speedCompare: Scale,
  calc: Calculator,
  teamBuilder: Users,
  matchups: Swords,
  chart: Grid3x3,
}
