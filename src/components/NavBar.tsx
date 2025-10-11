import {BarChart3, Microscope, Search } from "lucide-react";
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
                <li>
                    <a href="#">File</a>
                    <ul className="dropdown-menu">
                        <li><a href="">New</a></li>
                        <li><a href="">Open</a></li>
                        <li><a href="">Open Next</a></li>
                        <li><a href="">Open Recent</a></li>
                        <li><a href="">Open Folder</a></li>
                        <li><a href="">Close</a></li>
                        <li><a href="">Close All</a></li>
                        <li><a href="">Save</a></li>
                        <li><a href="">Revert</a></li>
                        <li><a href="">Page Setup</a></li>
                        <li><a href="">Quit</a></li>
                    </ul>
                </li>

                <li>
                    <a href="#">Edit</a>
                    <ul className="dropdown-menu">
                        <li><a href="">Undo</a></li>
                        <li><a href="">Cut</a></li>
                        <li><a href="">Clear</a></li>
                        <li><a href="">Clear Outside</a></li>
                        <li><a href="">Fill</a></li>
                        <li><a href="">Draw</a></li>
                        <li><a href="">Invert</a></li>
                        <li><a href="">Selection</a></li>
                    </ul>
                </li>

                <li>
                    <a href="#">Image</a>
                    <ul className="dropdown-menu">
                        <li><a href="">Color</a></li>
                        <li><a href="">Type</a></li>
                        <li><a href="">Zoom</a></li>
                        <li><a href="">Show Info...</a></li>
                        <li><a href="">Duplicate...</a></li>
                        <li><a href="">Rename</a></li>
                        <li><a href="">Tranform</a></li>
                        <li><a href="">Adjust</a></li>
                    </ul>
                </li>
                <li>
                    <a href="#">Analyze</a>
                    <ul className="dropdown-menu">
                        <li><a href="">Measure</a></li>
                        <li><a href="">Lable</a></li>
                        <li><a href="">Clear Results</a></li>
                        <li><a href="">Set Measurements...</a></li>
                        <li><a href="">Set Scale...</a></li>
                    </ul>
                </li>

                <li>
                    <a href="#">Process</a>
                    <ul className="dropdown-menu">
                        <li><a href="">Smooth</a></li>
                        <li><a href="">Sharpen</a></li>
                        <li><a href="">Enhance Contrast...</a></li>
                        <li><a href="">Subtract Background...</a></li>
                        <li><a href="">Filters</a></li>
                        <li><a href="">Binary</a></li>
                    </ul>
                </li>
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