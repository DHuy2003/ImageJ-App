import React, { useEffect, useState } from "react";
import "./DepthSize.css";

interface Frame {
  url: string;
  width: number;
  height: number;
}

interface Props {
  frames: Frame[];
  title?: string;
  onClose: () => void;
}

const NewStackViewer: React.FC<Props> = ({ frames, title, onClose }) => {
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-play stack
  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      setIndex(i => (i + 1) % frames.length);
    }, 100);

    return () => clearInterval(id);
  }, [isPlaying, frames.length]);

  return (
    <div className="stack-window">
      <div className="stack-header">
        <span>{title ?? "Stack Viewer"}</span>
        <button onClick={onClose}>X</button>
      </div>

      <div className="stack-body">
        <img src={frames[index].url} alt={`frame-${index}`} />
      </div>

      <div className="stack-controls">
        <button onClick={() => setIndex(i => (i - 1 + frames.length) % frames.length)}>◄</button>

        <button onClick={() => setIsPlaying(p => !p)}>
          {isPlaying ? "Stop" : "Play"}
        </button>

        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        />

        <button onClick={() => setIndex(i => (i + 1) % frames.length)}>►</button>
      </div>
    </div>
  );
};

export default NewStackViewer;
