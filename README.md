# GTA San Andreas - Dynamic Parked Vehicles & Persistent Garage (CLEO Redux)

![GTA SA CLEO Redux](https://img.shields.io/badge/GTA%20SA-CLEO%20Redux-blue.svg)
![Language](https://img.shields.io/badge/Language-JavaScript%20%28ES6%2B%29-yellow.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

An advanced, high-performance **CLEO Redux** mod for **Grand Theft Auto: San Andreas** (Classic & Portable) that brings true vehicle persistence to San Andreas.

Every time CJ exits a vehicle, its exact 3D position, heading, 15 tuning upgrade slots, vinyl paintjobs, 4-color palette, engine HP, flat tires, and visual damage are automatically saved to disk. A high-efficiency **proximity streamer** dynamically manages vehicle handles in the world as you explore, while an **interactive F6 HUD menu** lets you browse, manage, and teleport to any saved car across the entire map.

---

## Key Features

- 🚘 **Full Vehicle Persistence**: Automatically logs vehicle exit location and restores exact state upon return.
- 🛠️ **Complete Upgrade Audit**: Saves and restores all 15 tuning slots across TransFender, Loco Low Co, and Wheel Arch Angels (Spoilers, Hoods, Vents, Roofs, Side Skirts, Bumpers, Exhausts, Wheels, Hydraulics, Nitro, Stereo, Lamps).
- 🎨 **Paintjobs & 4-Color Palette**:
  - Restores lowrider & street racer vinyl decals (`06ED`).
  - Implements a dual-pass color restoration algorithm to preserve custom primary and secondary body paint over vinyl textures.
  - Supports 3rd and 4th extra trim/rim colors (`0A12` / `0A11`).
- 🩺 **Damage & Health Preservation**:
  - Engine health and smoke/fire levels (`02AB`).
  - Deflated / popped tire indices 0..3 (`04FE`).
  - Visual panel and door denting matching health degradation (`0730` / `073C`).
- 🛑 **Dead-Stop Exit Detection**: Waits for the vehicle's velocity to reach a complete stationary stop (`speed < 0.05`) before recording coordinates.
- 🌊 **Sunken Vehicle Storage**: Vehicles parked in water with health > 250 HP are stored normally without being discarded.
- 💥 **Collision Mesh Safety**: Includes proximity spawn deferral (`sq < 36.0`) to prevent physics mesh rebuild explosions when driving past parked spots.
- 📋 **Interactive F6 Garage Menu**:
  - Press **F6** on foot to open a clean, crash-free text-box menu.
  - Browse vehicles with Numpad `8` / `2` with instant driver-door teleportation & behind-player camera positioning.
  - Page through entries with Numpad `4` / `6`.
  - Auto-closes on vehicle entry or player death.
- 🗺️ **Game Memory & Map Mod Compatibility**:
  - Dynamically resolves localized zone names and vehicle names directly from GTA SA RAM memory on startup.
  - Compatible with custom map expansion mods (e.g., *Stars & Stripes*, *Underground*).
- 🔄 **Real-Time INI Hot-Reloading**: Press **F7** to reload configuration settings without restarting the game.

---

## Controls

| Key | Context | Action |
| :--- | :--- | :--- |
| **F6** | On Foot | Open / Close Parked Vehicles Garage Menu |
| **Numpad 8** | Menu Open | Move Up & Teleport to Selected Vehicle |
| **Numpad 2** | Menu Open | Move Down & Teleport to Selected Vehicle |
| **Numpad 4** | Menu Open | Previous Page |
| **Numpad 6** | Menu Open | Next Page |
| **F7** | Anywhere | Hot-reload `car_exit_logger.ini` & re-stream parked vehicles |

---

## Installation

1. Install [CLEO Redux](https://re.cleo.li/) for GTA San Andreas.
2. Copy `car_exit_logger[fs].sa.js` into your GTA San Andreas `CLEO/` directory.
3. (Optional) Copy `car_exit_logger.ini` into your GTA San Andreas `CLEO/` directory to customize streaming radii and preferences.
4. Launch the game!

---

## Configuration (`CLEO/car_exit_logger.ini`)

```ini
[Settings]
; Proximity distance (meters) to stream vehicles IN
streamIn=150.0

; Proximity distance (meters) to stream vehicles OUT
streamOut=170.0

; Maximum allowed entries in vehicles.parked
maxEntries=100

; Automatically unlock doors when streaming in vehicles
unlockDoors=1

; Display onscreen tooltip notifications
tooltips=1

; Restore engine health and visual damage
saveHealth=1

; Restore deflated / popped tires
saveTires=1
```

---

## Data Storage Format (`CLEO/vehicles.parked`)

Parked vehicle entries are stored in clean key-value tags:

```ini
[Vehicles]
Count=1
Entry0=M:567|N:Savanna|C:2644.59,-2002.99,13.18|H:195.36|Cl:1,61,0,0|P:2|Hp:1000|Tr:None|Dm:0;1;4|Dd:2;3|U:1133;1130;1010;1087;1086;1078;1132;1188|L:Ganton
```

| Tag | Field | Description |
| :--- | :--- | :--- |
| `M:` | Model ID | Vehicle model ID (400..611) |
| `N:` | Name | Shortened localized vehicle name |
| `C:` | Coordinates | 3D World Position (`X,Y,Z`) |
| `H:` | Heading | Compass heading angle (0..360°) |
| `Cl:`| Colors | Color palette (`Primary,Secondary,Extra3,Extra4`) |
| `P:` | Paintjob | Active vinyl paintjob ID (0..2) |
| `Hp:`| Health | Engine health points (251..1000 HP) |
| `Tr:`| Popped Tires | Deflated tire indices (`0;1;2;3` or `None`) |
| `Dm:`| Damaged Panels | Exact dented panel indices (`0..6` or `None`) |
| `Dd:`| Damaged Doors | Exact dented door indices (`0..5` or `None`) |
| `U:` | Upgrades | Installed tuning mod IDs (e.g. `1133;1130` or `None`) |
| `L:` | Location | Shortened map zone or city area name |

---

## Technical Details & Architecture

- **Engine**: CLEO Redux JavaScript (`.sa.js`) for GTA San Andreas.
- **Memory Safety**: Uses safe wrappers around native CLEO opcodes (`00A5`, `0229`, `06ED`, `0A11`, `0A12`, `043C`, `06E7`, `02AB`, `04FE`, `0730`, `073C`).
- **RAM Active Vehicle Shield**: Queries live GTA SA RAM handle memory (`getCarHandle`) on every operation to prevent deleting or modifying CJ's active vehicle.
- **Physics Deferral**: Defers vehicle creation when CJ is driving within 6m of a spawn coordinate to avoid `CColModel` collision mesh rebuild explosions.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
