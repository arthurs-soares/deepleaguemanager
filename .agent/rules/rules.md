---
applyTo: '**'
---
---
trigger: always_on
---

#  Discord Bot - Coding Standards & Best Practices

> **STRICT ADHERENCE REQUIRED.**

## 1 Architecture & Structure
- **Structure**: `src/{commands, core, events, models, services, utils}`.
- **Flow**: Commands  Handlers  Services  Database.
- **Principles**: Separation of Concerns. Thin Handlers. Modular Design.
- **Services**: Pure business logic. No direct DB access in handlers.
- **Discord.js**: Use `MessageFlags` for flags. Prefer `editReply` over `followUp` when possible.

## 2 Naming & Organization
- **Directories**: `commands/` (Definitions), `core/` (System), `services/` (Logic), `models/` (Schemas), `utils/` (Helpers).
- **Naming**:
  - Files/Services/Utils: `camelCase` (`userService.js`).
  - Models/Classes: `PascalCase` (`User.js`).
  - Functions: Verb+Object (`createUser`).
  - Variables: Descriptive (`discordUserId`).
- **Language**: **ENGLISH ONLY** for all code, comments, and visual text.

## 3 Coding Standards
- **Style**: `async/await` only. 2 spaces indent. Max 150 chars/line. JSDoc required.
- **Limits**:
  - **Files**: Max **200-300 lines** (Models/Utils: 300, Interactions/Commands: 250, Default: 200).
  - **Functions**: Max **80-200 lines** (Utils: 200, Interactions: 170, Default: 80).
- **Linting**: **MANDATORY**. `npm run lint` must pass before commit. Fix all errors.
- **Logs**: Use `LoggerService`. **NO** `console.log` (except in scripts/tests).

## 4 Interaction & Handlers
- **Workflow**: Validate  Delegate to Service  Response.
- **Rules**:
  - **Thin Handlers**: No business logic or DB calls in handlers.
  - **Responses**: Use `MessageFlags.Ephemeral` for errors/sensitive info.
  - **Deferral**: Always `deferReply({ flags: MessageFlags.Ephemeral })` for long tasks immediately.
  - **Errors**: Catch all via `src/core/errors/`. Use `handleInteractionError()`.

## 5 Components v2 (MANDATORY)
- **Requirement**: **ALWAYS** use Components v2. **NO** legacy embeds.
- **Builders**: `ContainerBuilder`, `TextDisplayBuilder`, `SeparatorBuilder`, `SectionBuilder`.
- **Imports**: Ensure correct imports from `discord.js` (or project wrapper).
- **Layout**:
  - Titles: `#` (H1), `##` (H2), `###` (H3).
  - Separators: Use `SeparatorSpacingSize` enum (e.g., `SeparatorSpacingSize.Small`). **NEVER strings**.
- **Limits**: Max 40 components/message, 4000 chars/text.
- **Docs**: Update `/docs/components-v2-guide.md` for all UI changes.

## 6 Database & Security
- **DB**: Use `src/models/`. Validate before write. Try/catch all ops.
- **Security**: No hardcoded secrets (use `.env`). Validate permissions (`src/utils/core/permissions.js`). Sanitize input.

## 7 Anti-Patterns (DO NOT DO)
-  Hardcode secrets/IDs.
-  Use `console.log` (use LoggerService).
-  Use `.then()` (use async/await).
-  Exceed file/function limits (check .eslintrc.js).
-  Use non-English text.
-  Use legacy embeds.
-  Ignore linting errors.

## 8 Workflow
1. **Lint**: `npm run lint` & `npm run lint:fix`.
2. **Test**: Validate imports and `.env`.
3. **Exceptions**: Use `// rules-exception: reason` if strictly necessary.
