import { BarChart3, Microscope, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { handleCut } from "../../utils/nav-bar/editUtils";
import {
    handleClose,
    handleCloseAll,
    handleNewWindow,
    handleOpen,
    handleOpenFolder,
    handleOpenMaskFolder,
    handleOpenNext,
    handleOpenRecent,
    handleQuit,
    handleSave,
} from "../../utils/nav-bar/fileUtils";
import {
    handleConvertTo16Bit,
    handleConvertTo32BitFloat,
    handleConvertTo8Bit,
    handleConvertToRGBColor,
    handleScaleToFit,
    handleZoomIn,
    handleZoomOut,
    handleZoomToSelection,
} from "../../utils/nav-bar/imageUtils";
import DropdownMenu from "../dropdown-menu/DropdownMenu";
import "./NavBar.css";

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
                        { label: "New Window", onClick: () => handleNewWindow() },
                        { label: "Open", onClick: () => handleOpen(navigate) },
                        { label: "Open Next", onClick: () => handleOpenNext(navigate) },
                        { label: "Open Recent", onClick: handleOpenRecent },
                        { label: "Open Folder", onClick: () => handleOpenFolder(navigate) },
                        { label: "Close", onClick: () => handleClose() },
                        { label: "Close All", onClick: () => handleCloseAll(navigate) },
                        { label: "Save", onClick: handleSave },
                        { label: "Open Mask Folder", onClick: () => handleOpenMaskFolder(navigate) },
                        { label: "Quit", onClick: () => handleQuit(navigate) }
                    ]}
                />

                <DropdownMenu
                    label="Edit"
                    items={[
                        { label: "Undo" },
                        { label: "Cut", onClick: () => handleCut() },
                        { label: "Clear" },
                        { label: "Clear Outside" },
                        { label: "Fill" },
                        { label: "Draw" },
                        { label: "Invert" },
                        {
                            label: "Selection", subItems: [
                                { label: "Select All" },
                                { label: "Select None" },
                                { label: "Restore Selection" },
                                { label: "Fit Circle" },
                                { label: "Fit Rectangle" },
                                { label: "Properties..." },
                                { label: "Scale..." },
                                { label: "Rotate..." },
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
                                { label: "8-bit", onClick: handleConvertTo8Bit },
                                { label: "16-bit", onClick: handleConvertTo16Bit },
                                { label: "32-bit Float", onClick: handleConvertTo32BitFloat },
                                { label: "RGB Color", onClick: handleConvertToRGBColor }
                            ]
                        },
                        {
                            label: "Color", subItems: [
                                { label: "Make Composite" },
                                { label: "Split Channels" },
                                { label: "Merge Channels" },
                                { label: "Channels Tool" }
                            ]
                        },
                        { label: "Show Info..." },
                        { label: "Duplicate..." },
                        { label: "Rename" },
                        {
                            label: "Zoom", subItems: [
                                { label: "In (+)", onClick: handleZoomIn },
                                { label: "Out (-)", onClick: handleZoomOut },
                                { label: "To Selection", onClick: handleZoomToSelection },
                                { label: "Scale to Fit", onClick: handleScaleToFit }
                            ]
                        },
                        {
                            label: "Transform", subItems: [
                                { label: "Flip" },
                                { label: "Rotate" }
                            ]
                        },
                        {
                            label: "Adjust", subItems: [
                                { label: "Size" },
                                { label: "Brightness/Contrast..." },
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
                    items={[{ label: "Smooth" },
                    { label: "Sharpen" },
                    { label: "Enhance Contrast..." },
                    { label: "Subtract Background..." },
                    { label: "Filters" },
                    {
                        label: "Binary", subItems: [
                            { label: "Make Binary" },
                            { label: "Erode" },
                            { label: "Dilate" },
                            { label: "Watershed" }
                        ]
                    }
                    ]}
                />
            </ul>

            <div className="divider"></div>

            <div className="navbar-menu-item">
                <BarChart3 className="menu-icon" ></BarChart3>
                <a href="#">Result</a>
            </div>

            <div className="navbar-menu-item">
                <Search className="menu-icon"></Search>
                <a href="#">Article</a>
            </div>

        </div>

    );
}
export default NavBar;