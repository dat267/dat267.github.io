import React from "react";
import Link from "next/link";

interface NavbarProps {
  brandText: string;
  links: {
    label: string;
    href: string;
  }[];
}

const Navbar: React.FC<NavbarProps> = ({ brandText, links }) => {
  return (
    <nav className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
      <Link href="/" className="text-xl font-bold">
        {brandText}
      </Link>
      <ul className="flex space-x-4">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="hover:text-gray-300">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
