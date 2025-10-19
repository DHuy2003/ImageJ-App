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
                    items={[
                        {label: "New", onClick: () => {console.log("New Clicked")}},
                        {label: "Open", onClick: () => {console.log("Open Clicked")}},
                        {label: "Open Next", onClick: () => {console.log("Open Next Clicked")}},
                        {label: "Open Recent", onClick: () => {console.log("Open Recent Clicked")}},
                        {label: "Open Folder", onClick: () => {console.log("Open Folder Clicked")}},
                        {label: "Close", onClick: () => {console.log("Close Clicked")}},
                        {label: "Close All", onClick: () => {console.log("Close All Clicked")}},
                        {label: "Save", onClick: () => {console.log("Save Clicked")}},
                        {label: "Revert", onClick: () => {console.log("Revert Clicked")}},
                        {label: "Page Setup", onClick: () => {console.log("Page Setup Clicked")}},
                        {label: "Quit", onClick: () => {console.log("Quit Clicked")}}
                    ]}
                />

                <DropdownMenu 
                    label="Edit" 
                    items={[
                        {label: "Undo"},
                        {label: "Cut"},
                        {label: "Clear"},
                        {label: "Clear Outside"},
                        {label: "Fill"},
                        {label: "Draw"},
                        {label: "Invert"},
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