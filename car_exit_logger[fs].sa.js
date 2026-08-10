/// <reference path=".config/sa.d.ts" />

// ════════════════════════════════════════════════════════════════
//  CAR EXIT LOGGER + PROXIMITY STREAMER
//  Pattern: commute[fs].jsalt — showTextBox, wait(0), manual wasDown,
//  blocking sub-loop menus, no IsKeyJustPressed, no Text.* namespace.
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════════
const CONFIG_PATH = "CLEO\\car_exit_logger.ini";
const PARKED_PATH = "CLEO\\vehicles.parked";

const CFG = {
  streamIn:    150.0,
  streamOut:   170.0,
  maxEntries:  100,
  unlockDoors: true,
  tooltips:    true,
  saveHealth:  true,
  saveTires:   true,
};

// ════════════════════════════════════════════════════════════════
//  KEY CONSTANTS
// ════════════════════════════════════════════════════════════════
const VK_F5    = 116;
const VK_F6    = 117;
const VK_F7    = 118;
const VK_UP    = 38;
const VK_DOWN  = 40;
const VK_LEFT  = 37;
const VK_RIGHT = 39;
const VK_ENTER = 13;
const VK_ESC   = 27;
const VK_SPACE = 32;
const VK_NUM8  = 104;
const VK_NUM2  = 98;
const VK_NUM4  = 100;
const VK_NUM6  = 102;
const VK_NUM5  = 101;
const VK_KEY_W = 87;
const VK_KEY_S = 83;
const VK_KEY_A = 65;
const VK_KEY_D = 68;

// ════════════════════════════════════════════════════════════════
//  MODULE-SCOPE wasDown VARS
// ════════════════════════════════════════════════════════════════
let f5WasDown  = false;
let f6WasDown  = false;
let f7WasDown  = false;

// ════════════════════════════════════════════════════════════════
//  DYNAMIC TUNABILITY PROBE
//  Detects mod-shop compatibility at runtime using GTA SA model
//  type opcodes (0A01/081E/0820/081F). Results cached per model ID.
//  A slot-0 probe at vehicle ENTRY TIME confirms actual tunability.
//  No static lists — works with modded vehicles automatically.
// ════════════════════════════════════════════════════════════════
const tunableCache = {};   // modelId -> true | false

function probeAndCacheTunability(car, mid) {
  // Already cached
  if (tunableCache.hasOwnProperty(mid)) return;

  try {
    // Step 1: Model type check — only automobiles can have tuning mods
    let isCar = false;
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelACar === 'function') {
      isCar = !!Car.IsThisModelACar(mid);
    }
    if (!isCar) { tunableCache[mid] = false; return; }

    // Step 2: Emergency vehicles can't visit mod shops
    try {
      if (typeof car.isEmergencyServices === 'function' && car.isEmergencyServices()) {
        tunableCache[mid] = false;
        return;
      }
    } catch(e) {}

    // Step 3: Live slot-0 probe — safe here because we're in a wait(0) main-loop frame
    //         (not inside saveCarExit which is called from runPending with no wait)
    let slot0 = undefined;
    try {
      if (typeof car.getCurrentMod === 'function') slot0 = car.getCurrentMod(0);
    } catch(e) { tunableCache[mid] = false; return; }

    // slot0 returns 0 for no mod, or a mod ID. Anything except an exception = tunable.
    tunableCache[mid] = (slot0 !== undefined && slot0 !== null);
  } catch(e) {
    tunableCache[mid] = false;
  }
}

const BOATS = [430, 446, 452, 453, 454, 472, 473, 484, 493, 595];
const BIKES = [448, 461, 462, 463, 468, 471, 481, 509, 510, 521, 522, 523, 571, 581, 586];
const AIRCRAFT = [417, 425, 447, 460, 469, 476, 487, 488, 497, 511, 512, 513, 519, 520, 548, 553, 563, 577, 592, 593];

function isBoatModel(mid) {
  return BOATS.indexOf(mid) !== -1;
}

function isBikeModel(mid) {
  return BIKES.indexOf(mid) !== -1;
}

function isAircraftModel(mid) {
  return AIRCRAFT.indexOf(mid) !== -1;
}

function isAutomobileModel(mid) {
  if (!mid || mid <= 0) return false;
  if (isBoatModel(mid) || isBikeModel(mid) || isAircraftModel(mid)) return false;
  try {
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelACar === 'function') {
      return !!Car.IsThisModelACar(mid);
    }
  } catch(e) {}
  return true;
}


function isTunableVehicle(mid) {
  if (!mid) return false;
  // If cached use that, otherwise conservatively return false
  // (probeAndCacheTunability must be called at entry time first)
  if (tunableCache.hasOwnProperty(mid)) return tunableCache[mid];
  // Fallback for vehicles entered before probe: use model type only
  try {
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelACar === 'function') {
      return !!Car.IsThisModelACar(mid);
    }
  } catch(e) {}
  return false;
}


function getVehicleName(modelId) {
  if (!modelId) return "Vehicle";

  // 1. Dynamic memory lookup via CLEO opcodes: CModelInfo array (0ADB) -> CText table (0ADE)
  try {
    let rawKey = "";
    if (typeof GetNameOfVehicleModel === 'function') {
      rawKey = GetNameOfVehicleModel(modelId);
    } else if (typeof Car !== 'undefined' && typeof Car.GetNameOfModel === 'function') {
      rawKey = Car.GetNameOfModel(modelId);
    }

    if (rawKey && rawKey.trim().length > 0) {
      const k = rawKey.trim();

      // Query localized text label directly from game RAM memory (CText table including custom FXTs)
      let localized = "";
      try {
        if (typeof GetLabelString === 'function') {
          localized = GetLabelString(k);
        } else if (typeof Text !== 'undefined' && typeof Text.GetLabelString === 'function') {
          localized = Text.GetLabelString(k);
        }
      } catch(e) {}

      if (localized && localized.trim().length > 0 && localized.trim() !== k) {
        return localized.trim();
      }

      // Fallback: title-case the raw GXT key (e.g. "BLISTRA" -> "Blistra")
      const formatted = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
      if (formatted && formatted.length > 2) return formatted;
    }
  } catch(e) {}



  return "" + modelId;
}

function getVehicleGxtKey(modelId) {
  if (!modelId) return "DUMMY";
  try {
    let key = "";
    if (typeof GetNameOfVehicleModel === 'function') {
      key = GetNameOfVehicleModel(modelId);
    } else if (typeof Car !== 'undefined' && typeof Car.GetNameOfModel === 'function') {
      key = Car.GetNameOfModel(modelId);
    }
    if (key && key.trim().length > 0) {
      key = key.trim().toUpperCase();
      if (key.length > 7) key = key.substring(0, 7);
      return key;
    }
  } catch(e) {}
  return "DUMMY";
}

//  GLOBAL STATE
// ════════════════════════════════════════════════════════════════
let wasInCar       = false;
let fireNotified   = false;
let lastCarHandle  = null;
let pending        = [];
let lastPendingMs  = 0;
let lastStreamerMs = 0;
let lastFireCheckMs = 0;
let streamed       = {};   // entry string → car handle
let spawnTimeMap   = {};   // key → spawn timestamp ms
let cache          = [];

// ════════════════════════════════════════════════════════════════
//  SAFE CAR WRAPPERS
// ════════════════════════════════════════════════════════════════
function toCar(c) {
  if (!c) return null;
  if (typeof c === 'object' && c !== null) return c;
  try { return new Car(c); } catch(e) { return null; }
}

