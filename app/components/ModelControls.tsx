import {
  Card,
  BlockStack,
  Text,
  RangeSlider,
  Checkbox,
  Button,
  Box,
  Collapsible,
  Tabs,
  Select
} from '@shopify/polaris';
import { ChevronDownIcon, ChevronUpIcon, TargetIcon } from '@shopify/polaris-icons';
import { useEffect, useCallback, useState, useRef } from 'react';
import { useBeforeUnload } from '@remix-run/react';

interface ModelSettings {
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
}

interface ModelControlsProps {
  settings: ModelSettings;
  onSettingChange: (category: string, setting: string, value: number | boolean | string) => void;
  onPositionChange: (axis: number, value: number) => void;
  onSaveCameraPosition?: (cameraData: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;
  modelUrl?: string;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  saveSettings: (event?: React.FormEvent) => void;
  handleDiscard: (event?: React.FormEvent) => void;
}

export function ModelControls({
  settings,
  onSettingChange,
  onPositionChange,
  onSaveCameraPosition,
  modelUrl,
  hasUnsavedChanges,
  setHasUnsavedChanges,
  saveSettings,
  handleDiscard
}: ModelControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Setup message listener for camera position
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'camera' && event.data.action === 'positionSaved') {
        const { position, target } = event.data.data;

        if (onSaveCameraPosition) {
          onSaveCameraPosition({
            position: position as [number, number, number],
            target: target as [number, number, number]
          });
        }

        setHasUnsavedChanges(true);

        // Trigger form change for save bar
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = Date.now().toString();
          const event = new Event('change', { bubbles: true });
          hiddenInputRef.current.dispatchEvent(event);
        }

        shopify.toast.show('Camera position saved');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSaveCameraPosition, setHasUnsavedChanges]);


  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );

  const tabs = [
    { id: 'camera-settings', content: 'Camera', accessibilityLabel: 'Camera settings', panelID: 'camera-settings-content' },
    { id: 'model-settings', content: 'Model', panelID: 'model-settings-content' },
    { id: 'lighting-settings', content: 'Lighting', panelID: 'lighting-settings-content' },
  ];

  const handleSavePosition = useCallback(() => {
    const iframe = document.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'camera',
        action: 'savePosition'
      }, '*');
    }
  }, []);


  const handleSettingChange = useCallback((category: string, setting: string, value: string | number | boolean) => {
    onSettingChange(category, setting, value);
  }, [onSettingChange]);

  // Set up the before unload handler
  useBeforeUnload(
    useCallback((event) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        return "You have unsaved changes. Are you sure you want to leave?";
      }
    }, [hasUnsavedChanges])
  );

  const renderCameraSettings = () => (
    <BlockStack gap="400">
      <RangeSlider
        label="Field of View"
        value={settings.camera.fov}
        suffix={<p style={{ minWidth: '24px', textAlign: 'right' }}>{settings.camera.fov}</p>}
        onChange={value => handleSettingChange('camera', 'fov', value)}
        min={30}
        max={120}
        step={1}
      />
      <Box>
        <BlockStack gap="300">
          <Button
            onClick={handleSavePosition}
            icon={TargetIcon}
          >
            Save Current Camera Position
          </Button>
          <Text as="p" variant="bodyMd">
            Position - X: {settings.camera.position[0].toFixed(2)},
            Y: {settings.camera.position[1].toFixed(2)},
            Z: {settings.camera.position[2].toFixed(2)}
          </Text>
          {settings.camera.target && (
            <Text as="p" variant="bodyMd">
              Target - X: {settings.camera.target[0].toFixed(2)},
              Y: {settings.camera.target[1].toFixed(2)},
              Z: {settings.camera.target[2].toFixed(2)}
            </Text>
          )}
        </BlockStack>
      </Box>
    </BlockStack>
  );

  const renderModelSettings = () => (
    <BlockStack gap="400">
      <RangeSlider
        label="Clearcoat Roughness"
        value={settings.material.clearcoatRoughness}
        onChange={value => handleSettingChange('material', 'clearcoatRoughness', value)}
        min={0}
        max={1}
        step={0.01}
      />
      <RangeSlider
        label="Metalness"
        value={settings.material.metalness}
        onChange={value => handleSettingChange('material', 'metalness', value)}
        min={0}
        max={1}
        step={0.01}
      />
      <RangeSlider
        label="Roughness"
        value={settings.material.roughness}
        onChange={value => handleSettingChange('material', 'roughness', value)}
        min={0}
        max={1}
        step={0.01}
      />
    </BlockStack>
  );

  const renderLightingSettings = () => {
    const envMapOptions = [
      { label: 'Sunflowers', value: '/images/sunflowers_puresky_2k.hdr' },
      { label: 'Spruit Sunrise', value: '/images/spruit_sunrise_2k.hdr' },
      { label: 'Cannon HDR', value: '/images/cannon_1k.hdr' }
    ];

    return (
      <BlockStack gap="400">
        <Checkbox
          label="Ambient Light"
          checked={settings.lighting.ambientLight}
          onChange={checked => handleSettingChange('lighting', 'ambientLight', checked)}
        />
        <RangeSlider
          label="Light Intensity"
          value={settings.lighting.intensity}
          onChange={value => handleSettingChange('lighting', 'intensity', value)}
          min={0}
          max={5}
          step={0.1}
          disabled={!settings.lighting.ambientLight}
        />
        {/* <Select
          label="Environment Map"
          options={envMapOptions}
          value={settings.envMapPath || envMapOptions[0].value}
          onChange={(value) => handleSettingChange('general', 'envMapPath', value)}
        /> */}
      </BlockStack>
    );
  };

  return (
    <Card>
      <form
        data-save-bar
        onSubmit={saveSettings}
        onReset={handleDiscard}
      >
        <input 
          type="hidden" 
          ref={hiddenInputRef}
          name="camera-position-timestamp"
          onChange={() => {}} 
        />
        <BlockStack gap="200">
          <Box>
            <Button
              onClick={() => setIsOpen(!isOpen)}
              icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
              fullWidth
            >
              Settings
            </Button>
          </Box>

          <Collapsible
            open={isOpen}
            id="model-controls-collapsible"
          >
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={handleTabChange}
              fitted
            >
              <Box padding="400">
                {selectedTab === 0 && renderCameraSettings()}
                {selectedTab === 1 && renderModelSettings()}
                {selectedTab === 2 && renderLightingSettings()}
              </Box>
            </Tabs>
          </Collapsible>
        </BlockStack>
      </form>
    </Card>
  );
}