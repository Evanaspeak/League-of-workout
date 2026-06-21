import { prisma } from "./prisma";

export async function seedDefaults() {
  const [userCount, roleCount, levelCount, masteryCount] = await Promise.all([
    prisma.user.count(),
    prisma.roleWeight.count(),
    prisma.levelConfig.count(),
    prisma.masteryConfig.count(),
  ]);

  if (userCount === 0) {
    await prisma.user.create({ data: { pseudo: "Joueur", gainageMaxSec: 45 } });
  }

  if (roleCount === 0) {
    await prisma.roleWeight.createMany({
      data: [
        { role: "Top",     poidsMort: 3.0, poidsKill: 1.2, poidsAssist: 0.8, maitriseActive: true },
        { role: "Jungle",  poidsMort: 3.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: true },
        { role: "Mid",     poidsMort: 3.0, poidsKill: 1.3, poidsAssist: 1.0, maitriseActive: true },
        { role: "ADC",     poidsMort: 3.2, poidsKill: 1.3, poidsAssist: 0.9, maitriseActive: true },
        { role: "Support", poidsMort: 2.2, poidsKill: 0.6, poidsAssist: 1.6, maitriseActive: true },
        { role: "ARAM",    poidsMort: 1.8, poidsKill: 0.8, poidsAssist: 1.0, maitriseActive: false },
        { role: "Arena",   poidsMort: 2.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: false },
      ],
    });
  }

  if (levelCount === 0) {
    await prisma.levelConfig.createMany({
      data: [
        { niveau: 1, seuilGainageSec: 45,   multiplicateur: 1.0,  malusDefaite: 5  },
        { niveau: 2, seuilGainageSec: 90,   multiplicateur: 1.67, malusDefaite: 8  },
        { niveau: 3, seuilGainageSec: 150,  multiplicateur: 2.33, malusDefaite: 12 },
        { niveau: 4, seuilGainageSec: 240,  multiplicateur: 3.33, malusDefaite: 15 },
        { niveau: 5, seuilGainageSec: 9999, multiplicateur: 4.67, malusDefaite: 20 },
      ],
    });
  }

  if (masteryCount === 0) {
    await prisma.masteryConfig.create({ data: { surchargeMax: 0.5, partiesPourMax: 100 } });
  }
}
