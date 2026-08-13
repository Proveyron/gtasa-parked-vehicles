const CONFIG_PATH = "CLEO\\car_exit_logger.ini";
const PARKED_PATH = "CLEO\\vehicles.parked";
const CFG = {
  streamIn:            150.0,
  streamOut:           170.0,
  maxEntries:          100,
  maxStreamed:         10,
  unlockDoors:         true,
  tooltips:            true,
  saveHealth:          true,
  saveTires:           true,
  tagLicensePlates:    true,
  customPlateText:     "PARKED",
  pauseDuringMissions: true,
  menuKey:             117,
  spawnerKey:          116,
};
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
const VK_NUM0  = 96;
const VK_KEY_W = 87;
const VK_KEY_S = 83;
const VK_KEY_A = 65;
const VK_KEY_D = 68;
let f5WasDown  = false;
let f6WasDown  = false;
let f7WasDown  = false;
const tunableCache = {};
function probeAndCacheTunability(car, mid) {
  if (tunableCache.hasOwnProperty(mid)) return;
  try {
    let isCar = false;
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelACar === 'function') {
      isCar = !!Car.IsThisModelACar(mid);
    }
    if (!isCar) { tunableCache[mid] = false; return; }
    try {
      if (typeof car.isEmergencyServices === 'function' && car.isEmergencyServices()) {
        tunableCache[mid] = false;
        return;
      }
    } catch(e) {}
    let slot0 = undefined;
    try {
      if (typeof car.getCurrentMod === 'function') slot0 = car.getCurrentMod(0);
    } catch(e) { tunableCache[mid] = false; return; }
    tunableCache[mid] = (slot0 !== undefined && slot0 !== null);
  } catch(e) {
    tunableCache[mid] = false;
  }
}
function isBoatModel(mid) {
  if (!mid) return false;
  try {
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelABoat === 'function') {
      return !!Car.IsThisModelABoat(mid);
    }
  } catch(e) {}
  return false;
}

function isAircraftModel(mid) {
  if (!mid) return false;
  try {
    if (typeof Car !== 'undefined') {
      if (typeof Car.IsThisModelAHeli === 'function' && Car.IsThisModelAHeli(mid)) return true;
      if (typeof Car.IsThisModelAPlane === 'function' && Car.IsThisModelAPlane(mid)) return true;
    }
  } catch(e) {}
  return false;
}

function isBmxModel(mid) {
  return mid === 481 || mid === 509 || mid === 510;
}

function isBikeModel(mid) {
  if (!mid) return false;
  if (isBmxModel(mid)) return true;
  try {
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelABike === 'function') {
      return !!Car.IsThisModelABike(mid);
    }
  } catch(e) {}
  const bikes = [448, 461, 462, 463, 468, 471, 521, 522, 581, 586];
  return bikes.indexOf(mid) !== -1;
}

function isAutomobileModel(mid) {
  if (!mid || mid < 400 || mid > 611) return false;
  if (isBoatModel(mid) || isAircraftModel(mid) || isBikeModel(mid)) return false;
  return true;
}

function setCarNumberPlate(c, plateText) {
  if (!c || !plateText) return;
  const txt = ("" + plateText).trim().substring(0, 8).toUpperCase();
  try {
    if (typeof c.setNumberPlate === 'function') {
      c.setNumberPlate(txt);
    } else if (typeof Car !== 'undefined' && typeof Car.SetNumberPlate === 'function') {
      Car.SetNumberPlate(c, txt);
    }
  } catch(e) {}
}

function getCarNumberPlate(c) {
  if (!c) return "";
  try {
    let txt = "";
    if (typeof c.getNumberPlate === 'function') txt = c.getNumberPlate();
    else if (typeof Car !== 'undefined' && typeof Car.GetNumberPlate === 'function') txt = Car.GetNumberPlate(c);
    if (txt && typeof txt === 'string' && txt.trim().length > 0) return txt.trim().substring(0, 8).toUpperCase();
  } catch(e) {}
  return "";
}
function isTunableVehicle(mid) {
  if (!mid) return false;
  if (tunableCache.hasOwnProperty(mid)) return tunableCache[mid];
  try {
    if (typeof Car !== 'undefined' && typeof Car.IsThisModelACar === 'function') {
      return !!Car.IsThisModelACar(mid);
    }
  } catch(e) {}
  return false;
}
function getVehicleName(modelId) {
  if (!modelId) return "Vehicle";
  try {
    let rawKey = "";
    if (typeof GetNameOfVehicleModel === 'function') {
      rawKey = GetNameOfVehicleModel(modelId);
    } else if (typeof Car !== 'undefined' && typeof Car.GetNameOfModel === 'function') {
      rawKey = Car.GetNameOfModel(modelId);
    }
    if (rawKey && rawKey.trim().length > 0) {
      const k = rawKey.trim();
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
      const formatted = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
      if (formatted && formatted.length > 2) return formatted;
    }
  } catch(e) {}
  if (VEHICLE_NAMES[modelId]) return VEHICLE_NAMES[modelId];
  return "" + modelId;
}

// Unsafe vehicle models (Trailers, Trains/Trams, RC models) that must never be spawned
const UNSAFE_VEHICLE_MODELS = {
  // Trailers (non-drivable / physics issues when standalone)
  435: 1, 450: 1, 584: 1, 591: 1, 606: 1, 607: 1, 608: 1, 610: 1, 611: 1,
  // Trains & Trams
  449: 1, 537: 1, 538: 1, 569: 1, 570: 1, 590: 1,
  // RC Mini Vehicles
  441: 1, 464: 1, 465: 1, 501: 1, 564: 1, 594: 1
};

function isSafeDrivableVehicle(mid) {
  if (!mid || typeof mid !== 'number' || isNaN(mid)) return false;
  if (mid < 400 || mid > 611) return false;
  return !UNSAFE_VEHICLE_MODELS[mid];
}

