import React, { useEffect, useRef, useState } from 'react';
import './NoiseDialogs.css';
import type { OutlierMode } from '../../../../utils/nav-bar/processUtils';

type Props = {
  isOpen: boolean;
  radius: number;
  threshold: number;
  mode: OutlierMode;
  previewEnabled: boolean;
  onRadiusChange: (v:number)=>void;
  onThresholdChange: (v:number)=>void;
  onModeChange: (v:OutlierMode)=>void;
  onTogglePreview: (enabled:boolean)=>void;
  onApply: ()=>void;
  onCancel: ()=>void;
};

const RemoveOutliersDialog: React.FC<Props> = ({
  isOpen, radius, threshold, mode, previewEnabled,
  onRadiusChange, onThresholdChange, onModeChange, onTogglePreview, onApply, onCancel
}) => {
  const dlgRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x: 20, y: 20 });
  const dragRef = useRef<{ dx: number; dy: number; dragging: boolean }>({ dx: 0, dy: 0, dragging: false });

  useEffect(() => { if (isOpen) setPos({ x: 20, y: 20 }); }, [isOpen]);

  const clamp = (x:number,y:number) => {
    const c = document.getElementById('image-view'); const d = dlgRef.current;
    if (!c || !d) return {x,y};
    const cR = c.getBoundingClientRect(); const dR = d.getBoundingClientRect();
    return { x: Math.max(0, Math.min(x, cR.width - dR.width)), y: Math.max(0, Math.min(y, cR.height - dR.height)) };
  };
  const onDown = (e:React.MouseEvent)=>{ const d=dlgRef.current; if(!d) return;
    dragRef.current.dragging=true;
    dragRef.current.dx=e.clientX-d.getBoundingClientRect().left;
    dragRef.current.dy=e.clientY-d.getBoundingClientRect().top;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, {once:true});
  };
  const onMove=(e:MouseEvent)=>{ if(!dragRef.current.dragging) return;
    const c=document.getElementById('image-view'); if(!c) return;
    const cR=c.getBoundingClientRect();
    setPos(clamp(e.clientX-cR.left-dragRef.current.dx, e.clientY-cR.top-dragRef.current.dy));
  };
  const onUp=()=>{ dragRef.current.dragging=false; window.removeEventListener('mousemove', onMove); };

  if (!isOpen) return null;

  const r = Number.isFinite(radius) ? radius : 0;
  const t = Number.isFinite(threshold) ? threshold : 0;

  const onRadiusNum = (v:string)=> {
    const p=parseFloat(v);
    onRadiusChange(!isFinite(p)?0:Math.max(0,p));
  };
  const onThresholdNum = (v:string)=> {
    const p=parseFloat(v);
    onThresholdChange(!isFinite(p)?0:Math.max(0,p));
  };

  return (
    <div className="noise-dialog-backdrop">
      <div ref={dlgRef} className="noise-dialog" style={{ left: pos.x, top: pos.y }}>
        <div className="noise-dialog-header" onMouseDown={onDown}>
          <div className="noise-dialog-title">Remove Outliers</div>
          <button className="noise-dialog-close" onClick={onCancel} aria-label="Close">×</button>
        </div>

        <div className="noise-dialog-body">
          <div className="noise-field">
            <div className="noise-field-label">Radius</div>
            <div className="noise-field-row">
              <input type="range" className="noise-range" min={1} max={20} step={1} value={r} onChange={(e)=>onRadiusChange(parseFloat(e.target.value))}/>
              <input type="number" className="noise-number-input" min={1} max={999} step={1} value={r} onChange={(e)=>onRadiusNum(e.target.value)} />
            </div>
          </div>

          <div className="noise-field">
            <div className="noise-field-label">Threshold</div>
            <div className="noise-field-row">
              <input type="range" className="noise-range" min={0} max={255} step={1} value={t} onChange={(e)=>onThresholdChange(parseFloat(e.target.value))}/>
              <input type="number" className="noise-number-input" min={0} max={9999} step={1} value={t} onChange={(e)=>onThresholdNum(e.target.value)} />
            </div>
          </div>

          <div className="noise-field">
            <div className="noise-field-label">Which outliers</div>
            <select className="noise-select" value={mode} onChange={(e)=>onModeChange(e.target.value as any)}>
              <option value="bright">Bright</option>
              <option value="dark">Dark</option>
              <option value="both">Both</option>
            </select>
          </div>

          <label className="noise-preview-row">
            <input type="checkbox" className="noise-checkbox" checked={previewEnabled} onChange={(e)=>onTogglePreview(e.target.checked)} />
            <span>Preview</span>
          </label>
        </div>

        <div className="noise-dialog-footer">
          <button type="button" className="noise-btn noise-btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="noise-btn noise-btn-primary" onClick={onApply}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default RemoveOutliersDialog;
