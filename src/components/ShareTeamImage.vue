<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useElementSize, useWindowSize } from '@vueuse/core'
import { Check, Copy, Download, ImageDown, Share2, X } from '@lucide/vue'
import type { Slot } from '@/data/tournaments'
import { t } from '@/i18n'
import type { Points } from '@/lib/team'
import ModalDialog from '@/components/ModalDialog.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import TeamShareCard from '@/components/TeamShareCard.vue'

// A team's button sharing it as an image: a dialog over the page with the image as it'll be (`TeamShareCard`, scaled
// to fit), across or standing (the one that fits the screen better picked at first: standing on a phone held upright),
// and the ways out: the device's share sheet where it takes files, a download, a copy to the clipboard where it takes
// images. Drawn from the card in the page (`modern-screenshot`, loaded on first use), at twice its size. The team
// builder's (its stat points too) and a tournament team's, beside their paste.
const props = defineProps<{
  team: Slot[]
  points?: readonly (Points | null)[]
  title?: string
  subtitle?: string
  /** The file's name, without its extension. */
  file?: string
  /** No button of its own: opened from elsewhere (`show`, the team builder's Share menu). */
  noButton?: boolean
}>()

type Layout = 'horizontal' | 'vertical'
const open = ref(false)
const layout = ref<Layout>('horizontal')
const layouts = computed(() => [
  { value: 'horizontal' as const, label: t('share.horizontal') },
  { value: 'vertical' as const, label: t('share.vertical') },
])
function show() {
  layout.value = window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches ? 'vertical' : 'horizontal'
  status.value = null
  open.value = true
}
defineExpose({ show })

