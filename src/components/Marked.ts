import { h, type FunctionalComponent } from 'vue'
import type { Marks } from '@/lib/search'

// A name with the search's matches highlighted (`split`'s marks). Functional, as a list can have hundreds.
const Marked: FunctionalComponent<{ p: Marks }> = ({ p }) => p.map((s, i) => (i % 2 && s ? h('mark', s) : s))
Marked.props = ['p']

export default Marked
