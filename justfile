# Shortcuts for the npm scripts; run `just` to list them.

set windows-shell := ["powershell.exe", "-NoLogo", "-Command"]

# List the recipes
default:
    @just --list

# Dev server with hot reload (also reachable from a phone on the same Wi-Fi)
dev:
    npm run dev

# Dev server with Vue's per-component timings in the Performance panel (which components re-render; durations inflated)
dev-profile $VITE_PROFILE="true":
    npm run dev

# Check the curated text's markers, type-check and build the production site into dist/
build:
    npm run build

# Build, then serve the production site at http://localhost:4173/sproutvgc/ (profile performance here)
preview: build
    npm run preview

# Regenerate src/data/generated/ from Pokémon Showdown and PokéAPI at the pinned commits (`just gen-data --update` repins to the latest)
gen-data *args:
    npm run gen-data -- {{args}}

# Check the markers in the curated text ({type:flying}, {move:taunt}...) in every language: quicker than a build
check-text:
    npm run check-text

# Time the search's matching over every language's names, at 1×, 10× and 50× the dex (`just bench-search 1 100` for others)
bench-search *args:
    npm run bench-search -- {{args}}
