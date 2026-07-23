export function aerformDemoProductName(name: string) {
  return name === "ContentGate" ? "Aerform Air 01" : name;
}

export function aerformDemoProductDescription(description: string | null) {
  if (!description) return description;
  if (!/ContentGate/i.test(description)) return description;
  return "Modular everyday carry backpack for commute, studio, and short travel. Built around realistic campaign templates, grounded product imagery, and approved brand knowledge.";
}

