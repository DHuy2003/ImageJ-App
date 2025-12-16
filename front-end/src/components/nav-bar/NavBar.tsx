import { BarChart3, Microscope, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DropdownMenu from "../dropdown-menu/DropdownMenu";
import "./NavBar.css";
import {
    handleNewFile,
    handleOpenFolder,
    handleOpenMaskFolder,
    handleCreateMask,
    handleVirtualSequence,
    handleRevert,
    handleClose,
    handleCloseAll,
    handleSave,
    handleSaveAll,
    handleExportAll,
    handleQuit
} from "../../utils/nav-bar/fileUtils";
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
    handleConvertBitDepth,
    handleFlipHorizontal,
    handleFlipVertical,
    handleOpenBrightnessContrast,
    handleOpenColorBalance,
    handleOpenImageSize,
    handleOpenThreshold,
    handleRotateLeft90,
    handleRotateRight90,
    handleScaleToFit,
    handleZoomIn,
    handleZoomOut
} from "../../utils/nav-bar/imageUtils";
import {
    handleClustering,
    handleExtractFeatures,
    handleSegmentation,
    handleShowAnalysis,
    handleShowFeatures,
    handleTracking,
} from "../../utils/nav-bar/toolUtils";
import "./NavBar.css";

import type { FilterType } from "../image-view/dialogs/filters/FiltersDialog";
import { dispatchFilterDialogEvent } from "../image-view/hooks/useFilterEvents";

const dispatchProcessEvent = (action: string) => {
    window.dispatchEvent(new CustomEvent('process-image', { detail: { action } }));
};

const handleOpenFilterDialog = (filterType: FilterType) => {
    dispatchFilterDialogEvent(filterType);
};

const handleOpenSubtractBackground = () => {
    window.dispatchEvent(new Event('openSubtractBackground'));
};

const handleToggleArticleSearch = () => {
    window.dispatchEvent(new CustomEvent('toggle-article-search'));
};

const NavBar = () => {
    const navigate = useNavigate();
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
                        { label: "New file", onClick: () => handleNewFile(navigate) },
                        { label: "Open Folder", onClick: () => handleOpenFolder(navigate) },
                        { label: "Open Mask Folder", onClick: () => handleOpenMaskFolder(navigate) },
                        { label: "Virtual Sequence...", onClick: handleVirtualSequence },
                        { label: "Create Mask", onClick: handleCreateMask },
                        { label: "Revert", onClick: handleRevert },
                        { label: "Close", onClick: handleClose },
                        { label: "Close All", onClick: handleCloseAll },
                        { label: "Save", onClick: handleSave },
                        { label: "Save All", onClick: handleSaveAll },
                        { label: "Export...", onClick: handleExportAll },
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
                            ]
                        }
                    ]}
                />

                <DropdownMenu
                    label="Image"
                    items={[
                        {
                            label: "Type", subItems: [
                                { label: "8-bit", onClick: () => handleConvertBitDepth(8, 0) },
                                { label: "16-bit", onClick: () => handleConvertBitDepth(16, 0) },
                                { label: "32-bit", onClick: () => handleConvertBitDepth(32, 0) },
                                { label: "RGB Color", onClick: () => handleConvertBitDepth(24, 0, true) },
                            ]
                        },
                        {
                            label: "Zoom", subItems: [
                                { label: "In (+)", onClick: handleZoomIn },
                                { label: "Out (-)", onClick: handleZoomOut },
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
                                { label: "Color Balance...", onClick: handleOpenColorBalance },
                                { label: "Threshold...", onClick: handleOpenThreshold }
                            ]
                        }
                    ]}
                />

                <DropdownMenu
                    label="Process"
                    items={[
                        { label: "Smooth", onClick: () => dispatchProcessEvent('smooth') },
                        { label: "Sharpen", onClick: () => dispatchProcessEvent('sharpen') },
                        { label: "Find Edges", onClick: () => dispatchProcessEvent('find-edges') },
                        { label: "Enhance Contrast..." },
                        { label: "Subtract Background...", onClick: handleOpenSubtractBackground },
                        {
                            label: "Filters", subItems: [
                                { label: "Convolve...", onClick: () => handleOpenFilterDialog('convolve') },
                                { label: "Gaussian Blur...", onClick: () => handleOpenFilterDialog('gaussian-blur') },
                                { label: "Median...", onClick: () => handleOpenFilterDialog('median') },
                                { label: "Mean...", onClick: () => handleOpenFilterDialog('mean') },
                                { label: "Minimum...", onClick: () => handleOpenFilterDialog('minimum') },
                                { label: "Maximum...", onClick: () => handleOpenFilterDialog('maximum') },
                                { label: "Unsharp Mask...", onClick: () => handleOpenFilterDialog('unsharp-mask') },
                                { label: "Variance...", onClick: () => handleOpenFilterDialog('variance') },
                                { label: "Show Circular Masks", onClick: () => handleOpenFilterDialog('circular-masks') }
                            ]
                        },
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
                        },
                        {
                            label: "Noise", subItems: [
                                { label: "Add Noise", onClick: () => dispatchProcessEvent('add-noise') },
                                { label: "Add Specified Noise...", onClick: () => dispatchProcessEvent('add-specified-noise') },
                                { label: "Salt and Pepper", onClick: () => dispatchProcessEvent('salt-and-pepper') },
                                { label: "Despeckle", onClick: () => dispatchProcessEvent('despeckle') },
                                { label: "Remove Outliers", onClick: () => dispatchProcessEvent('remove-outliers') },
                                { label: "Remove NaNs", onClick: () => dispatchProcessEvent('remove-nans') },
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

                <div className="navbar-menu-item" onClick={handleToggleArticleSearch}>
                    <Search className="menu-icon" />
                    <span>Article</span>
                </div>
            </div>
        </div>

    );
}
export default NavBar;