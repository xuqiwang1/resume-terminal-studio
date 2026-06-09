const toolDefinitions = [
  {
    name: "get_context",
    description: "Read the current UI context: opened document, visible page, selected section/field, active resume, workspace paths, and pending patch. Call this before get_materials and propose_edit.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "get_resume",
    description: "Read the active resume JSON and local workspace context.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "get_materials",
    description: "Read extracted local source materials in one call, so the agent can start writing without manually discovering workspace/materials/.extracted files. Run `resume-agent ingest` first if this returns no files.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxChars: {
          type: "integer",
          minimum: 1000,
          maximum: 200000,
          description: "Maximum total characters returned across extracted material files. Defaults to 60000."
        }
      }
    }
  },
  {
    name: "propose_edit",
    description: "Propose a finished edit to one resume field. First call get_context and get_materials, then WRITE the final polished text yourself and submit it here. This does NOT change the resume directly: it stages a pending patch that only the user can accept or reject in the Resume Studio workbench.\n\nSections:\n- name / title / contact / summary: plain text, no index/field.\n- experience / projects: arrays; use index + field (default 'details').\n- education: array of {school,degree,major,date,tag}; use index + field (one of school/degree/major/date/tag).\n- skills: array of {category,content}; use index + field (one of category/content; default 'content').\nFor structured arrays, proposing with index 0 onto an EMPTY array appends a new item.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["sectionId", "content"],
      properties: {
        sectionId: {
          type: "string",
          enum: ["name", "title", "contact", "summary", "experience", "projects", "education", "skills"],
          description: "Which section to edit. avatar is set by the user in the workbench, not here."
        },
        index: {
          type: "integer",
          minimum: 0,
          description: "Zero-based index within experience/projects/education/skills arrays. Ignored for summary. Defaults to 0."
        },
        field: {
          type: "string",
          description: "Sub-field to edit for array sections. experience/projects: 'details' (default), 'role', 'company'/'name', 'date'. education: one of school/degree/major/date/tag (default 'school'). skills: one of category/content (default 'content'). Ignored for summary."
        },
        bulletIndex: {
          type: "integer",
          minimum: 0,
          description: "Optional line/bullet index within the 'details' field. When specified, only that single bullet (line) is replaced instead of the entire details text. Lines are 0-indexed and split by newline. Use this for precise edits without rewriting the whole section."
        },
        content: {
          type: "string",
          description: "The finished, ready-to-use text you wrote for this field. The engine stores it verbatim; it does not rewrite it."
        }
      }
    }
  },
  {
    name: "propose_batch_edit",
    description: "Propose one coherent task with multiple structured resume changes. Use this when a meaningful edit spans multiple fields or items, such as filling education, rewriting one project entry, or updating summary plus one skill. This stages one batch pending patch for the user to accept or reject once in the app.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "changes"],
      properties: {
        title: {
          type: "string",
          description: "Short task title shown in the pending review UI."
        },
        summary: {
          type: "string",
          description: "Optional one-line summary of the batch intent."
        },
        changes: {
          type: "array",
          minItems: 1,
          description: "Structured batch changes. Each change requires operation, sectionId, and the fields needed by that operation.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["operation", "sectionId", "value"],
            properties: {
              operation: {
                type: "string",
                enum: ["replace_field", "replace_item", "append_item", "replace_section"]
              },
              sectionId: {
                type: "string",
                enum: ["name", "title", "contact", "summary", "experience", "projects", "education", "skills"]
              },
              index: {
                type: "integer",
                minimum: 0
              },
              field: {
                type: "string"
              },
              value: {
                description: "String for text replacements, object for item replacements/appends."
              }
            }
          }
        }
      }
    }
  },
  {
    name: "get_pending_patch",
    description: "Read the currently pending (proposed but not yet confirmed) patch, if any.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "get_activity",
    description: "Read the latest activity state and recent logged events.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 }
      }
    }
  },
  {
    name: "get_selection",
    description: "Get the user's current selection in the resume preview. Returns which field and section the user has clicked/focused on, so the agent can be context-aware.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  }
];

const resourceDefinitions = [
  {
    uri: "resume://active",
    name: "Active Resume",
    description: "The current active resume JSON document.",
    mimeType: "application/json"
  },
  {
    uri: "resume://activity-state",
    name: "Activity State",
    description: "The latest activity state for terminal-driven edits.",
    mimeType: "application/json"
  },
  {
    uri: "resume://activity-log",
    name: "Activity Log",
    description: "Recent structured activity events from the workspace.",
    mimeType: "application/json"
  },
  {
    uri: "resume://context",
    name: "Resume Studio Context",
    description: "Current document, view, selection, resume, and pending patch context.",
    mimeType: "application/json"
  },
  {
    uri: "resume://materials",
    name: "Extracted Materials",
    description: "Extracted local source materials available to the agent.",
    mimeType: "application/json"
  }
];

module.exports = {
  resourceDefinitions,
  toolDefinitions
};