const VEHICLE_NAMES = {
  400: 'Landstalker', 401: 'Bravura', 402: 'Buffalo', 403: 'Linerunner', 404: 'Perennial', 405: 'Sentinel', 406: 'Dump', 407: 'Firetruck', 408: 'Trashmaster', 409: 'Stretch',
  410: 'Manana', 411: 'Infernus', 412: 'Voodoo', 413: 'Pony', 414: 'Mule', 415: 'Cheetah', 416: 'Ambulance', 417: 'Leviathan', 418: 'Moonbeam', 419: 'Esperanto',
  420: 'Taxi', 421: 'Washington', 422: 'Bobcat', 423: 'Mr Whoopee', 424: 'BF Injection', 425: 'Hunter', 426: 'Premier', 427: 'Enforcer', 428: 'Securicar', 429: 'Banshee',
  430: 'Predator', 431: 'Bus', 432: 'Rhino', 433: 'Barracks', 434: 'Hotknife', 436: 'Previon', 437: 'Coach', 438: 'Cabbie', 439: 'Stallion', 440: 'Rumpo',
  442: 'Romero', 443: 'Packer', 444: 'Monster', 445: 'Admiral', 446: 'Squalo', 447: 'Sea Sparrow', 448: 'Pizzaboy', 451: 'Turismo', 452: 'Speeder', 453: 'Reefer',
  454: 'Tropic', 455: 'Flatbed', 456: 'Yankee', 457: 'Caddy', 458: 'Solair', 459: 'Topfun', 460: 'Skimmer', 461: 'PCJ-600', 462: 'Faggio', 463: 'Freeway',
  466: 'Glendale', 467: 'Oceanic', 468: 'Sanchez', 469: 'Sparrow', 470: 'Patriot', 471: 'Quad', 472: 'Coastguard', 473: 'Dinghy', 474: 'Hermes', 475: 'Sabre',
  476: 'Rustler', 477: 'ZR-350', 478: 'Walton', 479: 'Regina', 480: 'Comet', 481: 'BMX', 482: 'Burrito', 483: 'Camper', 484: 'Marquis', 485: 'Baggage',
  486: 'Dozer', 487: 'Maverick', 488: 'SAN Maverick', 489: 'Rancher', 490: 'FBI Rancher', 491: 'Virgo', 492: 'Greenwood', 493: 'Jetmax', 494: 'Hotring Racer',
  495: 'Sandking', 496: 'Blista Compact', 497: 'Police Maverick', 498: 'Boxville', 499: 'Benson', 500: 'Mesa', 502: 'Hotring Racer 2', 503: 'Hotring Racer 3',
  504: 'Bloodring Banger', 505: 'Rancher Lure', 506: 'Super GT', 507: 'Elegant', 508: 'Journey', 509: 'Bike', 510: 'Mountain Bike', 511: 'Beagle', 512: 'Cropduster',
  513: 'Stuntplane', 514: 'Tanker', 515: 'Roadtrain', 516: 'Nebula', 517: 'Majestic', 518: 'Buccaneer', 519: 'Shamal', 520: 'Hydra', 521: 'FCR-900',
  522: 'NRG-500', 523: 'HPV-1000', 524: 'Cement Truck', 525: 'Towtruck', 526: 'Fortune', 527: 'Cadrona', 528: 'FBI Truck', 529: 'Willard', 530: 'Forklift',
  531: 'Tractor', 532: 'Combine Harvester', 533: 'Feltzer', 534: 'Remington', 535: 'Slamvan', 536: 'Blade', 539: 'Vortex', 540: 'Vincent', 541: 'Bullet',
  542: 'Clover', 543: 'Sadler', 544: 'Firetruck LA', 545: 'Hustler', 546: 'Intruder', 547: 'Primo', 548: 'Cargobob', 549: 'Tampa', 550: 'Sunrise',
  551: 'Merit', 552: 'Utility Van', 553: 'Nevada', 554: 'Yosemite', 555: 'Windsor', 556: 'Monster A', 557: 'Monster B', 558: 'Uranus', 559: 'Jester',
  560: 'Sultan', 561: 'Stratum', 562: 'Elegy', 563: 'Raindance', 565: 'Flash', 566: 'Tahoma', 567: 'Savanna', 568: 'Bandito', 571: 'Kart',
  572: 'Mower', 573: 'Dune', 574: 'Sweeper', 575: 'Broadway', 576: 'Tornado', 577: 'AT-400', 578: 'DFT-30', 579: 'Huntley', 580: 'Stafford',
  581: 'BF-400', 582: 'Newsvan', 583: 'Tug', 585: 'Emperor', 586: 'Wayfarer', 587: 'Euro', 588: 'Hotdog', 589: 'Club', 592: 'Andromada',
  593: 'Dodo', 595: 'Launch', 596: 'Police Car LS', 597: 'Police Car SF', 598: 'Police Car LV', 599: 'Police Ranger', 600: 'Picador', 601: 'S.W.A.T. Tank',
  602: 'Alpha', 603: 'Phoenix', 604: 'Glendale Damaged', 605: 'Sadler Damaged', 609: 'Boxville Black'
};

let cachedAllSafeModels = null;
function getAllSafeVehiclesList() {
  if (cachedAllSafeModels) return cachedAllSafeModels;
  const list = [];
  for (let id = 400; id <= 611; id++) {
    if (isSafeDrivableVehicle(id)) list.push(id);
  }
  list.sort((a, b) => getVehicleName(a).toLowerCase().localeCompare(getVehicleName(b).toLowerCase()));
  cachedAllSafeModels = list;
  return cachedAllSafeModels;
}

function isPlayerOnMission() {
  try {
    if (typeof Script !== 'undefined' && typeof Script.IsOnMission === 'function') {
      return !!Script.IsOnMission();
    }
  } catch(e) {}
  return false;
}

let wasInCar          = false;
let fireNotified      = false;
let lastCarHandle     = null;
let wasOnMissionState = false;
let pending           = [];
let streamed          = {};
let spawnTimeMap      = {};
let cache         = [];

