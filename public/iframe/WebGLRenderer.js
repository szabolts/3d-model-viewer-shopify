import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import Stats from 'stats-gl';
import { reflector, texture, uv } from 'three/tsl';
import { ENV_MAPS } from '../../app/utils/environment.ts';

let renderer, scene, camera, controls, currentModel, stats;

async function init() {
  const params = new URLSearchParams(window.location.search);

  // Camera settings
  const fov = parseFloat(params.get('fov')) || 75;
  const cameraX = parseFloat(params.get('cameraX')) || 3;
  const cameraY = parseFloat(params.get('cameraY')) || 3;
  const cameraZ = parseFloat(params.get('cameraZ')) || 3;
  const targetX = parseFloat(params.get('targetX')) || 0;
  const targetY = parseFloat(params.get('targetY')) || 0;
  const targetZ = parseFloat(params.get('targetZ')) || 0;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(cameraX, cameraY, cameraZ);

  // Material settings
  const materialSettings = {
    clearcoatRoughness: parseFloat(params.get('clearcoatRoughness')) || 0,
    metalness: parseFloat(params.get('metalness')) || 1,
    roughness: parseFloat(params.get('roughness')) || 0
  };

  // Lighting settings
  const useAmbientLight = params.get('ambientLight') === 'true';
  const lightIntensity = parseFloat(params.get('lightIntensity')) || 1;
  
  if (useAmbientLight) {
    const ambientLight = new THREE.AmbientLight(0xffffff, lightIntensity);
    scene.add(ambientLight);
  }

  // Create WebGL renderer
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: "high-performance"
  });
  
  // Notify parent that we're using WebGL
  window.parent.postMessage({
    type: 'renderer',
    rendererType: 'webgl'
  }, '*');
  
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Stats
  stats = new Stats({
    precision: 3,
    horizontal: false,
    trackGPU: true
  });
  stats.init(renderer);
  document.body.appendChild(stats.dom);

  // Create OrbitControls and set target from URL params
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(targetX, targetY, targetZ);
  controls.update();

  // Handle URL parameters
  const modelUrl = params.get('model');
  const envMapPath = params.get('envMap') || ENV_MAPS.DEFAULT.value;

  // Load environment map
  new RGBELoader()
    .load(envMapPath, (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.environment = texture;

      // Load model after environment map is ready
      if (modelUrl) {
        loadModel(modelUrl, materialSettings);
        loadReflectionPlane();
      }
    });

  animate();
  return { materialSettings };
}

function loadReflectionPlane() {
  // Create reflector
  const reflection = reflector({ resolution: 1 });
  reflection.target.rotateX(-Math.PI / 2);
  scene.add(reflection.target);

  // Load textures
  const textureLoader = new THREE.TextureLoader();
  
  // Load normal map
  const floorNormal = textureLoader.load('/images/textures/refPlane_normal.png');
  floorNormal.wrapS = THREE.RepeatWrapping;
  floorNormal.wrapT = THREE.RepeatWrapping;
  floorNormal.repeat.set(15, 15);
  
  // Load roughness map
  const floorRoughness = textureLoader.load('/images/textures/refPlane_roughness.png');
  floorRoughness.wrapS = THREE.RepeatWrapping;
  floorRoughness.wrapT = THREE.RepeatWrapping;
  floorRoughness.repeat.set(15, 15);

  // Create UV scaling for the textures
  const floorUV = uv().mul(15);
  const floorNormalOffset = texture(floorNormal, floorUV).xy.mul(2).sub(1).mul(0.02);

  // Update reflection UV with normal offset
  reflection.uvNode = reflection.uvNode.add(floorNormalOffset);

  // Create floor material with reflection
  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xFFFFFF),
    roughness: 0.0,
    metalness: 1.0,
    envMapIntensity: 1.0,
    reflectivity: 1.0,
    normalMap: floorNormal,
    normalScale: new THREE.Vector2(0.0025, 0.0025),
  });

  // Add reflection to material
  floorMaterial.colorNode = reflection;

  // Create floor mesh
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100, 64, 64),
    floorMaterial
  );
  floor.receiveShadow = true;
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;

  scene.add(floor);
}

// Message handling
window.addEventListener('message', (event) => {
  // Check if we have the required objects
  if (!camera || !controls) return;

  const { type, action, value } = event.data;

  // Handle camera position save request
  if (type === 'camera' && action === 'savePosition') {
    const position = camera.position.toArray();
    const target = controls.target.toArray();
    
    window.parent.postMessage({
      type: 'camera',
      action: 'positionSaved',
      data: {
        position: position,
        target: target
      }
    }, '*');
    return;
  }
  
  // Handle live preview updates
  switch (type) {
    case 'cameraPosition':
      if (value?.position) {
        camera.position.set(value.position[0], value.position[1], value.position[2]);
      }
      if (value?.target) {
        controls.target.set(value.target[0], value.target[1], value.target[2]);
      }
      controls.update();
      break;
      
    case 'cameraFov':
      camera.fov = value;
      camera.updateProjectionMatrix();
      break;
      
    case 'material':
      if (currentModel) {
        currentModel.traverse((child) => {
          if (child.isMesh && child.material) {
            if (child.material.clearcoatRoughness !== value.clearcoatRoughness) {
              child.material.clearcoatRoughness = value.clearcoatRoughness;
            }
            if (child.material.metalness !== value.metalness) {
              child.material.metalness = value.metalness;
            }
            if (child.material.roughness !== value.roughness) {
              child.material.roughness = value.roughness;
            }
          }
        });
      }
      break;
      
    case 'lighting':
      const ambientLight = scene.children.find(child => child.isAmbientLight);
      if (value.ambientLight) {
        if (!ambientLight) {
          scene.add(new THREE.AmbientLight(0xffffff, value.intensity));
        } else if (ambientLight.intensity !== value.intensity) {
          ambientLight.intensity = value.intensity;
        }
      } else if (ambientLight) {
        scene.remove(ambientLight);
      }
      break;
      
    case 'envMap':
      if (value) {
        new RGBELoader().load(value, (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture;
          scene.environment = texture;
        });
      }
      break;
  }
});

function loadModel(url, materialSettings) {
  const loader = new GLTFLoader();
  loader.load(url, (gltf) => {
    if (currentModel) {
      scene.remove(currentModel);
    }
    
    currentModel = gltf.scene;
    
    // Apply material settings
    currentModel.traverse((child) => {
      if (child.isMesh && child.material) {
        Object.assign(child.material, materialSettings);
      }
    });

    scene.add(currentModel);
    
    const params = new URLSearchParams(window.location.search);
    const hasTarget = params.has('targetX') && params.has('targetY') && params.has('targetZ');
    
    if (!hasTarget) {
      // Auto-adjust camera to fit model
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      camera.position.copy(center);
      camera.position.x += maxDim * 2;
      camera.position.y += maxDim / 2;
      camera.position.z += maxDim * 2;
      camera.lookAt(center);
      controls.target.copy(center);
    }
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  stats.update();
}

init().catch(console.error);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});