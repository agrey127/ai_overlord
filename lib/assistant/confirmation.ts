export const CONFIRMATION_REPLY = "I confirm. Proceed with the pending action.";

const confirmationPatterns = [
  /\b(?:please\s+)?confirm\b[\s\S]{0,180}[.!?]?\s*$/i,
  /\b(?:would you like me to|do you want me to|should i|shall i|may i|can i|ready for me to)\b[\s\S]{0,160}\b(?:save|log|add|update|change|replace|delete|remove|start|finish|complete|schedule|reschedule|record|apply|proceed)\b[\s\S]{0,80}\?\s*$/i,
  /\b(?:confirm|save)\s+(?:it|this|these|that|the (?:draft|activity|workout|change|entry|plan))\s*[?!.]?\s*$/i,
];

export function assistantRequestsConfirmation(content: string, explicitlyRequired = false) {
  if (explicitlyRequired) return true;
  const normalized = content.trim();
  return confirmationPatterns.some((pattern) => pattern.test(normalized));
}
