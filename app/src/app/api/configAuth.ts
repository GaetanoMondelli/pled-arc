import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const allowedUsernamesPasswordsArray: readonly [string, string | undefined][] = [
  ["devpost", process.env.AUTH_DEVPOST_PASSWORD],
  ["docusign", process.env.AUTH_DOCUSIGN_PASSWORD],
  ["gmondelli", process.env.AUTH_GMONDELLI_PASSWORD],
];

const allowedUsernamesPasswords = new Map<string, any>(allowedUsernamesPasswordsArray);

const options: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing username or password");
        }

        const password = allowedUsernamesPasswords.get(credentials.username);
        if (!password || password !== credentials.password) {
          throw new Error("Invalid username or password");
        }

        return {
          id: credentials.username,
          name: credentials.username,
          email: `${credentials.username}@example.com`,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string; // Type assertion to allow 'id' property
      }
      return session;
    },
  },
};
export { options, allowedUsernamesPasswords };