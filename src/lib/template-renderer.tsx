import { ImageResponse } from "next/og";

import { renderApexCanine } from "./apex-canine-render";
import { loadApexCanineFonts } from "./apex-canine-fonts";
import { renderCaniGuard5 } from "./caniguard5-render";
import { loadCaniGuard5Fonts } from "./caniguard5-fonts";
import { renderContentGate } from "./contentgate-render";
import { loadContentGateFonts } from "./contentgate-fonts";
import {
  getTemplateLayoutContract,
  type TemplateSizeKey,
} from "./template-contract";
import { renderVitalBite } from "./vitalbite-render";
import { loadVitalBiteFonts } from "./vitalbite-fonts";

type ImageResponseOptions = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>;
type ImageResponseFont = NonNullable<ImageResponseOptions["fonts"]>[number];

export type TemplateRenderInput = {
  layoutKey: string;
  sizeKey: TemplateSizeKey;
  fields: Record<string, string>;
  disclaimer: string;
  origin: string;
  original?: boolean;
};

export type TemplateRenderResult = {
  element: React.ReactElement;
  w: number;
  h: number;
  fonts: ImageResponseFont[];
};

export async function renderContractTemplate(
  input: TemplateRenderInput
): Promise<TemplateRenderResult | null> {
  const contract = getTemplateLayoutContract(input.layoutKey);
  if (!contract) return null;
  if (!contract.sizes.includes(input.sizeKey)) {
    throw new Error(`Unsupported ${input.sizeKey} output for ${input.layoutKey}.`);
  }

  if (contract.renderer === "apex-canine") {
    const rendered = renderApexCanine(input);
    return {
      ...rendered,
      fonts: (await loadApexCanineFonts()) as ImageResponseFont[],
    };
  }
  if (contract.renderer === "caniguard5") {
    const rendered = renderCaniGuard5(input);
    return {
      ...rendered,
      fonts: (await loadCaniGuard5Fonts()) as ImageResponseFont[],
    };
  }
  if (contract.renderer === "contentgate") {
    const rendered = renderContentGate(input);
    return {
      ...rendered,
      fonts: (await loadContentGateFonts()) as ImageResponseFont[],
    };
  }

  const rendered = renderVitalBite(input);
  return {
    ...rendered,
    fonts: (await loadVitalBiteFonts()) as ImageResponseFont[],
  };
}
