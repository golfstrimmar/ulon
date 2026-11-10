export type TabId = "preview" | "html" | "css" | "js";

export type TabColor = "orange" | "sky" | "amber";

export interface ExportTab {
  id: TabId;
  label: string;
  filename?: string;
  color?: TabColor;
}

export type {
  BuildOptions,
  BundleAsset,
  ProductionBundle,
} from "./productionBuilder";
