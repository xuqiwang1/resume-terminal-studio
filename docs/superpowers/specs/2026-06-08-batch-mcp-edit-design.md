# Resume Studio Batch MCP Edit Design

## Goal

Replace the current single-field pending patch workflow with a task-level batch patch workflow that still preserves the core trust boundary:

- agents may propose resume changes
- agents may not write `active-resume.json` directly
- agents may not accept or reject pending changes
- the user reviews one coherent task diff and confirms it once in the app

The design must support real editing tasks such as "fill education section", "rewrite one project entry", or "tighten summary + selected experience bullets" without forcing the user through many accept clicks.

## Problem

The current MCP write contract is too narrow for realistic resume editing:

- `propose_edit` stages only one field at a time
- the pending slot is single-entry, so consecutive proposals overwrite each other
- structured edits such as education, skills, projects, and experience often require multi-field or multi-item changes
- some code paths silently no-op when the target item does not exist, which makes "accept" appear broken

This creates a bad product failure mode:

- the safe path is too cumbersome to use
- the agent is tempted to suggest editing files directly
- the trust boundary is preserved in theory but weakened in practice

## Decision

Adopt a task-level batch patch model:

- a single MCP call may stage multiple related changes
- the app presents one review surface for the whole task
- the user accepts or rejects the whole batch in one action
- changes inside the batch remain structured and auditable

The existing `propose_edit` remains for narrow edits such as one text field or one bullet line. A new `propose_batch_edit` becomes the standard path for multi-field and multi-item edits.

## User Experience

### Agent flow

1. Agent calls `get_context`
2. Agent calls `get_materials`
3. Agent writes final content itself
4. Agent submits either:
   - `propose_edit` for a narrow single-target edit
   - `propose_batch_edit` for one coherent task with multiple changes
5. Agent stops and waits for the user to review in the app

### App flow

When a batch patch is pending, the app shows:

- one task-level pending banner, such as `AI 待确认改动: 补全教育背景`
- one grouped diff view inside the pending panel
- section-based grouping, such as `education`, `experience`, `projects`
- per-change summaries that explain whether the change replaces a field, replaces an item, appends an item, or replaces a section

Version 1 accepts or rejects the entire batch as a unit. Partial accept can be added later, but it is explicitly out of scope for this design.

## Patch Model

### Patch envelope

Each pending batch patch has one envelope:

```json
{
  "id": "uuid",
  "sessionId": "uuid",
  "kind": "batch",
  "title": "补全教育背景",
  "summary": "Fill one existing education entry and append one new entry.",
  "createdAt": "2026-06-08T12:00:00.000Z",
  "changes": []
}
```

### Change operations

Version 1 supports exactly four operations:

1. `replace_field`
2. `replace_item`
3. `append_item`
4. `replace_section`

These cover the actual resume workflows without reopening arbitrary write access.

### Operation semantics

`replace_field`

- target: one field in one structured item
- examples:
  - `education[0].school`
  - `skills[1].content`
  - `experience[0].role`

`replace_item`

- target: one entire structured item
- examples:
  - replace one whole education record
  - replace one whole project record

`append_item`

- target: append one new structured item to `education`, `skills`, `experience`, or `projects`
- examples:
  - add a second education record
  - add a new project entry

`replace_section`

- target: one whole top-level text section or one whole text field inside a structured record
- examples:
  - `summary`
  - `title`
  - `contact`
  - `experience[0].details`
  - `projects[1].details`

### Example payload

```json
{
  "title": "补全教育背景",
  "summary": "Fill the first education item and append the undergraduate entry.",
  "changes": [
    {
      "operation": "replace_item",
      "sectionId": "education",
      "index": 0,
      "before": {
        "school": "School Name",
        "degree": "Degree",
        "major": "Major",
        "date": "Date",
        "tag": ""
      },
      "after": {
        "school": "北京师范大学",
        "degree": "硕士",
        "major": "社会学",
        "date": "2024.09 - 2027.06",
        "tag": "985"
      }
    },
    {
      "operation": "append_item",
      "sectionId": "education",
      "after": {
        "school": "安徽大学",
        "degree": "本科",
        "major": "社会学",
        "date": "2020.09 - 2024.06",
        "tag": "211"
      }
    }
  ]
}
```

## Validation Rules

Validation happens at proposal time, not at accept time.

If validation fails, the tool returns an error and does not stage anything.

### Allowed targets

- top-level text sections:
  - `title`
  - `contact`
  - `summary`
- structured sections:
  - `education`
  - `skills`
  - `experience`
  - `projects`

### Allowed schemas

`education`

- fields: `school`, `degree`, `major`, `date`, `tag`

`skills`

- fields: `category`, `content`

`experience`

- fields: `company`, `role`, `date`, `details`

`projects`

- fields: `name`, `role`, `date`, `details`

### Index rules

