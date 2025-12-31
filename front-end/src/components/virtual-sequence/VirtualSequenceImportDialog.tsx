import { useEffect, useMemo, useRef, useState } from "react";
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

type FieldErrors = {
  start?: string;
  count?: string;
  step?: string;
};

export default function VirtualSequenceImportDialog({
  isOpen,
  onCancel,
  onConfirm,
}: Props) {
  const [folderName, setFolderName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [start, setStart] = useState<number | "">(1);
  const [count, setCount] = useState<number | "">("");
  const [step, setStep] = useState<number | "">(1);
  const [loading, setLoading] = useState(false);
  const [sortNumerically, setSortNumerically] = useState(true);

  const [touched, setTouched] = useState({
    start: false,
    count: false,
    step: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const idleTimersRef = useRef<{ [k: string]: number | undefined }>({});

  const markTouchedAfterIdle = (field: "start" | "count" | "step", delayMs = 180) => {
    const timers = idleTimersRef.current;
    if (timers[field]) window.clearTimeout(timers[field]);
    timers[field] = window.setTimeout(() => {
      setTouched((t) => ({ ...t, [field]: true }));
    }, delayMs);
  };

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      setFiles([]);
      setStart(1);
      setStep(1);
      setCount("");
      setSortNumerically(true);
      setTouched({ start: false, count: false, step: false });
      setSubmitted(false);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      const timers = idleTimersRef.current;
      Object.values(timers).forEach((id) => {
        if (id) window.clearTimeout(id);
      });
    };
  }, []);

  const totalImages = files.length;

  const parsed = useMemo(() => {
    const s = typeof start === "number" ? Math.floor(start) : NaN;
    const st = typeof step === "number" ? Math.floor(step) : NaN;
    const c =
      typeof count === "number" && Number.isFinite(count)
        ? Math.floor(count)
        : NaN;
    return { s, st, c };
  }, [start, step, count]);

  const errors: FieldErrors = useMemo(() => {
    const e: FieldErrors = {};
    const total = totalImages;

    if (total <= 0) {
      if (submitted) {
        e.start = "Please choose a folder first.";
        e.count = "Please choose a folder first.";
        e.step = "Please choose a folder first.";
      }
      return e;
    }

    const { s, st, c } = parsed;

    if (!Number.isFinite(s)) e.start = "Start is required.";
    else if (s < 1) e.start = "Start must be at least 1.";
    else if (s > total)
      e.start = `This folder contains only ${total} images. Start must be between 1 and ${total}.`;

    if (!Number.isFinite(st)) e.step = "Step is required.";
    else if (st < 1) e.step = "Step must be at least 1.";

    if (!Number.isFinite(c)) e.count = "Count is required.";
    else if (c < 1) e.count = "Count must be at least 1.";
    else if (c > total) {
      e.count = `This folder contains only ${total} images. Count cannot be greater than ${total}.`;
    } else if (
      Number.isFinite(s) &&
      s >= 1 &&
      s <= total &&
      Number.isFinite(st) &&
      st >= 1
    ) {
      const remaining = total - s + 1;
      const maxPossible = Math.ceil(remaining / st);
      if (c > maxPossible) {
        e.count = `With Start = ${s} and Step = ${st}, you can take at most ${maxPossible} frame${
          maxPossible > 1 ? "s" : ""
        }.`;
      }
    }

    return e;
  }, [parsed, totalImages, submitted]);

  const isValid = useMemo(() => {
    if (loading) return false;
    if (files.length === 0) return false;
    return !errors.start && !errors.count && !errors.step;
  }, [loading, files.length, errors]);

  const resetForm = () => {
    setFolderName("");
    setFiles([]);
    setStart(1);
    setStep(1);
    setCount("");
    setSortNumerically(true);
    setTouched({ start: false, count: false, step: false });
    setSubmitted(false);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const handleBrowse = async () => {
    try {
      setLoading(true);
      const dirHandle = await (window as any).showDirectoryPicker();
      const collected: File[] = [];
      const imageExtensions = /\.(tif|tiff|png|jpg|jpeg|gif|bmp|webp|ico|svg)$/i;

      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const file = await entry.getFile();
          if (file.type.startsWith("image/") || imageExtensions.test(file.name)) {
            collected.push(file);
          }
        }
      }

      if (collected.length === 0) {
        await Swal.fire({
          title: "No images found",
          text: "No image files were found in the selected folder.",
          icon: "info",
          confirmButtonText: "OK",
          confirmButtonColor: "#3085d6",
        });
        return;
      }

      const result = sortNumerically ? naturalSortFiles(collected) : collected;

      setFiles(result);
      setFolderName((dirHandle as any).name || "Selected folder");

      setStart(1);
      setStep(1);
      setCount(result.length);

      setTouched({ start: false, count: false, step: false });
      setSubmitted(false);
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.name === "NotAllowedError") return;

      console.error("Error choosing folder for virtual sequence:", err);
      await Swal.fire({
        title: "Error",
        text: err?.message || "Failed to open folder.",
        icon: "error",
        confirmButtonText: "OK",
        confirmButtonColor: "#3085d6",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOk = () => {
    setSubmitted(true);
    setTouched({ start: true, count: true, step: true });

    if (!isValid) return;

    onConfirm({
      files,
      start: parsed.s,
      count: parsed.c,
      step: parsed.st,
    });
  };

  const shouldShowAnyError =
    submitted || touched.start || touched.count || touched.step;

  const validationMessage = useMemo(() => {
    if (!shouldShowAnyError) return "";
    return errors.start || errors.step || errors.count || "";
  }, [errors.start, errors.step, errors.count, shouldShowAnyError]);

  if (!isOpen) return null;

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
          <button className="vs-close-btn" onClick={handleCancel}>
            <span className="vs-close-icon">
              <X />
            </span>
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
                Found {files.length} image file{files.length > 1 ? "s" : ""}.
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
                disabled={files.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  setStart(v === "" ? "" : Number(v));
                  markTouchedAfterIdle("start");
                }}
                onBlur={() => setTouched((t) => ({ ...t, start: true }))}
              />
            </div>

            <div className="vs-form-row">
              <label>Count</label>
              <input
                type="number"
                min={1}
                value={count}
                disabled={files.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  setCount(v === "" ? "" : Number(v));
                  markTouchedAfterIdle("count");
                }}
                onBlur={() => setTouched((t) => ({ ...t, count: true }))}
              />
            </div>

            <div className="vs-form-row">
              <label>Step</label>
              <input
                type="number"
                min={1}
                value={step}
                disabled={files.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  setStep(v === "" ? "" : Number(v));
                  markTouchedAfterIdle("step");
                }}
                onBlur={() => setTouched((t) => ({ ...t, step: true }))}
              />
            </div>          
          </div>

          {validationMessage && (
            <div className="vs-validation-inline">
              {validationMessage}
            </div>
          )}

          <p className="vs-help-text">
            <b>Start</b>: the position of the image in the folder where playback begins (Start = 1 means begin from the first image).  <br />
            <b>Count</b>: the number of frames. <br />
            <b>Step</b>: the jump between frames.
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
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="vs-primary-btn"
            onClick={handleOk}
            disabled={!isValid}
            title={!isValid ? "Please fix invalid values to continue." : ""}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