function getCarHandle(char) {
  try {
    if (!char.isInAnyCar()) return null;
    let c = null;
    try { c = char.storeCarIsInNoSave(); } catch(e) {}
    if (!c) try { c = Char.StoreCarIsInNoSave(char); } catch(e) {}
    if (c) {
      return toCar(c);
    }
    return null;
  } catch(e) { return null; }
}

function isCarValid(c) {
  if (!c) return false;
  const obj = toCar(c);
  if (!obj) return false;
  try { if (typeof obj.doesExist === 'function') return obj.doesExist(); } catch(e) {}
  try { if (typeof Car !== 'undefined' && typeof Car.DoesExist === 'function') return Car.DoesExist(obj); } catch(e) {}
  return true;
}

function isCarDestroyed(c) {
  if (!c) return true;
  const obj = toCar(c);
  if (!obj || !isCarValid(obj)) return true;
  try {
    let dead = false;
    if (typeof obj.isDead === 'function') dead = obj.isDead();
    else if (typeof Car !== 'undefined' && typeof Car.IsDead === 'function') dead = Car.IsDead(obj);
    if (dead) return true;
  } catch(e) {}
  return getCarHealth(obj) <= 250;
}

function isCarUsable(c) {
  return !isCarDestroyed(c);
}

function getCarModelId(c) {
  if (!c) return 0;
  try { if (typeof c.getModel === 'function') return c.getModel(); } catch(e) {}
  try { if (typeof Car !== 'undefined' && typeof Car.GetModel === 'function') return Car.GetModel(c); } catch(e) {}
  return 0;
}

function getCarPos(c) {
  try {
    if (typeof c.getCoordinates === 'function') {
      const p = c.getCoordinates();
      if (p) return { x: +p.x || +p[0] || 0, y: +p.y || +p[1] || 0, z: +p.z || +p[2] || 0 };
    }
  } catch(e) {}
  try {
    if (typeof Car !== 'undefined' && typeof Car.GetCoordinates === 'function') {
      const p = Car.GetCoordinates(c);
      if (p) return { x: +p.x || +p[0] || 0, y: +p.y || +p[1] || 0, z: +p.z || +p[2] || 0 };
    }
  } catch(e) {}
  return { x: 0, y: 0, z: 0 };
}

function getCarHdg(c) {
  try { if (typeof c.getHeading === 'function') return +c.getHeading(); } catch(e) {}
  try { if (typeof Car !== 'undefined' && typeof Car.GetHeading === 'function') return +Car.GetHeading(c); } catch(e) {}
  return 0;
}

function getCarPitch(c) {
  if (!c) return 0;
  const obj = toCar(c);
  if (!obj) return 0;
  try {
    if (typeof obj.getPitch === 'function') {
      const p = +obj.getPitch();
      if (!isNaN(p)) return p;
    }
  } catch(e) {}
  try {
    if (typeof Car !== 'undefined' && typeof Car.GetPitch === 'function') {
      const p = +Car.GetPitch(obj);
      if (!isNaN(p)) return p;
    }
  } catch(e) {}
  return 0;
}

function setCarPitchAndHeading(c, pitch, heading) {
  if (!c) return;
  const obj = toCar(c);
  if (!obj) return;
  try { if (typeof obj.setHeading === 'function') obj.setHeading(heading); } catch(e) {}
  if (pitch && Math.abs(pitch) >= 0.5) {
    try {
      const pRad = (pitch * Math.PI) / 180 / 2;
      const yRad = (heading * Math.PI) / 180 / 2;
      const qx = Math.sin(pRad) * Math.cos(yRad);
      const qy = -Math.sin(pRad) * Math.sin(yRad);
      const qz = Math.cos(pRad) * Math.sin(yRad);
      const qw = Math.cos(pRad) * Math.cos(yRad);

      if (typeof obj.setQuaternion === 'function') {
        obj.setQuaternion(qx, qy, qz, qw);
      } else if (typeof Car !== 'undefined' && typeof Car.SetQuaternion === 'function') {
        Car.SetQuaternion(obj, qx, qy, qz, qw);
      }
    } catch(e) {}
  }
}



function getCarColors(c) {
  if (!c) return { c1: 0, c2: 0 };
  try {
    let c1 = undefined, c2 = undefined;
    if (typeof c.getColors === 'function') {
      const clrs = c.getColors();
      if (clrs) {
        c1 = clrs.color1 !== undefined ? clrs.color1 : (clrs.primary !== undefined ? clrs.primary : clrs[0]);
        c2 = clrs.color2 !== undefined ? clrs.color2 : (clrs.secondary !== undefined ? clrs.secondary : clrs[1]);
      }
    }
    if ((c1 === undefined || c2 === undefined) && typeof Car !== 'undefined' && typeof Car.GetColors === 'function') {
      const clrs = Car.GetColors(c);
      if (clrs) {
        c1 = clrs.color1 !== undefined ? clrs.color1 : (clrs.primary !== undefined ? clrs.primary : clrs[0]);
        c2 = clrs.color2 !== undefined ? clrs.color2 : (clrs.secondary !== undefined ? clrs.secondary : clrs[1]);
      }
    }
    if (c1 !== undefined && c2 !== undefined && !isNaN(+c1) && !isNaN(+c2)) {
      return { c1: Math.round(+c1), c2: Math.round(+c2) };
    }
  } catch(e) {}
  return { c1: 0, c2: 0 };
}

function getCarExtraColors(c) {
  try {
    if (typeof c.getExtraColors === 'function') {
      const e = c.getExtraColors();
      if (e) {
        const c3 = e.color3 !== undefined ? e.color3 : (e[0] !== undefined ? e[0] : -1);
        const c4 = e.color4 !== undefined ? e.color4 : (e[1] !== undefined ? e[1] : -1);
        return { c3: +c3, c4: +c4 };
      }
    } else if (typeof Car !== 'undefined' && typeof Car.GetExtraColors === 'function') {
      const e = Car.GetExtraColors(c);
      if (e) {
        const c3 = e.color3 !== undefined ? e.color3 : (e[0] !== undefined ? e[0] : -1);
        const c4 = e.color4 !== undefined ? e.color4 : (e[1] !== undefined ? e[1] : -1);
        return { c3: +c3, c4: +c4 };
      }
    }
  } catch(e) {}
  return { c3: -1, c4: -1 };
}

function setCarExtraColors(c, c3, c4) {
  if (!c || c3 === undefined || c3 === null || c3 < 0 || c4 === undefined || c4 === null || c4 < 0) return;
  try {
    if (typeof c.setExtraColors === 'function') {
      c.setExtraColors(c3, c4);
    } else if (typeof Car !== 'undefined' && typeof Car.SetExtraColors === 'function') {
      Car.SetExtraColors(c, c3, c4);
    }
  } catch(e) {}
}

function getCarPaintjob(c) {
  if (!c) return -1;
  try {
    let pj = -1;
    if (typeof c.getCurrentPaintjob === 'function') pj = c.getCurrentPaintjob();
    else if (typeof Car !== 'undefined' && typeof Car.GetCurrentPaintjob === 'function') pj = Car.GetCurrentPaintjob(c);
    if (pj !== undefined && pj !== null && pj >= 0 && pj <= 5) return pj;
  } catch(e) {}
  return -1;
}

function setCarPaintjob(c, pjId) {
  if (!c || pjId === undefined || pjId === null || pjId < 0) return;
  try {
    if (typeof c.givePaintjob === 'function') c.givePaintjob(pjId);
    else if (typeof Car !== 'undefined' && typeof Car.GivePaintjob === 'function') Car.GivePaintjob(c, pjId);
  } catch(e) {}
}

