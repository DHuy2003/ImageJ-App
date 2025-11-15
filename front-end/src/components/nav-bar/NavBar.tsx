import {BarChart3, Microscope, Search } from "lucide-react";
import DropdownMenu from "../dropdown-menu/DropdownMenu";
import { useNavigate } from "react-router-dom";
import "./NavBar.css";
import { 
    handleNewWindow, 
    handleOpen, 
    handleOpenNext, 
    handleOpenRecent, 
    handleOpenFolder, 
    handleClose, 
    handleCloseAll, 
    handleSave, 
    handleOpenMaskFolder,  
    handleQuit, 
} from "../../utils/nav-bar/fileUtils";
import { 
    handleCut, 
    handleClear,
    handleClearOutside,
    handleFill,
    handleSelectionAll,
    handleSelectionNone,
} from "../../utils/nav-bar/editUtils";

const NavBar = () => {
    const navigate = useNavigate();
    return(
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
                        {label: "New Window", onClick: () => handleNewWindow()},
                        {label: "Open", onClick: () => handleOpen(navigate)},
                        {label: "Open Next", onClick: () => handleOpenNext(navigate)},
                        {label: "Open Recent", onClick: handleOpenRecent},
                        {label: "Open Folder", onClick: () => handleOpenFolder(navigate)},
                        {label: "Open Mask Folder", onClick: () => handleOpenMaskFolder(navigate)},
                        {label: "Close", onClick: () => handleClose(navigate)},
                        {label: "Close All", onClick: () => handleCloseAll(navigate)},
                        {label: "Save", onClick: handleSave},
                        {label: "Quit", onClick: () => handleQuit(navigate)}
                    ]}
                />

                <DropdownMenu 
                    label="Edit" 
                    items={[
                        {label: "Undo"},
                        {label: "Cut", onClick: () => handleCut()},
                        {label: "Clear", onClick: () => handleClear()},
                        {label: "Clear Outside", onClick: () => handleClearOutside()},
                        {label: "Fill", onClick: () => handleFill()},
                        {label: "Draw"},
                        {label: "Invert"},
                        {label: "Selection", subItems: [
                            {label: "Select All", onClick: () => handleSelectionAll()},
                            {label: "Select None", onClick: () => handleSelectionNone()},
                            {label: "Restore Selection"},
                            {label: "Fit Circle"},
                            {label: "Fit Rectangle"},
                            {label: "Properties..."},
                            {label: "Scale..."},
                            {label: "Rotate..."},
                            {label: "Translate..."}
                        ]}
                    ]}
                />

                <DropdownMenu 
                    label="Image" 
                    items={[
                        {label: "Type"},
                        {label: "Color"},
                        {label: "Show Info..."},
                        {label: "Duplicate..."},
                        {label: "Rename"}, 
                        {label: "Zoom", subItems: [
                            {label: "In (+)"},
                            {label: "Out (-)"},
                            {label: "To Selection"},
                            {label: "Scale to Fit"}
                        ]},
                        {label: "Transform", subItems: [
                            {label: "Flip"},
                            {label: "Rotate"}
                        ]}, 
                        {label: "Adjust", subItems: [
                            {label: "Size"},
                            {label: "Brightness/Contrast..."},
                            {label: "Color Balance..."},
                            {label: "Threshold..."}
                        ]}
                    ]}
                />

                <DropdownMenu 
                    label="Analyze" 
                    items={[
                        {label: "Measurements..."},
                        {label: "Label"},
                        {label: "Clear Results"},
                        {label: "Set Measurements..."},
                        {label: "Set Scale..."},
                    ]}
                />

                <DropdownMenu 
                    label="Process" 
                    items={[{label: "Smooth"},
                        {label: "Sharpen"},
                        {label: "Enhance Contrast..."},
                        {label: "Subtract Background..."},
                        {label: "Filters"}, 
                        {label: "Binary", subItems: [
                            {label: "Make Binary"},
                            {label: "Erode"},
                            {label: "Dilate"},
                            {label: "Watershed"}
                        ]}
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