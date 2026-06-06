import type { ProjectStatus } from "./domain-types.js";

const editableProjectStates = ["draft", "scripting", "error"] as const;

export type ProjectState = ProjectStatus;

export function canEditProject(state: ProjectState) {
  return editableProjectStates.includes(state as (typeof editableProjectStates)[number]);
}
