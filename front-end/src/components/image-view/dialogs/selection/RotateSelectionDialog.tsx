import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./SelectionDialog.css";

type RotateSelectionDialogProps = {
  currentAngle: number;
  rotateAroundImageCenter?: boolean;
};

const RotateSelectionDialog: React.FC<RotateSelectionDialogProps> = ({
  currentAngle,
  rotateAroundImageCenter,
}) => {
  return (
    <div className="selection-dialog">
      <div className="selection-dialog__section selection-dialog__section--summary">
        <div className="selection-dialog__section-title">Current angle</div>
        <div className="selection-dialog__section-value">
          {currentAngle.toFixed(1)}°
        </div>
        <div className="selection-dialog__section-sub">
          <p>Positive values rotate counter-clockwise.</p>
          <p>Negative values rotate clockwise.</p> 
        </div>
      </div>

      <div className="selection-dialog__section">
        <div className="selection-dialog__section-title">Rotate by</div>
        <div className="selection-dialog__field selection-dialog__field--inline">
          <span className="selection-dialog__field-label">Degrees</span>
          <input
            id="rotate-angle"
            className="selection-dialog__input"
            type="number"
            step={1}
            defaultValue="0"
          />
        </div>

        <label className="selection-dialog__field" style={{ marginTop: 10 }}>
          <span className="selection-dialog__field-label"> </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="rotate-around-center"
              type="checkbox"
              defaultChecked={!!rotateAroundImageCenter}
            />
            <span>Rotate around image center</span>
          </div>
        </label>
      </div>

      <div className="selection-dialog__hint">
        <div className="selection-dialog__hint-title">Examples</div>
        <div className="selection-dialog__hint-text">
          90, -90, 180 · Allowed range: -360° to 360°
        </div>
      </div>
    </div>
  );
};

export const renderRotateSelectionDialog = (
  props: RotateSelectionDialogProps
): string => renderToStaticMarkup(<RotateSelectionDialog {...props} />);

export default RotateSelectionDialog;
