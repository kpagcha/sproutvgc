<script setup lang="ts">
// Dev-only section of the settings page: the font lab and a preview. Only loaded when import.meta.env.DEV is true.
import { onMounted } from 'vue'
import {
  BODY_FONTS,
  DISPLAY_FONTS,
  DISPLAY_SCALES,
  NUM_FONTS,
  loadAll,
  picks,
  resetPicks,
  type FontOption,
} from '@/dev/fonts'
import { MULTIPLIERS, formatMult, multClass } from '@/lib/typecalc'
import TypeIcon from '@/components/TypeIcon'
import { STYLES, useStyle, type Style } from '@/composables/useStyle'
import DevZone from '@/dev/DevZone.vue'

const { style, setStyle } = useStyle()

const STYLE_INFO: Record<Style, { label: string; note: string }> = {
  retro: { label: 'Retro', note: 'Square corners, ink outlines and hard shadows, with flat type badges. The default.' },
  pixel: { label: 'Pixel', note: 'Softer panels with the classic pixel-art type sprites.' },
}

const GROUPS: { key: 'display' | 'body' | 'num'; title: string; hint: string; options: FontOption[] }[] = [
  { key: 'display', title: 'Display', hint: 'Logo, headings, nav, tabs.', options: DISPLAY_FONTS },
  { key: 'body', title: 'Body', hint: 'Everything else.', options: BODY_FONTS },
  { key: 'num', title: 'Numbers', hint: 'Multipliers, quiz, stats.', options: NUM_FONTS },
]

const SAMPLE_EN = 'Which attacking types are super effective against Water/Ground? Grass is 4×, Electric has no effect.'
const SAMPLE_ES =
  '¿Qué tipos atacantes son súper eficaces contra Eléctrico? Tierra: 2×. Psíquico, Dragón, Siniestro: ½×.'
const DIGITS = '0123456789 ½ ¼ × → ↓'

onMounted(loadAll)
</script>

<template>
  <!-- Fenced off from the public settings above. -->
  <DevZone class="zone">
    <p class="muted intro">
      Only shown in <code>npm run dev</code>. Style and font picks apply across the whole app and are saved in this
      browser, so you can browse the real pages with them. Production builds always use the retro style.
    </p>

    <div class="panel">
      <h2>Style</h2>
      <div class="styles">
        <label v-for="s in STYLES" :key="s" class="opt" :class="{ on: style === s }">
          <input type="radio" name="style" :value="s" :checked="style === s" @change="setStyle(s)" />
          <span class="opt-text">
            <span class="opt-name">{{ STYLE_INFO[s].label }}</span>
            <span class="muted small">{{ STYLE_INFO[s].note }}</span>
          </span>
        </label>
      </div>
    </div>

    <div class="panel">
      <div class="head">
        <h2>Fonts</h2>
        <div class="controls">
          <label>
            Display scale
            <select v-model.number="picks.displayScale">
              <option v-for="s in DISPLAY_SCALES" :key="s" :value="s">{{ s * 100 }}%</option>
            </select>
          </label>
          <button type="button" class="btn" @click="resetPicks">Reset</button>
        </div>
      </div>

      <div class="groups">
        <fieldset v-for="g in GROUPS" :key="g.key">
          <legend>
            <b>{{ g.title }}</b> <span class="muted">{{ g.hint }}</span>
          </legend>
          <label v-for="f in g.options" :key="f.id" class="opt" :class="{ on: picks[g.key] === f.id }">
            <input v-model="picks[g.key]" type="radio" :name="g.key" :value="f.id" />
            <span class="opt-text">
              <span class="opt-name" :style="{ fontFamily: f.stack || undefined }">{{ f.label }}</span>
              <span class="muted small">{{ f.note }}</span>
            </span>
          </label>
        </fieldset>
      </div>
    </div>

    <div class="panel">
      <h2>Preview</h2>
      <h1>mondex · Type matchups</h1>
      <nav class="tabs">
        <a class="active">Defense</a>
        <a>Offense / coverage</a>
      </nav>
      <p>{{ SAMPLE_EN }}</p>
      <p>{{ SAMPLE_ES }}</p>
      <p class="num big">{{ DIGITS }}</p>
      <div class="mults">
        <span v-for="m in MULTIPLIERS" :key="m" class="mult-tag" :class="multClass(m)">{{ formatMult(m) }}</span>
      </div>
      <table class="mini">
        <tbody>
          <tr>
            <th><TypeIcon type="ground" /></th>
            <td class="num m-2">2</td>
            <td class="num m-0_5">½</td>
            <td class="num m-0">0</td>
            <td class="num"></td>
            <td class="num m-2">2</td>
          </tr>
        </tbody>
      </table>
      <div class="answers">
        <button v-for="m in MULTIPLIERS" :key="m" type="button" class="btn num ans">{{ formatMult(m) }}</button>
      </div>
    </div>
  </DevZone>
</template>

<style scoped>
code {
  font-size: 12px;
}
.small {
  font-size: 11px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.head h2 {
  margin: 0;
}
.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
select {
  font: inherit;
  color: inherit;
  background: var(--panel-alt);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 2px 4px;
}

.zone {
  margin-top: 36px;
}
.intro {
  margin: 0 0 12px;
}

.styles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 4px 12px;
}
.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
fieldset {
  margin: 0;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  min-width: 0;
}
legend {
  padding: 0 4px;
}
.opt {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 3px;
  cursor: pointer;
}
.opt:hover {
  background: var(--hover);
}
.opt.on {
  background: var(--sel);
}
.opt input {
  margin-top: 3px;
}
.opt-text {
  display: flex;
  flex-direction: column;
}
.opt-name {
  font-size: 15px;
}

.big {
  font-size: 16px;
}
.mults,
.answers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;
}
.ans {
  min-width: 52px;
  min-height: 36px;
  font-size: 15px;
  font-weight: bold;
}
.mini {
  border-collapse: collapse;
  font-weight: bold;
  margin: 8px 0;
}
.mini th,
.mini td {
  border: 1px solid var(--border);
  text-align: center;
  padding: 2px 4px;
}
.mini td {
  width: 36px;
  height: 24px;
}
</style>
