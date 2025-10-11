import { BarChart, BarChart3, Microscope, Search } from "lucide-react";
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
                    {/* <ul id="dropdown-menu">
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
                    </ul> */}
                </li>

                <li><a href="#">Edit</a></li>
                <li><a href="#">Image</a></li>
                <li><a href="#">Analyze</a></li>
                <li><a href="#">Process</a></li>
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