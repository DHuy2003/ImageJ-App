import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import "./VirtualSequence.css";

export type SequenceFrame = {
  url: string;
  name?: string;
};

type VirtualSequencePlayerProps = {
  isOpen: boolean;
  onClose: () => void;
  frames: SequenceFrame[];
};

const DEFAULT_FPS = 1;

const VirtualSequencePlayer = ({
  isOpen,
  onClose,
  frames,
}: VirtualSequencePlayerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(DEFAULT_FPS);

  const totalFrames = frames.length;

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [isOpen, totalFrames]);

  useEffect(() => {
    if (!isOpen || !isPlaying || totalFrames <= 1) return;

    const interval = 1000 / Math.max(1, fps);
    const id = window.setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        return next >= totalFrames ? 0 : next;
      });
    }, interval);

    return () => window.clearInterval(id);
  }, [isOpen, isPlaying, fps, totalFrames]);

  if (!isOpen || totalFrames === 0) return null;

  const currentFrame = frames[currentIndex];
  const currentUrl = currentFrame?.url;
  const currentName =
    currentFrame?.name ?? `Frame ${currentIndex + 1} / ${totalFrames}`;

  const handleStep = (dir: -1 | 1) => {
    setIsPlaying(false);
    setCurrentIndex((prev) => {
      let next = prev + dir;
      if (next < 0) next = totalFrames - 1;
      if (next >= totalFrames) next = 0;
      return next;
    });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsPlaying(false);
    setCurrentIndex(Number(e.target.value));
  };

  return (
    <div className="vs-backdrop">
      <div className="vs-dialog">
        <div className="vs-header">
          <div>
            <h2>Virtual Sequence</h2>
            <p className="vs-subtitle">
              {currentName} ({currentIndex + 1}/{totalFrames})
            </p>
          </div>
          <button className="vs-close-btn" onClick={onClose}>
            <span className="vs-close-icon">&times;</span>
          </button>
        </div>

        <div className="vs-body">
          {currentUrl ? (
            <img
              src={currentUrl}
              alt={currentName}
              className="vs-image"
            />
          ) : (
            <div className="vs-empty">No image to display</div>
          )}
        </div>

        <div className="vs-controls">
          <div className="vs-main-controls">
            <button
              className="vs-icon-btn"
              onClick={() => handleStep(-1)}
              disabled={totalFrames <= 1}
            >
              <span className="vs-icon-char">&lt;&lt;</span>
            </button>

            <button
              className="vs-play-btn"
              onClick={() => setIsPlaying((p) => !p)}
              disabled={totalFrames <= 1}
            >
              {isPlaying ? <Pause /> : <Play />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              className="vs-icon-btn"
              onClick={() => handleStep(1)}
              disabled={totalFrames <= 1}
            >
              <span className="vs-icon-char">&gt;&gt;</span>
            </button>
          </div>

          <div className="vs-timeline">
            <input
              type="range"
              min={0}
              max={totalFrames - 1}
              value={currentIndex}
              onChange={handleSliderChange}
            />
            <div className="vs-timeline-labels">
              <span>Start</span>
              <span>
                Frame {currentIndex + 1}/{totalFrames}
              </span>
              <span>End</span>
            </div>
          </div>

          <div className="vs-speed">
            <label>
              Speed: <span>{fps} fps</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.25}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualSequencePlayer;
