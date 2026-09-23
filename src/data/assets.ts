// Asset manifest. Files live under public/ and are referenced relative to the page (base './').
// Every consumer MUST tolerate a missing file (fallback to a procedural placeholder or a CSS avatar),
// because art is produced in parallel with code.

// ---------------------------------------------------------------- 3D models (public/models/<key>.glb)
// Conventions (three.js space): +Y up, the model's front faces +Z, 1 unit = 1 meter,
// origin on the ground at the footprint center (mowers: center of the cutting deck).
export const MODEL_KEYS = [
  // mowers
  'mower_reel', 'mower_push', 'mower_selfprop', 'mower_walkbehind', 'mower_zt48', 'mower_standon',
  'mower_zt60', 'mower_widearea', 'mower_gangreel',
  // hand tools
  'tool_shears', 'tool_trimmer', 'tool_trimmer_pro', 'tool_broom', 'tool_blower', 'tool_backpack',
  // add-ons (shop display only)
  'addon_stripekit', 'addon_sharpener', 'addon_bagger',
  // vehicles
  'veh_bike', 'veh_pickup', 'veh_pickup_trailer', 'veh_crewtruck', 'veh_boxtruck',
  // people (nodes named Head, Torso, ArmL, ArmR, LegL, LegR with pivots at the joints)
  'char_worker', 'char_homeowner',
  // buildings (front door faces +Z, the street side)
  'house_ranch', 'house_colonial', 'house_cottage', 'house_modern', 'house_mansion',
  'bld_office', 'bld_church', 'bld_school', 'bld_clubhouse', 'bld_pavilion', 'bld_hq_garage',
  // nature
  'tree_oak', 'tree_maple', 'tree_pine', 'tree_birch', 'tree_palm', 'shrub_round', 'shrub_hedge', 'flowers_cluster', 'rock_small', 'rock_big',
  // props
  'prop_gnome', 'prop_mailbox', 'prop_fence_picket', 'prop_fence_iron', 'prop_trampoline', 'prop_kiddie_pool',
  'prop_swingset', 'prop_bench', 'prop_birdbath', 'prop_sprinkler', 'prop_doghouse', 'prop_ball',
  'prop_bbq', 'prop_patio_set', 'prop_lamppost', 'prop_trashcan', 'prop_yard_sign', 'prop_soccer_goal',
  'prop_flagpole', 'prop_hose_reel', 'prop_wheelbarrow', 'prop_mulch_bag', 'prop_leaf_pile',
] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

// ---------------------------------------------------------------- shop thumbnails (public/img/thumbs/<key>.png, 256x256, transparent)
// One per equipment spec `thumb` key (rendered from the GLB in Blender).

// ---------------------------------------------------------------- portraits (public/img/portraits/<key>.webp, 512x512)
export const PORTRAIT_KEYS = [
  'p_retiree_1', 'p_retiree_2', 'p_perfectionist_1', 'p_perfectionist_2', 'p_family_1', 'p_family_2',
  'p_penny_1', 'p_penny_2', 'p_hoa_1', 'p_hoa_2', 'p_techie_1', 'p_techie_2', 'p_gardener_1', 'p_gardener_2',
  'p_eco_1', 'p_eco_2', 'p_landlord_1', 'p_landlord_2', 'p_dude_1', 'p_dude_2', 'p_veteran_1', 'p_veteran_2',
  'p_newcouple_1', 'p_newcouple_2', 'p_executive_1', 'p_executive_2',
  'p_facilities_1', 'p_parks_1', 'p_greenskeeper_1',
] as const;

// staff candidates (public/img/staff/<key>.webp, 512x512)
export const STAFF_PORTRAIT_KEYS = [
  's_1', 's_2', 's_3', 's_4', 's_5', 's_6', 's_7', 's_8', 's_9', 's_10',
] as const;

// ---------------------------------------------------------------- key art (public/img/<key>.webp)
export const IMAGE_KEYS = ['title_bg', 'logo', 'hub_bg', 'owner'] as const;

// ---------------------------------------------------------------- audio (public/audio/<key>.mp3)
export const SFX_KEYS = [
  'reel_loop', 'push_loop', 'zt_loop', 'trimmer_loop', 'blower_loop', 'truck_loop',
  'cut_crunch', 'bump', 'break', 'bag_full', 'bag_empty', 'knock', 'doorbell', 'door_open',
  'cash', 'tip', 'deal', 'reject', 'click', 'hover', 'level_up', 'achievement', 'day_end',
  'birds_ambience', 'rain_ambience', 'dog_bark', 'sprinkler_hit', 'gnome_break',
] as const;
export const MUSIC_KEYS = ['music_title', 'music_hub', 'music_mow'] as const;

export function modelUrl(key: string): string { return `./models/${key}.glb`; }
export function thumbUrl(key: string): string { return `./img/thumbs/${key}.png`; }
export function portraitUrl(key: string): string {
  return key.startsWith('s_') ? `./img/staff/${key}.webp` : `./img/portraits/${key}.webp`;
}
export function imageUrl(key: string): string { return `./img/${key}.webp`; }
export function audioUrl(key: string): string { return `./audio/${key}.mp3`; }
