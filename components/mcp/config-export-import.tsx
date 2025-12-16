"use client";

import { useState, useRef } from "react";
import { Download, Upload, Copy, Check } from "lucide-react";
import { useMcp } from "@/contexts/mcp-context";

export function ConfigExportImport() {
  const { exportConfig, importConfig } = useMcp();
  const [showExport, setShowExport] = useState(false);
  const [exportedConfig, setExportedConfig] = useState("");
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const config = exportConfig();
    setExportedConfig(config);
    setShowExport(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedConfig);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportedConfig], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mcp-servers.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        importConfig(content);
        setImportError(null);
        alert("설정을 성공적으로 가져왔습니다.");
      } catch (error) {
        setImportError(error instanceof Error ? error.message : "가져오기 실패");
      }
    };
    reader.readAsText(file);

    // Reset input
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          내보내기
        </button>
        <button
          onClick={handleImportClick}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          가져오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {importError && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
          {importError}
        </div>
      )}

      {showExport && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">설정 JSON</label>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    복사됨
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    복사
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors"
              >
                <Download className="w-3 h-3" />
                다운로드
              </button>
            </div>
          </div>
          <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 p-3 rounded-lg overflow-x-auto max-h-48">
            {exportedConfig}
          </pre>
          <button
            onClick={() => setShowExport(false)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}

