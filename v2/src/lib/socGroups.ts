/**
 * SOC major groups: the first two digits of an occupation code.
 *
 * DOL's disclosure files carry the full code (e.g. `15-1252.00`) and the
 * occupation title, but nothing that lets a reader ask for "every healthcare
 * role". The major group is that axis, and it is carried in the code itself,
 * so this is a lookup rather than new data.
 *
 * Source: BLS 2018 Standard Occupational Classification major groups.
 */
export const SOC_MAJOR_GROUPS: Record<string, string> = {
  "11": "Management",
  "13": "Business and financial",
  "15": "Computer and mathematical",
  "17": "Architecture and engineering",
  "19": "Life, physical and social science",
  "21": "Community and social service",
  "23": "Legal",
  "25": "Education and library",
  "27": "Arts, design, media and sport",
  "29": "Healthcare practitioners",
  "31": "Healthcare support",
  "33": "Protective service",
  "35": "Food preparation and serving",
  "37": "Building and grounds maintenance",
  "39": "Personal care and service",
  "41": "Sales",
  "43": "Office and administrative support",
  "45": "Farming, fishing and forestry",
  "47": "Construction and extraction",
  "49": "Installation, maintenance and repair",
  "51": "Production",
  "53": "Transportation and material moving",
  "55": "Military specific",
};

/** The major-group name for a SOC code, or null when the code is unreadable. */
export function socGroup(code: string | null): string | null {
  if (!code) return null;
  const major = code.trim().slice(0, 2);
  return SOC_MAJOR_GROUPS[major] ?? null;
}
