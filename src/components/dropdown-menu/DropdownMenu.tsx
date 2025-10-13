import './DropdownMenu.css';

type DropdownMenuProps = {
    label: string;           
    items?: string[];         
}

const DropdownMenu = ({ label, items = [] }: DropdownMenuProps) => {
    return (
        <li className="dropdown">
          <a href="#">{label}</a>
          {items && items.length > 0 && (
            <ul className="dropdown-menu">
              {items.map((item, index) => (
                <li key={index}>
                  <a href="#">{item}</a>
                </li>
              ))}
            </ul>
          )}
        </li>
    );
}
export default DropdownMenu;