function getCarSpd(c) {
  try { if (typeof c.getSpeed === 'function') return +c.getSpeed(); } catch(e) {}
  try { if (typeof Car !== 'undefined' && typeof Car.GetSpeed === 'function') return +Car.GetSpeed(c); } catch(e) {}
  return 0;
}

function getCarHealth(c) {
  if (!c) return 1000;
  try {
    const obj = toCar(c);
    let val = undefined;
    if (obj && typeof obj.getHealth === 'function') val = obj.getHealth();
    if (val !== undefined && val !== null && !isNaN(+val)) return Math.round(+val);
  } catch(e) {
    log("LOGGER: getCarHealth error: " + (e.stack || e));
  }
  return 1000;
}

function setCarHealth(c, health) {
  if (!c || health <= 0) return;
  const h = Math.round(+health);
  try {
    if (typeof c.setHealth === 'function') { c.setHealth(h); }
    else if (typeof Car !== 'undefined' && typeof Car.SetHealth === 'function') { Car.SetHealth(c, h); }
  } catch(e) {
    log("LOGGER: setCarHealth error: " + (e.stack || e));
  }
}

function getCarDamage(c) {
  const obj = toCar(c);
  if (!obj) return { panels: [], doors: [] };
  const mid = getCarModelId(c);
  if (!isAutomobileModel(mid)) return { panels: [], doors: [] };

  const doors = [];
  for (let d = 0; d <= 5; d++) {
    try {
      let isDam = false;
      if (typeof obj.isDoorDamaged === 'function') isDam = obj.isDoorDamaged(d);
      else if (typeof Car !== 'undefined' && typeof Car.IsDoorDamaged === 'function') isDam = Car.IsDoorDamaged(obj, d);
      if (isDam) doors.push(d);
    } catch(e) {}
  }

  const panels = [];
  for (let p = 0; p <= 6; p++) {
    try {
      let isDam = false;
      if (typeof obj.isPanelDamaged === 'function') isDam = obj.isPanelDamaged(p);
      else if (typeof Car !== 'undefined' && typeof Car.IsPanelDamaged === 'function') isDam = Car.IsPanelDamaged(obj, p);
      if (isDam) panels.push(p);
    } catch(e) {}
  }

  if (!panels.length && doors.length) {
    if (doors.indexOf(0) !== -1) panels.push(2); // Bonnet
    if (doors.indexOf(1) !== -1) panels.push(3); // Trunk
  }

  return { panels: panels, doors: doors };
}

function applyStoredDamage(c, panels, doors) {
  if (!c) return;
  const obj = toCar(c);
  if (!obj) return;
  const mid = getCarModelId(c);
  if (!isAutomobileModel(mid)) return;

  if (panels && panels.length) {
    for (const p of panels) {
      try {
        if (typeof obj.damagePanel === 'function') obj.damagePanel(p);
        else if (typeof Car !== 'undefined' && typeof Car.DamagePanel === 'function') Car.DamagePanel(obj, p);
      } catch(e) {}
    }
  }

  if (doors && doors.length) {
    for (const d of doors) {
      try {
        if (typeof obj.damageDoor === 'function') obj.damageDoor(d);
        else if (typeof Car !== 'undefined' && typeof Car.DamageDoor === 'function') Car.DamageDoor(obj, d);
      } catch(e) {}
    }
  }
}

function getCarPoppedTires(c) {
  if (!c) return [];
  const mid = getCarModelId(c);
  if (mid === 509 || mid === 481 || mid === 510) return [];
  if (!isAutomobileModel(mid) && !isBikeModel(mid)) return [];

  const popped = [];
  for (let i = 0; i < 4; i++) {
    try {
      let isBurst = false;
      if (typeof c.isTireBurst === 'function') isBurst = c.isTireBurst(i);
      else if (typeof Car !== 'undefined' && typeof Car.IsTireBurst === 'function') isBurst = Car.IsTireBurst(c, i);
      if (isBurst) popped.push(i);
    } catch(e) {}
  }
  return popped;
}

function setCarPoppedTires(c, tiresArray) {
  if (!c || !tiresArray || !tiresArray.length) return;
  const mid = getCarModelId(c);
  if (mid === 509 || mid === 481 || mid === 510) return;
  if (!isAutomobileModel(mid) && !isBikeModel(mid)) return;
  for (const t of tiresArray) {
    try {
      if (typeof c.burstTire === 'function') c.burstTire(t);
      else if (typeof Car !== 'undefined' && typeof Car.BurstTire === 'function') Car.BurstTire(c, t);
    } catch(e) {}
  }
}



function deleteCarHandle(c) {
  if (!c) return;
  try {
    const player = new Player(0);
    const char   = player.getChar();
    if (char && char.isInAnyCar()) {
      const pc = getCarHandle(char);
      if (pc && (c === pc || (c.handle && pc.handle && c.handle === pc.handle))) {
        log("LOGGER: BLOCKED deleteCarHandle — target is player active vehicle!");
        return;
      }
    }
  } catch(e) {}
  try { if (typeof c.delete === 'function') { c.delete(); return; } } catch(e) {}
  try { if (typeof Car !== 'undefined' && typeof Car.Delete === 'function') { Car.Delete(c); return; } } catch(e) {}
}

function loadModelSync(id) {
  Streaming.RequestModel(id);
  Streaming.LoadAllModelsNow();
  return Streaming.HasModelLoaded(id);
}

function spawnCarAt(modelId, x, y, z) {
  if (!loadModelSync(modelId)) return null;
  const spawnZ = z - 1.0;
  const car = Car.Create(modelId, x, y, spawnZ);
  if (car) {
    try {
      if (typeof car.setCoordinatesNoOffset === 'function') {
        car.setCoordinatesNoOffset(x, y, spawnZ);
      } else if (typeof Car !== 'undefined' && typeof Car.SetCoordinatesNoOffset === 'function') {
        Car.SetCoordinatesNoOffset(car, x, y, spawnZ);
      }
    } catch(e) {}
  }
  Streaming.MarkModelAsNoLongerNeeded(modelId);
  return car || null;
}

// ════════════════════════════════════════════════════════════════
//  MENU  — commute's showNativeMenu pattern
// ════════════════════════════════════════════════════════════════
function drainKeys() {
  while (
    Pad.IsKeyPressed(VK_UP)    || Pad.IsKeyPressed(VK_KEY_W) || Pad.IsKeyPressed(VK_NUM8) ||
    Pad.IsKeyPressed(VK_DOWN)  || Pad.IsKeyPressed(VK_KEY_S) || Pad.IsKeyPressed(VK_NUM2) ||
    Pad.IsKeyPressed(VK_LEFT)  || Pad.IsKeyPressed(VK_KEY_A) || Pad.IsKeyPressed(VK_NUM4) ||
    Pad.IsKeyPressed(VK_RIGHT) || Pad.IsKeyPressed(VK_KEY_D) || Pad.IsKeyPressed(VK_NUM6) ||
    Pad.IsKeyPressed(VK_ENTER) || Pad.IsKeyPressed(VK_SPACE) || Pad.IsKeyPressed(VK_NUM5) ||
    Pad.IsKeyPressed(VK_ESC)
  ) wait(0);
}

