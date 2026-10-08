import {
  evaluateTeamSuitability,
  rankTeamsBySuitability,
  SuitabilityIncident,
  SuitabilityTeam,
} from '../services/rescueSuitability';

const incident: SuitabilityIncident = {
  requiredCapabilities: ['medical', 'water rescue'],
  location: { latitude: 6.9271, longitude: 79.8612 },
};

const team = (overrides: Partial<SuitabilityTeam> = {}): SuitabilityTeam => ({
  id: 'team-1',
  name: 'Central Rescue',
  capabilities: ['medical', 'water rescue'],
  status: 'AVAILABLE',
  location: incident.location,
  ...overrides,
});

describe('rescue team suitability', () => {
  it('awards full points for matching capabilities, availability, and location', () => {
    const result = evaluateTeamSuitability(team(), incident);

    expect(result).toMatchObject({
      suitable: true,
      score: 100,
      capabilityScore: 50,
      availabilityScore: 20,
      distanceScore: 30,
      distanceKm: 0,
      matchedCapabilities: ['medical', 'water rescue'],
      missingCapabilities: [],
    });
  });

  it('makes a capability mismatch ineligible and explains the missing skill', () => {
    const result = evaluateTeamSuitability(team({ capabilities: ['medical'] }), incident);

    expect(result.suitable).toBe(false);
    expect(result.capabilityScore).toBe(25);
    expect(result.missingCapabilities).toEqual(['water rescue']);
    expect(result.reasons).toContain('Missing: water rescue');
  });

  it('marks unavailable teams ineligible and removes availability points', () => {
    const result = evaluateTeamSuitability(team({ status: 'DISPATCHED' }), incident);

    expect(result.suitable).toBe(false);
    expect(result.availabilityScore).toBe(0);
    expect(result.reasons).toContain('Team is dispatched');
  });

  it('reduces the distance score as a team is farther away', () => {
    const nearby = evaluateTeamSuitability(team(), incident);
    const farther = evaluateTeamSuitability(
      team({ location: { latitude: 7.2, longitude: 80.0 } }),
      incident
    );

    expect(farther.distanceScore).toBeLessThan(nearby.distanceScore);
    expect(farther.distanceKm).toBeGreaterThan(0);
  });

  it('ranks eligible and higher-scoring teams ahead of other teams', () => {
    const ranked = rankTeamsBySuitability(
      [
        team({ id: 'far', name: 'Far Team', location: { latitude: 7.2, longitude: 80.0 } }),
        team({ id: 'busy', name: 'Busy Team', status: 'ACTIVE' }),
        team({ id: 'near', name: 'Near Team' }),
      ],
      incident
    );

    expect(ranked.map((result) => result.teamId)).toEqual(['near', 'far', 'busy']);
  });

  it('rejects teams with no capability match, no requirements, or excessive distance', () => {
    const mismatch = evaluateTeamSuitability(team({ capabilities: ['fire'] }), incident);
    const emptyRequirements = evaluateTeamSuitability(team(), {
      ...incident,
      requiredCapabilities: [],
    });
    const outOfRange = evaluateTeamSuitability(
      team({ location: { latitude: 8.5, longitude: 81.0 } }),
      incident
    );

    expect(mismatch.suitable).toBe(false);
    expect(emptyRequirements.suitable).toBe(false);
    expect(outOfRange.suitable).toBe(false);
    expect(outOfRange.reasons).toContain('Beyond 100 km operating range');
  });
});