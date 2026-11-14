import { appPath } from "./paths";

export type PlantKind = "oak" | "pine" | "cherry" | "apple" | "orange" | "maple";
export type ItemKind = "hoe" | "wateringCan" | "fertilizer" | "superFertilizer" | "pesticide";

const materialRoot = appPath("/forest-game-materials");
export const lockedLandImage = `${materialRoot}/tile-land-locked.webp`;
export const landImage = `${materialRoot}/tile-land.webp`;
export const landUnlockBaseCost = 100;

export function landUnlockCost(landIndex: number) {
  return Math.min(Number.MAX_SAFE_INTEGER, landUnlockBaseCost * 5 ** Math.floor(landIndex / 10));
}

export const plantCatalog: {
  kind: PlantKind;
  name: string;
  cost: number;
  stages: readonly string[];
}[] = [
  {
    kind: "oak",
    name: "Oak",
    cost: 50,
    stages: Array.from({ length: 6 }, (_, index) => `${materialRoot}/oak-stage${index + 1}-${["seed", "sprout", "sapling", "young", "medium", "mature"][index]}.webp`),
  },
  {
    kind: "pine",
    name: "Pine",
    cost: 60,
    stages: Array.from({ length: 6 }, (_, index) => `${materialRoot}/pine-stage${index + 1}-${["seed", "sprout", "sapling", "young", "medium", "mature"][index]}.webp`),
  },
  {
    kind: "cherry",
    name: "Cherry Blossom",
    cost: 70,
    stages: Array.from({ length: 6 }, (_, index) => `${materialRoot}/cherry-stage${index + 1}-${["seed", "sprout", "sapling", "young", "medium", "mature"][index]}.webp`),
  },
  {
    kind: "apple",
    name: "Apple",
    cost: 80,
    stages: Array.from({ length: 6 }, (_, index) => `${materialRoot}/apple-stage${index + 1}-${["seed", "sprout", "sapling", "young", "medium", "mature"][index]}.webp`),
  },
  {
    kind: "orange",
    name: "Orange",
    cost: 80,
    stages: Array.from({ length: 6 }, (_, index) => `${materialRoot}/orange-stage${index + 1}-${["seed", "sprout", "sapling", "young", "medium", "mature"][index]}.webp`),
  },
  {
    kind: "maple",
    name: "Maple",
    cost: 90,
    stages: Array.from({ length: 6 }, (_, index) => `${materialRoot}/maple-stage${index + 1}-${["seed", "sprout", "sapling", "young", "medium", "mature"][index]}.webp`),
  },
];

export const itemCatalog: {
  kind: ItemKind;
  name: string;
  cost: number;
  boost: number;
  image: string;
  effect: "growth" | "protection";
}[] = [
  { kind: "hoe", name: "Cuốc", cost: 20, boost:  2, image: `${materialRoot}/item-hoe.webp`, effect: "growth" },
  { kind: "wateringCan", name: "Bình tưới nước", cost: 20, boost:  2, image: `${materialRoot}/item-watering-can.webp`, effect: "growth" },
  { kind: "fertilizer", name: "Phân bón", cost: 30, boost:  3, image: `${materialRoot}/item-fertilizer.webp`, effect: "growth" },
  { kind: "superFertilizer", name: "Phân bón siêu cấp", cost: 60, boost:  10, image: `${materialRoot}/item-super-fertilizer.webp`, effect: "growth" },
  { kind: "pesticide", name: "Thuốc trừ sâu", cost: 35, boost: 0, image: `${materialRoot}/item-pesticide.webp`, effect: "protection" },
];

export function plantStageImage(kind: PlantKind, growth: number) {
  const plant = plantCatalog.find((entry) => entry.kind === kind);
  if (!plant) return "";
  const stage = Math.min(5, Math.floor(Math.max(0, growth) / (100 / 6)));
  return plant.stages[stage];
}
