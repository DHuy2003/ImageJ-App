import {BarChart3, Microscope, Search } from "lucide-react";
import DropdownMenu from "../dropdown-menu/DropdownMenu";
import "./NavBar.css";

const NavBar = () => {
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
                    items={["New", "Open", "Open Next", "Open Recent", "Open Folder", "Close", 
                        "Close All", "Save", "Revert", "Page Setup", "Quit"
                    ]}
                />

                <DropdownMenu 
                    label="Edit" 
                    items={["Undo", "Cut", "Clear", "Clear Outside", "Fill", "Draw", "Invert",
                        {label: "Selection", subItems: [
                            {label: "Select All"},
                            {label: "Select None"},
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
                    items={["Type", "Color", "Show Info...", "Duplicate...", "Rename", 
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
                    items={["Measure", "Lable", "Clear Results", "Set Measurements...", "Set Scale..."]}
                />

                <DropdownMenu 
                    label="Process" 
                    items={["Smooth", "Sharpen", "Enhance Contrast...", "Subtract Background...", "Filters", 
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