- `replace_field`, `replace_item`, and structured `replace_section` require an existing index
- `append_item` does not accept an index
- a request that references a missing item must return a validation error
- missing-item append must be expressed explicitly as `append_item`, never inferred silently

### Atomicity

`propose_batch_edit` is atomic:

- all changes validate and stage together
- or none of them stage

`confirm_pending_patch` is also atomic:

- either all staged changes apply
- or none apply

No partial commit is allowed in version 1.

## Pending Storage Model

The current single pending slot remains conceptually single-slot, but the slot now stores either:

- one legacy single edit patch
- or one batch patch

This preserves the core product property that there is only one pending decision at a time.

Pending file shape:

```json
{
  "kind": "batch",
  "title": "...",
  "summary": "...",
  "changes": [...]
}
```

or:

```json
{
  "kind": "single",
  "sectionId": "summary",
  "before": "...",
  "after": "..."
}
```

## MCP Contract

### Keep

`propose_edit`

- remains supported
- intended for one field or one bullet-line edit

### Add

`propose_batch_edit`

Input shape:

```json
{
  "title": "string",
  "summary": "string",
  "changes": [
    {
      "operation": "replace_field | replace_item | append_item | replace_section",
      "sectionId": "title | contact | summary | education | skills | experience | projects",
      "index": 0,
      "field": "optional string",
      "value": "optional string or object"
    }
  ]
}
```

Input semantics:

- `replace_field`: requires `index`, `field`, and scalar `value`
- `replace_item`: requires `index` and object `value`
- `append_item`: requires object `value` and forbids `index`
- `replace_section`:
  - top-level text section requires scalar `value`
  - structured text field such as `experience[0].details` requires `index`, `field`, and scalar `value`

Tool behavior:

- validates all changes against the resume schema
- computes `before` snapshots and transforms the request into stored `before/after` patch data
- writes one pending batch patch
- returns one review-oriented response with grouped diffs

### Remove from agent reach

The following remain forbidden through MCP:

- direct resume file writes
- patch confirmation
- patch rejection
- arbitrary file mutation helpers

## App Review Surface

The pending review UI should adapt to patch kind.

For `single`:

- preserve the current simple banner and diff

For `batch`:

- show task title
- show task summary if present
- show grouped changes by section
- show concise labels such as:
  - `替换教育背景第 1 条`
  - `新增教育背景第 2 条`
  - `改写项目经历第 1 条正文`
- allow one `接受` and one `拒绝`

The UI must never imply that only part of the batch was applied if version 1 still commits atomically.

## Error Handling

The system must stop silently failing.

Proposal-time failures must include clear, user-actionable messages such as:

- `education[1] does not exist; use append_item instead`
- `projects field "company" is invalid; expected one of name, role, date, details`
- `batch contains 2 invalid changes; nothing was staged`

Accept-time failures should be rare because validation already ran, but they must still surface a clear error and leave both resume and pending state unchanged.

## Security Boundary

This design changes capability, not trust level.

Still allowed:

- agent reads local extracted materials
- agent proposes finished text
- agent stages one pending batch for review

Still forbidden:

- agent writes `active-resume.json` directly
- agent confirms or rejects pending patches
- agent bypasses the app review step
- agent mutates arbitrary files in the workspace as a substitute for MCP

Agent-facing prompts and workspace rules should explicitly say:

- if MCP cannot express the desired change, stop and report the limitation
- do not suggest direct file edits as a workaround

## Compatibility

The rollout should preserve existing narrow flows:

- current `propose_edit` clients continue working
- pending patch readers must understand both `single` and `batch`
- confirm/reject endpoints continue using the same route shape, but branch on pending patch kind internally

## Testing

The implementation must add or update tests for:

- batch validation success
- batch validation failure with no staged patch
- batch confirm writes every change atomically
- batch reject clears the pending slot without resume mutation
- append_item for education and other structured sections
- mixed batches that touch more than one section
- legacy `propose_edit` compatibility
- UI rendering for grouped batch pending diffs
- error messages for invalid field and invalid index cases

## Non-Goals

- partial acceptance inside one batch
- arbitrary free-form JSON patch execution
- direct MCP support for avatar mutation
- reopening CLI confirm or reject
- broadening agent write permissions outside the review flow

## Recommended Implementation Sequence

1. Define shared batch patch schema and persistence format.
2. Extend core patch application logic to support batch operations atomically.
3. Add MCP `propose_batch_edit`.
4. Update pending review UI to branch on patch kind.
5. Update docs and workspace guidance so agents stop suggesting direct file edits.

## Acceptance Criteria

This design is complete when all of the following are true:

- one education-fill task can be proposed and accepted in one click
- appending a new structured item is an explicit supported operation
- invalid targets fail before staging
- no accept flow silently no-ops
- agents still cannot bypass human review
- existing single-edit flows still work