function renderParkedMenu(entries, sel) {
  const total = entries ? entries.length : 0;
  if (total === 0) {
    showTextBox("~y~PARKED VEHICLES GARAGE~n~~r~No saved vehicles in storage.~n~~w~Press F6 to exit.");
    return;
  }

  const pageSize   = 5;
  const totalPages = Math.ceil(total / pageSize);
  const curPage    = Math.floor(sel / pageSize) + 1;
  const startPage  = Math.floor(sel / pageSize) * pageSize;
  const endPage    = Math.min(startPage + pageSize, total);

  // 1. HEADER TITLE
  let txt = "~y~PARKED GARAGE~n~";

  // 2. VEHICLE LIST ROWS
  for (let i = startPage; i < endPage; i++) {
    const d    = parseEntry(entries[i]);
    let name   = d ? (d.name || getVehicleName(d.modelId)) : ("" + (d ? d.modelId : ""));
    if (typeof name === 'string' && name.indexOf("Model ") === 0) name = name.substring(6);

    if (i === sel) {
      txt += "~g~> " + (i + 1) + ". " + name + "~n~";
    } else {
      txt += "~w~  " + (i + 1) + ". " + name + "~n~";
    }
  }

  // 3. FOOTER CONTROL HINTS (Numpad 8, 2, 4, 6)
  txt += "~w~8/2=Move & Teleport  4/6=Page  F6=Exit";

  showTextBox(txt);
}

function purgeDestroyedEntries() {
  try {
    const entries = readDisk();
    if (!entries || !entries.length) return [];
    let modified = false;
    const clean = [];
    for (let i = 0; i < entries.length; i++) {
      const d = parseEntry(entries[i]);
      if (!d) continue;
      const key = getUniqueKey(d);
      if (streamed.hasOwnProperty(key)) {
        const h = streamed[key];
        if (!isCarValid(h) || isCarDestroyed(h)) {
          delete streamed[key];
          modified = true;
          continue;
        }
      }
      clean.push(entries[i]);
    }
    if (modified) {
      writeDisk(clean);
      cache = clean;
    }
    return cache;
  } catch(e) {
    return cache || [];
  }
}

function runMenu(player, char) {
  cache = purgeDestroyedEntries();
  const entries = cache;

  drainKeys();

  let sel    = 0;
  let upD    = false, downD  = false;
  let leftD  = false, rightD = false;
  let enterD = false, f6D = true;

  renderParkedMenu(entries, sel);

  while (true) {
    wait(0);

    if (char.isInAnyCar() || player.isDead()) {
      break;
    }

    const total = entries ? entries.length : 0;
    if (total === 0) {
      const f6N = Pad.IsKeyPressed(VK_F6);
      if (f6N && !f6D) break;
      f6D = f6N;
      continue;
    }

    const pageSize = 5;

    const upN    = Pad.IsKeyPressed(VK_NUM8);
    const downN  = Pad.IsKeyPressed(VK_NUM2);
    const leftN  = Pad.IsKeyPressed(VK_NUM4);
    const rightN = Pad.IsKeyPressed(VK_NUM6);
    const enterN = Pad.IsKeyPressed(VK_NUM5);
    const f6N    = Pad.IsKeyPressed(VK_F6);

    if (f6N && !f6D) break;

    let changed = false;

    if (upN && !upD) {
      sel = (sel - 1 + total) % total;
      changed = true;
    }
    if (downN && !downD) {
      sel = (sel + 1) % total;
      changed = true;
    }
    if (leftN && !leftD) {
      sel = Math.max(0, sel - pageSize);
      changed = true;
    }
    if (rightN && !rightD) {
      sel = Math.min(total - 1, sel + pageSize);
      changed = true;
    }

    if (changed) {
      teleportTo(entries[sel], char, true);
      renderParkedMenu(entries, sel);
    }

    if (enterN && !enterD) {
      teleportTo(entries[sel], char, true);
      renderParkedMenu(entries, sel);
    }

    upD    = upN;
    downD  = downN;
    leftD  = leftN;
    rightD = rightN;
    enterD = enterN;
    f6D    = f6N;
  }

  clearMenuBox();
  drainKeys();
  f6WasDown = false;
}

function clearMenuBox() {
  try {
    if (typeof Text !== 'undefined' && typeof Text.ClearHelp === 'function') {
      Text.ClearHelp();
    } else if (typeof clearHelp === 'function') {
      clearHelp();
    }
  } catch(e) {}
}

function getTeleportOffset(mid) {
  if (isBoatModel(mid)) return { dist: 0.0, zOffset: 1.5 };
  if (isBikeModel(mid)) return { dist: 1.5, zOffset: 0.3 };
  if (isAircraftModel(mid)) return { dist: 5.0, zOffset: 0.3 };
  return { dist: 2.3, zOffset: 0.3 };
}

function setCharCoordinates(char, x, y, z) {
  if (!char) return;
  try { if (typeof char.setCoordinates === 'function') { char.setCoordinates(x, y, z); return; } } catch(e) {}
  try { if (typeof Char !== 'undefined' && typeof Char.SetCoordinates === 'function') { Char.SetCoordinates(char, x, y, z); return; } } catch(e) {}
}

function setCharHeading(char, hdg) {
  try { if (typeof char.setHeading === 'function') { char.setHeading(hdg); return; } } catch(e) {}
  try { if (typeof Char !== 'undefined' && typeof Char.SetHeading === 'function') { Char.SetHeading(char, hdg); return; } } catch(e) {}
}

function teleportTo(line, char, silent) {
  try {
    const d = parseEntry(line);
    if (!d) return;

    const key = getUniqueKey(d);
    if (streamed.hasOwnProperty(key)) {
      const h = streamed[key];
      if (!isCarValid(h) || isCarDestroyed(h)) {
        log("LOGGER: Cannot teleport — target vehicle was destroyed!");
        delete streamed[key];
        const entries = readDisk();
        if (entries) {
          const clean = entries.filter(e => e !== line);
          writeDisk(clean);
          cache = clean;
        }
        if (CFG.tooltips) showTextBox("~r~Cannot teleport — vehicle was destroyed!~n~~w~Entry removed.");
        return;
      }
    }

    const cfg = getTeleportOffset(d.modelId);
    const heading = d.heading || 0;
    
    // Offset onto the DRIVER DOOR (left) side of the vehicle based on cardinal heading
    const rad = (heading + 90) * Math.PI / 180;
    const tpX = d.x - Math.sin(rad) * cfg.dist;
    const tpY = d.y + Math.cos(rad) * cfg.dist;
    const tpZ = d.z + cfg.zOffset;

    setCharCoordinates(char, tpX, tpY, tpZ);
    setCharHeading(char, heading - 90);

    try {
      if (typeof Camera !== 'undefined' && typeof Camera.SetBehindPlayer === 'function') {
        Camera.SetBehindPlayer();
      }
    } catch(e) {}

    const name = getVehicleName(d.modelId);
    const coords = d.x.toFixed(0) + "," + d.y.toFixed(0);
    log("LOGGER: teleported to " + name + " at " + coords + " (Health: " + (d.health || 1000) + " HP)");
    if (!silent && CFG.tooltips) {
      showTextBox("~g~Teleported to ~y~" + name + "~g~ (~y~" + coords + "~g~)!");
    }
    runStreamer(char);
  } catch(e) {
    log("LOGGER: teleportTo error: " + (e.stack || e));
  }
}

function getUniqueKey(d) {
  if (!d) return "";
  return d.modelId + "_" + d.x.toFixed(2) + "_" + d.y.toFixed(2) + "_" + d.z.toFixed(2);
}



