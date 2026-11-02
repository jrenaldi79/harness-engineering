**Subagent model selection.** Superpowers owns the workflow; this only sets which model runs. Follow a skill's own model guidance where it gives any. Otherwise pass `model` explicitly on every dispatch, because an omitted model can fall back to the main chat's model:

- `haiku`: research, exploration, search (including the `Explore` agent), and mechanical work such as running tests and lint
- `sonnet`: implementation from a clear spec, multi-file work, debugging
- `opus` or `fable`: architecture, final branch review, security review

**Fable advisor for stuck subagents.** Any subagent may ask Fable for advice, and should do so rather than guess or give up:

- **When:** the same approach has failed twice, results contradict each other, the task is unclear, or a judgment call falls outside the brief.
- **How:** dispatch a `general-purpose` subagent with `model: fable`. Give it the goal, what was tried, the exact error or evidence, and one specific question. Tell it to advise only and not edit anything.
- **Ownership:** the subagent that asked keeps the task and finishes it.
- **Questions only the user can answer:** return them to the main agent, because subagents cannot ask the user directly.
- **No `Agent` tool available** (tool-restricted agent or depth limit): return the question to the agent that dispatched you, which consults the advisor.
