import { options } from "@/app/api/configAuth";
import NextAuth from "next-auth";

const authhandler = NextAuth(options);

export { authhandler as GET, authhandler as POST };