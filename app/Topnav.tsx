import React from "react";

interface TopnavProps {
  brandText: string;
  isSidenavOpen: boolean;
  toggleSidenav: () => void;
}

const Topnav: React.FC<TopnavProps> = ({ brandText, isSidenavOpen, toggleSidenav }) => {
  return (
    <nav className="bg-gray-800 h-12 text-white px-4 py-2 flex justify-between items-center">
      <div className="text-xl font-bold">{brandText}</div>
      <div>
        <button
          className="text-white focus:outline-none"
          onClick={toggleSidenav}
        >
          {isSidenavOpen ? "✕" : "☰"}
        </button>
      </div>
    </nav>
  );
};

export default Topnav;
