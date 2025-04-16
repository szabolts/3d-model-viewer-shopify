export const ENV_MAPS = {
  DEFAULT: { label: 'Sunflowers', value: '/images/sunflowers_puresky_2k.hdr' },
  SUNFLOWERS: { label: 'Sunflowers', value: '/images/sunflowers_puresky_2k.hdr' },
  SPRUIT_SUNRISE: { label: 'Spruit Sunrise', value: '/images/spruit_sunrise_2k.hdr' },
  CANNON: { label: 'Cannon HDR', value: '/images/cannon_1k.hdr' }
} as const;

export const ENV_MAP_OPTIONS = Object.values(ENV_MAPS);