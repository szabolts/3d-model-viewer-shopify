import { ActionFunctionArgs, json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const modelUrl = url.searchParams.get('modelUrl');
  
  if (!modelUrl) {
    return json({ error: "Model URL is required" }, { status: 400 });
  }
  
  try {
    // Fetch settings for the given model URL and shop
    const settings = await db.modelSettings.findUnique({
      where: {
        shop_modelUrl: {
          shop: session.shop,
          modelUrl: modelUrl
        }
      }
    });
    
    if (!settings) {
      return json({ 
        settings: null,
        message: "No settings found for this model"
      });
    }
    
    return json({ 
      settings: {
        camera: {
          fov: settings.cameraFov,
          position: [settings.cameraPositionX, settings.cameraPositionY, settings.cameraPositionZ],
          target: [settings.cameraTargetX, settings.cameraTargetY, settings.cameraTargetZ]
        },
        material: {
          clearcoatRoughness: settings.clearcoatRoughness,
          metalness: settings.metalness,
          roughness: settings.roughness
        },
        lighting: {
          ambientLight: settings.ambientLight,
          intensity: settings.lightIntensity
        },
        envMapPath: settings.envMapPath,
        name: settings.name
      }
    });
  } catch (error) {
    console.error("Error fetching model settings:", error);
    return json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  // Get settings from request body
  const data = await request.json();
  const { modelUrl, settings, name } = data;
  
  if (!modelUrl || !settings) {
    return json({ error: "Model URL and settings are required" }, { status: 400 });
  }
  
  try {
    // Create or update settings
    const updatedSettings = await db.modelSettings.upsert({
      where: {
        shop_modelUrl: {
          shop: session.shop,
          modelUrl: modelUrl
        }
      },
      update: {
        name: name || undefined,
        cameraFov: settings.camera?.fov || 75,
        cameraPositionX: settings.camera?.position?.[0] || 3,
        cameraPositionY: settings.camera?.position?.[1] || 3,
        cameraPositionZ: settings.camera?.position?.[2] || 3,
        cameraTargetX: settings.camera?.target?.[0] || 0,
        cameraTargetY: settings.camera?.target?.[1] || 0,
        cameraTargetZ: settings.camera?.target?.[2] || 0,
        clearcoatRoughness: settings.material?.clearcoatRoughness || 0,
        metalness: settings.material?.metalness || 1, 
        roughness: settings.material?.roughness || 0,
        ambientLight: settings.lighting?.ambientLight || false,
        lightIntensity: settings.lighting?.intensity || 1,
        envMapPath: settings.envMapPath || "/images/sunflowers_puresky_2k.hdr"
      },
      create: {
        shop: session.shop,
        modelUrl: modelUrl,
        name: name || null,
        cameraFov: settings.camera?.fov || 75,
        cameraPositionX: settings.camera?.position?.[0] || 3,
        cameraPositionY: settings.camera?.position?.[1] || 3,
        cameraPositionZ: settings.camera?.position?.[2] || 3,
        cameraTargetX: settings.camera?.target?.[0] || 0,
        cameraTargetY: settings.camera?.target?.[1] || 0,
        cameraTargetZ: settings.camera?.target?.[2] || 0,
        clearcoatRoughness: settings.material?.clearcoatRoughness || 0,
        metalness: settings.material?.metalness || 1,
        roughness: settings.material?.roughness || 0,
        ambientLight: settings.lighting?.ambientLight || false,
        lightIntensity: settings.lighting?.intensity || 1,
        envMapPath: settings.envMapPath || "/images/sunflowers_puresky_2k.hdr"
      }
    });
    
    return json({ 
      success: true, 
      message: "Settings saved successfully",
      settings: updatedSettings
    });
  } catch (error) {
    console.error("Error saving model settings:", error);
    return json({ error: "Failed to save settings" }, { status: 500 });
  }
}