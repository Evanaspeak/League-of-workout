-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pseudo" TEXT NOT NULL DEFAULT 'Joueur',
    "riotId" TEXT,
    "riotPuuid" TEXT,
    "riotRegion" TEXT NOT NULL DEFAULT 'EUW1',
    "gainageMaxSec" INTEGER NOT NULL DEFAULT 45
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "champion" TEXT,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "gainageSec" INTEGER NOT NULL,
    "niveauCalcule" INTEGER NOT NULL,
    "partiesAvantCalcule" INTEGER NOT NULL,
    "surchargeCalculee" REAL NOT NULL,
    "scoreCalcule" INTEGER NOT NULL,
    "malusCalcule" INTEGER NOT NULL,
    "pompesCalculees" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "riotMatchId" TEXT,
    CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoleWeight" (
    "role" TEXT NOT NULL PRIMARY KEY,
    "poidsMort" REAL NOT NULL,
    "poidsKill" REAL NOT NULL,
    "poidsAssist" REAL NOT NULL,
    "maitriseActive" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "LevelConfig" (
    "niveau" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "seuilGainageSec" INTEGER NOT NULL,
    "multiplicateur" REAL NOT NULL,
    "malusDefaite" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "MasteryConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "surchargeMax" REAL NOT NULL DEFAULT 0.5,
    "partiesPourMax" INTEGER NOT NULL DEFAULT 100
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "objectifTotalPompes" INTEGER NOT NULL DEFAULT 1000,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Goal_userId_key" ON "Goal" ("userId");
