export const CIVIC_CATEGORIES = [
  'water_supply',
  'roads',
  'drainage',
  'garbage',
  'sanitation',
  'streetlights',
  'electricity',
  'public_toilets',
  'traffic',
  'public_infrastructure',
  'other'
] as const;

export type CivicCategory = typeof CIVIC_CATEGORIES[number];

export const CATEGORY_LABELS: Record<CivicCategory, string> = {
  water_supply: 'Water Supply',
  roads: 'Roads & Potholes',
  drainage: 'Drainage & Flooding',
  garbage: 'Garbage & Waste',
  sanitation: 'Sanitation & Sewage',
  streetlights: 'Streetlights & Electrical',
  electricity: 'Public Electricity',
  public_toilets: 'Public Toilets',
  traffic: 'Traffic & Signage',
  public_infrastructure: 'Public Infrastructure',
  other: 'Other Civic Issue'
};
