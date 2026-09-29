export type Connector = "CCS1" | "NACS" | "J1772";

export type Station = {
  id: string;
  name: string;
  area: string;
  km: number;
  connector: Connector;
  powerKw: number;
};

export type DemoRoute = {
  id: string;
  name: string;
  destination: string;
  distanceKm: number;
  stations: Station[];
};

export const ROUTES: DemoRoute[] = [
  {
    id: "houston-austin",
    name: "Houston → Austin",
    destination: "Austin",
    distanceKm: 270,
    stations: [
      { id: "prairie", name: "Prairie Stop", area: "West Houston", km: 42, connector: "CCS1", powerKw: 150 },
      { id: "brazos", name: "Brazos Hub", area: "Brazos County", km: 91, connector: "NACS", powerKw: 250 },
      { id: "columbus", name: "Columbus Junction", area: "Columbus", km: 152, connector: "CCS1", powerKw: 150 },
      { id: "gateway", name: "Austin Gateway", area: "East Austin", km: 221, connector: "J1772", powerKw: 11 },
    ],
  },
  {
    id: "houston-san-antonio",
    name: "Houston → San Antonio",
    destination: "San Antonio",
    distanceKm: 320,
    stations: [
      { id: "katy", name: "Katy Exchange", area: "Katy", km: 48, connector: "CCS1", powerKw: 150 },
      { id: "flatonia", name: "Flatonia Point", area: "Flatonia", km: 124, connector: "NACS", powerKw: 250 },
      { id: "seguin", name: "Seguin Crossing", area: "Seguin", km: 213, connector: "CCS1", powerKw: 150 },
      { id: "westside", name: "Westside Bay", area: "San Antonio", km: 285, connector: "J1772", powerKw: 11 },
    ],
  },
];

export const SLOT_TIMES = ["09:00", "12:00", "15:00", "18:00"];
export const AVERAGE_SPEED_KMH = 85;
export const MAX_SLOT_WAIT_MINUTES = 120;

export type Slot = {
  id: string;
  routeId: string;
  stationId: string;
  date: string;
  time: string;
  state: "open" | "blocked";
  bookingId: string | null;
  driverAlias: string | null;
  bookedAt: string | null;
};

export type PlanInput = {
  routeId: string;
  batteryKwh: number;
  currentSoc: number;
  efficiencyKwhPer100Km: number;
  reserveSoc: number;
  connector: Connector;
  departureLocal: string;
};

export type StationAssessment = {
  station: Station;
  arrivalSoc: number;
  arrivalLocal: string;
  waitMinutes: number | null;
  nextSlot: Slot | null;
  reasons: string[];
  eligible: boolean;
};

export function getRoute(id: string) {
  return ROUTES.find((route) => route.id === id);
}

export function validatePlan(input: PlanInput): string | null {
  if (!getRoute(input.routeId)) return "Choose a demo route.";
  if (!Number.isFinite(input.batteryKwh) || input.batteryKwh < 10 || input.batteryKwh > 200) return "Usable battery must be 10–200 kWh.";
  if (!Number.isFinite(input.currentSoc) || input.currentSoc < 0 || input.currentSoc > 100) return "Current battery must be 0–100%.";
  if (!Number.isFinite(input.efficiencyKwhPer100Km) || input.efficiencyKwhPer100Km < 5 || input.efficiencyKwhPer100Km > 60) return "Consumption must be 5–60 kWh/100 km.";
  if (!Number.isFinite(input.reserveSoc) || input.reserveSoc < 0 || input.reserveSoc > 50) return "Reserve must be 0–50%.";
  if (!["CCS1", "NACS", "J1772"].includes(input.connector)) return "Choose a connector.";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.departureLocal) ||
      Number.isNaN(Date.parse(input.departureLocal + ":00Z"))) return "Choose a departure time.";
  return null;
}

export function safeRangeKm(input: PlanInput) {
  return Math.max(0, (input.currentSoc - input.reserveSoc) / 100 * input.batteryKwh /
    (input.efficiencyKwhPer100Km / 100));
}

export function arrivalSoc(input: PlanInput, km: number) {
  return input.currentSoc - (km * input.efficiencyKwhPer100Km / 100 / input.batteryKwh * 100);
}

// A UTC timestamp is used as a neutral wall-clock representation of the demo route's local time.
// It never claims to model a real geographic timezone or changing traffic.
export function localAtDistance(departureLocal: string, km: number) {
  const time = new Date(departureLocal + ":00Z").getTime() + Math.round(km / AVERAGE_SPEED_KMH * 60) * 60_000;
  return new Date(time).toISOString().slice(0, 16);
}

export function assessStations(
  input: PlanInput,
  slots: Slot[],
  operational: Record<string, boolean>,
): StationAssessment[] {
  const route = getRoute(input.routeId);
  if (!route || validatePlan(input)) return [];
  return route.stations.map((station) => {
    const predictedSoc = arrivalSoc(input, station.km);
    const arrival = localAtDistance(input.departureLocal, station.km);
    const reasons: string[] = [];
    if (predictedSoc < input.reserveSoc - 1e-9) reasons.push("Below your arrival reserve");
    if (station.connector !== input.connector) reasons.push(`Needs ${station.connector} connector`);
    if (operational[station.id] === false) reasons.push("Charger marked offline");

    const options = slots
      .filter((slot) => slot.stationId === station.id && slot.state === "open" && !slot.bookingId)
      .map((slot) => ({
        slot,
        minutes: (Date.parse(`${slot.date}T${slot.time}:00Z`) - Date.parse(arrival + ":00Z")) / 60_000,
      }))
      .filter(({ minutes }) => minutes >= 0 && minutes <= MAX_SLOT_WAIT_MINUTES)
      .sort((a, b) => a.minutes - b.minutes);
    if (!options.length) reasons.push("No open slot within 2 hours of arrival");
    return {
      station,
      arrivalSoc: predictedSoc,
      arrivalLocal: arrival,
      waitMinutes: options[0]?.minutes ?? null,
      nextSlot: options[0]?.slot ?? null,
      reasons,
      eligible: reasons.length === 0,
    };
  });
}

export function recommendedStation(assessments: StationAssessment[]) {
  // Prefer making more route progress while retaining the requested reserve.
  return assessments.filter((item) => item.eligible).sort((a, b) =>
    b.station.km - a.station.km || (a.waitMinutes ?? 0) - (b.waitMinutes ?? 0)
  )[0] ?? null;
}