function toCar(c) {
  if (!c) return null;
  if (typeof c === 'object' && c !== null) return c;
  try { return new Car(c); } catch(e) { return null; }
}
// Robust car equality: === first, then .handle, then == coercion.
// Needed because CLEO Redux may return different wrapper instances for the same vehicle.
function sameCar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    if (a.handle !== undefined && b.handle !== undefined && a.handle === b.handle) return true;
    // eslint-disable-next-line eqeqeq
    if (a == b) return true;
  } catch(e) {}
  return false;
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
  if (!c || !isCarValid(c)) return 0;
  try {
    const obj = toCar(c);
    let val = undefined;
    if (obj && typeof obj.getHealth === 'function') val = obj.getHealth();
    if (val !== undefined && val !== null && !isNaN(+val)) return Math.round(+val);
  } catch(e) {}
  return 0;
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
  if (isBmxModel(mid)) return []; // Bicycles (BMX) have no burstable tires
  if (!isAutomobileModel(mid) && !isBikeModel(mid)) return [];
  const maxTires = isBikeModel(mid) ? 2 : 4;
  const popped = [];
  for (let i = 0; i < maxTires; i++) {
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
  if (isBmxModel(mid)) return; // Bicycles (BMX) have no burstable tires
  if (!isAutomobileModel(mid) && !isBikeModel(mid)) return;
  const maxTires = isBikeModel(mid) ? 2 : 4;
  for (const t of tiresArray) {
    if (t >= maxTires) continue;
    try {
      if (typeof c.burstTire === 'function') c.burstTire(t);
      else if (typeof Car !== 'undefined' && typeof Car.BurstTire === 'function') Car.BurstTire(c, t);
    } catch(e) {}
  }
}
function isCarEmpty(c) {
  if (!c) return true;
  try {
    let driver = null;
    if (typeof c.getDriver === 'function') driver = c.getDriver();
    else if (typeof Car !== 'undefined' && typeof Car.GetDriver === 'function') driver = Car.GetDriver(c);
    if (driver) {
      try {
        if (typeof driver.doesExist === 'function' && driver.doesExist()) return false;
      } catch(e) { return false; }
    }
  } catch(e) {}
  try {
    let passCount = 0;
    if (typeof c.getNumberOfPassengers === 'function') passCount = c.getNumberOfPassengers();
    else if (typeof Car !== 'undefined' && typeof Car.GetNumberOfPassengers === 'function') passCount = Car.GetNumberOfPassengers(c);
    if (passCount > 0) return false;
  } catch(e) {}
  return true;
}
function deleteCarHandle(c) {
  if (!c) return;
  try {
    const player = new Player(0);
    const char   = player.getChar();
    if (char && char.isInAnyCar()) {
      const pc = getCarHandle(char);
      // Use sameCar() — === alone fails when wrappers are different instances
      if (sameCar(c, pc)) {
        log("LOGGER: BLOCKED deleteCarHandle — target is player active vehicle!");
        return;
      }
      // Ultimate safety: ask the game directly if the player is sitting in this car
      try {
        if (typeof char.isSittingInCar === 'function' && char.isSittingInCar(c)) {
          log("LOGGER: BLOCKED deleteCarHandle — player is sitting in target vehicle!");
          return;
        }
      } catch(e) {}
    }
  } catch(e) {}
  // HARD CRASH PREVENTION: Never delete a car that has an active driver or passenger!
  if (!isCarEmpty(c)) {
    log("LOGGER: BLOCKED deleteCarHandle — vehicle is not empty (driver/passenger present)");
    return;
  }
  try { if (typeof c.delete === 'function') { c.delete(); return; } } catch(e) {}
  try { if (typeof Car !== 'undefined' && typeof Car.Delete === 'function') { Car.Delete(c); return; } } catch(e) {}
}
function loadModelSync(id) {
  if (Streaming.HasModelLoaded(id)) return true;
  Streaming.RequestModel(id);
  Streaming.LoadAllModelsNow();
  return Streaming.HasModelLoaded(id);
}
function spawnCarAt(modelId, x, y, z) {
  if (!loadModelSync(modelId)) return null;
  const car = Car.Create(modelId, x, y, z);
  if (car) {
    try {
      if (typeof car.setCoordinatesNoOffset === 'function') {
        car.setCoordinatesNoOffset(x, y, z);
      } else if (typeof Car !== 'undefined' && typeof Car.SetCoordinatesNoOffset === 'function') {
        Car.SetCoordinatesNoOffset(car, x, y, z);
      }
    } catch(e) {}
  }
  Streaming.MarkModelAsNoLongerNeeded(modelId);
  return car || null;
}
function drainKeys() {
  while (
    Pad.IsKeyPressed(VK_UP)    || Pad.IsKeyPressed(VK_KEY_W) || Pad.IsKeyPressed(VK_NUM8) ||
    Pad.IsKeyPressed(VK_DOWN)  || Pad.IsKeyPressed(VK_KEY_S) || Pad.IsKeyPressed(VK_NUM2) ||
    Pad.IsKeyPressed(VK_LEFT)  || Pad.IsKeyPressed(VK_KEY_A) || Pad.IsKeyPressed(VK_NUM4) ||
    Pad.IsKeyPressed(VK_RIGHT) || Pad.IsKeyPressed(VK_KEY_D) || Pad.IsKeyPressed(VK_NUM6) ||
    Pad.IsKeyPressed(VK_ENTER) || Pad.IsKeyPressed(VK_SPACE) || Pad.IsKeyPressed(VK_NUM5) ||
    Pad.IsKeyPressed(VK_ESC)   || Pad.IsKeyPressed(VK_F5)    || Pad.IsKeyPressed(VK_F6)    || Pad.IsKeyPressed(VK_F7) ||
    (CFG.spawnerKey && Pad.IsKeyPressed(CFG.spawnerKey)) || (CFG.menuKey && Pad.IsKeyPressed(CFG.menuKey))
  ) wait(0);
}
function checkCheatCodes(player, char) {
  try {
    if (typeof Pad !== 'undefined' && typeof Pad.TestCheat === 'function') {
      if (Pad.TestCheat("PACKER")) {
        const pp = char.getCoordinates();
        if (!pp) return;
        const hdg = getCarHdg(char);
        const rad = hdg * Math.PI / 180;
        const spX = pp.x - Math.sin(rad) * 6.0;
        const spY = pp.y + Math.cos(rad) * 6.0;
        const spZ = pp.z;
        const nc = spawnCarAt(443, spX, spY, spZ);
        if (nc) {
          try { nc.setHeading(hdg); } catch(e) {}
          if (CFG.tooltips) showTextBox("~g~Cheat activated: ~y~Packer spawned!");
          log("LOGGER: Cheat activated — spawned Packer (443) at " + spX.toFixed(1) + "," + spY.toFixed(1));
        }
      }
    }
  } catch(e) {}
}
function renderParkedMenu(entries, sel) {
  const total = entries ? entries.length : 0;
  if (total === 0) {
    showTextBox("~y~PARKED VEHICLES GARAGE~n~~r~No saved vehicles in storage.");
    return;
  }
  const pageSize   = 5;
  const totalPages = Math.ceil(total / pageSize);
  const curPage    = Math.floor(sel / pageSize) + 1;
  const startPage  = Math.floor(sel / pageSize) * pageSize;
  const endPage    = Math.min(startPage + pageSize, total);
  let txt = "~y~PARKED GARAGE~n~";
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
  showTextBox(txt);
}
function purgeDestroyedEntries() {
  try {
    const entries = readDisk();
    if (!entries || !entries.length) return [];
    let modified = false;
    const clean = [];
    for (let i = 0; i < entries.length; i++) {
      const d    = parseEntry(entries[i]);
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
    const f6N    = Pad.IsKeyPressed(VK_F6) || (CFG.menuKey && Pad.IsKeyPressed(CFG.menuKey));
    const f5N    = Pad.IsKeyPressed(VK_F5) || (CFG.spawnerKey && Pad.IsKeyPressed(CFG.spawnerKey));
    if (f5N) {
      runSpawnerMenu(player, char);
      break;
    }
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
      teleportTo(entries[sel], char, false);
      break;
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
  f6WasDown = true;
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

function renderSpawnerMenu(modelSel) {
  const models = getAllSafeVehiclesList();
  const total = models.length;
  if (total === 0) {
    showTextBox("~y~CAR SPAWNER~n~~r~No safe vehicles found.");
    return;
  }

  const pageSize = 6;
  const curPage = Math.floor(modelSel / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);
  const startPage = Math.floor(modelSel / pageSize) * pageSize;
  const endPage = Math.min(startPage + pageSize, total);

  let txt = "~y~CAR SPAWNER (A-Z) (" + curPage + "/" + totalPages + ")~n~";
  for (let i = startPage; i < endPage; i++) {
    const mid = models[i];
    const name = getVehicleName(mid);
    if (i === modelSel) {
      txt += "~g~> " + name + "~n~";
    } else {
      txt += "~w~  " + name + "~n~";
    }
  }
  showTextBox(txt);
}

function spawnVehicleFromSpawner(modelId, char) {
  if (!isSafeDrivableVehicle(modelId)) {
    const name = getVehicleName(modelId);
    showTextBox("~r~Cannot spawn " + name + " — vehicle is not safe/drivable!");
    log("LOGGER: Blocked unsafe vehicle spawn attempt: " + modelId);
    return false;
  }
  const pp = char.getCoordinates();
  if (!pp) return false;
  const hdg = getCarHdg(char);
  const rad = hdg * Math.PI / 180;
  
  let dist = 4.5;
  let zOffset = 0.2;
  let clearRadius = 4.0;
  if (isBoatModel(modelId)) {
    dist = 8.5;
    zOffset = 1.5;
    clearRadius = 6.0;
  } else if (isAircraftModel(modelId)) {
    dist = 9.0;
    zOffset = 0.5;
    clearRadius = 7.0;
  } else if (modelId === 403 || modelId === 514 || modelId === 515 || modelId === 443 || modelId === 406 || modelId === 408 || modelId === 455 || modelId === 524) {
    dist = 7.5;
    zOffset = 0.5;
    clearRadius = 6.0;
  } else if (isBikeModel(modelId)) {
    dist = 3.5;
    zOffset = 0.2;
    clearRadius = 3.0;
  }

  const spX = pp.x - Math.sin(rad) * dist;
  const spY = pp.y + Math.cos(rad) * dist;
  const spZ = pp.z + zOffset;

  let playerCar = null;
  try { if (char.isInAnyCar()) playerCar = getCarHandle(char); } catch(e) {}

  // Force clear any empty vehicle in spawn area (including tracked spawned cars)
  clearNearbyNonTracked(spX, spY, spZ, clearRadius, playerCar, char, true);

  // Prevent overlapping if an occupied vehicle remains in spawn area
  if (isSpawnZoneOccupied(spX, spY, spZ, clearRadius * 0.7, playerCar, char)) {
    showTextBox("~r~Spawn area occupied! Move away to spawn.");
    log("LOGGER: Car Spawner blocked — spawn area occupied at " + spX.toFixed(1) + "," + spY.toFixed(1));
    return false;
  }

  const car = spawnCarAt(modelId, spX, spY, spZ);
  const name = getVehicleName(modelId);
  if (car) {
    try { car.setHeading(hdg); } catch(e) {}
    if (CFG.unlockDoors && isAutomobileModel(modelId)) {
      try { car.lockDoors(1); } catch(e) {}
    }
    log("LOGGER: Car Spawner spawned " + name + " (" + modelId + ") at " + spX.toFixed(1) + "," + spY.toFixed(1));
    if (CFG.tooltips) {
      showTextBox("~g~Spawned ~y~" + name + "~g~!");
    }
    return true;
  } else {
    showTextBox("~r~Failed to spawn ~y~" + name + "~r~!");
    log("LOGGER: Car Spawner failed to spawn model " + modelId);
    return false;
  }
}

function runSpawnerMenu(player, char) {
  drainKeys();
  let modelSel = 0;
  const models = getAllSafeVehiclesList();
  const totalModels = models.length;

  let upD = false, downD = false;
  let leftD = false, rightD = false;
  let enterD = false, f5D = true;

  renderSpawnerMenu(modelSel);

  while (true) {
    wait(0);
    if (char.isInAnyCar() || player.isDead()) {
      break;
    }

    const upN    = Pad.IsKeyPressed(VK_NUM8);
    const downN  = Pad.IsKeyPressed(VK_NUM2);
    const leftN  = Pad.IsKeyPressed(VK_NUM4);
    const rightN = Pad.IsKeyPressed(VK_NUM6);
    const enterN = Pad.IsKeyPressed(VK_NUM5);
    const f5N    = Pad.IsKeyPressed(VK_NUM0) || Pad.IsKeyPressed(VK_F5) || (CFG.spawnerKey && Pad.IsKeyPressed(CFG.spawnerKey)) || Pad.IsKeyPressed(VK_ESC);

    if (f5N && !f5D) {
      break;
    }

    const pageSize = 6;

    if (totalModels > 0) {
      let modelChanged = false;

      if (upN && !upD) {
        modelSel = (modelSel - 1 + totalModels) % totalModels;
        modelChanged = true;
      }
      if (downN && !downD) {
        modelSel = (modelSel + 1) % totalModels;
        modelChanged = true;
      }
      if (leftN && !leftD) {
        modelSel = Math.max(0, modelSel - pageSize);
        modelChanged = true;
      }
      if (rightN && !rightD) {
        modelSel = Math.min(totalModels - 1, modelSel + pageSize);
        modelChanged = true;
      }
      if (modelChanged) {
        renderSpawnerMenu(modelSel);
      }

      if (enterN && !enterD) {
        const selectedModel = models[modelSel];
        spawnVehicleFromSpawner(selectedModel, char);
        wait(200);
        renderSpawnerMenu(modelSel);
      }
    }

    upD    = upN;
    downD  = downN;
    leftD  = leftN;
    rightD = rightN;
    enterD = enterN;
    f5D    = f5N;
  }

  clearMenuBox();
  drainKeys();
  f5WasDown = true;
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
    const rad = (heading + 90) * Math.PI / 180;
    const tpX = d.x - Math.sin(rad) * cfg.dist;
    const tpY = d.y + Math.cos(rad) * cfg.dist;
    const tpZ = d.z + cfg.zOffset;
    try {
      if (typeof Streaming !== 'undefined') {
        if (typeof Streaming.RequestCollision === 'function') Streaming.RequestCollision(tpX, tpY);
        if (typeof Streaming.LoadScene === 'function') Streaming.LoadScene(tpX, tpY, tpZ);
      }
    } catch(e) {}
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
            continue;
          }
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
          const rawSpd = getCarSpd(h);
          const speed  = (isNaN(rawSpd) || rawSpd < 0) ? 0 : rawSpd;
          if (speed < 0.05) {
            updateParkedCarStateIfNeeded(h, d, i, entries);
          }
        } else {
          if (playerCar && sq < 36.0) {
            continue;
          }
          // If this entry was just repositioned this iteration its new key is
          // already registered in streamed — skip to avoid a duplicate spawn.
          if (streamed.hasOwnProperty(key)) continue;

          // Prevent vehicle pool exhaustion: limit active streamed parked cars to MaxStreamed (default 10)
          let activeCount = 0;
          for (const k in streamed) {
            if (streamed[k] && isCarValid(streamed[k])) activeCount++;
          }
          if (activeCount >= (CFG.maxStreamed || 10)) {
            continue;
          }

          clearNearbyNonTracked(d.x, d.y, d.z, 2.0, playerCar, char);
          const nc = spawnCarAt(d.modelId, d.x, d.y, d.z);
          if (nc) {
            try { nc.setHeading(d.heading); } catch(e) {}
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
                if (m >= 1000 && loadModelSync(m)) {
                  try {
                    if (typeof nc.addMod === 'function') nc.addMod(m);
                    else if (typeof Car !== 'undefined' && typeof Car.AddMod === 'function') Car.AddMod(nc, m);
                  } catch(e) {}
                  Streaming.MarkModelAsNoLongerNeeded(m);
                }
              }
            }
            // Restore hydraulics and nitro state after mods are applied
            applyCarExtras(nc, d.extras);
            if (CFG.tagLicensePlates && d.plateText) {
              setCarNumberPlate(nc, d.plateText);
            }
            streamed[key] = nc;
            spawnTimeMap[key] = Date.now();
            log("LOGGER: Streamed IN vehicle " + (d.name || getVehicleName(d.modelId)) + " at " + d.x.toFixed(1) + "," + d.y.toFixed(1) + " (Plate: " + (d.plateText || "PARKED") + ")");
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
            try {
              if (typeof h.markAsNoLongerNeeded === 'function') h.markAsNoLongerNeeded();
              else if (typeof Car !== 'undefined' && typeof Car.MarkAsNoLongerNeeded === 'function') Car.MarkAsNoLongerNeeded(h);
            } catch(e) {}
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
    if (Date.now() - spawnT < 4000) return false;
    const cp = getCarPos(h);
    const hdg = getCarHdg(h);
    const mDx = cp.x - d.x, mDy = cp.y - d.y, mDz = cp.z - d.z;
    const mDistSq = mDx*mDx + mDy*mDy + mDz*mDz;
    const mHdgDiff = Math.abs(hdg - d.heading);
    if (mDistSq >= 0.25 || mHdgDiff >= 5.0) {
      const hp     = getCarHealth(h);
      if (hp <= 250) return false;
      const clrs   = getCarColors(h);
      const extraC = getCarExtraColors(h);
      const mods   = getCarMods(h, d.modelId);
      const tires  = getCarPoppedTires(h);
      const pj     = getCarPaintjob(h);
      const dam    = getCarDamage(h);
      const extras = getCarExtras(h, mods);
      const newLine = formatMinifiedEntry({
        modelId: d.modelId, x: cp.x, y: cp.y, z: cp.z, heading: hdg,
        primaryColor: clrs.c1, secondaryColor: clrs.c2,
        extraColor1: extraC.c3, extraColor2: extraC.c4,
        paintjob: pj, health: (CFG.saveHealth ? hp : 1000),
        tires: (CFG.saveTires ? tires : []),
        panels: dam.panels, doors: dam.doors,
        upgrades: mods, extras: extras
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
function clearNearbyNonTracked(x, y, z, r, playerCar, char, forceClearTracked) {
  try {
    let next = false;
    for (let i = 0; i < 15; i++) {
      const c = World.GetRandomCarInSphereNoSaveRecursive(x, y, z, r, next, false);
      if (!c) break;
      const valid = isCarValid(c);
      if (!valid) break;
      // Use sameCar() — === fails when wrappers are different object instances
      if (sameCar(c, playerCar)) { next = true; continue; }
      if (sameCar(c, lastCarHandle)) { next = true; continue; }
      // Hard safety: never delete a car the player is physically sitting in or occupied car
      try {
        if (char && typeof char.isSittingInCar === 'function' && char.isSittingInCar(c)) {
          next = true; continue;
        }
      } catch(e) {}
      if (!isCarEmpty(c)) { next = true; continue; }

      let isTracked = false;
      let trackedKey = null;
      for (const k in streamed) {
        if (sameCar(streamed[k], c)) { isTracked = true; trackedKey = k; break; }
      }
      if (isTracked) {
        if (!forceClearTracked) {
          next = true;
          continue;
        } else {
          delete streamed[trackedKey];
          delete spawnTimeMap[trackedKey];
        }
      }
      deleteCarHandle(c);
      next = false;
    }
  } catch(e) {}
}

function isSpawnZoneOccupied(x, y, z, r, playerCar, char) {
  try {
    const c = World.GetRandomCarInSphereNoSaveRecursive(x, y, z, r, false, false);
    if (c && isCarValid(c)) {
      if (playerCar && sameCar(c, playerCar)) return true;
      try {
        if (char && typeof char.isSittingInCar === 'function' && char.isSittingInCar(c)) return true;
      } catch(e) {}
      if (!isCarEmpty(c)) return true;
      return true;
    }
  } catch(e) {}
  return false;
}
function tryClaimCar(car, char) {
  try {
    if (!car || !isCarValid(car)) return;
    const mid = getCarModelId(car);
    if (mid <= 0) return;
    const cp = getCarPos(car);
    const ents = cache;
    if (!ents || !ents.length) return;

    let claimIdx = -1;

    // Pass 1: Direct entity handle match in streamed table
    for (let i = 0; i < ents.length; i++) {
      const d = parseEntry(ents[i]);
      if (!d || d.modelId !== mid) continue;
      const key = getUniqueKey(d);
      const h = streamed[key];
      if (h && sameCar(h, car)) {
        claimIdx = i;
        break;
      }
    }

    // Pass 2: Spatial proximity match if handle not bound yet (closest entry within 4.0m)
    if (claimIdx === -1) {
      let closestDistSq = 16.0; // 4.0m max radius
      for (let i = 0; i < ents.length; i++) {
        const d = parseEntry(ents[i]);
        if (!d || d.modelId !== mid) continue;
        const key = getUniqueKey(d);
        const h = streamed[key];
        // Skip entry if bound to a different active entity handle
        if (h && isCarValid(h) && !sameCar(h, car)) continue;

        const dx = cp.x - d.x, dy = cp.y - d.y, dz = cp.z - d.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          claimIdx = i;
        }
      }
    }

    if (claimIdx !== -1) {
      const ln  = ents[claimIdx];
      const d   = parseEntry(ln);
      const key = d ? getUniqueKey(d) : "";
      if (key && streamed.hasOwnProperty(key)) delete streamed[key];
      if (key && spawnTimeMap.hasOwnProperty(key)) delete spawnTimeMap[key];
      ents.splice(claimIdx, 1);
      writeDisk(ents);
      cache = ents;
      const name = d ? (d.name || getVehicleName(mid)) : "vehicle";
      log("LOGGER: Claimed parked " + name + " (Entry " + claimIdx + " removed)");
      if (CFG.tooltips) showTextBox("~y~Claimed ~g~" + name + "~n~~w~Entry removed from storage.");
    }
  } catch(e) {
    log("LOGGER: tryClaimCar error: " + (e.stack || e));
  }
}
function runPending(char) {
  if (!pending.length) return;
  if (CFG.pauseDuringMissions && isPlayerOnMission()) {
    pending = [];
    return;
  }
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
function formatMinifiedEntry(d) {
  if (!d) return "";
  const clrStr = (d.extraColor1 >= 0 && d.extraColor2 >= 0)
               ? (d.primaryColor + "," + d.secondaryColor + "," + d.extraColor1 + "," + d.extraColor2)
               : (d.primaryColor + "," + d.secondaryColor);
  const pjStr = (d.paintjob !== undefined && d.paintjob !== null && d.paintjob >= 0) ? d.paintjob : "";
  const trStr = (d.tires && d.tires.length) ? d.tires.join(",") : "";
  const dmStr = (d.panels && d.panels.length) ? d.panels.join(",") : "";
  const ddStr = (d.doors && d.doors.length) ? d.doors.join(",") : "";
  const uStr  = (d.upgrades && d.upgrades.length) ? d.upgrades.join(",") : "";
  const exFlags = [];
  if (d.extras) {
    if (d.extras.hydraulics) exFlags.push("h");
    if (d.extras.nitroModId === 1008) exFlags.push("n1");
    else if (d.extras.nitroModId === 1009) exFlags.push("n3");
    else if (d.extras.nitroModId === 1010) exFlags.push("n5");
  }
  const exStr = exFlags.join("+");
  const plateStr = d.plateText || (CFG.tagLicensePlates ? (CFG.customPlateText || "PARKED") : "");
  return d.modelId + "|" +
         d.x.toFixed(2) + "," + d.y.toFixed(2) + "," + d.z.toFixed(2) + "|" +
         d.heading.toFixed(1) + "|" +
         clrStr + "|" +
         pjStr + "|" +
         d.health + "|" +
         trStr + "|" +
         dmStr + "|" +
         ddStr + "|" +
         uStr + "|" +
         exStr + "|" +
         plateStr;
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
    const plate = CFG.tagLicensePlates ? (CFG.customPlateText || "PARKED") : getCarNumberPlate(car);
    if (CFG.tagLicensePlates) {
      setCarNumberPlate(car, plate);
    }
    const cp     = getCarPos(car);
    const hdg    = getCarHdg(car);
    const clrs   = getCarColors(car);
    const extraC = getCarExtraColors(car);
    const mods   = getCarMods(car, mid);
    const name   = getVehicleName(mid);
    const tires  = getCarPoppedTires(car);
    const pj     = getCarPaintjob(car);
    const dam    = getCarDamage(car);
    const extras = getCarExtras(car, mods);
    const line = formatMinifiedEntry({
      modelId: mid, x: cp.x, y: cp.y, z: cp.z, heading: hdg,
      primaryColor: clrs.c1, secondaryColor: clrs.c2,
      extraColor1: extraC.c3, extraColor2: extraC.c4,
      paintjob: pj, health: (CFG.saveHealth ? hp : 1000),
      tires: (CFG.saveTires ? tires : []),
      panels: dam.panels, doors: dam.doors,
      upgrades: mods, extras: extras,
      plateText: plate
    });
    const ents = readDisk();
    ents.push(line);
    while (ents.length > CFG.maxEntries) ents.shift();
    writeDisk(ents);
    cache = ents;
    const d   = parseEntry(line);
    const key = getUniqueKey(d);
    if (key) streamed[key] = car;
    log("LOGGER: SUCCESS! Saved exit for " + name + " at " + cp.x.toFixed(0) + "," + cp.y.toFixed(0) + " (Plate: " + plate + ") | Health: " + hp + " HP");
    if (CFG.tooltips) showTextBox("~g~Saved ~y~" + name + "~n~~w~Plate: ~y~" + plate);
  } catch(e) {
    log("LOGGER: saveCarExit error: " + (e.stack || e));
  }
}
function parseEntry(line) {
  if (!line || typeof line !== 'string') return null;
  const s = line.trim();
  if (!s || s.indexOf("[") === 0 || s.indexOf(";") === 0 || s.indexOf("#") === 0) return null;
  try {
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
        const upgradesPart = parts[9] || "";
        const upgrades = [];
        if (upgradesPart) {
          for (const p of upgradesPart.split(",")) {
            const n = parseInt(p, 10);
            if (n >= 1000) upgrades.push(n);
          }
        }
        // parts[10] = extras flags, e.g. "h+n3"
        const extras = { hydraulics: false, nitroModId: 0 };
        if (parts[10]) {
          const flags = parts[10].split("+");
          extras.hydraulics = flags.indexOf("h") !== -1;
          if (flags.indexOf("n1") !== -1) extras.nitroModId = 1008;
          else if (flags.indexOf("n3") !== -1) extras.nitroModId = 1009;
          else if (flags.indexOf("n5") !== -1) extras.nitroModId = 1010;
        }
        const plateText = (parts[11] && parts[11].trim().length > 0) ? parts[11].trim().substring(0, 8).toUpperCase() : (CFG.tagLicensePlates ? (CFG.customPlateText || "PARKED") : "");
        return {
          modelId: mid,
          name: getVehicleName(mid),
          x: x, y: y, z: z,
          heading: hdg,
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
          extras: extras,
          plateText: plateText,
        };
      }
    }
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
        if (n >= 1000) upgrades.push(n);
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
      varA:           -1,
      varB:           -1,
      upgrades:       upgrades,
    };
  } catch(e) { return null; }
}
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
    for (let i = clean.length; i < clean.length + 5; i++) {
      IniFile.WriteString("NotFound", PARKED_PATH, "Vehicles", "Entry" + i);
    }
    log("LOGGER: writeDisk wrote " + clean.length + " entries to " + PARKED_PATH);
  } catch(e) {
    log("LOGGER: writeDisk error: " + (e.stack || e));
  }
}
function loadConfig() {
  try {
    const r = IniFile.ReadFloat(CONFIG_PATH, "Settings", "StreamInRadius");
    if (r && r > 0) CFG.streamIn = r;
    const o = IniFile.ReadFloat(CONFIG_PATH, "Settings", "StreamOutRadius");
    if (o && o > 0) CFG.streamOut = o;
    const m = IniFile.ReadInt(CONFIG_PATH, "Settings", "MaxEntries");
    if (m && m > 0) CFG.maxEntries = m;
    const ms = IniFile.ReadInt(CONFIG_PATH, "Settings", "MaxStreamed");
    if (ms && ms > 0) CFG.maxStreamed = Math.min(Math.max(ms, 1), 25);
    const u = IniFile.ReadInt(CONFIG_PATH, "Settings", "AutoUnlockDoors");
    if (u !== null && u !== undefined) CFG.unlockDoors = (u === 1);
    const t = IniFile.ReadInt(CONFIG_PATH, "Settings", "EnableTooltips");
    if (t !== null && t !== undefined) CFG.tooltips = (t === 1);
    const h = IniFile.ReadInt(CONFIG_PATH, "Settings", "SaveVehicleHealth");
    if (h !== null && h !== undefined) CFG.saveHealth = (h === 1);
    const pt = IniFile.ReadInt(CONFIG_PATH, "Settings", "SavePoppedTires");
    if (pt !== null && pt !== undefined) CFG.saveTires = (pt === 1);
    const tlp = IniFile.ReadInt(CONFIG_PATH, "Settings", "TagLicensePlates");
    if (tlp !== null && tlp !== undefined) CFG.tagLicensePlates = (tlp === 1);
    const cpt = IniFile.ReadString(CONFIG_PATH, "Settings", "CustomPlateText");
    if (cpt && cpt !== "NotFound" && cpt.trim().length > 0) CFG.customPlateText = cpt.trim().substring(0, 8).toUpperCase();
    const pdm = IniFile.ReadInt(CONFIG_PATH, "Settings", "PauseDuringMissions");
    if (pdm !== null && pdm !== undefined) CFG.pauseDuringMissions = (pdm === 1);
    const mk = IniFile.ReadInt(CONFIG_PATH, "Settings", "MenuKeyCode");
    if (mk && mk > 0) CFG.menuKey = mk; else CFG.menuKey = VK_F6;
    const sk = IniFile.ReadInt(CONFIG_PATH, "Settings", "SpawnerKeyCode");
    if (sk && sk > 0) CFG.spawnerKey = sk; else CFG.spawnerKey = VK_F5;
  } catch(e) {
    log("LOGGER: loadConfig error: " + (e.stack || e));
  }
}
function getCarMods(car, modelId) {
  const mods = [];
  if (!isTunableVehicle(modelId)) return mods;
  if (!isCarUsable(car)) return mods;
  for (let slot = 0; slot <= 14; slot++) {
    try {
      let id = 0;
      if (typeof car.getModSlot === 'function') id = car.getModSlot(slot);
      else if (typeof car.getCurrentMod === 'function') id = car.getCurrentMod(slot);
      else if (typeof Car !== 'undefined' && typeof Car.GetModSlot === 'function') id = Car.GetModSlot(car, slot);
      if (id && id >= 1000) mods.push(id);
    } catch(e) {}
  }
  return mods;
}
// Nitro mod IDs in GTA SA: 1008=x1, 1009=x3, 1010=x5/infinite
const NITRO_MOD_IDS = [1008, 1009, 1010];
// Returns a compact extras object: { hydraulics: bool, nitroModId: int|0 }
function getCarExtras(car, mods) {
  const extras = { hydraulics: false, nitroModId: 0 };
  if (!car) return extras;
  // Hydraulics — check live state via game API
  try {
    if (typeof car.doesHaveHydraulics === 'function') {
      extras.hydraulics = !!car.doesHaveHydraulics();
    }
  } catch(e) {}
  // Nitro — detect from installed mod IDs (most reliable, avoids memory reads)
  if (mods && mods.length) {
    for (const id of mods) {
      if (NITRO_MOD_IDS.indexOf(id) !== -1) {
        extras.nitroModId = id;
        break;
      }
    }
  }
  return extras;
}
// Restores hydraulics and nitro on a freshly spawned car.
function applyCarExtras(car, extras) {
  if (!car || !extras) return;
  if (extras.hydraulics) {
    try {
      if (typeof car.setHydraulics === 'function') car.setHydraulics(true);
      else if (typeof Car !== 'undefined' && typeof Car.SetHydraulics === 'function') Car.SetHydraulics(car, true);
    } catch(e) {}
  }
  if (extras.nitroModId) {
    // giveNonPlayerNitro gives one shot; call multiple times for multi-shot types
    const shots = extras.nitroModId === 1009 ? 3 : extras.nitroModId === 1010 ? 5 : 1;
    try {
      for (let i = 0; i < shots; i++) {
        if (typeof car.giveNonPlayerNitro === 'function') car.giveNonPlayerNitro();
        else if (typeof Car !== 'undefined' && typeof Car.GiveNonPlayerNitro === 'function') Car.GiveNonPlayerNitro(car);
      }
    } catch(e) {}
  }
}
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
log("LOGGER: starting");
loadConfig();
gatherAndUpdateAllOnStart();
log("LOGGER: initialized with " + cache.length + " parked entries");
wait(500);
showTextBox("~y~Car Exit Logger~n~~w~F5=spawner  F6=menu  F7=reload INI");
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
  const f7Now = Pad.IsKeyPressed(VK_F7);
  if (f7Now && !f7WasDown) {
    f7WasDown = true;
    loadConfig();
    let playerCar = null;
    try { if (char.isInAnyCar()) playerCar = getCarHandle(char); } catch(e) {}
    for (const k in streamed) {
      const c = streamed[k];
      try { if (isCarValid(c) && (!playerCar || !sameCar(c, playerCar))) deleteCarHandle(c); } catch(e) {}
    }
    streamed = {};
    spawnTimeMap = {};
    gatherAndUpdateAllOnStart();
    runStreamer(char);
    log("LOGGER: reloaded, " + cache.length + " entries");
    showTextBox("~y~INI reloaded! ~g~" + cache.length + " ~y~entries");
    // Drain F7 hold so the reload doesn't fire again on the next frame
    while (Pad.IsKeyPressed(VK_F7)) wait(0);
  } else if (!f7Now) {
    f7WasDown = false;
  }
  const f5Now         = Pad.IsKeyPressed(CFG.spawnerKey || VK_F5);
  const f5JustPressed = f5Now && !f5WasDown;
  f5WasDown           = f5Now;
  if (f5JustPressed) {
    if (char.isInAnyCar()) {
      showTextBox("~r~Cannot open spawner in a vehicle!~n~~w~Get out on foot first.");
      log("LOGGER: Spawner open blocked — player is in a vehicle");
    } else {
      runSpawnerMenu(player, char);
      drainKeys();
      f5WasDown = false;
    }
    continue;
  }
  const f6Now         = Pad.IsKeyPressed(CFG.menuKey || VK_F6);
  const f6JustPressed = f6Now && !f6WasDown;
  f6WasDown           = f6Now;
  if (f6JustPressed) {
    if (char.isInAnyCar()) {
      showTextBox("~r~Cannot open menu in a vehicle!~n~~w~Get out on foot first.");
      log("LOGGER: Menu open blocked — player is in a vehicle");
    } else {
      runMenu(player, char);
      drainKeys();
      f6WasDown = false;
    }
    continue;
  }
  const inCar = char.isInAnyCar();
  checkCheatCodes(player, char);
  if (inCar) {
    if (!wasInCar) {
      wasInCar = true;
      fireNotified = false;
      try {
        const car = getCarHandle(char);
        const mid = getCarModelId(car);
        if (car && isCarValid(car) && mid > 0) {
          lastCarHandle = car;
          const vName = getVehicleName(mid);
          log("LOGGER: Entered vehicle model " + mid + " (" + vName + ")");
          tryClaimCar(car, char);
          probeAndCacheTunability(car, mid);
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
    if (lastCarHandle && isCarValid(lastCarHandle)) {
      try {
        if (CFG.pauseDuringMissions && isPlayerOnMission()) {
          const vMid = getCarModelId(lastCarHandle);
          const vName = getVehicleName(vMid);
          log("LOGGER: Exited vehicle while on a mission — exit position not saved (" + vName + ")");
          if (CFG.tooltips) showTextBox("~y~Mission Active!~n~~w~Exit position not saved for ~y~" + vName);
        } else {
          const hp = getCarHealth(lastCarHandle);
          if (hp > 250 && isCarUsable(lastCarHandle)) {
            log("LOGGER: Added vehicle handle to pending exit queue (Health: " + hp + " HP)");
            pending.push({ car: lastCarHandle, t: Date.now() });
          } else {
            log("LOGGER: Exited vehicle with health <= 250 (" + hp + " HP) — ignored & discarded");
            if (CFG.tooltips && !fireNotified) showTextBox("~r~Vehicle destroyed!~n~~w~Exit position not saved.");
          }
        }
      } catch(e) {
        log("LOGGER: Error on exit check: " + (e.stack || e));
      }
    }
    lastCarHandle = null;
  }
  runPending(char);
  runStreamer(char);
}
