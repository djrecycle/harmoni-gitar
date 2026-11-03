import { notFound } from "next/navigation";
import { getSettings, type Features } from "./settings";

export type Feature = keyof Features;

/** Is this feature switched on in Pengaturan? Payments are off by default. */
export async function isFeatureEnabled(feature: Feature): Promise<boolean> {
  return (await getSettings()).features[feature] === true;
}

/** For pages and route handlers behind a flag (e.g. /guru/pembayaran/*): 404 while the feature is off. */
export async function requireFeature(feature: Feature): Promise<void> {
  if (!(await isFeatureEnabled(feature))) notFound();
}

export class FeatureDisabledError extends Error {
  constructor(feature: Feature) {
    super(`Feature "${feature}" is disabled`);
  }
}

/** For server actions behind a flag: throws while the feature is off, so the action never runs. */
export async function assertFeature(feature: Feature): Promise<void> {
  if (!(await isFeatureEnabled(feature))) throw new FeatureDisabledError(feature);
}
