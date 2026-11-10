import { useState, useCallback, useEffect } from "react";
import { buildProductionBundle } from "../models/productionBuilder";
import type { TabId, ProductionBundle } from "../models/types";
import { TABS } from "../lib/constants";
import { downloadFile, downloadZip } from "../lib/downloadUtils";

export function useExportController() {
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [bundle, setBundle] = useState<ProductionBundle | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isPurgeOn, setIsPurgeOn] = useState(true);
  const [isDedupOn, setIsDedupOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runBuild = useCallback(async (purge: boolean, dedup: boolean) => {
    setIsBuilding(true);
    setError(null);
    try {
      const result = await buildProductionBundle({ purge, dedup });
      setBundle(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsBuilding(false);
    }
  }, []);

  // Автоматический билд при первом открытии страницы
  useEffect(() => {
    runBuild(isPurgeOn, isDedupOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBuild = useCallback(() => {
    runBuild(isPurgeOn, isDedupOn);
  }, [runBuild, isPurgeOn, isDedupOn]);

  const getContent = useCallback(
    (tab: TabId): string => {
      if (!bundle) return "";
      if (tab === "html") return bundle.html;
      if (tab === "css") return bundle.css;
      if (tab === "js") return bundle.js;
      return "";
    },
    [bundle],
  );

  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  const handleDownloadActiveTab = useCallback(() => {
    if (!activeTabMeta?.filename || activeTab === "preview") return;
    downloadFile(activeTabMeta.filename, getContent(activeTab));
  }, [activeTabMeta, activeTab, getContent]);

  const handleDownloadZip = useCallback(async () => {
    if (!bundle) return;
    await downloadZip(bundle);
  }, [bundle]);

  const handleDownloadFile = useCallback(
    (filename: string, content: string) => {
      downloadFile(filename, content);
    },
    [],
  );

  return {
    activeTab,
    setActiveTab,
    bundle,
    isBuilding,
    isPurgeOn,
    setIsPurgeOn,
    isDedupOn,
    setIsDedupOn,
    error,
    handleBuild,
    getContent,
    activeTabMeta,
    handleDownloadActiveTab,
    handleDownloadZip,
    handleDownloadFile,
  };
}
