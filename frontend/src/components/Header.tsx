"use client";

import Link from 'next/link';
import Image from 'next/image';
import React from 'react';
import { usePathname } from 'next/navigation';

const Header = () => {
    const pathname = usePathname();

    return (
        <header role="banner" className="bg-white p-4 shadow-md flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
                <Image src="/logo.png" alt="eCFR Logo" className="h-12 w-12" width={64} height={64} />
                <h1 className="text-2xl font-bold text-primary">Federal Regulation Analysis Tool</h1>
            </Link>
            
            <nav className="flex items-center space-x-2">
                <Link href="/explorer" className={`px-4 py-2 rounded-md font-semibold transition-colors ${pathname === '/explorer' ? 'nav-active' : 'text-gray-600 hover:bg-gray-100'}`}>Explorer</Link>
                <Link href="/analytics" className={`px-4 py-2 rounded-md font-semibold transition-colors ${pathname === '/analytics' ? 'nav-active' : 'text-gray-600 hover:bg-gray-100'}`}>Analytics</Link>
            </nav>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 bg-accent text-primary font-bold p-2 rounded-md">Skip to Main Content</a>
        </header>
    );
};

export default Header;
