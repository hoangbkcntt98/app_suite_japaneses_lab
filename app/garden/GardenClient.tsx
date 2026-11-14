"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { apiPath } from "@manga/lib/paths";
import {
  itemCatalog,
  landImage,
  landUnlockCost,
  lockedLandImage,
  plantCatalog,
  plantStageImage,
  type ItemKind,
  type PlantKind,
} from "@manga/lib/forest-game-materials";
import styles from "../games/page.module.css";

type Plant = { id: string; kind: PlantKind; growth: number; landIndex: number; protected?: boolean; plantedAt: string };
type GardenSave = {
  xp: number;
  landCount: number;
  plants: Plant[];
  seeds: Record<PlantKind, number>;
  items: Record<ItemKind, number>;
};
const seeds = plantCatalog;
const gardenItems = itemCatalog;
const seedKinds = plantCatalog.map((seed) => seed.kind);
const legacyPlantKinds: Record<string, PlantKind> = { sakura: "cherry", bamboo: "pine", bonsai: "oak" };
const visibleLandCount = 10;
const landPageSize = 50;

export default function GardenClient() {
  const [garden, setGarden] = useState<GardenSave>({
    xp: 0,
    landCount: 0,
    plants: [],
    seeds: Object.fromEntries(seedKinds.map((kind) => [kind, 0])) as Record<PlantKind, number>,
    items: Object.fromEntries(gardenItems.map((item) => [item.kind, 0])) as Record<ItemKind, number>,
  });
  const [gardenReady, setGardenReady] = useState(false);
  const [gardenMessage, setGardenMessage] = useState("");
  const [openPlantId, setOpenPlantId] = useState<string | null>(null);
  const [openLandIndex, setOpenLandIndex] = useState<number | null>(null);
  const [landPage, setLandPage] = useState(0);
  const [storeOpen, setStoreOpen] = useState(false);

  useEffect(() => {
    fetch(apiPath("/api/garden"))
      .then(async (response) => {
        if (!response.ok) throw new Error("Garden load failed");
        const saved = await response.json() as Partial<GardenSave>;
        const plants = Array.isArray(saved.plants) ? saved.plants.flatMap((plant, index) => {
          const kind = typeof plant?.kind === "string" ? legacyPlantKinds[plant.kind] || plant.kind : "";
          if (typeof plant?.id !== "string" || !seeds.some((seed) => seed.kind === kind) || !Number.isFinite(plant.growth)) return [];
          return [{
            id: plant.id,
            kind: kind as PlantKind,
            growth: Math.min(100, Math.max(0, plant.growth)),
            landIndex: Number.isSafeInteger(plant.landIndex) && Number(plant.landIndex) >= 0 ? Number(plant.landIndex) : index,
            protected: plant.protected === true,
            plantedAt: typeof plant.plantedAt === "string" && !Number.isNaN(Date.parse(plant.plantedAt)) ? plant.plantedAt : new Date().toISOString(),
          }];
        }) : [];
        const savedLandCount = Number.isSafeInteger(saved.landCount) ? Math.max(0, Number(saved.landCount)) : 0;
        setGarden({
          xp: Number.isFinite(saved.xp) ? Math.max(0, Number(saved.xp)) : 0,
          landCount: Math.max(savedLandCount, ...plants.map((plant) => plant.landIndex + 1)),
          plants,
          seeds: Object.fromEntries(seedKinds.map((kind) => {
            const value = saved.seeds?.[kind];
            return [kind, Number.isInteger(value) ? Math.max(0, Number(value)) : 0];
          })) as Record<PlantKind, number>,
          items: Object.fromEntries(gardenItems.map((item) => {
            const value = saved.items?.[item.kind];
            return [item.kind, Number.isFinite(value) ? Math.max(0, Number(value)) : 0];
          })) as Record<ItemKind, number>,
        });
        setGardenReady(true);
      })
      .catch(() => setGardenMessage("Không tải được vườn từ database. Hãy tải lại trang."));
  }, []);

  useEffect(() => {
    if (!gardenReady) return;
    const timer = window.setTimeout(() => {
      fetch(apiPath("/api/garden"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(garden),
      }).then((response) => {
        if (!response.ok) throw new Error("Garden save failed");
      }).catch(() => setGardenMessage("Không lưu được vườn vào database. Kiểm tra kết nối rồi tải lại."));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [garden, gardenReady]);

  function unlockLand(landIndex: number) {
    if (landIndex !== garden.landCount) {
      setGardenMessage("Hãy mở khóa từng ô theo thứ tự.");
      return;
    }
    const cost = landUnlockCost(landIndex);
    if (garden.xp < cost) {
      setGardenMessage(`Cần ${cost} XP để mở ô đất tiếp theo.`);
      return;
    }
    setGarden((current) => ({
      ...current,
      xp: current.xp - cost,
      landCount: current.landCount + 1,
    }));
    setGardenMessage(`Đã mở ô đất ${landIndex + 1}.`);
  }

  function buySeed(seed: typeof seeds[number]) {
    if (garden.xp < seed.cost) {
      setGardenMessage("Chưa đủ XP để mua cây này.");
      return;
    }
    setGarden((current) => ({
      ...current,
      xp: current.xp - seed.cost,
      seeds: { ...current.seeds, [seed.kind]: current.seeds[seed.kind] + 1 },
    }));
    setGardenMessage(`Đã mua ${seed.name}. Hạt giống đã vào kho.`);
  }

  function plantSeed(landIndex: number, seed: typeof seeds[number]) {
    if (landIndex >= garden.landCount || garden.plants.some((plant) => plant.landIndex === landIndex)) return;
    if (garden.seeds[seed.kind] < 1) return;
    setGarden((current) => ({
      ...current,
      plants: [...current.plants, {
        id: `${Date.now()}-${Math.random()}`,
        kind: seed.kind,
        growth: 0,
        landIndex,
        plantedAt: new Date().toISOString(),
      }],
      seeds: { ...current.seeds, [seed.kind]: Math.max(0, current.seeds[seed.kind] - 1) },
    }));
    setOpenLandIndex(null);
    setGardenMessage(`Đã trồng ${seed.name} tại ô đất ${landIndex + 1}.`);
  }

  function buyGardenItem(item: typeof gardenItems[number]) {
    if (garden.xp < item.cost) {
      setGardenMessage("Chưa đủ XP để mua vật phẩm.");
      return;
    }
    setGarden((current) => ({
      ...current,
      xp: current.xp - item.cost,
      items: { ...current.items, [item.kind]: current.items[item.kind] + 1 },
    }));
    setGardenMessage(`Đã mua ${item.name}. Chọn cây để sử dụng.`);
  }

  function applyGardenItem(plantId: string, item: typeof gardenItems[number]) {
    const target = garden.plants.find((plant) => plant.id === plantId);
    if (garden.items[item.kind] < 1 || !target || (item.effect === "protection" && target.protected)) return;
    setGarden((current) => ({
      ...current,
      plants: current.plants.map((plant) => plant.id === plantId
        ? item.effect === "protection"
          ? { ...plant, protected: true }
          : { ...plant, growth: Math.min(100, plant.growth + item.boost) }
        : plant),
      items: { ...current.items, [item.kind]: Math.max(0, current.items[item.kind] - 1) },
    }));
    setGardenMessage(item.effect === "protection"
      ? `${item.name} đã bảo vệ cây khỏi sâu bệnh.`
      : `${item.name} đã giúp cây lớn thêm ${item.boost}%.`);
    setOpenPlantId(null);
  }

  return <>
    <div className={styles.gardenTopbar}>
      <strong className={styles.xpBalance}>✦ {garden.xp} XP</strong>
    </div>
    <section className={styles.garden}>
      <div className={styles.gardenHeading}>
        <div><span>GARDEN · 育てる</span><h2>Khu vườn Japanese Lab</h2>
          <p>Dùng XP kiếm được khi trả lời đúng để mua cây. Mỗi câu đúng giúp cây lớn thêm.</p></div>
      </div>
      <button type="button" className={styles.storeButton} onClick={() => setStoreOpen(true)}>
        <b>Store</b><span>Hạt giống & vật phẩm</span><i>＋</i>
      </button>
      {storeOpen ? <div className={styles.storeBackdrop} role="presentation" onMouseDown={() => setStoreOpen(false)}>
        <section className={styles.storeModal} role="dialog" aria-modal="true" aria-labelledby="store-title" onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className={styles.storeClose} onClick={() => setStoreOpen(false)} aria-label="Đóng cửa hàng">×</button>
          <p>STORE · お店</p><h3 id="store-title">Hạt giống & vật phẩm</h3>
          <div className={styles.seedShop}>
            {seeds.map((seed) => <button key={seed.kind} onClick={() => buySeed(seed)} disabled={!gardenReady || garden.xp < seed.cost}>
              <Image src={seed.stages[0]} alt="" width={48} height={48} /><b>{seed.name}</b><small>{seed.cost} XP · Kho: {garden.seeds[seed.kind]}</small>
            </button>)}
            {gardenItems.map((item) => <button key={item.kind} onClick={() => buyGardenItem(item)} disabled={!gardenReady || garden.xp < item.cost}>
              <Image src={item.image} alt="" width={48} height={48} /><b>{item.name}</b><small>{item.cost} XP · Kho: {garden.items[item.kind]}</small>
            </button>)}
          </div>
        </section>
      </div> : null}
      <p className={styles.landPricingNote}>Mở từng ô một: 100 XP/ô cho 10 ô đầu, 500 XP/ô cho 10 ô tiếp theo; giá tăng ×5 sau mỗi 10 ô.</p>
      {Math.ceil(Math.max(visibleLandCount, garden.landCount + 10) / landPageSize) > 1 ? <div className={styles.landPagination}>
        <button onClick={() => setLandPage((page) => Math.max(0, page - 1))} disabled={landPage === 0}>← Trước</button>
        <span>{landPage + 1} / {Math.ceil(Math.max(visibleLandCount, garden.landCount + 10) / landPageSize)}</span>
        <button
          onClick={() => setLandPage((page) => Math.min(Math.ceil(Math.max(visibleLandCount, garden.landCount + 10) / landPageSize) - 1, page + 1))}
          disabled={landPage >= Math.ceil(Math.max(visibleLandCount, garden.landCount + 10) / landPageSize) - 1}
        >Tiếp →</button>
      </div> : null}
      <div className={styles.landGrid} aria-label="Các ô đất trong vườn">
        {Array.from({
          length: Math.min(landPageSize, Math.max(visibleLandCount, garden.landCount + 10) - landPage * landPageSize),
        }, (_, pageIndex) => {
          const landIndex = landPage * landPageSize + pageIndex;
          const plant = garden.plants.find((item) => item.landIndex === landIndex);
          if (landIndex >= garden.landCount) {
            const canUnlock = landIndex === garden.landCount;
            const cost = landUnlockCost(landIndex);
            return canUnlock ? <button
              className={styles.lockedLand}
              key={`locked-${landIndex}`}
              onClick={() => unlockLand(landIndex)}
              disabled={!gardenReady || garden.xp < cost}
              aria-label={`Mở khóa ô đất ${landIndex + 1} với giá ${cost} XP`}
              title={`Mở khóa · ${cost} XP`}
            >
              <Image src={lockedLandImage} alt="" width={104} height={104} />
              <span>🔒 {cost} XP</span>
            </button> : <div className={styles.lockedLand} key={`locked-${landIndex}`} aria-label={`Ô đất ${landIndex + 1} đang khóa`}>
              <Image src={lockedLandImage} alt="" width={104} height={104} />
              <span>🔒</span>
            </div>;
          }
          if (!plant) return <div className={styles.emptyLand} key={`land-${landIndex}`}>
            <button
              type="button"
              className={styles.emptyLandTrigger}
              onClick={() => {
                setOpenPlantId(null);
                setOpenLandIndex((current) => current === landIndex ? null : landIndex);
              }}
              aria-expanded={openLandIndex === landIndex}
              aria-label={`Ô đất trống ${landIndex + 1}. Chọn hạt giống để trồng.`}
            >
              <Image src={landImage} alt="" width={104} height={104} />
              <i className={styles.landProgressSpacer} aria-hidden="true" />
              <i className={styles.landDateSpacer} aria-hidden="true" />
              <span>Ô đất {landIndex + 1}</span>
            </button>
            {openLandIndex === landIndex ? <div className={styles.seedPlantMenu} aria-label="Chọn hạt giống">
              <button
                type="button"
                className={styles.seedPlantMenuClose}
                onClick={() => setOpenLandIndex(null)}
                aria-label="Đóng menu hạt giống"
                title="Đóng"
              >×</button>
              {seeds.map((seed) => <button
                type="button"
                key={seed.kind}
                disabled={!garden.seeds[seed.kind]}
                onClick={() => plantSeed(landIndex, seed)}
                aria-label={`${seed.name}, còn ${garden.seeds[seed.kind]}`}
                title={`${seed.name} · Kho: ${garden.seeds[seed.kind]}`}
              >
                <Image src={seed.stages[0]} alt="" width={34} height={34} />
                <span>{seed.name}</span>
                <small>×{garden.seeds[seed.kind]}</small>
              </button>)}
            </div> : null}
          </div>;
          const seed = seeds.find((item) => item.kind === plant.kind)!;
          const stage = Math.min(5, Math.floor(plant.growth / (100 / 6))) + 1;
          return <div className={styles.plantedLand} key={plant.id}>
            <button
              type="button"
              className={styles.plantedLandTrigger}
              onClick={() => setOpenPlantId((current) => current === plant.id ? null : plant.id)}
              aria-expanded={openPlantId === plant.id}
              aria-label={`${seed.name}, giai đoạn ${stage}. Mở vật phẩm chăm sóc cây.`}
            >
              <Image className={styles.plantImage} src={plantStageImage(plant.kind, plant.growth)} alt="" width={104} height={104} />
              <i className={styles.growthTrack} aria-label={`Tiến trình ${plant.growth}%`}><em style={{ width: `${plant.growth}%` }} /></i>
              <small className={styles.plantedDate}>Trồng: {new Date(plant.plantedAt).toLocaleDateString("vi-VN")}</small>
              <b>{seed.name}</b>
            </button>
            {openPlantId === plant.id ? <div className={styles.plantActions} aria-label={`Vật phẩm chăm sóc ${seed.name}`}>
              <button
                type="button"
                className={styles.plantActionsClose}
                onClick={() => setOpenPlantId(null)}
                aria-label="Đóng menu vật phẩm"
                title="Đóng"
              >×</button>
              <div className={styles.plantStatus}>
                <span>Giai đoạn {stage}/6</span>
                <span>{plant.growth}%</span>
                {plant.protected ? <small className={styles.protectedBadge}>Đã bảo vệ</small> : null}
                <i className={styles.growthTrack}><em style={{ width: `${plant.growth}%` }} /></i>
              </div>
              {gardenItems.map((item) => <button
                type="button"
                key={item.kind}
                disabled={!garden.items[item.kind] || (item.effect === "growth" && plant.growth >= 100) || (item.effect === "protection" && plant.protected)}
                onClick={() => applyGardenItem(plant.id, item)}
                aria-label={`${item.name} cho cây ${seed.name}. Còn ${garden.items[item.kind]}`}
                title={`${item.name} · Còn ${garden.items[item.kind]}`}
              ><Image src={item.image} alt="" width={28} height={28} /></button>)}
            </div> : null}
          </div>;
        })}
      </div>
      {gardenMessage ? <p className={styles.gardenMessage} role="status">{gardenMessage}</p> : null}
      <small className={styles.gardenNote}>
        {gardenReady ? "Tiến trình lưu vào database." : gardenMessage ? "Vườn chưa sẵn sàng." : "Đang tải tiến trình..."}
      </small>
    </section>
  </>;
}
