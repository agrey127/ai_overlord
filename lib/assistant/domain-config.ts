import type { FunctionTool } from "openai/resources/responses/responses";
import type { AssistantDomain } from "@/lib/assistant/types";
import { assistantTools } from "@/lib/assistant/tools";
import { coreInstructions } from "@/lib/assistant/prompts/core";
import { generalInstructions } from "@/lib/assistant/prompts/general";
import { nutritionInstructions } from "@/lib/assistant/prompts/nutrition";
import { runningInstructions } from "@/lib/assistant/prompts/running";
import { strengthInstructions } from "@/lib/assistant/prompts/strength";
import { chiefOfStaffInstructions } from "@/lib/assistant/prompts/chief-of-staff";
import { domainToolNames } from "@/lib/assistant/domain-policy";

export const ASSISTANT_PROMPT_VERSION = 5;

type ConfiguredDomain = "general" | "strength" | "running" | "nutrition" | "chief_of_staff";

const domainInstructions: Record<ConfiguredDomain, string> = {
  general: generalInstructions,
  strength: strengthInstructions,
  running: runningInstructions,
  nutrition: nutritionInstructions,
  chief_of_staff: chiefOfStaffInstructions,
};

function restrictEnum(tool: FunctionTool, field: string, values: string[]): FunctionTool {
  const parameters = tool.parameters as { properties: Record<string, Record<string, unknown>> };
  return {
    ...tool,
    parameters: {
      ...parameters,
      properties: {
        ...parameters.properties,
        [field]: { ...parameters.properties[field], enum: values },
      },
    },
  };
}

function toolsForDomain(domain: ConfiguredDomain): FunctionTool[] {
  const allowed = new Set(domainToolNames[domain]);
  const selected = assistantTools.filter((tool) => allowed.has(tool.name));
  if (selected.length !== allowed.size) {
    throw new Error(`The ${domain} tool configuration references a missing tool.`);
  }
  return selected.map((tool) => {
    if (tool.name === "query_personal_totals") {
      if (domain === "running") return restrictEnum(tool, "dataset", ["runs"]);
      if (domain === "nutrition") return restrictEnum(tool, "dataset", ["meal_logs"]);
    }
    if (tool.name === "prepare_activity_import" && domain === "running") {
      return restrictEnum(tool, "activity_type", ["run"]);
    }
    return tool;
  });
}

const configurations = Object.fromEntries(
  (Object.keys(domainInstructions) as ConfiguredDomain[]).map((domain) => [domain, {
    instructions: `${coreInstructions}\n\n${domainInstructions[domain]}`,
    tools: toolsForDomain(domain),
  }]),
) as Record<ConfiguredDomain, { instructions: string; tools: FunctionTool[] }>;

export function getAssistantDomainConfig(domain: AssistantDomain) {
  return domain in configurations ? configurations[domain as ConfiguredDomain] : null;
}
