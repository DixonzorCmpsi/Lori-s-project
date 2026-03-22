import { faker } from "@faker-js/faker";

export function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    email: faker.internet.email().toLowerCase(),
    name: faker.person.fullName(),
    ageRange: "18+" as const,
    emailVerified: true,
    ...overrides,
  };
}

export function buildTheater(ownerId: string, overrides: Record<string, unknown> = {}) {
  return {
    ownerId,
    name: faker.company.name() + " Theater",
    city: faker.location.city(),
    state: faker.location.state(),
    ...overrides,
  };
}

export function buildProduction(theaterId: string, overrides: Record<string, unknown> = {}) {
  const firstRehearsal = faker.date.future({ years: 0.1 });
  const openingNight = new Date(firstRehearsal);
  openingNight.setDate(openingNight.getDate() + 30);
  const closingNight = new Date(openingNight);
  closingNight.setDate(closingNight.getDate() + 7);

  return {
    theaterId,
    name: faker.music.songName(),
    estimatedCastSize: faker.number.int({ min: 10, max: 100 }),
    firstRehearsal: firstRehearsal.toISOString().split("T")[0],
    openingNight: openingNight.toISOString().split("T")[0],
    closingNight: closingNight.toISOString().split("T")[0],
    ...overrides,
  };
}
