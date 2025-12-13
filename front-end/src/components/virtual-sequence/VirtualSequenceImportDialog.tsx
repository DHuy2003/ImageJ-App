import { useEffect, useState } from "react";
import { FolderOpen, X } from "lucide-react";
import Swal from "sweetalert2";
import "./VirtualSequence.css";

type Props = {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (config: {
    files: File[];
    start: number;
    count: number;
    step: number;
  }) => void;
};

const naturalSortFiles = (files: File[]) =>
  [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

const VirtualSequenceImportDialog = ({
  isOpen,
  onCancel,
  onConfirm,
}: Props) => {
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [start, setStart] = useState<number | "">(1);
  const [count, setCount] = useState<number | "">("");
  const [step, setStep] = useState<number | "">(1);
  const [loading, setLoading] = useState(false);
  const [sortNumerically, setSortNumerically] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      setFiles([]);
      setStart(1);
      setCount("");
      setStep(1);
      setSortNumerically(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    try {
      setLoading(true);
      const dirHandle = await (window as any).showDirectoryPicker();
      const collected: File[] = [];

      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const file = await entry.getFile();
          if (
            file.type.startsWith("image/") ||
            /\.(tif|tiff)$/i.test(file.name)
          ) {
            collected.push(file);
          }
        }
      }

      if (collected.length === 0) {
        await Swal.fire({
          title: "Notification",
          text: "No image files found in this folder.",
          icon: "info",
          confirmButtonText: "OK",
          confirmButtonColor: "#3085d6",
        });
        return;
      }

      let result = collected;
      if (sortNumerically) {
        result = naturalSortFiles(collected);
      }

      setFiles(result);
      setFolderName((dirHandle as any).name || "Selected folder");
      setStart(1);
      setCount(result.length);
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.name === "NotAllowedError") {
        return;
      }
      console.error("Error choosing folder for virtual sequence:", err);
      await Swal.fire({
        title: "Error",
        text: err.message || "Failed to open folder.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#3085d6",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOk = async () => {
    if (files.length === 0) {
      await Swal.fire({
        title: "Notification",
        text: "Please choose a folder with images first.",
        icon: "info",
        confirmButtonText: "OK",
        confirmButtonColor: "#3085d6",
      });
      return;
    }

    const total = files.length;
    const sRaw = typeof start === "number" ? start : 1;
    const stRaw = typeof step === "number" ? step : 1;
    const cRaw = typeof count === "number" ? count : total;
    const s = Math.max(1, sRaw);
    const st = Math.max(1, stRaw);
    const c = cRaw > 0 ? Math.min(cRaw, total) : total;

    onConfirm({
      files,
      start: s,
      count: c,
      step: st,
    });
  };

  return (
    <div className="vs-backdrop">
      <div className="vs-dialog vs-dialog-compact">
        <div className="vs-header">
          <div>
            <h2>Import Image Sequence</h2>
            <p className="vs-subtitle">
              Select folder and range; you can optionally sort file names numerically.
            </p>
          </div>
          <button className="vs-close-btn" onClick={onCancel}>
            <span className="vs-close-icon"><X/></span>
          </button>
        </div>

        <div className="vs-body vs-body-form">
          <div className="vs-form-row">
            <label>Directory</label>
            <div className="vs-dir-input">
              <input
                type="text"
                readOnly
                value={folderName}
                placeholder="No folder chosen"
              />
              <button
                type="button"
                className="vs-browse-btn"
                onClick={handleBrowse}
                disabled={loading}
              >
                <FolderOpen size={16} />
                <span>{loading ? "Loading..." : "Browse"}</span>
              </button>
            </div>
            {files.length > 0 && (
              <p className="vs-help-text">
                Found {files.length} image file
                {files.length > 1 ? "s" : ""} (sorted by numeric name).
              </p>
            )}
          </div>

          <div className="vs-form-grid">
            <div className="vs-form-row">
              <label>Start</label>
              <input
                type="number"
                min={1}
                value={start}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setStart("");
                  } else {
                    setStart(Math.max(1, Number(v) || 1));
                  }
                }}
              />
            </div>

            <div className="vs-form-row">
              <label>Count</label>
              <input
                type="number"
                min={1}
                value={count}
                onChange={(e) =>
                  setCount(
                    e.target.value === "" ? "" : Number(e.target.value) || 1
                  )
                }
              />
            </div>

            <div className="vs-form-row">
              <label>Step</label>
              <input
                type="number"
                min={1}
                value={step}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") {
                    setStep("");
                  } else {
                    setStep(Math.max(1, Number(v) || 1));
                  }
                }}
              />
            </div>
          </div>

          <p className="vs-help-text">
            Sequence will play files in order using Start / Count / Step.
          </p>

          <div className="vs-form-row vs-checkbox-row">
            <label className="vs-checkbox-label">
              <input
                type="checkbox"
                checked={sortNumerically}
                onChange={(e) => setSortNumerically(e.target.checked)}
              />
              <span>Sort names numerically</span>
            </label>
          </div>
        </div>

        <div className="vs-footer">
          <button
            type="button"
            className="vs-secondary-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="vs-primary-btn"
            onClick={handleOk}
            disabled={loading}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualSequenceImportDialog;
