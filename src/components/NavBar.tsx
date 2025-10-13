import {BarChart3, Microscope, Search } from "lucide-react";
import DropdownMenu from "./DropdownMenu";
import "../styles/NavBar.css";

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
                    items={["New", "Open", "Open Next", "Open Recent", "Open Folder", "Close", "Close All", "Save", "Revert", "Page Setup", "Quit"]}
                />

                <DropdownMenu 
                    label="Edit" 
                    items={["Undo", "Cut", "Clear", "Clear Outside", "Fill", "Draw", "Invert", "Selection"]}
                />

                <DropdownMenu 
                    label="Image" 
                    items={["Color", "Type", "Zoom", "Show Info...", "Duplicate...", "Rename", "Tranform", "Adjust"]}
                />
                <DropdownMenu 
                    label="Analyze" 
                    items={["Measure", "Lable", "Clear Results", "Set Measurements...", "Set Scale..."]}
                />

                <DropdownMenu 
                    label="Process" 
                    items={["Smooth", "Sharpen", "Enhance Contrast...", "Subtract Background...", "Filters", "Binary"]}
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