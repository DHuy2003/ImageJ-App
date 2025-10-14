import './DropdownMenu.css';
import { ChevronRight } from "lucide-react";

type MenuItem = string | {
    label: string;
    subItems?: MenuItem[];
};

type DropdownMenuProps = {
    label?: string; 
    items?: MenuItem[];
};

const DropdownList = ({ items }: { items: MenuItem[] }) => (
    <ul className="dropdown-menu">
        {items.map((item, index) => (
            <li key={index} className={typeof item !== 'string' && item.subItems ? 'submenu' : ''}>
                {typeof item === 'string' ? (
                    <a href="#">{item}</a>
                ) : (
                    <>
                        <a href="#">
                            {item.label}
                            {item.subItems && item.subItems.length > 0 && <ChevronRight size={16} className="dropdown-arrow" />}
                        </a>
                        {item.subItems && item.subItems.length > 0 && <DropdownList items={item.subItems} />}
                    </>
                )}
            </li>
        ))}
    </ul>
);

const DropdownMenu = ({ label, items = [] }: DropdownMenuProps) => {
    if (!label) {
        return <DropdownList items={items} />;
    }

    return (
        <li className="dropdown">
          <a href="#">{label}</a>
          {items && items.length > 0 && <DropdownList items={items} />}
        </li>
    );
}
export default DropdownMenu;