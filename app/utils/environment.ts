export const ENV_MAPS = {
    DEFAULT: '/images/sunflowers_puresky_2k.hdr',
    SUNFLOWERS: '/images/sunflowers_puresky_2k.hdr',
    SPRUIT_SUNRISE: '/images/spruit_sunrise_2k.hdr',
    CANNON: '/images/cannon_1k.hdr'
  } as const;
  
  export const ENV_MAP_OPTIONS = [
    { label: 'Sunflowers', value: ENV_MAPS.SUNFLOWERS },
    { label: 'Spruit Sunrise', value: ENV_MAPS.SPRUIT_SUNRISE },
    { label: 'Cannon HDR', value: ENV_MAPS.CANNON }
  ] as const;