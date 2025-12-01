import { BarChart3, Microscope, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
    handleClear,
    handleClearOutside,
    handleCut,
    handleDraw,
    handleFill,
    handleFitCircle,
    handleFitRectangle,
    handleInvert,
    handleProperties,
    handleRestoreSelection,
    handleRotate,
    handleScale,
    handleSelectionAll,
    handleSelectionNone,
    handleUndo
} from "../../utils/nav-bar/editUtils";
import {
    handleClose,
    handleCloseAll,
    handleCreateMask,
    handleOpen,
    handleOpenFolder,
    handleOpenMaskFolder,
    handleQuit,
    handleRevert,
    handleSave,
    handleSaveAll,
} from "../../utils/nav-bar/fileUtils";
import DropdownMenu from "../dropdown-menu/DropdownMenu";
import "./NavBar.css";

import {
    handleConvertBitDepth,
    handleOpenBrightnessContrast,
    handleScaleToFit,
    handleZoomIn,
    handleZoomOut,
    handleOpenImageSize,
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotateLeft90,
    handleRotateRight90
} from "../../utils/nav-bar/imageUtils";

import {
    handleClustering,
    handleExtractFeatures,
    handleSegmentation,
    handleShowAnalysis,
    handleShowFeatures,
    handleTracking,
} from "../../utils/nav-bar/toolUtils";

const dispatchProcessEvent = (action: string) => {
    window.dispatchEvent(new CustomEvent('process-image', { detail: { action } }));
};


const NavBar = () => {
    const navigate = useNavigate();
    const currentDepth = 8;
    return (
        <div id="navbar">
            <div id="navbar-title">
                <Microscope id="navbar-icon" />
                <h1 id="navbar-name">CellTracker Pro</h1>
            </div>

            <div className="divider"></div>

            <ul id="navbar-menu">
                <DropdownMenu
                    label="File"
                    items={[
                        { label: "Open", onClick: () => handleOpen(navigate) },
                        { label: "Open Folder", onClick: () => handleOpenFolder(navigate) },
                        { label: "Open Mask Folder", onClick: () => handleOpenMaskFolder(navigate) },
                        { label: "Create Mask", onClick: handleCreateMask },
                        { label: "Revert", onClick: handleRevert },
                        { label: "Close", onClick: handleClose },
                        { label: "Close All", onClick: handleCloseAll },
                        { label: "Save", onClick: handleSave },
                        { label: "Save All", onClick: handleSaveAll },
                        { label: "Quit", onClick: () => handleQuit(navigate) }
                    ]}
                />

                <DropdownMenu
                    label="Edit"
                    items={[
                        { label: "Undo", onClick: handleUndo },
                        { label: "Cut", onClick: handleCut },
                        { label: "Clear", onClick: handleClear },
                        { label: "Clear Outside", onClick: handleClearOutside },
                        { label: "Fill", onClick: handleFill },
                        { label: "Draw", onClick: handleDraw },
                        { label: "Invert", onClick: handleInvert },
                        {
                            label: "Selection", subItems: [
                                { label: "Select All", onClick: handleSelectionAll },
                                { label: "Select None", onClick: handleSelectionNone },
                                { label: "Restore Selection", onClick: handleRestoreSelection },
                                { label: "Fit Circle", onClick: handleFitCircle },
                                { label: "Fit Rectangle", onClick: handleFitRectangle },
                                { label: "Properties...", onClick: handleProperties },
                                { label: "Scale...", onClick: handleScale },
                                { label: "Rotate...", onClick: handleRotate },
                                { label: "Translate..." }
                            ]
                        }
                    ]}
                />

                <DropdownMenu
                    label="Image"
                    items={[
                        {
                            label: "Type", subItems: [
                                { label: "8-bit", onClick: () => handleConvertBitDepth(8, currentDepth) },
                                { label: "16-bit", onClick: () => handleConvertBitDepth(16, currentDepth) },
                                { label: "32-bit", onClick: () => handleConvertBitDepth(32, currentDepth) },
                                { label: "RGB Color", onClick: () => handleConvertBitDepth(24, currentDepth, true) },
                            ]
                        },
                        { label: "Color" },
                        // { label: "Show Info..." },
                        // { label: "Duplicate..." },
                        // { label: "Rename" },
                        {
                            label: "Zoom", subItems: [
                                { label: "In (+)", onClick: handleZoomIn },
                                { label: "Out (-)", onClick: handleZoomOut },
                                // { label: "To Selection" },
                                { label: "Scale to Fit", onClick: handleScaleToFit }
                            ]
                        },
                        {
                            label: "Transform", subItems: [
                                { label: "Flip Horizontal", onClick: handleFlipHorizontal },
                                { label: "Flip Vertical", onClick: handleFlipVertical },
                                { label: "Rotate 90° Left", onClick: handleRotateLeft90 },
                                { label: "Rotate 90° Right", onClick: handleRotateRight90 }
                            ]
                        },
                        {
                            label: "Adjust", subItems: [
                                { label: "Brightness/Contrast...", onClick: handleOpenBrightnessContrast },
                                { label: "Size", onClick: handleOpenImageSize },
                                { label: "Color Balance..." },
                                { label: "Threshold..." }
                            ]
                        }
                    ]}
                />

                <DropdownMenu
                    label="Analyze"
                    items={[
                        { label: "Measurements..." },
                        { label: "Label" },
                        { label: "Clear Results" },
                        { label: "Set Measurements..." },
                        { label: "Set Scale..." },
                    ]}
                />

                <DropdownMenu
                    label="Process"
                    items={[
                        { label: "Smooth", onClick: () => dispatchProcessEvent('smooth') },
                        { label: "Sharpen", onClick: () => dispatchProcessEvent('sharpen') },
                        { label: "Find Edges", onClick: () => dispatchProcessEvent('find-edges') },
                        // { label: "Enhance Contrast..." },
                        // { label: "Subtract Background..." },
                        // { label: "Filters" },
                        {
                            label: "Binary", subItems: [
                                { label: "Make Binary", onClick: () => dispatchProcessEvent('make-binary') },
                                { label: "Convert to Mask", onClick: () => dispatchProcessEvent('convert-to-mask') },
                                { label: "Erode", onClick: () => dispatchProcessEvent('erode') },
                                { label: "Dilate", onClick: () => dispatchProcessEvent('dilate') },
                                { label: "Open", onClick: () => dispatchProcessEvent('open') },
                                { label: "Close", onClick: () => dispatchProcessEvent('close') },
                                { label: "Watershed", onClick: () => dispatchProcessEvent('watershed') }
                            ]
                        }
                    ]}
                />

                <DropdownMenu
                    label="Tool"
                    items={[
                        { label: "Segmentation", onClick: handleSegmentation },
                        { label: "Tracking", onClick: handleTracking },
                        { label: "Extract Features", onClick: handleExtractFeatures },
                        { label: "Show Features", onClick: handleShowFeatures },
                        { label: "Clustering", onClick: handleClustering }
                    ]}
                />
            </ul>

            <div className="divider"></div>

            <div id="navbar-right">
                <div className="navbar-menu-item" onClick={handleShowAnalysis}>
                    <BarChart3 className="menu-icon" />
                    <span>Result</span>
                </div>

                <div className="navbar-menu-item">
                    <Search className="menu-icon" />
                    <span>Article</span>
                </div>
            </div>
        </div>

    );
}
export default NavBar;