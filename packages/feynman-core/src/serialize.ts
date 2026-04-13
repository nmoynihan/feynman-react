import type { Diagram } from "./types";

function repairBareBackslashes(json: string): string {
  let result = "";
  let insideString = false;

  for (let index = 0; index < json.length; index += 1) {
    const char = json[index]!;

    if (!insideString) {
      result += char;
      if (char === '"') {
        insideString = true;
      }
      continue;
    }

    if (char === '"') {
      result += char;
      insideString = false;
      continue;
    }

    if (char === "\\") {
      const next = json[index + 1];

      if (next && /["\\/]/.test(next)) {
        result += char;
        result += next;
        index += 1;
      } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(json.slice(index + 2, index + 6))) {
        result += char;
        result += next;
        index += 1;
      } else if (next && /[bfnrt]/.test(next) && /[a-zA-Z]/.test(json[index + 2] ?? "")) {
        result += "\\\\";
      } else if (next && /[bfnrt]/.test(next)) {
        result += char;
        result += next;
        index += 1;
      } else {
        result += "\\\\";
      }

      continue;
    }

    result += char;
  }

  return result;
}

/**
 * Serialize a diagram to formatted JSON for storage or interchange.
 */
export function serializeDiagram(diagram: Diagram): string {
  return JSON.stringify(diagram, null, 2);
}

/**
 * Parse diagram JSON with a typed return value.
 */
export function parseDiagram(json: string): Diagram {
  try {
    return JSON.parse(json) as Diagram;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }

    return JSON.parse(repairBareBackslashes(json)) as Diagram;
  }
}