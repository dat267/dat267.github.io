"use client";
import React, { useState } from "react";
import Topnav from "./Topnav";
import Sidenav from "./Sidenav";

const Nav: React.FC = () => {
  const [isSidenavOpen, setSidenavOpen] = useState(false);

  const toggleSidenav = () => {
    setSidenavOpen(!isSidenavOpen);
  };

  const links = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    // Add more links as needed
  ];

  return (
    <div>
      <Topnav brandText="Dat" isSidenavOpen={isSidenavOpen} toggleSidenav={toggleSidenav} />
      <Sidenav isOpen={isSidenavOpen} links={links} toggleSidenav={toggleSidenav} />
      {/* Your other content goes here */}
    </div>
  );
};

export default Nav;