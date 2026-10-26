import { computed, ref, watch } from 'vue'
import { emptyMember, MOVE_SLOTS, newTeam, TEAM_SIZE, type Member, type Team } from '@/lib/team'

// The team builder's teams, saved in this browser as they're edited, and the one open. The starred ones first, then
// the latest changed. A team saved by an older shape is read as far as it goes, the rest of each slot left empty.

const KEY = 'sproutvgc.teams.v1'

interface Stored {
  teams: Team[]
  open: string | null
}

function member(x: unknown): Member {
  const m = emptyMember()
  if (!x || typeof x !== 'object') return m
  const o = x as Partial<Member>
  m.pokemon = o.pokemon ?? null
  m.item = o.item ?? null
  m.ability = o.ability ?? null
  m.nature = o.nature ?? null
  if (Array.isArray(o.moves)) m.moves = Array.from({ length: MOVE_SLOTS }, (_, i) => o.moves![i] ?? null)
  if (Array.isArray(o.points) && o.points.length === 6)
    m.points = o.points.map((p) => Number(p) || 0) as Member['points']
  return m
}

function read(): Stored {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Stored).teams)) return { teams: [], open: null }
    const teams = (raw as Stored).teams.flatMap((t): Team[] =>
      t && typeof t.id === 'string'
        ? [
            {
              id: t.id,
              name: typeof t.name === 'string' ? t.name : '',
              members: Array.from({ length: TEAM_SIZE }, (_, i) => member(t.members?.[i])),
              starred: !!t.starred,
              // Which slot Mega Evolves in its insights: a slot, none (null), or unset (the first with its stone).
              ...((t.mega === null || Number.isInteger(t.mega)) && { mega: t.mega }),
              updated: Number(t.updated) || 0,
            },
          ]
        : [],
    )
    const open = (raw as Stored).open
    return { teams, open: teams.some((t) => t.id === open) ? open : null }
  } catch {
    return { teams: [], open: null } // Storage unavailable, or what's there unreadable.
  }
}

const state = ref<Stored>(read())

function save() {
  try {
    if (state.value.teams.length) localStorage.setItem(KEY, JSON.stringify(state.value))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage unavailable: the teams last for this page load.
  }
}
watch(state, save, { deep: true })

// Edited in another tab, here too.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) state.value = read()
})

/** Whether a team has nothing in it: not worth keeping. */
const blank = (t: Team) => t.members.every((m) => !m.pokemon)

export function useTeams() {
  const teams = computed(() =>
    [...state.value.teams].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || b.updated - a.updated),
  )
  const current = computed(() => state.value.teams.find((t) => t.id === state.value.open) ?? null)

  /** Opens a team, leaving the one open before if there was nothing in it. */
  function open(id: string) {
    const before = current.value
    state.value.open = id
    if (before && before.id !== id && blank(before)) remove(before.id)
  }
  /** Starts a team, with these Pokémon if given, and opens it. */
  function create(name: string, members?: Member[]): Team {
    const team = newTeam(name)
    if (members) members.forEach((m, i) => (team.members[i] = m))
    state.value.teams.push(team)
    open(team.id)
    return team
  }
  /** Marks the open team as changed now (after editing it in place). */
  function touch() {
    if (current.value) current.value.updated = Date.now()
  }
  function remove(id: string) {
    state.value.teams = state.value.teams.filter((t) => t.id !== id)
    if (state.value.open === id) state.value.open = null
  }
  function duplicate(id: string, name: string) {
    const t = state.value.teams.find((x) => x.id === id)
    if (!t) return
    const copy = create(name, JSON.parse(JSON.stringify(t.members)) as Member[])
    if (t.mega !== undefined) copy.mega = t.mega
  }
  function star(id: string) {
    const t = state.value.teams.find((x) => x.id === id)
    if (t) t.starred = !t.starred
  }

  return { teams, current, open, create, touch, remove, duplicate, star }
}
