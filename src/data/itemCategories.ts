// What an item is for in a battle, for the item rankings to filter by: every item has one, given by `npm run gen-data`
// (`scripts/itemCategories.ts`), in `items.data.json`. Kept without imports, so the generator can read it.

/** The categories, in the order they're listed. */
export const ITEM_CATEGORIES = ['mega', 'offense', 'defense', 'speed', 'field', 'utility'] as const
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]
