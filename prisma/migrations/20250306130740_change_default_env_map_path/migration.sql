-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ModelSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "modelUrl" TEXT NOT NULL,
    "name" TEXT,
    "cameraFov" REAL NOT NULL DEFAULT 75,
    "cameraPositionX" REAL NOT NULL DEFAULT 3,
    "cameraPositionY" REAL NOT NULL DEFAULT 3,
    "cameraPositionZ" REAL NOT NULL DEFAULT 3,
    "cameraTargetX" REAL NOT NULL DEFAULT 0,
    "cameraTargetY" REAL NOT NULL DEFAULT 0,
    "cameraTargetZ" REAL NOT NULL DEFAULT 0,
    "clearcoatRoughness" REAL NOT NULL DEFAULT 0,
    "metalness" REAL NOT NULL DEFAULT 1,
    "roughness" REAL NOT NULL DEFAULT 0,
    "ambientLight" BOOLEAN NOT NULL DEFAULT false,
    "lightIntensity" REAL NOT NULL DEFAULT 1,
    "envMapPath" TEXT NOT NULL DEFAULT '/images/sunflowers_puresky_2k.hdr',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ModelSettings" ("ambientLight", "cameraFov", "cameraPositionX", "cameraPositionY", "cameraPositionZ", "cameraTargetX", "cameraTargetY", "cameraTargetZ", "clearcoatRoughness", "createdAt", "envMapPath", "id", "lightIntensity", "metalness", "modelUrl", "name", "roughness", "shop", "updatedAt") SELECT "ambientLight", "cameraFov", "cameraPositionX", "cameraPositionY", "cameraPositionZ", "cameraTargetX", "cameraTargetY", "cameraTargetZ", "clearcoatRoughness", "createdAt", "envMapPath", "id", "lightIntensity", "metalness", "modelUrl", "name", "roughness", "shop", "updatedAt" FROM "ModelSettings";
DROP TABLE "ModelSettings";
ALTER TABLE "new_ModelSettings" RENAME TO "ModelSettings";
CREATE UNIQUE INDEX "ModelSettings_shop_modelUrl_key" ON "ModelSettings"("shop", "modelUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
