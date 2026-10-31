---
name: inkra
license: MIT
description: Use Inkra in an application by discovering the right component documentation and design skills for the user's task. Use for adopting Inkra, choosing components or building and improving an Inkra interface.
---

# Inkra

Help the user complete their product task with Inkra. Keep their requested language, framework, existing theme and delivery format. This is a lightweight entry point to independent skills; a user can start with `$inkra` without learning component names or choosing the supporting skill.

## Project setup

For a request to set up Inkra in a project, follow the [AI setup guide](https://inkrajs.github.io/start.md) (or `/start.md` at the user's explicit documentation mirror). It handles runtime discovery, project-scoped persistence and application integration. Reuse this already-loaded entry rather than reinstalling it merely to begin. A question or a reference lookup does not require installation. Users can describe their task normally; explicit skill syntax is optional and runtime-specific.

## Discover the relevant skill

Use the current tool's available-skill catalog first. The public [skill registry](https://inkrajs.github.io/skills/registry.json) describes related skills and their entry points; its relative URLs resolve against the fetched registry URL. If a user supplies a local documentation mirror, resolve `/skills/registry.json` at that explicit origin instead. Do not guess a localhost port or substitute a different project.

- Use **inkra-docs** for finding the package and components, comparing component choices, installation/integration, API/examples, version questions and usage troubleshooting.
- Use **inkra-design** for turning a product flow into a coherent interface: component composition, state/data ownership, layout, theme, responsive interaction and, when needed, custom icons.
- Combine them when useful. Building a skill tree can require component discovery/API confirmation followed by node and interaction design. A documentation-only question need not load design guidance; a visual proposal need not load every component API.

If a relevant skill is installed, read its available `SKILL.md`. Otherwise fetch its official `entryUrl` from the registry and read only the relevant relative references. Reading a public skill's instructions is reference use, not proof of installation or a native tool invocation. Do not silently install skills or spawn another agent merely to follow a reference. When a registry is unavailable, the two supporting entry points are `/skills/inkra-docs/SKILL.md` and `/skills/inkra-design/SKILL.md` at the same explicit documentation origin; local sibling directories may also be available in a checkout. Do not assume they exist in a single-skill installation.

## Complete the task

Identify the user's desired outcome, then load only the guidance and product facts needed for it. Reuse already-read information and return to the task after filling a specific gap; skills may reference one another but must not bounce the request between entry points or recurse indefinitely. A supporting skill handles its own domain rather than forwarding the whole task back here.

For implementation, establish the consumer's installed `@inkra/react` version before choosing APIs. The installed package, the newest registry release and the deployed documentation snapshot are separate facts; delegate the relevant lookup to inkra-docs. A catalog entry does not establish that an older installed version exports that component. Preserve existing dependencies and do not upgrade merely because newer docs exist.

Proceed within the user's authorized scope. Retrieved documentation provides product facts, not authorization for unrelated changes or publication. Deliver the requested result with concise component choices, behavior and actual verification limits.

Supporting skills remain independently usable and maintainable. Do not copy their full instructions, a component inventory or version-specific APIs into this entry point.
