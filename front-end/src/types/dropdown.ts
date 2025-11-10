export type MenuItem = {
    label: string;
    subItems?: MenuItem[];
    onClick?: () => void;
};

export type DropdownMenuProps = {
    label: string; 
    items: MenuItem[];
};