// The card at its own size, scaled down to the preview's width.
const frame = useTemplateRef<HTMLElement>('frame')
const card = useTemplateRef<InstanceType<typeof TeamShareCard>>('card')
const { width: frameW } = useElementSize(frame)
const cardSize = ref({ w: 1, h: 1 })
let ro: ResizeObserver | undefined
watch(
  () => card.value?.$el as HTMLElement | undefined,
  (el) => {
    ro?.disconnect()
    if (!el) return
    ro = new ResizeObserver(() => (cardSize.value = { w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
  },
)
onBeforeUnmount(() => ro?.disconnect())
// As wide as the preview and no taller than half the screen, so the dialog needn't scroll: scrolling, its scrollbar
// would narrow the preview, shrinking it, the scrollbar then going, and round again, the dialog jumping.
const { height: winH } = useWindowSize()
const scale = computed(() => Math.min(1, frameW.value / cardSize.value.w, (winH.value * 0.55) / cardSize.value.h))

// The image, drawn again for each way out (the theme or the layout may have changed since).
const canShare = typeof navigator !== 'undefined' && 'canShare' in navigator
const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write
const busy = ref(false)
const status = shallowRef<'copied' | 'saved' | 'failed' | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
// What went well is said a moment; a failure stays, in the bad color, until the next try.
function say(s: typeof status.value) {
  status.value = s
  clearTimeout(timer)
  if (s !== 'failed') timer = setTimeout(() => (status.value = null), 2000)
}
function fail(e: unknown) {
  console.error('[share image]', e)
  say('failed')
}
onBeforeUnmount(() => clearTimeout(timer))

/** Firefox and Safari can draw the image before the pictures in it are decoded: drawn again a few times, a moment
 * apart. The library does that itself, but once per picture, each wait longer than the last: some 8 seconds for a
 * team's sixty (sprites, item icons, type badges). */
const REDRAWS = 3
const REDRAW_MS = 100
const redraws = typeof navigator !== 'undefined' && !navigator.userAgent.includes('Chrome')
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function draw(): Promise<Blob | null> {
  await nextTick()
  const el = card.value?.$el as HTMLElement | undefined
  if (!el) return null
  const { domToBlob, domToForeignObjectSvg } = await import('modern-screenshot')
  await document.fonts.ready
  const options = {
    // Its own size, not as the preview shows it (scaled down, which the library would otherwise measure).
    width: el.offsetWidth,
    height: el.offsetHeight,
    scale: 2,
    // No fonts embedded: the card's are the system's, and fetching the page's web fonts (the type badges' names', from
    // Google's) was what made it hang.
    font: false as const,
    timeout: 10000,
    type: 'image/png',
    backgroundColor: getComputedStyle(el).backgroundColor,
    // Every element's margin as the page has it, set on the copy drawn: the library leaves out what it takes for the
    // browser's defaults, and in Firefox it misjudges them, the lists (`ul`) drawn with their default margins then,
    // pushing the card down and its foot off the image.
    onCloneNode: (cloned: Node) => {
      if (!(cloned instanceof HTMLElement)) return
      const from = [el, ...el.querySelectorAll<HTMLElement>('*')]
      const to = [cloned, ...cloned.querySelectorAll<HTMLElement>('*')]
      if (from.length !== to.length) return
      from.forEach((f, i) => (to[i]!.style.margin = getComputedStyle(f).margin))
    },
  }
  if (!redraws) return domToBlob(el, options)

  // Elsewhere, the card as an SVG once, then onto a canvas, drawn again a few times (the library's own redrawing off).
  const svg = await domToForeignObjectSvg(el, { ...options, features: { fixSvgXmlDecode: false } })
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = options.width * options.scale
  canvas.height = options.height * options.scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const paint = () => {
    ctx.fillStyle = options.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  }
  paint()
  for (let i = 0; i < REDRAWS; i++) {
    await wait(REDRAW_MS)
    paint()
  }
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
const fileName = () => `${(props.file ?? 'team').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'team'}.png`

async function run(how: 'share' | 'download' | 'copy') {
  if (busy.value) return
  busy.value = true
  status.value = null
  try {
    // Copied, the clipboard is given the image to come at once, in the click: written after drawing it, the click would
    // be too long ago for the browser to allow it.
    if (how === 'copy') {
      const png = draw().then((b) => b ?? Promise.reject(new Error('no card to draw')))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      return say('copied')
    }
    const blob = await draw()
    if (!blob) return fail('no card to draw')
    const file = new File([blob], fileName(), { type: 'image/png' })
    if (how === 'share' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: props.title })
      } catch (e) {
        // Dismissed: nothing to say.
        if ((e as Error).name !== 'AbortError') fail(e)
      }
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    say('saved')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button v-if="!noButton" type="button" class="btn share-image" @click="show">
    <ImageDown :size="14" aria-hidden="true" />{{ t('share.button') }}
  </button>
  <ModalDialog v-model:open="open" :label="t('share.title')">
    <div v-if="open" class="panel share-dialog">
      <div class="share-dialog-head">
        <h2>{{ t('share.title') }}</h2>
        <button type="button" class="share-close" :aria-label="t('share.close')" @click="open = false">
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
      <SegmentedControl v-model="layout" class="soft" :label="t('share.layout')" :options="layouts" />
      <!-- The card at its own size, scaled to fit, centered; the room it takes, its scaled size. -->
      <div ref="frame" class="share-frame">
        <div class="share-room" :style="{ width: `${cardSize.w * scale}px`, height: `${cardSize.h * scale}px` }">
          <div class="share-scaled" :style="{ transform: `scale(${scale})` }">
            <TeamShareCard ref="card" :team :points :title :subtitle :layout />
          </div>
        </div>
      </div>
      <div class="share-actions">
        <span class="share-status small" :class="status === 'failed' ? 'bad' : 'muted'" aria-live="polite">{{
          busy ? t('share.busy') : status ? t(`share.${status}`) : ''
        }}</span>
        <button v-if="canCopy" type="button" class="btn" :disabled="busy" @click="run('copy')">
          <component :is="status === 'copied' ? Check : Copy" :size="14" aria-hidden="true" />{{ t('share.copy') }}
        </button>
        <button type="button" class="btn" :class="{ primary: !canShare }" :disabled="busy" @click="run('download')">
          <Download :size="14" aria-hidden="true" />{{ t('share.download') }}
        </button>
        <button v-if="canShare" type="button" class="btn primary" :disabled="busy" @click="run('share')">
          <Share2 :size="14" aria-hidden="true" />{{ t('share.share') }}
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.share-image {
  font-size: 0.875em;
  font-weight: bold;
}
.share-dialog {
  /* Room for a scrollbar kept whether or not there's one, so one coming doesn't change the preview's width. */
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 760px !important;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.share-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.share-dialog h2 {
  margin: 0;
  font-size: 1.05em;
}
.share-close {
  display: inline-flex;
  padding: 2px;
  color: var(--muted);
  background: none;
  border: 0;
  cursor: pointer;
}
.share-close:hover {
  color: var(--text);
}
/* The preview: the card scaled from its top left corner, the frame as tall as it then is. */
.share-frame {
  flex: none;
  display: flex;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border);
}
.share-room {
  flex: none;
}
.share-scaled {
  width: max-content;
  transform-origin: top left;
}
.share-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.share-status.bad {
  font-weight: bold;
  color: var(--bad);
}
.share-status {
  margin-right: auto;
}
.small {
  font-size: 0.875em;
}
</style>
