"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Key,
  FolderOpen,
  HardDrive,
  Cloud,
  Save,
  Eye,
  EyeOff,
  FolderSearch,
  LayoutGrid,
  CheckCircle,
} from "lucide-react";
import { CONFIG } from "@/lib/config";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SettingsPage() {
  const [showCivitaiKey, setShowCivitaiKey] = useState(false);
  const [showHfKey, setShowHfKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [civitaiKey, setCivitaiKey] = useState("");
  const [hfKey, setHfKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");

  // Load existing key status on mount
  const apiKeysQuery = trpc.settings.getApiKeys.useQuery();

  useEffect(() => {
    if (apiKeysQuery.data) {
      const keys = apiKeysQuery.data;
      if (keys.civitai_api_key?.exists) {
        setCivitaiKey("");
      }
      if (keys.huggingface_token?.exists) {
        setHfKey("");
      }
      if (keys.google_api_key?.exists) {
        setGoogleKey("");
      }
    }
  }, [apiKeysQuery.data]);

  // Mutations
  const saveCivitaiApiKey = trpc.civitai.saveApiKey.useMutation({
    onSuccess: () => {
      toast.success("CivitAI API key saved");
      setCivitaiKey("");
      apiKeysQuery.refetch();
    },
    onError: (e) => toast.error(e.message || "Failed to save key"),
  });

  const saveHfApiKey = trpc.settings.saveApiKey.useMutation({
    onSuccess: () => {
      toast.success("HuggingFace token saved");
      setHfKey("");
      apiKeysQuery.refetch();
    },
    onError: (e) => toast.error(e.message || "Failed to save token"),
  });

  const saveGoogleApiKey = trpc.videos.saveGoogleApiKey.useMutation({
    onSuccess: () => {
      toast.success("Google API key saved");
      setGoogleKey("");
      apiKeysQuery.refetch();
    },
    onError: (e) => toast.error(e.message || "Failed to save key"),
  });

  const [modelsPath, setModelsPath] = useState(CONFIG.paths.models);
  const [warehousePath, setWarehousePath] = useState(CONFIG.paths.warehouse);
  const [workflowPaths, setWorkflowPaths] = useState(CONFIG.paths.workflows);
  const [defaultWorkflowView, setDefaultWorkflowView] = useState<"table" | "cards">(
    typeof localStorage !== "undefined" ? (localStorage.getItem("defaultWorkflowView") as "table" | "cards") || "table" : "table"
  );

  const handleDirectoryPrompt = (current: string, onChange: (value: string) => void) => {
    const nextPath = window.prompt("Enter directory path", current);
    if (nextPath && nextPath.trim()) {
      onChange(nextPath.trim());
    }
  };

  const keyStatus = apiKeysQuery.data;

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-card px-6 py-4">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Configure Sminventory</p>
        </div>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* API Keys */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Configure API keys for model downloads and lookups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">CivitAI API Key</label>
                  {keyStatus?.civitai_api_key?.exists && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Configured
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showCivitaiKey ? "text" : "password"}
                      placeholder={keyStatus?.civitai_api_key?.exists
                        ? keyStatus.civitai_api_key.maskedValue
                        : "Enter your CivitAI API key"}
                      value={civitaiKey}
                      onChange={(e) => setCivitaiKey(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowCivitaiKey(!showCivitaiKey)}
                    >
                      {showCivitaiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => saveCivitaiApiKey.mutate({ apiKey: civitaiKey })}
                    disabled={!civitaiKey || saveCivitaiApiKey.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for model hash lookups and downloads from CivitAI
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">HuggingFace Token</label>
                  {keyStatus?.huggingface_token?.exists && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Configured
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showHfKey ? "text" : "password"}
                      placeholder={keyStatus?.huggingface_token?.exists
                        ? keyStatus.huggingface_token.maskedValue
                        : "Enter your HuggingFace token"}
                      value={hfKey}
                      onChange={(e) => setHfKey(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowHfKey(!showHfKey)}
                    >
                      {showHfKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => saveHfApiKey.mutate({ key: "huggingface_token", value: hfKey })}
                    disabled={!hfKey || saveHfApiKey.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for downloading models from HuggingFace
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="google-api-key" className="text-sm font-medium">Google API Key (YouTube Data API)</label>
                  {keyStatus?.google_api_key?.exists && (
                    <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                      <CheckCircle className="h-3 w-3" />
                      Configured
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="google-api-key"
                      type={showGoogleKey ? "text" : "password"}
                      placeholder={keyStatus?.google_api_key?.exists
                        ? keyStatus.google_api_key.maskedValue
                        : "Enter your Google API key"}
                      value={googleKey}
                      onChange={(e) => setGoogleKey(e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowGoogleKey(!showGoogleKey)}
                    >
                      {showGoogleKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    onClick={() => saveGoogleApiKey.mutate({ apiKey: googleKey })}
                    disabled={!googleKey || saveGoogleApiKey.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional. Enables rich YouTube metadata (description, publish date, URLs in description).
                  Without it, only basic info (title, channel, thumbnail) is available via oEmbed.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Paths Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Paths
              </CardTitle>
              <CardDescription>
                Configured storage locations (read from config)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Stability Matrix Models</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input value={modelsPath} readOnly className="font-mono text-sm flex-1 min-w-[200px]" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleDirectoryPrompt(modelsPath, setModelsPath)}
                  >
                    <FolderSearch className="h-4 w-4" />
                    Browse
                  </Button>
                  <Badge variant="secondary">Local</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">Warehouse Storage</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input value={warehousePath} readOnly className="font-mono text-sm flex-1 min-w-[200px]" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleDirectoryPrompt(warehousePath, setWarehousePath)}
                  >
                    <FolderSearch className="h-4 w-4" />
                    Browse
                  </Button>
                  <Badge variant="outline">Warehouse</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Workflow Directories</label>
                {workflowPaths.map((path, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <Input value={path} readOnly className="font-mono text-sm flex-1 min-w-[200px]" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        handleDirectoryPrompt(path, (updated) => {
                          setWorkflowPaths((prev) => prev.map((p, idx) => (idx === i ? updated : p)));
                        });
                      }}
                    >
                      <FolderSearch className="h-4 w-4" />
                      Browse
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Validation Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Validation Settings</CardTitle>
              <CardDescription>
                Configure how models are validated
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Default Validation Level</p>
                  <p className="text-sm text-muted-foreground">
                    How thoroughly to validate model files during scanning
                  </p>
                </div>
                <Badge variant="secondary">{CONFIG.validation.defaultLevel}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Quick</p>
                  <p className="text-muted-foreground">Size check only</p>
                </div>
                <div className="p-3 rounded-lg border border-primary bg-primary/5">
                  <p className="font-medium">Standard</p>
                  <p className="text-muted-foreground">Partial hash (fast)</p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="font-medium">Full</p>
                  <p className="text-muted-foreground">Complete SHA256</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5" />
                View Preferences
              </CardTitle>
              <CardDescription>
                Set default view modes for different pages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Default Workflow View</label>
                <p className="text-sm text-muted-foreground mb-3">
                  When you visit /workflows without a view parameter, it will redirect to show this view by default
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={defaultWorkflowView === "table" ? "default" : "outline"}
                    onClick={() => {
                      setDefaultWorkflowView("table");
                      if (typeof localStorage !== "undefined") {
                        localStorage.setItem("defaultWorkflowView", "table");
                      }
                    }}
                  >
                    Table View (Default)
                  </Button>
                  <Button
                    variant={defaultWorkflowView === "cards" ? "default" : "outline"}
                    onClick={() => {
                      setDefaultWorkflowView("cards");
                      if (typeof localStorage !== "undefined") {
                        localStorage.setItem("defaultWorkflowView", "cards");
                      }
                    }}
                  >
                    Cards View
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Current preference: <strong>{defaultWorkflowView === "table" ? "Table View (/?view=table)" : "Cards View (/?view=cards)"}</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
