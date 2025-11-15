"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2.5 dark:bg-gray-800 dark:border-gray-700">
      <div className="flex flex-wrap justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <img src="/wlogo.png" alt="PLED" className="w-6 h-6 object-contain" />
            <span className="self-center text-2xl font-semibold whitespace-nowrap dark:text-white">PLED</span>
          </Link>
        </div>
        <div className="flex items-center lg:order-2 gap-2">
          {status === "authenticated" ? (
            <>
              <Link href="/template-editor">
                <Button variant="ghost" size="sm" className="font-medium">
                  Template Editor
                </Button>
              </Link>
              <Link href="/registry">
                <Button variant="ghost" size="sm" className="font-medium">
                  Registry
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                {session?.user?.name || session?.user?.email || "User"}
              </Button>
              <button className="btn btn-sm btn-error ml-2" onClick={() => signOut({ callbackUrl: "/" })}>
                Logout
              </button>
            </>
          ) : (
            <Link href="/auth/signin">
              <Button size="sm" className="font-medium">Log in</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
