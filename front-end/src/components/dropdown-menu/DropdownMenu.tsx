import { ChevronRight } from "lucide-react";
import './DropdownMenu.css';

type MenuItem = {
    label: string;
    subItems?: MenuItem[];
    onClick?: () => void;
};

type DropdownMenuProps = {
    label: string;
    items: MenuItem[];
};

const DropdownList = ({ items }: { items: MenuItem[] }) => {
    return (
        <ul className="dropdown-menu">
            {items.map((item, index) => (
                <li key={index} className={item.subItems && item.subItems.length > 0 ? 'submenu' : ''}>
                    <a href="#" onClick={(e) => {
                        e.preventDefault();
                        if (!item.subItems && item.onClick) {
                            item.onClick();
                        }
                    }}>
                        {item.label}
                        {item.subItems && item.subItems.length > 0 && <ChevronRight className="dropdown-arrow" />}
                    </a>

                    {item.subItems && item.subItems.length > 0 && (
                        <DropdownList
                            items={item.subItems.map(subItem => ({
                                ...subItem,
                                onClick: subItem.onClick || (() => { })
                            }))}
                        />
                    )}
                </li>
            ))}
        </ul>
    );
}

const DropdownMenu = ({ label, items }: DropdownMenuProps) => {
    return (
        <li className="dropdown">
            <a href="#">{label}</a>
            <DropdownList items={items} />
        </li>
    );
}
export default DropdownMenu;