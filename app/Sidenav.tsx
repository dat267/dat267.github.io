import React from "react";
import Link from "next/link";

interface SidenavProps {
  isOpen: boolean;
  links: {
    label: string;
    href: string;
  }[];
  toggleSidenav: () => void;
}

const Sidenav: React.FC<SidenavProps> = ({ isOpen, links, toggleSidenav }) => {
  const handleLinkClick = () => {
    toggleSidenav();
  };

  return (
    <div
      className={
        "mt-12 fixed top-0 left-0 w-full h-full bg-opacity-75 bg-black text-white " +
        (isOpen ? "" : "hidden")
      }
    >
      <ul className="p-8">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href}>
              <div
                className="block py-2 px-4 hover:bg-gray-800 transition-colors duration-300 ease-in-out cursor-pointer"
                onClick={handleLinkClick}
              >
                {link.label}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidenav;
