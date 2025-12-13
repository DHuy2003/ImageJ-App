import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./SelectionDialog.css";

type BaseProps = {
  centerX: string;
  centerY: string;
  xmin: string;
  ymin: string;
  xmax: string;
  ymax: string;
};

type RectProps = BaseProps & {
  kind: "rect";
  width: string;
  height: string;
  area: string;
};

type CircleProps = BaseProps & {
  kind: "circle";
  radius: string;
  diameter: string;
  area: string;
};

export type PropertiesSelectionDialogProps = RectProps | CircleProps;

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="selection-dialog__props-row">
    <div className="selection-dialog__props-label">{label}</div>
    <div className="selection-dialog__props-value" title={value}>
      {value}
    </div>
  </div>
);

const PropertiesSelectionDialog: React.FC<PropertiesSelectionDialogProps> = (
  props
) => {
  const isCircle = props.kind === "circle";

  return (
    <div className="selection-dialog selection-dialog--props">
      <div className="selection-dialog__chip-row">
        <span className="selection-dialog__chip">
          {isCircle ? "Circle" : "Rectangle"}
        </span>
      </div>

      <div className="selection-dialog__props-grid">
        <div className="selection-dialog__props-section">
          <div className="selection-dialog__section-title">Center (px)</div>
          <Row label="Xc" value={props.centerX} />
          <Row label="Yc" value={props.centerY} />
        </div>

        <div className="selection-dialog__props-section">
          <div className="selection-dialog__section-title">Bounds (px)</div>
          <Row label="xmin" value={props.xmin} />
          <Row label="ymin" value={props.ymin} />
          <Row label="xmax" value={props.xmax} />
          <Row label="ymax" value={props.ymax} />
        </div>

        <div className="selection-dialog__props-section">
          <div className="selection-dialog__section-title">
            {isCircle ? "Geometry" : "Size (px)"}
          </div>

          {isCircle ? (
            <>
              <Row label="Radius" value={`${(props as CircleProps).radius} px`} />
              <Row label="Diameter" value={`${(props as CircleProps).diameter} px`} />
              <Row label="Area" value={`${(props as CircleProps).area} px²`} />
            </>
          ) : (
            <>
              <Row label="Width" value={(props as RectProps).width} />
              <Row label="Height" value={(props as RectProps).height} />
              <Row label="Area" value={`${(props as RectProps).area} px²`} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const renderPropertiesSelectionDialog = (
  props: PropertiesSelectionDialogProps
): string => renderToStaticMarkup(<PropertiesSelectionDialog {...props} />);

export default PropertiesSelectionDialog;