// ════════════════════════════════════════════════════════════════
//  STREAMER
// ════════════════════════════════════════════════════════════════
function runStreamer(char) {
  try {
    const pp      = char.getCoordinates();
    if (!pp) return;
    const entries = cache;
    if (!entries || !entries.length) return;

    let playerCar = null;
    try { if (char.isInAnyCar()) playerCar = getCarHandle(char); } catch(e) {}

    const inSq  = CFG.streamIn  * CFG.streamIn;
    const outSq = CFG.streamOut * CFG.streamOut;

    for (let i = entries.length - 1; i >= 0; i--) {
      const line = entries[i];
      const d    = parseEntry(line);
      if (!d) continue;

      const key = getUniqueKey(d);
      const dx  = pp.x - d.x, dy = pp.y - d.y, dz = pp.z - d.z;
      const sq  = dx*dx + dy*dy + dz*dz;
      const h   = streamed[key];

      if (sq <= inSq) {
        if (streamed.hasOwnProperty(key)) {
          if (playerCar && h === playerCar) {
            // Player is inside this vehicle! Do NOT process destruction or delete handle!
            continue;
          }
          // If the spawned vehicle was destroyed / exploded
          if (!isCarValid(h) || isCarDestroyed(h)) {
            const name = getVehicleName(d.modelId);
            log("LOGGER: Parked vehicle " + name + " at " + d.x.toFixed(0) + "," + d.y.toFixed(0) + " was destroyed! Removed from list.");
            if (CFG.tooltips) showTextBox("~r~Parked ~y~" + name + " ~r~was destroyed! Entry removed.");

            delete streamed[key];
            entries.splice(i, 1);
            cache = entries;
            writeDisk(cache);
            continue;
          }

          // If stationary/stopped after being hit or moved, update stored position & damage
          const rawSpd = getCarSpd(h);
          const speed  = (isNaN(rawSpd) || rawSpd < 0) ? 0 : rawSpd;
          if (speed < 0.05) {
            updateParkedCarStateIfNeeded(h, d, i, entries);
          }
        } else {
          // If player is driving right through this exact spot (< 6m), defer spawn to prevent collision mesh rebuild crush
          if (playerCar && sq < 36.0) {
            continue;
          }

          clearNearbyNonTracked(d.x, d.y, d.z, 0.1, playerCar);
          const nc = spawnCarAt(d.modelId, d.x, d.y, d.z);
          if (nc) {
            setCarPitchAndHeading(nc, d.pitch || 0, d.heading || 0);
            try { nc.changeColor(d.primaryColor, d.secondaryColor); } catch(e) {}
            if (d.paintjob !== undefined && d.paintjob !== null && d.paintjob >= 0) {
              setCarPaintjob(nc, d.paintjob);
              try { nc.changeColor(d.primaryColor, d.secondaryColor); } catch(e) {}
            }
            if (d.extraColor1 >= 0 && d.extraColor2 >= 0) {
              setCarExtraColors(nc, d.extraColor1, d.extraColor2);
            }
            if (CFG.unlockDoors && isAutomobileModel(d.modelId)) try { nc.lockDoors(1); } catch(e) {}
            if (CFG.saveHealth && d.health && d.health > 250 && d.health <= 1000) {
              setCarHealth(nc, d.health);
            }
            applyStoredDamage(nc, d.panels, d.doors);
            if (CFG.saveTires && d.tires && d.tires.length > 0) {
              setCarPoppedTires(nc, d.tires);
            }
            if (d.upgrades && d.upgrades.length > 0) {
              for (const m of d.upgrades) {
                if (m >= 1000 && m <= 1193 && loadModelSync(m)) {
                  try {
                    if (typeof nc.addMod === 'function') nc.addMod(m);
                    else if (typeof Car !== 'undefined' && typeof Car.AddMod === 'function') Car.AddMod(nc, m);
                  } catch(e) {}
                  Streaming.MarkModelAsNoLongerNeeded(m);
                }
              }
            }
            streamed[key] = nc;
            spawnTimeMap[key] = Date.now();
            log("LOGGER: Streamed IN vehicle " + (d.name || getVehicleName(d.modelId)) + " at " + d.x.toFixed(1) + "," + d.y.toFixed(1));
          }
        }
      } else if (sq > outSq) {
        if (h) {
          let isPlayerActiveCar = false;
          try {
            if (char.isInAnyCar()) {
              const pc = getCarHandle(char);
              if (pc && (h === pc || (h.handle && pc.handle && h.handle === pc.handle))) {
                isPlayerActiveCar = true;
              }
            }
          } catch(e) {}

          if (!isPlayerActiveCar && isCarValid(h)) {
            updateParkedCarStateIfNeeded(h, d, i, entries);
            deleteCarHandle(h);
            log("LOGGER: Streamed OUT vehicle " + (d.name || getVehicleName(d.modelId)));
          }
          delete streamed[key];
          delete spawnTimeMap[key];
        }
      }
    }
  } catch(e) {
    log("LOGGER: streamer error: " + (e.stack || e));
  }
}

function updateParkedCarStateIfNeeded(h, d, i, entries) {
  try {
    if (!isCarValid(h) || isCarDestroyed(h)) return false;
    const oldKey = getUniqueKey(d);
    const spawnT = spawnTimeMap[oldKey] || 0;
    // 4-second grace period after spawn for physics & collision settlement (e.g. Packer ramps, trailers)
    if (Date.now() - spawnT < 4000) return false;

    const cp = getCarPos(h);
    const hdg = getCarHdg(h);
    const mDx = cp.x - d.x, mDy = cp.y - d.y, mDz = cp.z - d.z;
    const mDistSq = mDx*mDx + mDy*mDy + mDz*mDz;
    const mHdgDiff = Math.abs(hdg - d.heading);

    const curPitch = getCarPitch(h);
    const mPitchDiff = Math.abs(curPitch - (d.pitch || 0));

    if (mDistSq >= 0.25 || mHdgDiff >= 5.0 || mPitchDiff >= 5.0) {
      const hp     = getCarHealth(h);
      if (hp <= 250) return false;

      const clrs   = getCarColors(h);
      const extraC = getCarExtraColors(h);
      const mods   = getCarMods(h, d.modelId);
      const tires  = getCarPoppedTires(h);
      const pj     = getCarPaintjob(h);
      const dam    = getCarDamage(h);

      const newLine = formatMinifiedEntry({
        modelId: d.modelId, x: cp.x, y: cp.y, z: cp.z, heading: hdg,
        pitch: curPitch,
        primaryColor: clrs.c1, secondaryColor: clrs.c2,
        extraColor1: extraC.c3, extraColor2: extraC.c4,
        paintjob: pj, health: (CFG.saveHealth ? hp : 1000),
        tires: (CFG.saveTires ? tires : []),
        panels: dam.panels, doors: dam.doors,
        upgrades: mods
      });

      const oldKey = getUniqueKey(d);
      entries[i] = newLine;
      cache = entries;
      writeDisk(cache);

      if (oldKey && streamed.hasOwnProperty(oldKey)) {
        delete streamed[oldKey];
        delete spawnTimeMap[oldKey];
      }

      const newD = parseEntry(newLine);
      const newKey = getUniqueKey(newD);
      if (newKey) {
        streamed[newKey] = h;
        spawnTimeMap[newKey] = Date.now();
      }

      log("LOGGER: Updated position for moved parked " + getVehicleName(d.modelId) + " to " + cp.x.toFixed(1) + "," + cp.y.toFixed(1));
      return true;
    }
  } catch(e) {
    log("LOGGER: updateParkedCarState error: " + (e.stack || e));
  }
  return false;
}

function clearNearbyNonTracked(x, y, z, r, playerCar) {
  try {
    let next = false;
    for (let i = 0; i < 10; i++) {
      const c = World.GetRandomCarInSphereNoSaveRecursive(x, y, z, r, next, false);
      if (!c) break;
      const valid = isCarValid(c);
      if (!valid) break;
      if (playerCar && c === playerCar) { next = true; continue; }
      if (lastCarHandle && c === lastCarHandle) { next = true; continue; }

      let isTracked = false;
      for (const k in streamed) {
        if (streamed[k] && streamed[k] === c) { isTracked = true; break; }
      }
      if (isTracked) { next = true; continue; }

      deleteCarHandle(c);
      next = true;
    }
  } catch(e) {}
}

