import { ENV_MAPS } from '../utils/environment';

export interface ModelSettings {
    camera: {
      fov: number;
      position: [number, number, number];
      target?: [number, number, number];
    };
    material: {
      clearcoatRoughness: number;
      metalness: number;
      roughness: number;
    };
    lighting: {
      ambientLight: boolean;
      intensity: number;
    };
    envMapPath?: string;
    name?: string;
  }
  
  export interface ViewerMessage {
    type: 'camera' | 'material' | 'lighting' | 'envMap' | 'renderer';
    action?: string;
    value?: any;
    data?: any;
    rendererType?: 'webgpu' | 'webgl';
    webgpuAvailable?: boolean;
  }
  
  export const defaultSettings: ModelSettings = {
    camera: {
      fov: 75,
      position: [3, 3, 3],
      target: [0, 0, 0]
    },
    material: {
      clearcoatRoughness: 0,
      metalness: 1,
      roughness: 0
    },
    lighting: {
      ambientLight: false,
      intensity: 1
    },
    envMapPath: ENV_MAPS.DEFAULT.value,
  };