export type RescueTeamStatus = 'AVAILABLE' | 'DISPATCHED' | 'EN_ROUTE' | 'ACTIVE' | 'COMPLETE';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SuitabilityTeam {
  id: string;
  name: string;
  capabilities: string[];
  status: RescueTeamStatus;
  location: Coordinates;
}

export interface SuitabilityIncident {
  requiredCapabilities: string[];
  location: Coordinates;
}

export interface TeamSuitability {
  teamId: string;
  teamName: string;
  suitable: boolean;
  score: number;
  capabilityScore: number;
  availabilityScore: number;
  distanceScore: number;
  distanceKm: number;
  matchedCapabilities: string[];
  missingCapabilities: string[];
  reasons: string[];
}

export const MAX_RESCUE_DISTANCE_KM = 100;

function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

export function evaluateTeamSuitability(
  team: SuitabilityTeam,
  incident: SuitabilityIncident
): TeamSuitability {
  const normalizedCapabilities = new Set(team.capabilities.map((item) => item.trim().toLowerCase()));
  const matchedCapabilities = incident.requiredCapabilities.filter((capability) =>
    normalizedCapabilities.has(capability.trim().toLowerCase())
  );
  const missingCapabilities = incident.requiredCapabilities.filter(
    (capability) => !normalizedCapabilities.has(capability.trim().toLowerCase())
  );
  const hasRequirements = incident.requiredCapabilities.length > 0;
  const capabilityScore = hasRequirements
    ? rounded((matchedCapabilities.length / incident.requiredCapabilities.length) * 50)
    : 0;
  const available = team.status === 'AVAILABLE';
  const availabilityScore = available ? 20 : 0;
  const distanceKm = calculateDistanceKm(team.location, incident.location);
  const distanceScore = rounded(
    Math.max(0, 30 * (1 - distanceKm / MAX_RESCUE_DISTANCE_KM))
  );
  const suitable =
    hasRequirements &&
    matchedCapabilities.length === incident.requiredCapabilities.length &&
    available &&
    distanceKm <= MAX_RESCUE_DISTANCE_KM;
  const reasons = [
    `${matchedCapabilities.length}/${incident.requiredCapabilities.length} required capabilities matched`,
    available ? 'Team is available' : `Team is ${team.status.toLowerCase()}`,
    `${rounded(distanceKm)} km from incident`,
  ];

  if (missingCapabilities.length > 0) {
    reasons.push(`Missing: ${missingCapabilities.join(', ')}`);
  }
  if (distanceKm > MAX_RESCUE_DISTANCE_KM) {
    reasons.push(`Beyond ${MAX_RESCUE_DISTANCE_KM} km operating range`);
  }
  if (!hasRequirements) {
    reasons.push('Incident has no required capabilities');
  }

  return {
    teamId: team.id,
    teamName: team.name,
    suitable,
    score: rounded(capabilityScore + availabilityScore + distanceScore),
    capabilityScore,
    availabilityScore,
    distanceScore,
    distanceKm: rounded(distanceKm),
    matchedCapabilities,
    missingCapabilities,
    reasons,
  };
}

export function rankTeamsBySuitability(
  teams: SuitabilityTeam[],
  incident: SuitabilityIncident
): TeamSuitability[] {
  return teams
    .map((team) => evaluateTeamSuitability(team, incident))
    .sort(
      (left, right) =>
        Number(right.suitable) - Number(left.suitable) ||
        right.score - left.score ||
        left.distanceKm - right.distanceKm ||
        left.teamName.localeCompare(right.teamName)
    );
}