// ════════════════════════════════════════════════════════════════
//  CLAIM CAR
// ════════════════════════════════════════════════════════════════
function tryClaimCar(car, char) {
  try {
    let sitting = false;
    try { if (typeof char.isSittingInCar === 'function') sitting = char.isSittingInCar(car); } catch(e) {}
    try { if (!sitting && typeof Char !== 'undefined' && typeof Char.IsSittingInCar === 'function') sitting = Char.IsSittingInCar(char, car); } catch(e) {}
    if (!sitting) return;

    const mid  = getCarModelId(car);
    const cp   = getCarPos(car);
    const ents = cache;
    if (!ents || !ents.length) return;

    let bestIdx = -1, bestDist = 1e9;
    for (let i = 0; i < ents.length; i++) {
      const d = parseEntry(ents[i]);
      if (!d || d.modelId !== mid) continue;
      const sq = (cp.x-d.x)**2 + (cp.y-d.y)**2 + (cp.z-d.z)**2;
      if (sq < bestDist) { bestDist = sq; bestIdx = i; }
    }
    if (bestIdx !== -1) {
      const ln  = ents[bestIdx];
      const d   = parseEntry(ln);
      const key = d ? getUniqueKey(d) : "";
      if (key && streamed[key]) delete streamed[key];
      if (streamed[ln]) delete streamed[ln];
      ents.splice(bestIdx, 1);
      writeDisk(ents);
      cache = ents;
      const coords = d ? (d.x.toFixed(0) + "," + d.y.toFixed(0)) : "";
      log("LOGGER: claimed vehicle at " + coords + ", entry removed");
      if (CFG.tooltips) showTextBox("~y~Claimed vehicle! ~g~Entry removed.");
    }
  } catch(e) {
    log("LOGGER: claim error: " + (e.stack || e));
  }
}

