import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./SelectionDialog.css";

type ScaleSelectionDialogProps = {
  width: number;
  height: number;
};

const fmt = (v: number) => v.toFixed(2);

const ScaleSelectionDialog: React.FC<ScaleSelectionDialogProps> = ({
  width,
  height,
}) => {
  return (
    <div className="selection-dialog">
      <div className="selection-dialog__section selection-dialog__section--summary">
        <div className="selection-dialog__section-title">Current size</div>
        <div className="selection-dialog__section-value">
          {fmt(width)} × {fmt(height)} px
        </div>
        <div className="selection-dialog__section-sub">
          Larger scale values produce bigger selections.
        </div>
      </div>

      <div className="selection-dialog__fields">
        <label className="selection-dialog__field">
          <span className="selection-dialog__field-label">X scale factor</span>
          <input
            id="scale-x"
            className="selection-dialog__input"
            type="number"
            step="0.01"
            defaultValue="1.00"
          />
        </label>

        <label className="selection-dialog__field">
          <span className="selection-dialog__field-label">Y scale factor</span>
          <input
            id="scale-y"
            className="selection-dialog__input"
            type="number"
            step="0.01"
            defaultValue="1.00"
          />
        </label>
      </div>

      <div className="selection-dialog__hint">
        <div className="selection-dialog__hint-title">Tip</div>
        <div className="selection-dialog__hint-text">
          1.0 = keep size · &gt; 1.0 = enlarge · &lt; 1.0 = shrink
        </div>
      </div>
    </div>
  );
};

export const renderScaleSelectionDialog = (
  props: ScaleSelectionDialogProps
): string => renderToStaticMarkup(<ScaleSelectionDialog {...props} />);

export default ScaleSelectionDialog;
