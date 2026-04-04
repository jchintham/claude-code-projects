# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

Open `tictactoe.html` directly in a browser — no build step, server, or dependencies required.

## Architecture

Single self-contained HTML file with inline CSS and JS. No frameworks, no modules.

**Game logic (JS):**
- `board` — 9-element array (`null | 'X' | 'O'`), indices 0–8 left-to-right, top-to-bottom
- `WINS` — hardcoded array of all 8 winning index triples
- `checkWinner(b)` — returns `{ winner, line }` or `{ winner: 'draw' }` or `null`
- `minimax(b, isMax)` — unoptimised full-tree minimax; O plays as maximiser
- `bestMove()` — iterates empty cells, calls minimax, returns index of highest-scoring move
- `applyMove(index, player)` — writes to `board[]` and updates the DOM cell
- AI move fires in a `setTimeout(..., 300)` after the human move to give visual feedback

**State:**
- `board`, `current`, `gameOver`, `vsComputer` are module-level vars
- `scores { X, O, D }` persists across restarts but resets on "Reset Scores"

## Git & GitHub

- Remote: `origin` → `https://github.com/jchintham/claude-code-projects` (branch: `main`)
- After completing any meaningful change, commit with a descriptive message and push to keep the remote in sync