// ════════════════════════════════════════════════════════════════
//  PENDING EXIT QUEUE
// ════════════════════════════════════════════════════════════════
function runPending(char) {
  if (!pending.length) return;
  const now = Date.now();

  const player = new Player(0);
  if (player.isDead()) {
    log("LOGGER: Player is dead — clearing pending exit queue.");
    pending = [];
    return;
  }

  let playerCar = null;
  try { if (char.isInAnyCar()) playerCar = getCarHandle(char); } catch(e) {}

  for (let i = pending.length - 1; i >= 0; i--) {
    const item = pending[i];
    const c    = item.car;
    try {
      if (!isCarValid(c) || isCarDestroyed(c)) {
        log("LOGGER: Discarded vehicle handle from pending exit queue — vehicle on fire / destroyed");
        if (CFG.tooltips) showTextBox("~r~Vehicle on fire or destroyed!~n~~w~Exit position not saved.");
        pending.splice(i, 1);
        continue;
      }
      const mid = getCarModelId(c);
      if (mid <= 0) { pending.splice(i, 1); continue; }
      if (playerCar && (c === playerCar || (typeof char.isSittingInCar === 'function' && char.isSittingInCar(c)))) { pending.splice(i, 1); continue; }

      const rawSpd = getCarSpd(c);
      const speed  = (isNaN(rawSpd) || rawSpd < 0) ? 0 : rawSpd;

      if (speed < 0.05) {
        saveCarExit(c);
        pending.splice(i, 1);
      }
    } catch(e) {
      log("LOGGER: runPending error on item: " + (e.stack || e));
      pending.splice(i, 1);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  SAVE CAR EXIT
// ════════════════════════════════════════════════════════════════
function formatMinifiedEntry(d) {
  if (!d) return "";
  const clrStr = (d.extraColor1 >= 0 && d.extraColor2 >= 0)
               ? (d.primaryColor + "," + d.secondaryColor + "," + d.extraColor1 + "," + d.extraColor2)
               : (d.primaryColor + "," + d.secondaryColor);
  const pjStr = (d.paintjob !== undefined && d.paintjob !== null && d.paintjob >= 0) ? d.paintjob : "";
  const trStr = (d.tires && d.tires.length) ? d.tires.join(",") : "";
  const dmStr = (d.panels && d.panels.length) ? d.panels.join(",") : "";
  const ddStr = (d.doors && d.doors.length) ? d.doors.join(",") : "";
  const pitStr = (d.pitch !== undefined && d.pitch !== null && Math.abs(d.pitch) >= 0.5) ? d.pitch.toFixed(1) : "";
  const uStr  = (d.upgrades && d.upgrades.length) ? d.upgrades.join(",") : "";

  return d.modelId + "|" +
         d.x.toFixed(2) + "," + d.y.toFixed(2) + "," + d.z.toFixed(2) + "|" +
         d.heading.toFixed(1) + "|" +
         clrStr + "|" +
         pjStr + "|" +
         d.health + "|" +
         trStr + "|" +
         dmStr + "|" +
         ddStr + "|" +
         pitStr + "|" +
         uStr;
}

function saveCarExit(car) {
  try {
    const player = new Player(0);
    if (player.isDead()) {
      log("LOGGER: Skipped saving exit — player is dead.");
      return;
    }
    const hp = getCarHealth(car);
    if (hp <= 250 || isCarDestroyed(car)) {
      log("LOGGER: Skipped saving exit — vehicle health <= 250 (" + hp + " HP)");
      if (CFG.tooltips) showTextBox("~r~Vehicle destroyed!~n~~w~Exit position not saved.");
      return;
    }
    const mid = getCarModelId(car);
    if (mid <= 0) return;

    const cp     = getCarPos(car);
    const hdg    = getCarHdg(car);
    const pit    = getCarPitch(car);
    const clrs   = getCarColors(car);
    const extraC = getCarExtraColors(car);
    const mods   = getCarMods(car, mid);
    const name   = getVehicleName(mid);
    const tires  = getCarPoppedTires(car);
    const pj     = getCarPaintjob(car);
    const dam    = getCarDamage(car);

    const line = formatMinifiedEntry({
      modelId: mid, x: cp.x, y: cp.y, z: cp.z, heading: hdg,
      pitch: pit,
      primaryColor: clrs.c1, secondaryColor: clrs.c2,
      extraColor1: extraC.c3, extraColor2: extraC.c4,
      paintjob: pj, health: (CFG.saveHealth ? hp : 1000),
      tires: (CFG.saveTires ? tires : []),
      panels: dam.panels, doors: dam.doors,
      upgrades: mods
    });

    const ents = readDisk();
    ents.push(line);
    while (ents.length > CFG.maxEntries) ents.shift();
    writeDisk(ents);
    cache = ents;

    const d   = parseEntry(line);
    const key = getUniqueKey(d);
    if (key) streamed[key] = car;

    log("LOGGER: SUCCESS! Saved exit for " + name + " at " + cp.x.toFixed(0) + "," + cp.y.toFixed(0) + " | Health: " + hp + " HP (" + line + ")");
    if (CFG.tooltips) showTextBox("~g~Saved ~y~" + name);
  } catch(e) {
    log("LOGGER: saveCarExit error: " + (e.stack || e));
  }
}

// ════════════════════════════════════════════════════════════════
//  PARSE ENTRY
// ════════════════════════════════════════════════════════════════
function parseEntry(line) {
  if (!line || typeof line !== 'string') return null;
  const s = line.trim();
  if (!s || s.indexOf("[") === 0 || s.indexOf(";") === 0 || s.indexOf("#") === 0) return null;

  try {
    // 1. Ultra-Minified Positional Format: mid|x,y,z|hdg|c1,c2,c3,c4|pj|hp|tires|panels|doors|mods
    if (s.indexOf("|") !== -1 && s.indexOf("M:") === -1 && s.indexOf("Model:") === -1) {
      const parts = s.split("|");
      if (parts.length >= 3) {
        const mid = parseInt(parts[0], 10);
        if (isNaN(mid) || mid <= 0) return null;
        const cParts = parts[1].split(",");
        if (cParts.length < 3) return null;
        const x = parseFloat(cParts[0]), y = parseFloat(cParts[1]), z = parseFloat(cParts[2]);

        const hdg = parts[2] ? parseFloat(parts[2]) : 0;
        const clrParts = parts[3] ? parts[3].split(",") : [];
        const c1 = clrParts[0] !== undefined ? parseInt(clrParts[0], 10) : 0;
        const c2 = clrParts[1] !== undefined ? parseInt(clrParts[1], 10) : 0;
        const c3 = (clrParts.length >= 4 && clrParts[2] !== undefined) ? parseInt(clrParts[2], 10) : -1;
        const c4 = (clrParts.length >= 4 && clrParts[3] !== undefined) ? parseInt(clrParts[3], 10) : -1;
        const pj = parts[4] ? parseInt(parts[4], 10) : -1;
        const hp = parts[5] ? parseInt(parts[5], 10) : 1000;

        const tires = [];
        if (parts[6]) {
          for (const p of parts[6].split(",")) {
            const n = parseInt(p, 10);
            if (n >= 0 && n <= 5) tires.push(n);
          }
        }

        const panels = [];
        if (parts[7]) {
          for (const p of parts[7].split(",")) {
            const n = parseInt(p, 10);
            if (n >= 0 && n <= 6) panels.push(n);
          }
        }

        const doors = [];
        if (parts[8]) {
          for (const p of parts[8].split(",")) {
            const n = parseInt(p, 10);
            if (n >= 0 && n <= 5) doors.push(n);
          }
        }

        let pitch = 0;
        let upgradesPart = parts[9];

        if (parts[9]) {
          const p9vals = parts[9].split(",").map(v => parseFloat(v)).filter(v => !isNaN(v));
          if (p9vals.length === 1 && (p9vals[0] < 1000 || p9vals[0] > 1193)) {
            pitch = p9vals[0];
            upgradesPart = parts[10] || "";
          } else if (p9vals.every(v => v >= 1000 && v <= 1193)) {
            upgradesPart = parts[9];
          }
        } else if (parts[10]) {
          upgradesPart = parts[10];
        }

        const upgrades = [];
        if (upgradesPart) {
          for (const p of upgradesPart.split(",")) {
            const n = parseInt(p, 10);
            if (n >= 1000 && n <= 1193) upgrades.push(n);
          }
        }

        return {
          modelId: mid,
          name: getVehicleName(mid),
          x: x, y: y, z: z,
          heading: hdg,
          pitch: pitch,
          primaryColor: c1,
          secondaryColor: c2,
          extraColor1: c3,
          extraColor2: c4,
          paintjob: pj,
          health: hp,
          tires: tires,
          panels: panels,
          doors: doors,
          upgrades: upgrades,
        };
      }
    }

    // 2. Legacy Key-Value Tag Format (M:mid|...)
    const mM   = s.match(/(?:Model:|M:)(\d+)/);
    const cM   = s.match(/(?:Coords:|C:)(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/);
    if (!mM || !cM) return null;
    const nM   = s.match(/(?:Name:|N:)([^|\r\n]+)/);
    const hM   = s.match(/(?:Heading:|H:)(-?[\d.]+)/);
    const clM  = s.match(/(?:Colors:|Cl:)(\d+),(\d+)(?:,(\d+),(\d+))?/);
    const pjM  = s.match(/(?:Paintjob:|P:)(\d+)/);
    const hpM  = s.match(/(?:Health:|Hp:)(\d+)/);
    const trM  = s.match(/(?:Tires:|Tr:)([^|\r\n]+)/);
    const dmM  = s.match(/(?:Panels:|Dm:)([^|\r\n]+)/);
    const ddM  = s.match(/(?:Doors:|Dd:)([^|\r\n]+)/);
    const uM   = s.match(/(?:Upgrades:|U:)([^|\r\n]+)/);
    const paintjob = pjM ? parseInt(pjM[1], 10) : -1;
    const tires = [];
    if (trM && trM[1].trim() !== "None") {
      for (const p of trM[1].trim().split(/[;,]/)) {
        const n = parseInt(p, 10);
        if (n >= 0 && n <= 5) tires.push(n);
      }
    }
    const panels = [];
    if (dmM && dmM[1].trim() !== "None") {
      for (const p of dmM[1].trim().split(/[;,]/)) {
        const n = parseInt(p, 10);
        if (n >= 0 && n <= 6) panels.push(n);
      }
    }
    const doors = [];
    if (ddM && ddM[1].trim() !== "None") {
      for (const p of ddM[1].trim().split(/[;,]/)) {
        const n = parseInt(p, 10);
        if (n >= 0 && n <= 5) doors.push(n);
      }
    }
    const upgrades = [];
    if (uM && uM[1].trim() !== "None") {
      for (const p of uM[1].trim().split(/[;,]/)) {
        const n = parseInt(p, 10);
        if (n >= 1000 && n <= 1193) upgrades.push(n);
      }
    }
    const mid = parseInt(mM[1], 10);
    const x   = parseFloat(cM[1]);
    const y   = parseFloat(cM[2]);
    const z   = parseFloat(cM[3]);

    return {
      modelId:        mid,
      name:           (nM && nM[1].trim()) ? nM[1].trim() : getVehicleName(mid),
      x:              x,
      y:              y,
      z:              z,
      heading:        hM  ? parseFloat(hM[1])  : 0,
      primaryColor:   clM ? parseInt(clM[1], 10) : 0,
      secondaryColor: clM ? parseInt(clM[2], 10) : 0,
      extraColor1:    (clM && clM[3] !== undefined) ? parseInt(clM[3], 10) : -1,
      extraColor2:    (clM && clM[4] !== undefined) ? parseInt(clM[4], 10) : -1,
      paintjob:       paintjob,
      health:         hpM ? parseInt(hpM[1], 10) : 1000,
      tires:          tires,
      panels:         panels,
      doors:          doors,
      varA:           -1,  // legacy format: no extras stored
      varB:           -1,
      upgrades:       upgrades,
    };
  } catch(e) { return null; }
}

// ════════════════════════════════════════════════════════════════
//  DISK I/O
// ════════════════════════════════════════════════════════════════
function readDisk() {
  const lines = [];
  try {
    const count = IniFile.ReadInt(PARKED_PATH, "Vehicles", "Count") || 0;
    for (let i = 0; i < count && i < CFG.maxEntries; i++) {
      const v = IniFile.ReadString(PARKED_PATH, "Vehicles", "Entry" + i);
      if (v && v !== "NotFound" && v.trim().length > 0) lines.push(v.trim());
    }
  } catch(e) {
    log("LOGGER: readDisk error: " + (e.stack || e));
  }
  return lines;
}

function writeDisk(lines) {
  try {
    const clean = lines.filter(l => l && l.trim().length > 0 && l !== "NotFound");
    while (clean.length > CFG.maxEntries) clean.shift();
    IniFile.WriteInt(clean.length, PARKED_PATH, "Vehicles", "Count");
    for (let i = 0; i < clean.length; i++) {
      IniFile.WriteString(clean[i], PARKED_PATH, "Vehicles", "Entry" + i);
    }
    // Clear stale slots
    for (let i = clean.length; i < clean.length + 5; i++) {
      IniFile.WriteString("NotFound", PARKED_PATH, "Vehicles", "Entry" + i);
    }
    log("LOGGER: writeDisk wrote " + clean.length + " entries to " + PARKED_PATH);
  } catch(e) {
    log("LOGGER: writeDisk error: " + (e.stack || e));
  }
}

// ════════════════════════════════════════════════════════════════
//  CONFIG LOADER
// ════════════════════════════════════════════════════════════════
function loadConfig() {
  try {
    const r = IniFile.ReadFloat(CONFIG_PATH, "Settings", "StreamInRadius");
    if (r && r > 0) CFG.streamIn = r;
    const o = IniFile.ReadFloat(CONFIG_PATH, "Settings", "StreamOutRadius");
    if (o && o > 0) CFG.streamOut = o;
    const m = IniFile.ReadInt(CONFIG_PATH, "Settings", "MaxEntries");
    if (m && m > 0) CFG.maxEntries = m;
    const u = IniFile.ReadInt(CONFIG_PATH, "Settings", "AutoUnlockDoors");
    if (u !== null && u !== undefined) CFG.unlockDoors = (u === 1);
    const t = IniFile.ReadInt(CONFIG_PATH, "Settings", "EnableTooltips");
    if (t !== null && t !== undefined) CFG.tooltips = (t === 1);
    const h = IniFile.ReadInt(CONFIG_PATH, "Settings", "SaveVehicleHealth");
    if (h !== null && h !== undefined) CFG.saveHealth = (h === 1);
    const pt = IniFile.ReadInt(CONFIG_PATH, "Settings", "SavePoppedTires");
    if (pt !== null && pt !== undefined) CFG.saveTires = (pt === 1);
  } catch(e) {
    log("LOGGER: loadConfig error: " + (e.stack || e));
  }
}

// ════════════════════════════════════════════════════════════════
//  CAR MODS READER
// ════════════════════════════════════════════════════════════════
function getCarMods(car, modelId) {
  const mods = [];
  if (!isTunableVehicle(modelId)) return mods;
  if (!isCarUsable(car)) return mods;
  for (let slot = 0; slot <= 14; slot++) {
    try {
      let id = 0;
      if (typeof car.getCurrentMod === 'function') id = car.getCurrentMod(slot);
      if (!id && typeof Car !== 'undefined' && typeof Car.GetCurrentMod === 'function') id = Car.GetCurrentMod(car, slot);
      if (id && id >= 1000 && id <= 1193) mods.push(id);
    } catch(e) {}
  }
  return mods;
}

// ════════════════════════════════════════════════════════════════
//  GAME START MEMORY SYNC
// ════════════════════════════════════════════════════════════════
function gatherAndUpdateAllOnStart() {
  try {
    const lines = readDisk();
    if (!lines || !lines.length) {
      cache = [];
      return;
    }
    let modified = false;
    const updated = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const d = parseEntry(line);
      if (!d) continue;

      const newLine = formatMinifiedEntry(d);
      if (newLine !== line) modified = true;
      updated.push(newLine);
    }

    if (modified) {
      writeDisk(updated);
      cache = updated;
      log("LOGGER: Migrated vehicle entries to ultra-minified format (" + updated.length + " entries)");
    } else {
      cache = lines;
      log("LOGGER: All " + lines.length + " parked vehicle entries are up to date");
    }
  } catch(e) {
    cache = readDisk();
    log("LOGGER: gatherAndUpdateAllOnStart error: " + (e.stack || e));
  }
}

// ════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════
log("LOGGER: starting");
loadConfig();
gatherAndUpdateAllOnStart();
log("LOGGER: initialized with " + cache.length + " parked entries");
wait(500);
showTextBox("~y~Car Exit Logger~n~~w~F6=menu  F7=reload INI");

// ════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ════════════════════════════════════════════════════════════════
while (true) {
  wait(0);

  const player = new Player(0);
  const char   = player.getChar();

  if (player.isDead()) {
    if (wasInCar || lastCarHandle || pending.length > 0) {
      log("LOGGER: Player died — clearing vehicle state and pending exit queue.");
      wasInCar      = false;
      lastCarHandle = null;
      pending       = [];
    }
    continue;
  }

  // ── F7: reload INI + re-stream ────────────────────────────────
  const f7Now = Pad.IsKeyPressed(VK_F7);
  if (f7Now && !f7WasDown) {
    f7WasDown = true;
    loadConfig();
    let playerCar = null;
    try { if (char.isInAnyCar()) playerCar = getCarHandle(char); } catch(e) {}
    for (const k in streamed) {
      const c = streamed[k];
      try { if (isCarValid(c) && (!playerCar || c !== playerCar)) deleteCarHandle(c); } catch(e) {}
    }
    streamed = {};
    spawnTimeMap = {};
    gatherAndUpdateAllOnStart();
    runStreamer(char);
    log("LOGGER: reloaded, " + cache.length + " entries");
    showTextBox("~y~INI reloaded! ~g~" + cache.length + " ~y~entries");
  } else if (!f7Now) {
    f7WasDown = false;
  }

  // ── F6: open menu (blocking sub-loop, main loop suspends) ─────
  const f6Now         = Pad.IsKeyPressed(VK_F6);
  const f6JustPressed = f6Now && !f6WasDown;
  f6WasDown           = f6Now;

  if (f6JustPressed) {
    if (char.isInAnyCar()) {
      showTextBox("~r~Cannot open menu in a vehicle!~n~~w~Get out on foot first.");
      log("LOGGER: Menu open blocked — player is in a vehicle");
    } else {
      runMenu(player, char);           // blocks until closed
      drainKeys();                     // prevent key bleed after return
      f6WasDown = false;               // ensure next F6 press opens on first click
    }
    continue;
  }

  // ── EXIT LOGGER: detect car entry/exit ───────────────────────
  const inCar = char.isInAnyCar();

  if (inCar) {
    if (!wasInCar) {
      wasInCar = true;
      fireNotified = false;
      try {
        const car = getCarHandle(char);
        const mid = getCarModelId(car);
        if (car && isCarValid(car) && mid > 0) {
          lastCarHandle = car;
          log("LOGGER: Entered vehicle model " + mid);
          probeAndCacheTunability(car, mid);  // safe probe in wait(0) frame
          tryClaimCar(car, char);
        }
      } catch(e) {
        log("LOGGER: Error on enter car: " + (e.stack || e));
      }
    } else if (lastCarHandle && isCarValid(lastCarHandle)) {
      if (isCarDestroyed(lastCarHandle) && !fireNotified) {
        fireNotified = true;
        log("LOGGER: Vehicle caught fire / health <= 250 while driving");
        if (CFG.tooltips) showTextBox("~r~Vehicle destroyed!~n~~w~Exit position not saved.");
      }
    }
  } else if (wasInCar) {
    wasInCar = false;
    log("LOGGER: Exited vehicle, checking handle...");
    if (lastCarHandle) {
      try {
        const hp = getCarHealth(lastCarHandle);
        if (hp > 250 && isCarUsable(lastCarHandle)) {
          log("LOGGER: Added vehicle handle to pending exit queue (Health: " + hp + " HP)");
          pending.push({ car: lastCarHandle, t: Date.now() });
        } else {
          log("LOGGER: Exited vehicle with health <= 250 (" + hp + " HP) — ignored & discarded");
          if (CFG.tooltips && !fireNotified) showTextBox("~r~Vehicle destroyed!~n~~w~Exit position not saved.");
        }
      } catch(e) {
        log("LOGGER: Error on exit check: " + (e.stack || e));
      }
      lastCarHandle = null;
    }
  }

  runPending(char);
  runStreamer(char);
}
