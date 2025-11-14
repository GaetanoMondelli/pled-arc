"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2.5 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex flex-wrap justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2">
            {/* <img src="/wlogo-white.png" alt="PLED" className="w-6 h-6 object-contain" /> */}
            <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">PLED</span>
          </Link>
        </div>
        <div className="flex items-center lg:order-2 gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="font-medium">
              Playground
            </Button>
          </Link>
          <Link href="/template-editor">
            <Button variant="ghost" size="sm" className="font-medium">
              Template Editor
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
