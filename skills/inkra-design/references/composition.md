# Compose a product interface

## Start with the user's outcome

Identify what the user needs to see, decide and do. Use the content and existing application structure already available. Distinguish a request for a proposal or review from authorization to change code; do not force an implementation when the user wants a design discussion.

For an implementation, establish the consumer's installed package version and shortlist existing components by capability with inkra-docs or official docs/types. Explain only the useful tradeoffs. Confirm a component's actual feature before choosing a primitive-based replacement, combining overlapping controls or inventing a prop. Keep a gap explicit when the existing package does not cover it.

## Give state a clear owner

Separate domain records and rules from presentation and temporary interaction state. For each visible action, identify the record it changes and what success, failure or unavailable means in this application. Components render and expose documented events; the application owns persistence, access rights, resource balances and transitions. Keep derived display values derived from the same source data instead of maintaining conflicting copies.

Preserve existing data-fetching, routing and form architecture. A preview may use local state, but label its persistence boundary honestly. Represent the loading, empty, error, disabled or complete states the actual task needs; do not add speculative flows or backend infrastructure.

## Common composition decisions

These are starting points to verify in the installed version, not a fixed widget inventory.

| User task | Useful choices to investigate | Application decisions |
| --- | --- | --- |
| Capture or edit information | Field with Input/Select/Textarea, a clear submit action and nearby status | Draft versus saved values, validation, pending/failed submission and reset |
| Browse a management list | Compare Table/DataTable against required sorting/filtering/editing; add controls only where the selected component leaves a gap | Query/filter state, row identity, selection scope, edit persistence and loading/empty/error results |
| Show tasks and claim rewards | Checklist/list composition with Progress and Button where appropriate | Which events complete a task, whether a reward was claimed, a single consistent reward update and the unavailable/completed state |
| Show a skill or technology tree | Check DependencyGraph and available node customization; use existing detail/overlay components as needed | Prerequisites, current level, resource cost, selected node, unlock/upgrade rules and failure outcomes |
| Show inventory or equipment | Check InventoryGrid, selection and available drag/layout capabilities; use contextual details and actions where appropriate | Item identity/footprint, allowed moves, quantities, equipped state and keyboard/touch alternatives |

Use the smallest composition that completes the flow. For a skill tree, a custom node image or Flip card is an optional appearance; dependency and upgrade logic remain independent of that appearance. Selecting a locked node may inspect it without activating an unavailable action, when the business rules permit this.

## Organize the interface

Give the main content and primary next action a clear hierarchy. Group related controls and keep descriptions/status close to the affected input or action. Distinguish an action button from navigation with a real destination. Avoid wrapping every section in another card or adding a control that has no effect.

Keep surrounding context visible when a detail panel is enough; use an overlay only when the flow actually calls for one. Maintain focus and Escape/focus-return where the chosen component supports that interaction. On a narrow screen, reflow related groups and make graph/table scrolling local instead of shrinking all type or nesting full-page scrollers.

Preserve the project's theme and reuse its spacing/layout conventions. Read interfaces.md for concrete token, type and interaction guidance. Read icons.md only when a missing or requested icon warrants authored geometry; ordinary composition can reuse existing icons.

## A useful handoff

For a proposal, give the chosen components, hierarchy, state transitions and any API uncertainty. For code, keep the implementation focused and runnable in the existing application, then report the behavior actually checked. For a review, prioritize concrete issues in the supplied screen and avoid rewriting the product into an unrelated demo.
