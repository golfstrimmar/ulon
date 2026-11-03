import type { HtmlNode } from "@/types/HtmlNode";

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  projects: ProjectSummary[];
}

export interface FullProjectPayload {
  id: string;
  name: string;
  folderId: string;
  htmlJson: HtmlNode[];
  scss?: string;
  js?: string;
  updatedAt: string;
}
